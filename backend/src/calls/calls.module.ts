import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { CallsController } from './calls.controller';
import { CallsService } from './calls.service';

@Module({
  imports: [RealtimeModule],
  controllers: [CallsController],
  providers: [CallsService],
})
export class CallsModule {}
