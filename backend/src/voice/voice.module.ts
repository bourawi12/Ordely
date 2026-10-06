import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { RingioAdapter } from './adapters/ringio.adapter';
import { CallArtifactController } from './artifacts/call-artifact.controller';
import { CallArtifactService } from './artifacts/call-artifact.service';
import { CallCallbackController } from './callbacks/call-callback.controller';
import { CallCallbackGuard } from './callbacks/call-callback.guard';
import { CallCallbackService } from './callbacks/call-callback.service';
import { CallDispatcherService } from './call-dispatcher.service';
import { VOICE_AGENT_CLIENT } from './voice-agent-client.interface';
import { VoiceController } from './voice.controller';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [
    CallCallbackController,
    CallArtifactController,
    VoiceController,
  ],
  providers: [
    CallDispatcherService,
    CallCallbackService,
    CallArtifactService,
    CallCallbackGuard,
    {
      provide: VOICE_AGENT_CLIENT,
      useClass: RingioAdapter,
    },
  ],
  exports: [CallDispatcherService, CallArtifactService, VOICE_AGENT_CLIENT],
})
export class VoiceModule {}
