/** Provider-agnostic interfaces for the voice layer.
 *  Swap SttService / LlmService / TtsService implementations without touching call logic. */

export interface SttResult {
  text: string;
  language?: string;
  confidence?: number;
}

/** Intent the LLM extracted from the conversation. */
export type VoiceIntent = 'CONFIRMED' | 'CANCELLED' | 'UNCLEAR';

/** Detected language. */
export type VoiceLanguage =
  | 'FRENCH'
  | 'ENGLISH'
  | 'TUNISIAN_ARABIC'
  | 'MIXED';

export type LanguageCode = 'fr' | 'en' | 'ar' | 'tn';

/** Segment for code-switched / multilingual speech synthesis. */
export interface SpeechSegment {
  text: string;
  language: LanguageCode;
}

/** Structured output validated before touching the database. */
export interface AgentAnalysis {
  intent: VoiceIntent;
  language: VoiceLanguage;
  confidence: number;
  needsFollowUp: boolean;
  /** Next sentence to speak to the customer. */
  agentReply: string;
  /** Code-switching segments for natural multilingual speech */
  segments?: SpeechSegment[];
  /** Optional pre-synthesized neural audio (base64 MP3) */
  audioBase64?: string;
}

/** One message in the conversation. */
export interface ConversationMessage {
  speaker: 'AGENT' | 'CUSTOMER';
  text: string;
  timestamp: string;
}

export type VoiceSessionStatus =
  | 'INITIATED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'FAILED';
