import { Module } from '@nestjs/common';
import { CallsModule } from '../calls/calls.module';
import { OrdersModule } from '../orders/orders.module';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';

@Module({
  imports: [CallsModule, OrdersModule],
  controllers: [IntegrationsController],
  providers: [IntegrationsService],
})
export class IntegrationsModule {}