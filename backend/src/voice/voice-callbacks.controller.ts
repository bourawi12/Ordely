import {
  Body,
  Controller,
  HttpCode,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Public } from '../auth/public.decorator';
import {
  VoiceEventDto,
  VoiceRecordingDto,
  VoiceResultDto,
  VoiceTranscriptDto,
} from './dto/voice-callbacks.dto';
import { VoiceCallbackGuard } from './voice-callback.guard';
import {
  RECORDING_MAX_BYTES,
  VoiceCallbacksService,
} from './voice-callbacks.service';

/**
 * Callbacks from the voice agent (Ringio's OrdelyCallbackClient, with
 * ORDELY_CALLBACK_URL=<backend>/api). No user session: the shared secret is the credential.
 */
@Public()
@UseGuards(VoiceCallbackGuard)
@Controller('internal/voice')
export class VoiceCallbacksController {
  constructor(private readonly voice: VoiceCallbacksService) {}

  @Post('events')
  @HttpCode(200)
  event(@Body() dto: VoiceEventDto) {
    return this.voice.event(dto);
  }

  @Post('transcript')
  @HttpCode(200)
  transcript(@Body() dto: VoiceTranscriptDto) {
    return this.voice.transcript(dto);
  }

  @Post('result')
  @HttpCode(200)
  result(@Body() dto: VoiceResultDto) {
    return this.voice.result(dto);
  }

  @Post('recordings')
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: RECORDING_MAX_BYTES, files: 1 },
    }),
  )
  recording(
    @Body() dto: VoiceRecordingDto,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    return this.voice.recording(dto, file);
  }
}
