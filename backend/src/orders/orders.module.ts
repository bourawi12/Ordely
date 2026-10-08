import { Module } from '@nestjs/common';
import { CallsModule } from '../calls/calls.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [CallsModule, RealtimeModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
