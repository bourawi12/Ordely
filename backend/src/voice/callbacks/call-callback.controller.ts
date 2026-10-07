import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Public } from '../../auth/public.decorator';
import { VoiceCallEvent, VoiceCallResult } from '../voice.types';
import { CallCallbackGuard } from './call-callback.guard';
import { CallCallbackService } from './call-callback.service';

@Controller('internal/voice')
@Public()
@UseGuards(CallCallbackGuard)
export class CallCallbackController {
  constructor(private readonly callbackService: CallCallbackService) {}

  @Post('events')
  async handleEvent(@Body() event: VoiceCallEvent) {
    return this.callbackService.handleEvent(event);
  }

  @Post('result')
  async handleResult(@Body() result: VoiceCallResult) {
    return this.callbackService.handleResult(result);
  }
}
