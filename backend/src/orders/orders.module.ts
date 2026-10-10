import { Module } from '@nestjs/common';
import { CallsModule } from '../calls/calls.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { IntegrationWebhookModule } from '../integrations/integration-webhook.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [CallsModule, RealtimeModule, IntegrationWebhookModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
