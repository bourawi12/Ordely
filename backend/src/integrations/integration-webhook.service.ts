import { Injectable, Logger } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class IntegrationWebhookService {
  private readonly logger = new Logger(IntegrationWebhookService.name);

  constructor(private readonly prisma: PrismaService) {}

  async notifyOrderStatus(boutiqueId: number, orderId: number, status: string) {
    const [order, integration] = await Promise.all([
      this.prisma.order.findFirst({ where: { id: orderId, boutiqueId }, select: { id: true, externalOrderId: true } }),
      this.prisma.integration.findUnique({ where: { boutiqueId }, select: { webhookUrl: true, webhookSecret: true, enabled: true } }),
    ]);
    if (!order?.externalOrderId || !integration?.enabled || !integration.webhookUrl) return;
    const timestamp = new Date().toISOString();
    const body = JSON.stringify({ event: 'order.status_changed', externalOrderId: order.externalOrderId, ordelyOrderId: order.id, status, updatedAt: timestamp });
    const signature = createHmac('sha256', integration.webhookSecret).update(`${timestamp}.${body}`).digest('hex');
    try {
      const response = await fetch(integration.webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Ordely-Timestamp': timestamp, 'X-Ordely-Signature': `sha256=${signature}` }, body, signal: AbortSignal.timeout(5000) });
      if (!response.ok) this.logger.warn(`Integration webhook rejected for order ${order.id}: ${response.status}`);
    } catch (error) {
      this.logger.warn(`Integration webhook failed for order ${order.id}: ${(error as Error).message}`);
    }
  }
}