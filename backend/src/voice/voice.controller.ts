import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { CurrentBoutique } from '../auth/current-user.decorator';
import { CallArtifactService } from './artifacts/call-artifact.service';
import { CallCallbackGuard } from './callbacks/call-callback.guard';
import {
  VOICE_AGENT_CLIENT,
  VoiceAgentClient,
} from './voice-agent-client.interface';
import { TranscriptEntry, VoiceCallTask } from './voice.types';

@Controller('voice')
export class VoiceController {
  constructor(
    private readonly artifacts: CallArtifactService,
    @Inject(VOICE_AGENT_CLIENT)
    private readonly voiceAgentClient: VoiceAgentClient,
  ) {}

  @Public()
  @UseGuards(CallCallbackGuard)
  @Post('task/start')
  async startTask(@Body() task: VoiceCallTask) {
    if (!task?.taskId || !task?.destination) {
      throw new BadRequestException('taskId and destination are required');
    }

    return this.voiceAgentClient.startTask(task);
  }

  @Public()
  @UseGuards(CallCallbackGuard)
  @Post('task/stop')
  async stopTask(@Body() body: { taskId?: string }) {
    if (!body?.taskId) {
      throw new BadRequestException('taskId is required');
    }

    await this.voiceAgentClient.stopTask(body.taskId);
    return { success: true, taskId: body.taskId };
  }

  @Public()
  @UseGuards(CallCallbackGuard)
  @Get('health')
  async healthCheck() {
    return { ok: await this.voiceAgentClient.healthCheck() };
  }

  @Get('calls/:callId/transcripts')
  listTranscripts(
    @CurrentBoutique() boutiqueId: number,
    @Param('callId', ParseIntPipe) callId: number,
  ) {
    return this.artifacts.listTranscripts(boutiqueId, callId);
  }

  @Post('calls/:callId/transcripts')
  async saveTranscript(
    @CurrentBoutique() boutiqueId: number,
    @Param('callId', ParseIntPipe) callId: number,
    @Body() entry: Partial<TranscriptEntry>,
  ) {
    if (!entry || !entry.speaker || !entry.text) {
      throw new BadRequestException(
        'speaker and text are required to save a transcript entry',
      );
    }

    return this.artifacts.saveTranscript(boutiqueId, callId, entry);
  }

  @Get('calls/:callId/assets')
  listAssets(
    @CurrentBoutique() boutiqueId: number,
    @Param('callId', ParseIntPipe) callId: number,
  ) {
    return this.artifacts.listAssets(boutiqueId, callId);
  }

  @Post('calls/:callId/assets')
  async saveAsset(
    @CurrentBoutique() boutiqueId: number,
    @Param('callId', ParseIntPipe) callId: number,
    @Body()
    body: {
      speaker?: string;
      fileName?: string;
      contentType?: string;
      bytes?: number;
      durationMs?: number;
      sampleRate?: number;
      channelCount?: number;
    },
  ) {
    if (!body || !body.speaker || !body.fileName || !body.contentType) {
      throw new BadRequestException(
        'speaker, fileName, and contentType are required',
      );
    }

    const asset = {
      speaker: body.speaker,
      fileName: body.fileName,
      contentType: body.contentType,
      bytes: body.bytes,
      durationMs: body.durationMs,
      sampleRate: body.sampleRate,
      channelCount: body.channelCount,
    };

    return this.artifacts.saveAsset(boutiqueId, callId, asset);
  }
}
