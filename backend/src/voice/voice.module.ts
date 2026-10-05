import { Module } from '@nestjs/common';
import { VoiceCallbackGuard } from './voice-callback.guard';
import { VoiceCallbacksController } from './voice-callbacks.controller';
import { VoiceCallbacksService } from './voice-callbacks.service';
import { VoiceDispatcherService } from './voice-dispatcher.service';

/** The AI voice agent (Ringio): sends queued calls to it and applies what it reports back. */
@Module({
  controllers: [VoiceCallbacksController],
  providers: [
    VoiceCallbacksService,
    VoiceDispatcherService,
    VoiceCallbackGuard,
  ],
  exports: [VoiceDispatcherService],
})
export class VoiceModule {}
