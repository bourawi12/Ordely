import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { RingioAdapter } from './adapters/ringio.adapter';
import { CallArtifactController } from './artifacts/call-artifact.controller';
import { CallArtifactService } from './artifacts/call-artifact.service';
import { CallCallbackController } from './callbacks/call-callback.controller';
import { CallCallbackGuard } from './callbacks/call-callback.guard';
import { CallCallbackService } from './callbacks/call-callback.service';
import { VOICE_AGENT_CLIENT } from './voice-agent-client.interface';
import { VoiceController } from './voice.controller';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [PrismaModule, StorageModule, RealtimeModule],
  controllers: [
    CallCallbackController,
    CallArtifactController,
    VoiceController,
  ],
  providers: [
    CallCallbackService,
    CallArtifactService,
    CallCallbackGuard,
    {
      provide: VOICE_AGENT_CLIENT,
      useClass: RingioAdapter,
    },
  ],
  exports: [CallArtifactService, VOICE_AGENT_CLIENT],
})
export class VoiceModule {}
