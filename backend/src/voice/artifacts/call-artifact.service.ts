import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { TranscriptEntry } from '../voice.types';

@Injectable()
export class CallArtifactService {
  private readonly logger = new Logger(CallArtifactService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async saveTranscript(entry: TranscriptEntry) {
    const call = await this.prisma.call.findUnique({
      where: { taskId: entry.taskId },
    });

    if (!call) {
      throw new NotFoundException(`Call not found for task ${entry.taskId}`);
    }

    const saved = await this.prisma.callTranscriptEntry.upsert({
      where: {
        callId_sequence: {
          callId: call.id,
          sequence: entry.sequence,
        },
      },
      update: {
        speaker: entry.speaker,
        text: entry.text,
        timestamp: entry.timestamp ? new Date(entry.timestamp) : new Date(),
      },
      create: {
        callId: call.id,
        sequence: entry.sequence,
        speaker: entry.speaker,
        text: entry.text,
        timestamp: entry.timestamp ? new Date(entry.timestamp) : new Date(),
      },
    });

    // Also update legacy JSON transcript array for backwards compatibility
    const allEntries = await this.prisma.callTranscriptEntry.findMany({
      where: { callId: call.id },
      orderBy: { sequence: 'asc' },
      select: { speaker: true, text: true },
    });

    await this.prisma.call.update({
      where: { id: call.id },
      data: {
        transcript: allEntries as unknown as Prisma.InputJsonValue,
      },
    });

    return saved;
  }

  async saveRecording(
    taskId: string,
    speaker: string,
    buffer: Buffer,
    durationMs?: number,
  ) {
    const call = await this.prisma.call.findUnique({
      where: { taskId },
      include: { order: { select: { boutiqueId: true } } },
    });

    if (!call) {
      throw new NotFoundException(`Call not found for task ${taskId}`);
    }

    const boutiqueId = call.order.boutiqueId;
    const objectKey = `calls/${boutiqueId}/${call.id}/${speaker}.wav`;

    await this.storage.put(objectKey, buffer, 'audio/wav');

    const recording = await this.prisma.callRecording.upsert({
      where: {
        callId_speaker: {
          callId: call.id,
          speaker,
        },
      },
      update: {
        objectKey,
        sizeBytes: buffer.length,
        durationMs,
      },
      create: {
        callId: call.id,
        speaker,
        objectKey,
        sizeBytes: buffer.length,
        durationMs,
      },
    });

    this.logger.log(
      `Saved ${speaker} recording (${buffer.length} bytes) for call ${call.id}`,
    );

    return recording;
  }

  async getRecordingUrl(
    boutiqueId: number,
    callId: number,
    speaker: string,
  ): Promise<string> {
    const call = await this.prisma.call.findFirst({
      where: { id: callId, order: { boutiqueId } },
      include: {
        recordings: {
          where: { speaker },
        },
      },
    });

    if (!call || call.recordings.length === 0) {
      throw new NotFoundException(
        `Recording for speaker ${speaker} not found on call ${callId}`,
      );
    }

    return this.storage.url(call.recordings[0].objectKey);
  }
}
