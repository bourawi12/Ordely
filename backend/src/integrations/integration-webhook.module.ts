import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { IntegrationWebhookService } from './integration-webhook.service';

@Module({ imports: [PrismaModule], providers: [IntegrationWebhookService], exports: [IntegrationWebhookService] })
export class IntegrationWebhookModule {}