import { Injectable, NotFoundException } from '@nestjs/common';
import { Order } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderStatus, UpdateOrderDto } from './dto/update-order.dto';

/** Every query is scoped by the signed-in user's shop: another shop's order is a 404. */
@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(boutiqueId: number, status?: OrderStatus): Promise<Order[]> {
    return this.prisma.order.findMany({
      where: status ? { boutiqueId, status } : { boutiqueId },
      orderBy: { id: 'desc' },
    });
  }

  async findOne(boutiqueId: number, id: number) {
    const order = await this.prisma.order.findFirst({
      where: { id, boutiqueId },
      include: { calls: { orderBy: { createdAt: 'desc' } } },
    });
    if (!order) {
      throw new NotFoundException(`Order ${id} not found`);
    }
    return order;
  }

  create(boutiqueId: number, dto: CreateOrderDto): Promise<Order> {
    return this.prisma.order.create({ data: { ...dto, boutiqueId } });
  }

  async update(
    boutiqueId: number,
    id: number,
    dto: UpdateOrderDto,
  ): Promise<Order> {
    await this.ensureExists(boutiqueId, id);
    return this.prisma.order.update({ where: { id }, data: dto });
  }

  private async ensureExists(boutiqueId: number, id: number) {
    const count = await this.prisma.order.count({ where: { id, boutiqueId } });
    if (count === 0) {
      throw new NotFoundException(`Order ${id} not found`);
    }
  }

  async remove(boutiqueId: number, id: number): Promise<void> {
    const { count } = await this.prisma.order.deleteMany({
      where: { id, boutiqueId },
    });
    if (count === 0) {
      throw new NotFoundException(`Order ${id} not found`);
    }
  }
}
