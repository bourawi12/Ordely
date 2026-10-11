import { Module } from '@nestjs/common';
import { CallsModule } from '../calls/calls.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrderStatusUpdatesModule } from '../integrations/order-status-updates.module';

@Module({
  imports: [CallsModule, RealtimeModule, OrderStatusUpdatesModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
