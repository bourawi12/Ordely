import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  VOICE_AGENT_CLIENT,
  VoiceAgentClient,
} from '../../voice/voice-agent-client.interface';
import { CallDispatcherService } from './call-dispatcher.service';
import {
  isWithinCallWindow,
  nextAttemptNumber,
} from './call-orchestration-policy';

const POLL_INTERVAL_MS = 30_000;
const POLL_BATCH_SIZE = 100;
const STALE_CALL_TIMEOUT_MS = 10 * 60_000;

@Injectable()
export class CallOrchestratorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CallOrchestratorService.name);
  private timer: NodeJS.Timeout | null = null;
  private polling = false;
  private pollRequested = false;
  private cursorId: number | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly dispatcher: CallDispatcherService,
    @Inject(VOICE_AGENT_CLIENT)
    private readonly voiceAgentClient: VoiceAgentClient,
  ) {}

  onModuleInit(): void {
    void this.pollOnce();
    this.timer = setInterval(() => void this.pollOnce(), POLL_INTERVAL_MS);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async pollOnce(): Promise<void> {
    if (this.polling) {
      this.pollRequested = true;
      return;
    }
    this.polling = true;
    try {
      const now = new Date();
      await this.expireStaleCalls(now);
      const orders = await this.prisma.order.findMany({
        where: { status: 'pending' },
        select: {
          id: true,
          boutiqueId: true,
          boutique: {
            select: { callStartTime: true, callEndTime: true },
          },
          calls: {
            orderBy: { attempt: 'asc' },
            select: {
              id: true,
              attempt: true,
              status: true,
              disposition: true,
              completedAt: true,
              dispatchedAt: true,
              taskId: true,
            },
          },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: POLL_BATCH_SIZE,
        ...(this.cursorId === undefined
          ? {}
          : { cursor: { id: this.cursorId }, skip: 1 }),
      });
      this.cursorId = orders.at(-1)?.id;
      if (orders.length < POLL_BATCH_SIZE) this.cursorId = undefined;

      for (const order of orders) {
        if (
          !isWithinCallWindow(
            order.boutique.callStartTime,
            order.boutique.callEndTime,
            now,
          )
        ) {
          continue;
        }

        const pendingCall = order.calls.find(
          (call) => call.status === 'pending',
        );
        if (pendingCall && (pendingCall.taskId || pendingCall.dispatchedAt)) {
          continue;
        }

        const attempt = pendingCall
          ? pendingCall.attempt
          : nextAttemptNumber(order.calls, now);
        if (attempt === null) continue;

        if (!(await this.voiceAgentClient.checkCapacity())) return;

        let callId = pendingCall?.id;
        if (!callId) {
          try {
            const call = await this.prisma.call.create({
              data: { orderId: order.id, attempt },
              select: { id: true },
            });
            callId = call.id;
          } catch (error) {
            if ((error as { code?: string }).code === 'P2002') continue;
            throw error;
          }
        }

        await this.dispatcher.dispatchCall(order.boutiqueId, callId);
        return;
      }
    } catch (error) {
      this.logger.error(
        `Call orchestration poll failed: ${(error as Error).message}`,
      );
    } finally {
      this.polling = false;
      if (this.pollRequested) {
        this.pollRequested = false;
        void this.pollOnce();
      }
    }
  }

  private async expireStaleCalls(now: Date): Promise<void> {
    const staleCalls = await this.prisma.call.findMany({
      where: {
        status: 'pending',
        dispatchedAt: { lt: new Date(now.getTime() - STALE_CALL_TIMEOUT_MS) },
      },
      select: { id: true, orderId: true, attempt: true },
    });

    for (const call of staleCalls) {
      const result = await this.prisma.call.updateMany({
        where: { id: call.id, status: 'pending' },
        data: {
          status: 'no_answer',
          disposition: 'no_answer',
          completedAt: now,
          failureReason: 'Voice call timed out without a result',
        },
      });
      if (result.count > 0 && call.attempt >= 3) {
        await this.prisma.order.updateMany({
          where: { id: call.orderId, status: 'pending' },
          data: { status: 'unreachable' },
        });
      }
    }
  }
}
