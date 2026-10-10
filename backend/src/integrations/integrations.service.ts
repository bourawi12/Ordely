import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { OrdersService } from '../orders/orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateIntegrationOrderDto } from './dto/create-integration-order.dto';
import { UpdateIntegrationDto } from './dto/update-integration.dto';

const publicFields = { id: true, name: true, apiKeyPrefix: true, webhookUrl: true, enabled: true, lastTestedAt: true, createdAt: true, updatedAt: true } as const;

function secret(prefix: string) {
  return `${prefix}${randomBytes(24).toString('hex')}`;
}

function hash(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

@Injectable()
export class IntegrationsService {
  constructor(private readonly prisma: PrismaService, private readonly ordersService: OrdersService) {}

  async get(boutiqueId: number) {
    return this.prisma.integration.findUnique({ where: { boutiqueId }, select: publicFields });
  }

  async create(boutiqueId: number, dto: UpdateIntegrationDto) {
    const existing = await this.prisma.integration.findUnique({ where: { boutiqueId } });
    if (existing) throw new ConflictException('An integration already exists for this shop.');
    const apiKey = secret('ordely_live_');
    const webhookSecret = secret('whsec_');
    const integration = await this.prisma.integration.create({ data: { boutiqueId, webhookUrl: dto.webhookUrl ?? null, enabled: dto.enabled ?? true, apiKeyHash: hash(apiKey), apiKeyPrefix: apiKey.slice(0, 18), webhookSecret }, select: publicFields });
    return { integration, apiKey, webhookSecret };
  }

  async update(boutiqueId: number, dto: UpdateIntegrationDto) {
    await this.ensure(boutiqueId);
    return this.prisma.integration.update({ where: { boutiqueId }, data: dto, select: publicFields });
  }

  async test(boutiqueId: number) {
    const integration = await this.prisma.integration.findUnique({ where: { boutiqueId } });
    if (!integration) throw new NotFoundException('Integration is not configured.');
    if (!integration.webhookUrl) throw new BadRequestException('Add your website callback URL first.');
    try {
      const response = await fetch(integration.webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Ordely-Test': 'true' }, body: JSON.stringify({ event: 'integration.test', message: 'Ordely connected successfully.' }), signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error(`Website returned ${response.status}`);
    } catch (error) {
      throw new BadRequestException(`Connection test failed: ${(error as Error).message}`);
    }
    const updated = await this.prisma.integration.update({ where: { boutiqueId }, data: { lastTestedAt: new Date() }, select: publicFields });
    return { ok: true, integration: updated };
  }

  async receiveOrder(apiKey: string, dto: CreateIntegrationOrderDto) {
    const integration = await this.prisma.integration.findUnique({ where: { apiKeyHash: hash(apiKey) } });
    if (!integration || !integration.enabled) throw new UnauthorizedException('Invalid integration credentials.');
    const existing = await this.prisma.order.findFirst({ where: { boutiqueId: integration.boutiqueId, externalOrderId: dto.externalOrderId } });
    if (existing) return { ...existing, duplicate: true };
    const order = await this.ordersService.create(integration.boutiqueId, {
      customer: dto.customer.name,
      phone: dto.customer.phone,
      items: dto.items,
      total: dto.total,
      source: 'integration',
      externalOrderId: dto.externalOrderId,
    });
    return { ...order, duplicate: false };
  }

  private async ensure(boutiqueId: number) {
    const count = await this.prisma.integration.count({ where: { boutiqueId } });
    if (!count) throw new NotFoundException('Integration is not configured.');
  }
}