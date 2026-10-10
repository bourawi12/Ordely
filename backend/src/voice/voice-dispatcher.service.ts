import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { taskIdFor, withinCallHours } from './voice.rules';

const DEFAULT_INTERVAL_MS = 5_000;
const DEFAULT_TIMEOUT_MINUTES = 10;
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Hands queued calls (status "pending", not dispatched yet) to the voice agent, one at a time:
 * the Ringio agent runs a single call at once and answers 409 while busy. Respects each
 * shop's call hours. A dispatched call with no result after VOICE_CALL_TIMEOUT_MINUTES is
 * closed as "no answer" so the queue never stalls. Off unless VOICE_DISPATCH_ENABLED=true.
 */
@Injectable()
export class VoiceDispatcherService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(VoiceDispatcherService.name);
  private timer: NodeJS.Timeout | null = null;
  private busy = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  get enabled() {
    return this.config.get('VOICE_DISPATCH_ENABLED') === 'true';
  }

  onApplicationBootstrap() {
    if (!this.enabled) return;
    const interval = Number(
      this.config.get('VOICE_DISPATCH_INTERVAL_MS', DEFAULT_INTERVAL_MS),
    );
    this.logger.log(
      `Dispatching queued calls to ${this.agentUrl} every ${interval} ms`,
    );
    this.timer = setInterval(() => void this.tick(), interval);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private get agentUrl() {
    return this.config
      .get<string>('VOICE_AGENT_URL', 'http://host.docker.internal:4200')
      .replace(/\/+$/, '');
  }

  /** One pass: close stale calls, then start the oldest queued call if the agent is free. */
  async tick(
    now = new Date(),
  ): Promise<'dispatched' | 'busy' | 'idle' | 'failed'> {
    if (this.busy) return 'busy';
    this.busy = true;
    try {
      await this.expireStale(now);
      const inFlight = await this.prisma.call.count({
        where: { status: 'pending', dispatchedAt: { not: null } },
      });
      if (inFlight > 0) return 'busy';

      const queued = await this.prisma.call.findMany({
        where: {
          status: 'pending',
          dispatchedAt: null,
          order: { status: 'pending' },
        },
        orderBy: { createdAt: 'asc' },
        take: 50,
        include: { order: { include: { boutique: true, items: true } } },
      });
      const call = queued.find((c) =>
        withinCallHours(
          c.order.boutique.callStartTime,
          c.order.boutique.callEndTime,
          now,
        ),
      );
      if (!call) return 'idle';

      // Claim it first, so that two passes can never send the same call.
      const { count } = await this.prisma.call.updateMany({
        where: { id: call.id, dispatchedAt: null, status: 'pending' },
        data: { dispatchedAt: now },
      });
      if (count === 0) return 'busy';

      const { order } = call;
      const task = {
        taskId: taskIdFor(call.id),
        // Ringio routes simulated numbers to its test phones, never to real customers.
        destination:
          this.config.get<string>('VOICE_TEST_DESTINATION') || order.phone,
        availabilityPolicy: 'reject',
        attempt: call.attempt,
        order: {
          id: order.id,
          customerName: order.customer,
          items: order.items.map((i) => ({
            name: i.productName,
            quantity: i.quantity,
            unitPrice: i.unitPrice.toString(),
          })),
          total: order.total.toString(),
          currency: 'TND',
        },
        shop: {
          name: order.boutique.name ?? 'Ordely',
          languages: order.boutique.callLanguages,
        },
      };
      const sent = await this.send(task);
      if (sent === 'started') {
        this.logger.log(
          `Call ${call.id} (order ${order.id}) handed to the voice agent`,
        );
        return 'dispatched';
      }
      // Not taken: back in the queue for the next pass.
      await this.prisma.call.updateMany({
        where: { id: call.id, status: 'pending' },
        data: { dispatchedAt: null },
      });
      return sent === 'busy' ? 'busy' : 'failed';
    } catch (err) {
      this.logger.error(`Dispatch pass failed: ${(err as Error).message}`);
      return 'failed';
    } finally {
      this.busy = false;
    }
  }

  private async send(task: object): Promise<'started' | 'busy' | 'failed'> {
    try {
      const res = await fetch(`${this.agentUrl}/api/task/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.get<string>('VOICE_AGENT_TOKEN') ?? ''}`,
        },
        body: JSON.stringify(task),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (res.ok) return 'started';
      if (res.status === 409) return 'busy';
      this.logger.warn(`The voice agent refused the call (${res.status})`);
      return 'failed';
    } catch (err) {
      this.logger.warn(
        `The voice agent is unreachable: ${(err as Error).message}`,
      );
      return 'failed';
    }
  }

  /** Dispatched calls that never reported back: closed as "no answer", order left pending. */
  private async expireStale(now: Date) {
    const minutes = Number(
      this.config.get('VOICE_CALL_TIMEOUT_MINUTES', DEFAULT_TIMEOUT_MINUTES),
    );
    const { count } = await this.prisma.call.updateMany({
      where: {
        status: 'pending',
        dispatchedAt: { lt: new Date(now.getTime() - minutes * 60_000) },
      },
      data: { status: 'no_answer' },
    });
    if (count)
      this.logger.warn(`${count} voice call(s) timed out without a result`);
  }
}
