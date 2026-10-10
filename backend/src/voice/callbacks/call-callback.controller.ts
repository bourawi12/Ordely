import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Public } from '../../auth/public.decorator';
import { CallOrchestratorService } from '../../calls/orchestration/call-orchestrator.service';
import { VoiceCallEvent, VoiceCallResult } from '../voice.types';
import { CallCallbackGuard } from './call-callback.guard';
import { CallCallbackService } from './call-callback.service';

@Controller('internal/voice')
@Public()
@UseGuards(CallCallbackGuard)
export class CallCallbackController {
  constructor(
    private readonly callbackService: CallCallbackService,
    private readonly moduleRef: ModuleRef,
  ) {}

  @Post('events')
  async handleEvent(@Body() event: VoiceCallEvent) {
    return this.callbackService.handleEvent(event);
  }

  @Post('result')
  async handleResult(@Body() result: VoiceCallResult) {
    const response = await this.callbackService.handleResult(result);
    void this.moduleRef
      .get(CallOrchestratorService, { strict: false })
      ?.pollOnce();
    return response;
  }
}
