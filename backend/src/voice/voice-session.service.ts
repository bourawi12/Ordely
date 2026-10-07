import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { LlmService, OrderContext } from './llm.service';
import { TtsService } from './tts.service';
import {
  AgentAnalysis,
  ConversationMessage,
  VoiceSessionStatus,
} from './voice.interfaces';

/** In-memory store of active voice sessions (one per call ID).
 *  Fine for a dev prototype; replace with Redis if scaling later. */
interface ActiveSession {
  callId: number;
  orderId: number;
  boutiqueId: number;
  userId: number;
  status: VoiceSessionStatus;
  startedAt: Date;
  orderContext: OrderContext;
  history: ConversationMessage[];
  lastAnalysis?: AgentAnalysis;
}

@Injectable()
export class VoiceSessionService {
  private readonly logger = new Logger(VoiceSessionService.name);
  private readonly sessions = new Map<number, ActiveSession>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
    private readonly llmService: LlmService,
    private readonly ttsService: TtsService,
  ) {}

  /** Returns all pending orders for a boutique (for the order picker in the UI). */
  async listTestOrders(boutiqueId: number) {
    return this.prisma.order.findMany({
      where: { boutiqueId, status: 'pending' },
      include: { items: true },
      orderBy: { id: 'desc' },
      take: 50,
    });
  }

  /** Creates a Call row in INITIATED state and returns the session data. */
  async startSession(
    boutiqueId: number,
    userId: number,
    orderId: number,
  ): Promise<{ callId: number; greeting: AgentAnalysis }> {
    // Validate order ownership
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, boutiqueId },
      include: { items: true },
    });
    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }
    if (order.status !== 'pending') {
      throw new BadRequestException(
        `Order ${orderId} is already ${order.status}; only pending orders can be tested`,
      );
    }

    // Check no active session already running for this order
    for (const session of this.sessions.values()) {
      if (session.orderId === orderId && session.status === 'IN_PROGRESS') {
        throw new BadRequestException(
          `A voice session is already active for order ${orderId}`,
        );
      }
    }

    // Create a Call record (reusing existing Call table)
    const attemptCount = await this.prisma.call.count({
      where: { orderId },
    });
    const call = await this.prisma.call.create({
      data: {
        orderId,
        attempt: attemptCount + 1,
        status: 'pending', // INITIATED maps to pending in DB
      },
    });

    // Build the context that will be handed to the LLM
    const orderContext: OrderContext = {
      orderId: order.id,
      customerName: order.customer,
      phone: order.phone,
      products: order.items.map((i) => ({
        name: i.productName,
        quantity: i.quantity,
      })),
    };

    // Generate the opening greeting via LLM
    let greeting: AgentAnalysis;
    try {
      greeting = await this.llmService.generateGreeting(orderContext);
      const { audioBase64, segments } = await this.ttsService.synthesizeSpeech(greeting.agentReply);
      greeting.audioBase64 = audioBase64 || undefined;
      greeting.segments = segments;
    } catch (err) {
      // Clean up the call row if greeting fails
      await this.prisma.call.delete({ where: { id: call.id } }).catch(() => {});
      throw err;
    }

    const session: ActiveSession = {
      callId: call.id,
      orderId,
      boutiqueId,
      userId,
      status: 'IN_PROGRESS',
      startedAt: new Date(),
      orderContext,
      history: [
        {
          speaker: 'AGENT',
          text: greeting.agentReply,
          timestamp: new Date().toISOString(),
        },
      ],
      lastAnalysis: greeting,
    };

    this.sessions.set(call.id, session);
    this.logger.log(
      `Voice session started: callId=${call.id} orderId=${orderId} boutiqueId=${boutiqueId}`,
    );

    return { callId: call.id, greeting };
  }

  getSession(callId: number, boutiqueId: number): ActiveSession {
    const session = this.sessions.get(callId);
    if (!session) {
      throw new NotFoundException(`Voice session ${callId} not found`);
    }
    if (session.boutiqueId !== boutiqueId) {
      throw new ForbiddenException('Session does not belong to your boutique');
    }
    return session;
  }

  /** Processes a customer utterance; returns the agent's response. */
  async processUtterance(
    callId: number,
    boutiqueId: number,
    customerText: string,
  ): Promise<AgentAnalysis> {
    const session = this.getSession(callId, boutiqueId);

    if (session.status !== 'IN_PROGRESS') {
      throw new BadRequestException(`Session ${callId} is not IN_PROGRESS`);
    }

    // Record customer utterance
    session.history.push({
      speaker: 'CUSTOMER',
      text: customerText,
      timestamp: new Date().toISOString(),
    });

    // Send to LLM (pass history minus the last customer message, which we add separately)
    const historyWithoutLast = session.history.slice(0, -1);
    const analysis = await this.llmService.processTranscript(
      session.orderContext,
      historyWithoutLast,
      customerText,
    );

    // Synthesize speech for the reply
    const { audioBase64, segments } = await this.ttsService.synthesizeSpeech(analysis.agentReply);
    analysis.audioBase64 = audioBase64 || undefined;
    analysis.segments = segments;

    // Record agent reply
    session.history.push({
      speaker: 'AGENT',
      text: analysis.agentReply,
      timestamp: new Date().toISOString(),
    });

    session.lastAnalysis = analysis;
    return analysis;
  }

  /** Finalises the session: updates Call row and optionally the Order status. */
  async completeSession(
    callId: number,
    boutiqueId: number,
  ): Promise<{ finalAnalysis?: AgentAnalysis }> {
    const session = this.getSession(callId, boutiqueId);
    const analysis = session.lastAnalysis;

    const durationSeconds = Math.round(
      (Date.now() - session.startedAt.getTime()) / 1000,
    );

    // Map VoiceIntent → Call status
    let callStatus: 'confirmed' | 'failed' | 'no_answer' = 'failed';
    if (analysis?.intent === 'CONFIRMED') callStatus = 'confirmed';
    else if (analysis?.intent === 'CANCELLED') callStatus = 'failed';

    // Convert conversation to the DB transcript format
    const transcript = session.history.map((m) => ({
      speaker: m.speaker === 'AGENT' ? 'agent' : 'customer',
      text: m.text,
    })) as Prisma.InputJsonValue;

    // Update the Call row
    await this.prisma.call.update({
      where: { id: callId },
      data: {
        status: callStatus,
        durationSeconds,
        language: analysis?.language ?? null,
        transcript,
      },
    });

    // Update Order status only on a clear decision
    if (analysis?.intent === 'CONFIRMED') {
      await this.ordersService.update(boutiqueId, session.orderId, {
        status: 'confirmed',
      });
    } else if (analysis?.intent === 'CANCELLED') {
      await this.ordersService.update(boutiqueId, session.orderId, {
        status: 'cancelled',
      });
    }

    session.status = 'COMPLETED';
    this.sessions.delete(callId);

    this.logger.log(
      `Voice session completed: callId=${callId} intent=${analysis?.intent} orderId=${session.orderId}`,
    );

    return { finalAnalysis: analysis };
  }

  /** Force-ends a session (user clicked Stop) without making a business decision. */
  async abortSession(callId: number, boutiqueId: number): Promise<void> {
    const session = this.getSession(callId, boutiqueId);
    const durationSeconds = Math.round(
      (Date.now() - session.startedAt.getTime()) / 1000,
    );

    const transcript = session.history.map((m) => ({
      speaker: m.speaker === 'AGENT' ? 'agent' : 'customer',
      text: m.text,
    })) as Prisma.InputJsonValue;

    await this.prisma.call.update({
      where: { id: callId },
      data: {
        status: 'no_answer',
        durationSeconds,
        transcript,
      },
    });

    session.status = 'FAILED';
    this.sessions.delete(callId);
    this.logger.log(`Voice session aborted: callId=${callId}`);
  }
}
