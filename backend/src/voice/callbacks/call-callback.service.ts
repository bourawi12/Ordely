import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { VoiceCallEvent, VoiceCallResult } from '../voice.types';
import { decideOutcome, LANGUAGE_LABELS, LanguageCode } from '../voice.rules';
import { MAX_ATTEMPTS } from '../../calls/orchestration/call-orchestration-policy';

const DEFAULT_MIN_CONFIDENCE = 0.7;

@Injectable()
export class CallCallbackService {
  private readonly logger = new Logger(CallCallbackService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private get minConfidence() {
    const value = Number(
      this.config.get('VOICE_MIN_CONFIDENCE', DEFAULT_MIN_CONFIDENCE),
    );
    return Number.isFinite(value) && value > 0 && value <= 1
      ? value
      : DEFAULT_MIN_CONFIDENCE;
  }

  async handleEvent(event: VoiceCallEvent) {
    const call = await this.prisma.call.findUnique({
      where: { taskId: event.taskId },
    });

    if (!call) {
      throw new NotFoundException(`No call found with taskId ${event.taskId}`);
    }

    const data: Record<string, unknown> = {
      transportPhase: event.phase,
    };

    if (event.providerCallId && !call.providerCallId) {
      data.providerCallId = event.providerCallId;
    }

    if (event.phase === 'ended' && !call.completedAt) {
      data.completedAt = event.timestamp
        ? new Date(event.timestamp)
        : new Date();
    }

    if (event.phase === 'error' && event.message) {
      data.failureReason = event.message;
    }

    this.logger.log(
      `Call ${call.id} (task ${event.taskId}) phase updated to ${event.phase}`,
    );

    return this.prisma.call.update({
      where: { id: call.id },
      data,
    });
  }

  async handleResult(result: VoiceCallResult) {
    const call = await this.prisma.call.findUnique({
      where: { taskId: result.taskId },
    });

    if (!call) {
      throw new NotFoundException(`No call found with taskId ${result.taskId}`);
    }

    const outcome = decideOutcome(result, this.minConfidence);
    let status: string;
    let disposition = result.disposition;
    let failureReason: string | null = null;

    if (outcome === 'confirmed') {
      status = 'confirmed';
      disposition = 'confirmed';
    } else if (outcome === 'cancelled') {
      status = 'failed';
      disposition = 'declined';
      failureReason = 'Customer declined the order';
    } else if (outcome === 'no_answer') {
      status = result.disposition === 'error' ? 'failed' : 'no_answer';
      failureReason = result.error || 'No answer from customer';
    } else if (call.attempt >= MAX_ATTEMPTS) {
      status = 'failed';
      disposition = 'needs_human';
      failureReason = 'Customer intent remained unclear after the final call attempt';
    } else {
      status = 'failed';
      disposition = 'ambiguous';
      failureReason = 'Customer intent unclear; another call will be attempted';
    }

    const applied = await this.prisma.$transaction(async (tx) => {
      const update = await tx.call.updateMany({
        where: { id: call.id, status: 'pending' },
        data: {
          disposition,
          durationSeconds: result.durationSeconds ?? call.durationSeconds,
          ...(result.language
            ? { language: LANGUAGE_LABELS[result.language as LanguageCode] }
            : {}),
          completedAt: result.timestamp ? new Date(result.timestamp) : new Date(),
          status,
          failureReason,
          ...(result.providerCallId && !call.providerCallId
            ? { providerCallId: result.providerCallId }
            : {}),
        },
      });
      if (update.count === 0) return false;
      if (outcome === 'confirmed' || outcome === 'cancelled') {
        const orderUpdate = await tx.order.updateMany({
          where: { id: call.orderId, status: 'pending' },
          data: { status: outcome },
        });
        if (orderUpdate.count === 0) {
          status = 'failed';
          disposition = 'policy_blocked';
          failureReason = 'Order is no longer pending; Maria\'s decision was not applied';
          await tx.call.update({
            where: { id: call.id },
            data: { status, disposition, failureReason },
          });
        }
      }
      return true;
    });

    this.logger.log(
      `Call ${call.id} finished with disposition ${disposition} (status: ${status})${applied ? '' : ' (already closed, ignored)'}`,
    );
    return { ok: true, status, disposition, failureReason, applied };
  }
}
