import { Module } from '@nestjs/common';
import {
  ORDER_STATUS_UPDATE_PUBLISHER,
} from '../orders/order-status-update.publisher';
import { PrismaModule } from '../prisma/prisma.module';
import { IntegrationWebhookService } from './integration-webhook.service';

@Module({
  imports: [PrismaModule],
  providers: [
    IntegrationWebhookService,
    {
      provide: ORDER_STATUS_UPDATE_PUBLISHER,
      useExisting: IntegrationWebhookService,
    },
  ],
  exports: [ORDER_STATUS_UPDATE_PUBLISHER],
})
export class OrderStatusUpdatesModule {}