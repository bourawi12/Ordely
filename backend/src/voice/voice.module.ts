import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { LlmService } from './llm.service';
import { SttService } from './stt.service';
import { TtsService } from './tts.service';
import { VoiceController } from './voice.controller';
import { VoiceGateway } from './voice.gateway';
import { VoiceSessionService } from './voice-session.service';

@Module({
  imports: [OrdersModule],
  controllers: [VoiceController],
  providers: [
    VoiceGateway,
    VoiceSessionService,
    LlmService,
    SttService,
    TtsService,
  ],
  exports: [VoiceSessionService, SttService, TtsService],
})
export class VoiceModule {}
