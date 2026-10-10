import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { VoiceModule } from '../voice/voice.module';
import { CallsController } from './calls.controller';
import { CallsService } from './calls.service';
import { CallDispatcherService } from './orchestration/call-dispatcher.service';
import { CallOrchestratorService } from './orchestration/call-orchestrator.service';

@Module({
  imports: [RealtimeModule, VoiceModule],
  controllers: [CallsController],
  providers: [CallsService, CallDispatcherService, CallOrchestratorService],
  exports: [CallsService, CallDispatcherService, CallOrchestratorService],
})
export class CallsModule {}
