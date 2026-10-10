import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { IntegrationWebhookModule } from './integration-webhook.module';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';

@Module({ imports: [OrdersModule, IntegrationWebhookModule], controllers: [IntegrationsController], providers: [IntegrationsService] })
export class IntegrationsModule {}