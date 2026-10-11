import { Injectable, Logger } from '@nestjs/common';
import { createHmac, randomUUID } from 'node:crypto';
import {
  OrderStatusUpdate,
  OrderStatusUpdatePublisher,
} from '../orders/order-status-update.publisher';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class IntegrationWebhookService implements OrderStatusUpdatePublisher {
  private readonly logger = new Logger(IntegrationWebhookService.name);

  constructor(private readonly prisma: PrismaService) {}

  async publish({ boutiqueId, orderId, status }: OrderStatusUpdate): Promise<void> {
    try {
      const integration = await this.prisma.integration.findUnique({
        where: { boutiqueId },
        select: { webhookUrl: true, webhookSecret: true, enabled: true },
      });
      if (!integration?.enabled || !integration.webhookUrl) return;

      const order = await this.prisma.order.findFirst({
        where: { id: orderId, boutiqueId },
        select: { id: true, externalOrderId: true },
      });
      if (!order?.externalOrderId) return;

      const timestamp = Math.floor(Date.now() / 1000).toString();
      const body = JSON.stringify({
        id: randomUUID(),
        event: `order.${status}`,
        createdAt: new Date().toISOString(),
        order: {
          ordelyOrderId: order.id,
          externalOrderId: order.externalOrderId,
          status,
        },
      });
      const signature = createHmac('sha256', integration.webhookSecret)
        .update(`${timestamp}.${body}`)
        .digest('hex');

      const response = await fetch(integration.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Ordely-Event': `order.${status}`,
          'X-Ordely-Signature': `t=${timestamp},v1=${signature}`,
        },
        body,
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) {
        this.logger.warn(`Order webhook returned HTTP ${response.status}`);
      }
    } catch (error) {
      this.logger.warn(`Order webhook delivery failed: ${(error as Error).message}`);
    }
  }
}