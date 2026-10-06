import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { VoiceCallEvent, VoiceCallResult } from '../voice.types';

@Injectable()
export class CallCallbackService {
  private readonly logger = new Logger(CallCallbackService.name);

  constructor(private readonly prisma: PrismaService) {}

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

    let status = call.status;
    let failureReason = call.failureReason;

    switch (result.disposition) {
      case 'confirmed':
        status = 'confirmed';
        break;
      case 'declined':
        status = 'failed';
        failureReason = 'Customer declined the order';
        break;
      case 'no_answer':
        status = 'no_answer';
        failureReason = 'No answer from customer';
        break;
      case 'ambiguous':
      case 'needs_human':
        failureReason = `Call ended with disposition: ${result.disposition}. Requires manual review.`;
        break;
      case 'error':
        status = 'failed';
        failureReason = result.error || 'Voice agent execution error';
        break;
    }

    const updated = await this.prisma.call.update({
      where: { id: call.id },
      data: {
        disposition: result.disposition,
        durationSeconds: result.durationSeconds ?? call.durationSeconds,
        completedAt: result.timestamp ? new Date(result.timestamp) : new Date(),
        status,
        failureReason,
        ...(result.providerCallId
          ? { providerCallId: result.providerCallId }
          : {}),
      },
    });

    this.logger.log(
      `Call ${call.id} finished with disposition ${result.disposition} (status: ${status})`,
    );
    return updated;
  }
}
