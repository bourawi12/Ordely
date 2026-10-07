import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  AgentAnalysis,
  ConversationMessage,
  SpeechSegment,
  VoiceIntent,
  VoiceLanguage,
} from './voice.interfaces';
import { segmentMultilingualText } from './language-detector';

/** Minimal order context handed to the LLM — never invented, always from DB. */
export interface OrderContext {
  orderId: number;
  customerName: string;
  phone: string;
  products: { name: string; quantity: number }[];
}

const VOICE_INTENTS: VoiceIntent[] = ['CONFIRMED', 'CANCELLED', 'UNCLEAR'];
const VOICE_LANGUAGES: VoiceLanguage[] = [
  'FRENCH',
  'ENGLISH',
  'TUNISIAN_ARABIC',
  'MIXED',
];

function buildSystemPrompt(order: OrderContext): string {
  const productList = order.products
    .map((p) => `${p.quantity}× ${p.name}`)
    .join(', ');

  return `You are an AI telephone order confirmation agent for Ordely operating in Tunisia.

Your goal is to contact customers and verify whether they confirm or cancel their existing order.

ORDER DETAILS (DO NOT INVENT, USE ONLY THESE):
- Order ID: #${order.orderId}
- Customer: ${order.customerName}
- Products: ${productList}

LANGUAGE INSTRUCTIONS:
- The default and primary language of the conversation MUST BE authentic Tunisian Arabic (Derja).
- Write Tunisian Derja in clear Arabic script (e.g., "عسلامة", "نحب نأكد الكوموند متاعك", "مريقلة", "بطلنا الكوموند").
- The customer may speak Tunisian Arabic (Derja), French, English, or mix these languages freely.
- Detect the customer's language automatically and respond in natural Tunisian Arabic or code-switched mix.

CONVERSATION RULES:
1. Greet the customer warmly in Tunisian Arabic ("عسلامة...").
2. Explain you are calling from Ordely regarding their order.
3. Present the order details clearly (${productList}).
4. Ask explicitly whether they want to confirm ("تؤكد") or cancel ("تبطل") the order.
5. If the customer clearly confirms → intent = CONFIRMED.
6. If the customer clearly refuses/cancels → intent = CANCELLED.
7. If the answer is unclear, ask a clarification question in Derja → intent = UNCLEAR.
8. NEVER assume confirmation from an ambiguous or silent response.
9. NEVER invent, modify, or add product information.
10. Keep responses concise — this is a phone call, not an essay.

IMPORTANT — YOU MUST ALWAYS RESPOND WITH VALID JSON:
{
  "intent": "CONFIRMED" | "CANCELLED" | "UNCLEAR",
  "language": "TUNISIAN_ARABIC" | "FRENCH" | "ENGLISH" | "MIXED",
  "confidence": 0.0–1.0,
  "needsFollowUp": true | false,
  "agentReply": "the exact sentence in Tunisian Derja to speak to the customer",
  "segments": [
    { "text": "exact words in this language", "language": "tn" | "fr" | "en" | "ar" }
  ]
}

Do not output anything outside this JSON object. No markdown, no explanation, only the JSON.`;
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly client: OpenAI | null = null;
  private readonly model: string;
  private readonly apiKey: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = config.get<string>('OPENAI_API_KEY', '').trim();
    if (this.apiKey) {
      this.client = new OpenAI({
        apiKey: this.apiKey,
        baseURL: config.get<string>('OPENAI_BASE_URL') || undefined,
      });
      this.logger.log('LlmService initialized with OpenAI API key');
    } else {
      this.logger.warn(
        'OPENAI_API_KEY not set. Using built-in local prototype intent engine (Tunisian Derja).',
      );
    }
    this.model = config.get<string>('OPENAI_MODEL', 'gpt-4o-mini');
  }

  async processTranscript(
    order: OrderContext,
    history: ConversationMessage[],
    newCustomerText: string,
  ): Promise<AgentAnalysis> {
    if (!this.client) {
      return this.fallbackProcessTranscript(order, newCustomerText);
    }

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: buildSystemPrompt(order) },
    ];

    for (const msg of history) {
      messages.push({
        role: msg.speaker === 'AGENT' ? 'assistant' : 'user',
        content: msg.text,
      });
    }

    messages.push({ role: 'user', content: newCustomerText });

    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages,
        temperature: 0.3,
        max_tokens: 400,
        response_format: { type: 'json_object' },
      });

      const raw = completion.choices[0]?.message?.content ?? '{}';
      return this.parseAndValidate(raw);
    } catch (err) {
      this.logger.warn(
        `OpenAI call failed (${(err as Error).message}). Falling back to local engine.`,
      );
      return this.fallbackProcessTranscript(order, newCustomerText);
    }
  }

  /** Generates the first agent greeting for a new session in Tunisian Arabic. */
  async generateGreeting(order: OrderContext): Promise<AgentAnalysis> {
    if (!this.client) {
      return this.fallbackGreeting(order);
    }

    const productList = order.products
      .map((p) => `${p.quantity}× ${p.name}`)
      .join(', ');

    const prompt = `Generate a warm, natural phone greeting in authentic Tunisian Arabic (Derja written in Arabic script) for an order confirmation call.
Order: #${order.orderId}, Customer: ${order.customerName}, Products: ${productList}.
Example tone: "عسلامة ${order.customerName} ! معاك مساعد Ordely على جال الكوموند متاعك (${productList}). تثبت معايا الكوموند متاعك ؟"
The agent has not yet heard from the customer, so intent must be UNCLEAR and needsFollowUp must be true.
Respond ONLY in this JSON format:
{"intent":"UNCLEAR","language":"TUNISIAN_ARABIC","confidence":1.0,"needsFollowUp":true,"agentReply":"<greeting in Tunisian Derja>","segments":[{"text":"<greeting>","language":"tn"}]}`;

    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        max_tokens: 200,
        response_format: { type: 'json_object' },
      });

      const raw = completion.choices[0]?.message?.content ?? '{}';
      return this.parseAndValidate(raw);
    } catch (err) {
      this.logger.warn(
        `OpenAI greeting failed (${(err as Error).message}). Falling back to local engine.`,
      );
      return this.fallbackGreeting(order);
    }
  }

  private fallbackGreeting(order: OrderContext): AgentAnalysis {
    const productList = order.products
      .map((p) => `${p.quantity}× ${p.name}`)
      .join(', ');
    const agentReply = `عسلامة ${order.customerName} ! معاك مساعد Ordely على جال الكوموند متاعك (${productList}). تثبت معايا الكوموند متاعك ؟`;
    return {
      intent: 'UNCLEAR',
      language: 'TUNISIAN_ARABIC',
      confidence: 1.0,
      needsFollowUp: true,
      agentReply,
      segments: segmentMultilingualText(agentReply),
    };
  }

  private fallbackProcessTranscript(
    order: OrderContext,
    text: string,
  ): AgentAnalysis {
    const formatAnalysis = (
      intent: VoiceIntent,
      language: VoiceLanguage,
      confidence: number,
      needsFollowUp: boolean,
      agentReply: string,
    ): AgentAnalysis => ({
      intent,
      language,
      confidence,
      needsFollowUp,
      agentReply,
      segments: segmentMultilingualText(agentReply),
    });

    const lower = text.toLowerCase().trim();

    // Tunisian Arabic / Derja affirmative
    const derjaConfirm =
      /\b(ey|aywah|aywa|behi|mriguel|mrigla|na3am|sahihe|tamem|kamel|khalas|eyh|أكد|تأكيد|مأكدة)\b/i;
    // French affirmative
    const frConfirm =
      /\b(oui|ouais|d'accord|daccord|confirme|confirmer|absolument|parfait|bien sur|c'est bon|exactement|ouep)\b/i;
    // English affirmative
    const enConfirm =
      /\b(yes|yeah|yep|confirm|confirmed|sure|okay|ok|alright)\b/i;

    // Tunisian Arabic / Derja negative
    const derjaCancel =
      /\b(le|laa|batalt|battal|batal|ma nhebech|ma nhebch|fassakh|نبطل|بطل|إلغاء)\b/i;
    // French negative
    const frCancel =
      /\b(non|pas du tout|annuler|annule|refuse|refuser|je ne veux plus|annulez)\b/i;
    // English negative
    const enCancel =
      /\b(no|nope|cancel|cancelled|refuse|decline|do not want)\b/i;

    if (derjaConfirm.test(lower)) {
      return formatAnalysis(
        'CONFIRMED',
        'TUNISIAN_ARABIC',
        0.95,
        false,
        `يعيشك يا ${order.customerName} ! الكوموند متاعك مأكدة ومريقلة. نوصلوهالك في أقرب وقت إن شاء الله.`,
      );
    }

    if (frConfirm.test(lower)) {
      return formatAnalysis(
        'CONFIRMED',
        'TUNISIAN_ARABIC',
        0.95,
        false,
        `يعيشك ${order.customerName} ! الكوموند متاعك confirmée ومريقلة. Bonne journée !`,
      );
    }

    if (enConfirm.test(lower)) {
      return formatAnalysis(
        'CONFIRMED',
        'TUNISIAN_ARABIC',
        0.95,
        false,
        `يعيشك ${order.customerName} ! Your order is confirmed. نهارك طيب !`,
      );
    }

    if (derjaCancel.test(lower)) {
      return formatAnalysis(
        'CANCELLED',
        'TUNISIAN_ARABIC',
        0.95,
        false,
        `ما فماش حتى مشكلة يا ${order.customerName}. بطلنا الكوموند متاعك. نهارك طيب !`,
      );
    }

    if (frCancel.test(lower)) {
      return formatAnalysis(
        'CANCELLED',
        'TUNISIAN_ARABIC',
        0.95,
        false,
        `C'est bien noté ${order.customerName}. بطلنا الكوموند متاعك. Bonne journée !`,
      );
    }

    if (enCancel.test(lower)) {
      return formatAnalysis(
        'CANCELLED',
        'TUNISIAN_ARABIC',
        0.95,
        false,
        `Noted ${order.customerName}. بطلنا الكوموند متاعك. Thank you !`,
      );
    }

    // Inquiries
    const isQuestion =
      lower.includes('chnowa') ||
      lower.includes('combien') ||
      lower.includes('prix') ||
      lower.includes("c'est quoi") ||
      lower.includes('quand') ||
      lower.includes('chkoun') ||
      lower.includes('repeat') ||
      lower.includes('repete') ||
      lower.includes('شنوة') ||
      lower.includes('بقداش') ||
      lower.includes('شكون');

    if (isQuestion) {
      const productList = order.products
        .map((p) => `${p.quantity}× ${p.name}`)
        .join(', ');
      return formatAnalysis(
        'UNCLEAR',
        'TUNISIAN_ARABIC',
        0.7,
        true,
        `هذي الكوموند متاعك #${order.orderId} فيها (${productList}). تحب تؤكد الكوموند متاعك وإلا تبطلها ؟`,
      );
    }

    return formatAnalysis(
      'UNCLEAR',
      'TUNISIAN_ARABIC',
      0.5,
      true,
      `سامحني، ما فهمتكش مليح. تحب تؤكد الكوموند متاعك وإلا تبطلها ؟ قولي "نأكد" وإلا "نبطل".`,
    );
  }

  private parseAndValidate(raw: string): AgentAnalysis {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      throw new Error(`LLM returned invalid JSON: ${raw.slice(0, 200)}`);
    }

    const intent = String(parsed.intent ?? 'UNCLEAR') as VoiceIntent;
    const language = String(parsed.language ?? 'TUNISIAN_ARABIC') as VoiceLanguage;
    const confidence = Number(parsed.confidence ?? 0);
    const needsFollowUp = Boolean(parsed.needsFollowUp ?? true);
    const agentReply = String(
      parsed.agentReply ?? 'سامحني، عاود قولي شنوة تحب تعمل ؟',
    );

    if (!VOICE_INTENTS.includes(intent)) {
      throw new Error(`Invalid intent from LLM: ${String(parsed.intent)}`);
    }
    if (!VOICE_LANGUAGES.includes(language)) {
      throw new Error(`Invalid language from LLM: ${String(parsed.language)}`);
    }
    if (confidence < 0 || confidence > 1) {
      throw new Error(`Invalid confidence from LLM: ${confidence}`);
    }

    let segments: SpeechSegment[] | undefined;
    if (Array.isArray(parsed.segments) && parsed.segments.length > 0) {
      segments = (parsed.segments as any[])
        .map((s) => ({
          text: String(s.text || ''),
          language: (['fr', 'en', 'ar', 'tn'].includes(String(s.language))
            ? s.language
            : 'tn') as any,
        }))
        .filter((s) => s.text.trim().length > 0);
    }
    if (!segments || segments.length === 0) {
      segments = segmentMultilingualText(agentReply);
    }

    return { intent, language, confidence, needsFollowUp, agentReply, segments };
  }
}
