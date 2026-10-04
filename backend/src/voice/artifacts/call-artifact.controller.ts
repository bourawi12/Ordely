import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Public } from '../../auth/public.decorator';
import { CallCallbackGuard } from '../callbacks/call-callback.guard';
import { TranscriptEntry } from '../voice.types';
import { CallArtifactService } from './call-artifact.service';

const MAX_WAV_FILE_SIZE = 30 * 1024 * 1024; // 30 MB

@Controller('internal/voice')
@Public()
@UseGuards(CallCallbackGuard)
export class CallArtifactController {
  constructor(private readonly artifactService: CallArtifactService) {}

  @Post('transcript')
  async saveTranscript(@Body() entry: TranscriptEntry) {
    if (!entry.taskId || typeof entry.sequence !== 'number' || !entry.text) {
      throw new BadRequestException('Invalid transcript payload');
    }
    return this.artifactService.saveTranscript(entry);
  }

  @Post('recordings')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_WAV_FILE_SIZE, files: 1 },
    }),
  )
  async uploadRecording(
    @Body('taskId') taskId: string,
    @Body('speaker') speaker: string,
    @Body('durationMs') durationMsStr?: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!taskId || !speaker) {
      throw new BadRequestException('Missing taskId or speaker field');
    }
    if (!file) {
      throw new BadRequestException('No WAV audio file provided');
    }

    const durationMs = durationMsStr ? parseInt(durationMsStr, 10) : undefined;
    return this.artifactService.saveRecording(
      taskId,
      speaker,
      file.buffer,
      durationMs,
    );
  }
}
