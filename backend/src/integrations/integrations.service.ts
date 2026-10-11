import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { OrdersService } from '../orders/orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateConnectionDto } from './dto/create-connection.dto';
import { ExternalOrderDto } from './dto/external-order.dto';

function hashKey(key: string) {
  return createHash('sha256').update(key).digest('hex');
}

@Injectable()
export class IntegrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
  ) {}

  async createCustomApiConnection(
    boutiqueId: number,
    dto: CreateConnectionDto,
  ) {
    const existing = await this.prisma.integration.findUnique({
      where: { boutiqueId },
    });
    if (existing) {
      throw new ConflictException('An integration already exists for this shop.');
    }
    const rawKey = `ordely_live_${randomBytes(24).toString('hex')}`;
    const connection = await this.prisma.integration.create({
      data: {
        boutiqueId,
        name: dto.name?.trim() || 'Custom website API',
        apiKeyHash: hashKey(rawKey),
        apiKeyPrefix: rawKey.slice(0, 18),
        webhookSecret: `whsec_${randomBytes(24).toString('hex')}`,
        webhookUrl: dto.webhookUrl,
      },
    });

    return {
      id: connection.id,
      provider: 'custom_api',
      name: connection.name,
      apiKeyPrefix: connection.apiKeyPrefix,
      webhookSecret: connection.webhookSecret,
      status: connection.enabled ? 'active' : 'disabled',
      apiKey: rawKey,
      warning: 'Save this key now. It will not be shown again.',
    };
  }

  async listConnections(boutiqueId: number) {
    const connection = await this.prisma.integration.findUnique({
      where: { boutiqueId },
      select: {
        id: true,
        name: true,
        apiKeyPrefix: true,
        webhookUrl: true,
        enabled: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return connection
      ? [{ ...connection, provider: 'custom_api', status: connection.enabled ? 'active' : 'disabled' }]
      : [];
  }

  async updateCustomApiConnection(boutiqueId: number, dto: CreateConnectionDto) {
    const connection = await this.prisma.integration.findUnique({
      where: { boutiqueId },
    });
    if (!connection) throw new UnauthorizedException('Integration is not configured');
    const webhookSecret = dto.rotateWebhookSecret
      ? `whsec_${randomBytes(24).toString('hex')}`
      : undefined;
    const updated = await this.prisma.integration.update({
      where: { boutiqueId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.webhookUrl !== undefined ? { webhookUrl: dto.webhookUrl } : {}),
        ...(webhookSecret ? { webhookSecret } : {}),
      },
      select: {
        id: true,
        name: true,
        webhookUrl: true,
        apiKeyPrefix: true,
        enabled: true,
        updatedAt: true,
      },
    });
    return { ...updated, ...(webhookSecret ? { webhookSecret } : {}) };
  }

  async ingestExternalOrder(apiKey: string | undefined, dto: ExternalOrderDto) {
    if (!apiKey) throw new UnauthorizedException('Missing Ordely API key');

    const connection = await this.prisma.integration.findUnique({
      where: { apiKeyHash: hashKey(apiKey) },
    });
    if (!connection || !connection.enabled) {
      throw new UnauthorizedException('Invalid Ordely API key');
    }

    const existing = await this.prisma.order.findFirst({
      where: {
        boutiqueId: connection.boutiqueId,
        externalOrderId: dto.externalOrderId,
      },
    });
    if (existing) {
      return {
        ...(await this.orderWithOrchestration(connection.boutiqueId, existing.id)),
        duplicate: true,
      };
    }

    const total =
      dto.total ??
      dto.items.reduce(
        (sum, item) => sum + (item.unitPrice ?? 0) * item.quantity,
        0,
      );
    let order;
    try {
      order = await this.ordersService.create(connection.boutiqueId, {
        customer: dto.customer.name,
        phone: dto.customer.phone,
        address: dto.customer.address,
        total,
        items: dto.items.map((item) => ({
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice ?? 0,
        })),
        source: 'integration',
        externalOrderId: dto.externalOrderId,
      });
    } catch (error) {
      if (this.isUniqueConstraint(error)) {
        const duplicate = await this.prisma.order.findFirst({
          where: {
            boutiqueId: connection.boutiqueId,
            externalOrderId: dto.externalOrderId,
          },
        });
        if (duplicate) return { ...duplicate, duplicate: true };
      }
      throw error;
    }
    return {
      ...(await this.orderWithOrchestration(connection.boutiqueId, order.id)),
      duplicate: false,
    };
  }

  async orchestrationStatus(boutiqueId: number, externalOrderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { boutiqueId, externalOrderId },
      select: { id: true },
    });
    if (!order) return null;
    return this.orderWithOrchestration(boutiqueId, order.id);
  }

  private async orderWithOrchestration(boutiqueId: number, orderId: number) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, boutiqueId },
      include: {
        items: true,
        calls: {
          select: {
            id: true,
            status: true,
            attempt: true,
            taskId: true,
            transportPhase: true,
            dispatchedAt: true,
            completedAt: true,
            failureReason: true,
          },
          orderBy: { attempt: 'desc' },
        },
      },
    });
    if (!order) return null;
    const latestCall = order.calls?.[0];
    const dispatch = latestCall?.taskId
      ? latestCall.transportPhase ?? 'dispatched'
      : latestCall?.status === 'pending'
        ? 'queued'
        : 'not_started';
    return {
      ...order,
      orchestration: {
        status: order.status,
        dispatch,
        callId: latestCall?.id ?? null,
        taskId: latestCall?.taskId ?? null,
        attempt: latestCall?.attempt ?? null,
        failureReason: latestCall?.failureReason ?? null,
      },
    };
  }

  private isUniqueConstraint(error: unknown) {
    return (
      error instanceof Error &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
    );
  }
}