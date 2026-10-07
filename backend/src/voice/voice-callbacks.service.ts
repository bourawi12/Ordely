import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import {
  VoiceEventDto,
  VoiceRecordingDto,
  VoiceResultDto,
  VoiceTranscriptDto,
} from './dto/voice-callbacks.dto';
import {
  CALL_STATUS,
  callIdFrom,
  decideOutcome,
  LANGUAGE_LABELS,
  LanguageCode,
  mergeTranscript,
  TranscriptPart,
} from './voice.rules';

/** Largest accepted recording (one speaker, one call), in bytes. */
export const RECORDING_MAX_BYTES = 25 * 1024 * 1024;
const DEFAULT_MIN_CONFIDENCE = 0.8;

const speakerOf = (s: 'agent' | 'customer' | 'mobile'): 'agent' | 'customer' =>
  s === 'agent' ? 'agent' : 'customer';

/**
 * Applies what the voice agent reports about a call it was given: lifecycle events, the
 * streamed transcript, the per-speaker recordings and the final result. Only calls Ordely
 * actually dispatched are accepted, and a finished call never changes again.
 */
@Injectable()
export class VoiceCallbacksService {
  private readonly logger = new Logger(VoiceCallbacksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
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

  /** The dispatched call behind a task id. */
  private async dispatchedCall(taskId: string) {
    const id = callIdFrom(taskId);
    const call = id
      ? await this.prisma.call.findUnique({ where: { id } })
      : null;
    if (!call || !call.dispatchedAt) {
      throw new NotFoundException('Unknown task');
    }
    return call;
  }

  async event(dto: VoiceEventDto) {
    const call = await this.dispatchedCall(dto.taskId);
    if (dto.providerCallId && !call.providerCallId) {
      await this.prisma.call.update({
        where: { id: call.id },
        data: { providerCallId: dto.providerCallId },
      });
    }
    this.logger.log(`Call ${call.id}: ${dto.phase}`);
    return { ok: true };
  }

  /** Appends one fragment; the readable transcript is rebuilt from all fragments. */
  async transcript(dto: VoiceTranscriptDto) {
    const call = await this.dispatchedCall(dto.taskId);
    if (call.status !== 'pending')
      throw new ConflictException('This call is over');
    await this.prisma.$transaction(async (tx) => {
      // Fragments arrive concurrently: lock the row so none is lost.
      await tx.$queryRaw`SELECT id FROM calls WHERE id = ${call.id} FOR UPDATE`;
      const current = await tx.call.findUniqueOrThrow({
        where: { id: call.id },
        select: { transcriptParts: true },
      });
      const parts = [
        ...((current.transcriptParts as unknown as TranscriptPart[] | null) ??
          []),
        { seq: dto.sequence, speaker: speakerOf(dto.speaker), text: dto.text },
      ];
      await tx.call.update({
        where: { id: call.id },
        data: {
          transcriptParts: parts as unknown as Prisma.InputJsonValue,
          transcript: mergeTranscript(
            parts,
          ) as unknown as Prisma.InputJsonValue,
        },
      });
    });
    return { ok: true };
  }

  /** Stores one speaker's WAV privately; the call page signs a short-lived link to it. */
  async recording(
    dto: VoiceRecordingDto,
    file: { buffer: Buffer; size: number } | undefined,
  ) {
    const call = await this.dispatchedCall(dto.taskId);
    if (!file?.buffer?.length)
      throw new BadRequestException('A WAV file is required in "file"');
    if (file.size > RECORDING_MAX_BYTES)
      throw new BadRequestException('The recording is too large');
    // RIFF....WAVE: the content must really be a WAV file, whatever its name.
    if (
      file.buffer.length < 44 ||
      file.buffer.toString('ascii', 0, 4) !== 'RIFF' ||
      file.buffer.toString('ascii', 8, 12) !== 'WAVE'
    ) {
      throw new BadRequestException('The recording must be a WAV file');
    }
    const speaker = speakerOf(dto.speaker);
    const key = `recordings/call-${call.id}/${speaker}.wav`;
    await this.storage.put(key, file.buffer, 'audio/wav');
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM calls WHERE id = ${call.id} FOR UPDATE`;
      const current = await tx.call.findUniqueOrThrow({
        where: { id: call.id },
        select: { recordingKeys: true },
      });
      const keys = {
        ...((current.recordingKeys as Record<string, string> | null) ?? {}),
        [speaker]: key,
      };
      await tx.call.update({
        where: { id: call.id },
        data: { recordingKeys: keys },
      });
    });
    return { ok: true };
  }

  /**
   * The end of the call. Ordely decides (voice.rules.ts `decideOutcome`): only a clear,
   * confident yes or no changes the order, together with the call, in one transaction.
   */
  async result(dto: VoiceResultDto) {
    const call = await this.dispatchedCall(dto.taskId);
    const outcome = decideOutcome(dto, this.minConfidence);
    const language = dto.language
      ? LANGUAGE_LABELS[dto.language as LanguageCode]
      : undefined;
    const applied = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.call.updateMany({
        where: { id: call.id, status: 'pending' },
        data: {
          status: CALL_STATUS[outcome],
          durationSeconds: dto.durationSeconds ?? null,
          ...(language && { language }),
          ...(dto.providerCallId &&
            !call.providerCallId && { providerCallId: dto.providerCallId }),
        },
      });
      if (count === 0) return false;
      if (outcome === 'confirmed' || outcome === 'cancelled') {
        // Never overrides an order the merchant already settled.
        await tx.order.updateMany({
          where: { id: call.orderId, status: 'pending' },
          data: { status: outcome },
        });
      }
      return true;
    });
    this.logger.log(
      `Call ${call.id} result: ${dto.disposition} ${dto.intent ?? '-'} ${dto.confidence ?? '-'} → ${outcome}${applied ? '' : ' (already closed, ignored)'}`,
    );
    return { ok: true, outcome, applied };
  }
}
