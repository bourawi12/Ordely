import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { VoiceModule } from '../voice/voice.module';
import { CallsController } from './calls.controller';
import { CallsService } from './calls.service';

@Module({
  imports: [RealtimeModule, VoiceModule],
  controllers: [CallsController],
  providers: [CallsService],
  exports: [CallsService],
})
export class CallsModule {}
