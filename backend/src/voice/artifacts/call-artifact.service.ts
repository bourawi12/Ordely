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

  async listTranscripts(boutiqueId: number, callId: number) {
    const call = await this.prisma.call.findFirst({
      where: {
        id: callId,
        order: { boutiqueId },
      },
      include: {
        transcriptEntries: {
          orderBy: { sequence: 'asc' },
        },
      },
    });

    if (!call) {
      throw new NotFoundException(
        `Call ${callId} not found for boutique ${boutiqueId}`,
      );
    }

    return call.transcriptEntries;
  }

  async listAssets(boutiqueId: number, callId: number) {
    const call = await this.prisma.call.findFirst({
      where: {
        id: callId,
        order: { boutiqueId },
      },
      include: {
        recordings: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!call) {
      throw new NotFoundException(
        `Call ${callId} not found for boutique ${boutiqueId}`,
      );
    }

    return call.recordings;
  }

  async saveAsset(
    boutiqueId: number,
    callId: number,
    asset: {
      speaker: string;
      fileName: string;
      contentType: string;
      bytes?: number;
      durationMs?: number;
      sampleRate?: number;
      channelCount?: number;
    },
  ) {
    const call = await this.prisma.call.findFirst({
      where: {
        id: callId,
        order: { boutiqueId },
      },
      include: { order: { select: { boutiqueId: true } } },
    });

    if (!call) {
      throw new NotFoundException(
        `Call ${callId} not found for boutique ${boutiqueId}`,
      );
    }

    const speaker = asset.speaker === 'customer' ? 'customer' : 'agent';
    const objectKey = `calls/${call.order.boutiqueId}/${call.id}/${speaker}.wav`;

    return this.prisma.callRecording.upsert({
      where: {
        callId_speaker: {
          callId: call.id,
          speaker,
        },
      },
      update: {
        objectKey,
        sizeBytes: asset.bytes ?? null,
        durationMs: asset.durationMs ?? null,
      },
      create: {
        callId: call.id,
        speaker,
        objectKey,
        sizeBytes: asset.bytes ?? null,
        durationMs: asset.durationMs ?? null,
      },
    });
  }

  async saveTranscript(entry: TranscriptEntry): Promise<unknown>;
  async saveTranscript(
    boutiqueId: number,
    callId: number,
    entry: Partial<TranscriptEntry>,
  ): Promise<unknown>;
  async saveTranscript(
    entryOrBoutiqueId: TranscriptEntry | number,
    callId?: number,
    entry?: Partial<TranscriptEntry>,
  ) {
    if (typeof entryOrBoutiqueId === 'number') {
      const boutiqueId = entryOrBoutiqueId;
      const call = await this.prisma.call.findFirst({
        where: {
          id: callId,
          order: { boutiqueId },
        },
      });

      if (!call || !callId) {
        throw new NotFoundException(
          `Call ${callId} not found for boutique ${boutiqueId}`,
        );
      }

      const normalizedEntry: TranscriptEntry = {
        taskId: call.taskId || `call-${call.id}`,
        sequence:
          typeof entry?.sequence === 'number'
            ? entry.sequence
            : (await this.prisma.callTranscriptEntry.count({
                where: { callId: call.id },
              })) + 1,
        speaker: entry?.speaker === 'customer' ? 'customer' : 'agent',
        text: String(entry?.text ?? '').trim(),
        timestamp: entry?.timestamp ?? new Date().toISOString(),
      };

      return this.persistTranscript(normalizedEntry);
    }

    return this.persistTranscript(entryOrBoutiqueId);
  }

  private async persistTranscript(entry: TranscriptEntry) {
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
