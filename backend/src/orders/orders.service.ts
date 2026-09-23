import { Injectable, NotFoundException } from '@nestjs/common';
import { Order } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<Order[]> {
    return this.prisma.order.findMany({ orderBy: { id: 'desc' } });
  }

  async findOne(id: number) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { calls: { orderBy: { createdAt: 'desc' } } },
    });
    if (!order) {
      throw new NotFoundException(`Order ${id} not found`);
    }
    return order;
  }

  create(dto: CreateOrderDto): Promise<Order> {
    return this.prisma.order.create({ data: dto });
  }

  async update(id: number, dto: UpdateOrderDto): Promise<Order> {
    await this.ensureExists(id);
    return this.prisma.order.update({
      where: { id },
      data: { status: dto.status },
    });
  }

  private async ensureExists(id: number) {
    const count = await this.prisma.order.count({ where: { id } });
    if (count === 0) {
      throw new NotFoundException(`Order ${id} not found`);
    }
  }

  async remove(id: number): Promise<void> {
    const { count } = await this.prisma.order.deleteMany({ where: { id } });
    if (count === 0) {
      throw new NotFoundException(`Order ${id} not found`);
    }
  }
}
