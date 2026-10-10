import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReclamationDto } from './dto/create-reclamation.dto';
import { ListReclamationsDto } from './dto/list-reclamations.dto';
import { UpdateReclamationDto } from './dto/update-reclamation.dto';

const listInclude = {
  user: { select: { id: true, name: true, email: true } },
  order: { select: { id: true, customer: true, total: true } },
} as const;

@Injectable()
export class ReclamationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForBoutique(boutiqueId: number, query: ListReclamationsDto) {
    return this.prisma.reclamation.findMany({
      where: { boutiqueId, ...(query.status ? { status: query.status } : {}) },
      include: listInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findForBoutique(boutiqueId: number, id: number) {
    const reclamation = await this.prisma.reclamation.findFirst({
      where: { id, boutiqueId },
      include: listInclude,
    });
    if (!reclamation) throw new NotFoundException(`Reclamation ${id} not found`);
    return reclamation;
  }

  async create(boutiqueId: number, userId: number, dto: CreateReclamationDto) {
    if (dto.orderId) {
      const order = await this.prisma.order.findFirst({ where: { id: dto.orderId, boutiqueId } });
      if (!order) throw new NotFoundException(`Order ${dto.orderId} not found`);
    }
    return this.prisma.reclamation.create({
      data: { boutiqueId, userId, subject: dto.subject, description: dto.description, orderId: dto.orderId },
      include: listInclude,
    });
  }

  async listForAdmin(query: ListReclamationsDto) {
    return this.prisma.reclamation.findMany({
      where: query.status ? { status: query.status } : undefined,
      include: { ...listInclude, boutique: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findForAdmin(id: number) {
    const reclamation = await this.prisma.reclamation.findUnique({
      where: { id },
      include: { ...listInclude, boutique: { select: { id: true, name: true } } },
    });
    if (!reclamation) throw new NotFoundException(`Reclamation ${id} not found`);
    return reclamation;
  }

  async updateStatus(id: number, dto: UpdateReclamationDto) {
    await this.findForAdmin(id);
    return this.prisma.reclamation.update({
      where: { id },
      data: { status: dto.status, resolvedAt: dto.status === 'resolved' ? new Date() : null },
      include: { ...listInclude, boutique: { select: { id: true, name: true } } },
    });
  }
}