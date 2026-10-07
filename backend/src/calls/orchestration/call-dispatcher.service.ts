import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import {
  VOICE_AGENT_CLIENT,
  VoiceAgentClient,
} from '../../voice/voice-agent-client.interface';
import { VoiceCallTask } from '../../voice/voice.types';
import { isWithinCallWindow } from './call-orchestration-policy';

@Injectable()
export class CallDispatcherService {
  private readonly logger = new Logger(CallDispatcherService.name);
  private activeDispatches = 0;
  private readonly maxConcurrency = 1;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(VOICE_AGENT_CLIENT)
    private readonly voiceAgentClient: VoiceAgentClient,
  ) {}

  /**
   * Dispatches a specific pending call attempt to the external voice agent runtime.
   */
  async dispatchCall(boutiqueId: number, callId: number) {
    if (this.activeDispatches >= this.maxConcurrency) {
      throw new ConflictException(
        'An external voice agent call is already in progress. Please wait for it to complete.',
      );
    }

    this.activeDispatches++;
    try {
      const call = await this.prisma.call.findFirst({
        where: { id: callId, order: { boutiqueId } },
        include: {
          order: {
            include: {
              boutique: true,
              items: {
                select: { productName: true, quantity: true },
              },
            },
          },
        },
      });

      if (!call) {
        throw new NotFoundException(`Call ${callId} not found`);
      }

      if (call.status !== 'pending') {
        throw new ConflictException(
          `Call ${callId} is already marked as ${call.status}`,
        );
      }

      if (call.taskId && call.transportPhase === 'dispatched') {
        throw new ConflictException(
          `Call ${callId} has already been dispatched with task ${call.taskId}`,
        );
      }

      if (
        !isWithinCallWindow(
          call.order.boutique.callStartTime,
          call.order.boutique.callEndTime,
        )
      ) {
        return {
          ...call,
          deferred: true,
          deferredReason: 'outside_call_window',
        };
      }

      const taskId = randomUUID();
      const destination =
        call.order.phone?.replace(/[\s().-]/g, '') || '+21699000000';

      const preferredLanguage =
        call.language || call.order.boutique.callLanguages?.[0] || 'ar-TN';
      const boutiqueName = call.order.boutique.name ?? 'Boutique';
      const confirmationProcess =
        call.order.boutique.confirmationProcess ?? 'default';
      const instructions = [
        'Verify the order details with the customer before confirming.',
        `Boutique: ${boutiqueName}.`,
        `Confirmation process: ${confirmationProcess}.`,
      ];

      const task: VoiceCallTask = {
        taskId,
        orderlyCallId: call.id,
        boutiqueId,
        destination,
        availabilityPolicy: 'reject',
        scenario: {
          orderRef: `#${call.order.id}`,
          customer: call.order.customer,
          item: call.order.items
            .map(({ productName, quantity }) => `${productName} x${quantity}`)
            .join(', '),
          quantity: call.order.items.reduce(
            (sum, item) => sum + item.quantity,
            0,
          ),
          total: `${Number(call.order.total).toFixed(3)} TND`,
          language: preferredLanguage,
          boutique: {
            id: call.order.boutique.id,
            name: call.order.boutique.name ?? null,
            confirmationProcess: call.order.boutique.confirmationProcess ?? null,
          },
          instructions,
        },
      };

      this.logger.log(
        `Dispatching call ${callId} (task ${taskId}) to voice agent`,
      );
      let result;
      try {
        result = await this.voiceAgentClient.startTask(task);
      } catch (error) {
        result = { accepted: false, error: (error as Error).message };
      }

      if (result.deferred) {
        return {
          ...call,
          deferred: true,
          deferredReason: 'capacity_unavailable',
        };
      }

      if (result.accepted) {
        return await this.prisma.call.update({
          where: { id: call.id },
          data: {
            taskId,
            dispatchedAt: new Date(),
            transportPhase: 'dispatched',
            failureReason: null,
          },
        });
      }

      return await this.prisma.call.update({
        where: { id: call.id },
        data: {
          taskId,
          status: 'failed',
          disposition: 'error',
          completedAt: new Date(),
          transportPhase: 'rejected',
          failureReason: result.error || 'Voice agent rejected task',
        },
      });
    } finally {
      this.activeDispatches--;
    }
  }
}
