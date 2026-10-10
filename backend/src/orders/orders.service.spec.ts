import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CallOrchestratorService } from '../calls/orchestration/call-orchestrator.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { IntegrationWebhookService } from '../integrations/integration-webhook.service';
import { OrdersService } from './orders.service';

describe('OrdersService', () => {
  let service: OrdersService;
  const prismaTransaction = jest.fn();
  const callOrchestrator = { pollOnce: jest.fn() };
  const order = {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: CallOrchestratorService, useValue: callOrchestrator },
        { provide: IntegrationWebhookService, useValue: { notifyOrderStatus: jest.fn() } },
        {
          provide: PrismaService,
          useValue: {
            order,
            $transaction: prismaTransaction,
          },
        },
        {
          provide: RealtimeService,
          useValue: {
            emitOrderCreated: jest.fn(),
            emitOrderStatusChanged: jest.fn(),
            emitCallStatusChanged: jest.fn(),
          },
        },
      ],
    }).compile();
    service = moduleRef.get(OrdersService);
  });

  it("lists only the shop's orders, newest first", async () => {
    order.findMany.mockResolvedValue([]);
    await service.findAll(7);
    expect(order.findMany).toHaveBeenCalledWith({
      where: { boutiqueId: 7 },
      include: {
        items: true,
        calls: {
          select: {
            status: true,
            attempt: true,
            disposition: true,
            completedAt: true,
            createdAt: true,
          },
          orderBy: { attempt: 'desc' },
        },
      },
      orderBy: { id: 'desc' },
    });
  });

  it('summarizes attempts and the next retry time', async () => {
    const completedAt = new Date('2026-10-08T10:00:00.000Z');
    order.findMany.mockResolvedValue([
      {
        id: 1,
        status: 'pending',
        calls: [
          {
            status: 'no_answer',
            attempt: 1,
            disposition: 'no_answer',
            completedAt,
            createdAt: new Date('2026-10-08T09:00:00.000Z'),
          },
        ],
      },
    ]);

    await expect(service.findAll(7)).resolves.toEqual([
      {
        id: 1,
        status: 'pending',
        callCount: 1,
        nextCallAt: new Date('2026-10-08T10:30:00.000Z'),
      },
    ]);
  });

  it('creates an order in the shop', async () => {
    const dto = {
      customer: 'Ada',
      phone: '+216 22 000 000',
      items: [{ productName: 'Coffee', quantity: 2, unitPrice: 6.25 }],
      total: 12.5,
    };
    order.create.mockResolvedValue({
      id: 1,
      status: 'pending',
      createdAt: new Date(),
      ...dto,
    });
    await expect(service.create(7, dto)).resolves.toMatchObject({ id: 1 });
    expect(order.create).toHaveBeenCalledWith({
      data: {
        customer: 'Ada',
        phone: '+216 22 000 000',
        total: 12.5,
        boutiqueId: 7,
        items: {
          create: [
            {
              productName: 'Coffee',
              quantity: 2,
              unitPrice: 6.25,
            },
          ],
        },
      },
      include: { items: true },
    });
    expect(callOrchestrator.pollOnce).toHaveBeenCalledTimes(1);
  });

  it('edits the fields of an order of the shop', async () => {
    order.count.mockResolvedValue(1);
    order.update.mockResolvedValue({ id: 1, customer: 'Bob' });
    await expect(
      service.update(7, 1, { customer: 'Bob' }),
    ).resolves.toMatchObject({ customer: 'Bob' });
    expect(order.count).toHaveBeenCalledWith({
      where: { id: 1, boutiqueId: 7 },
    });
    expect(order.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { customer: 'Bob' },
      include: { items: true },
    });
  });

  it("throws NotFound for missing orders and another shop's orders", async () => {
    order.findFirst.mockResolvedValue(null);
    order.count.mockResolvedValue(0);
    order.deleteMany.mockResolvedValue({ count: 0 });
    await expect(service.findOne(7, 99)).rejects.toThrow(NotFoundException);
    await expect(
      service.update(7, 99, { status: 'confirmed' }),
    ).rejects.toThrow(NotFoundException);
    await expect(service.remove(7, 99)).rejects.toThrow(NotFoundException);
    expect(order.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 99, boutiqueId: 7 } }),
    );
    expect(order.deleteMany).toHaveBeenCalledWith({
      where: { id: 99, boutiqueId: 7 },
    });
    expect(order.update).not.toHaveBeenCalled();
  });

  it('imports valid CSV rows and reports invalid ones', async () => {
    prismaTransaction.mockResolvedValue([]);
    const csvContent =
      'customer,phone,item,quantity,total,status\n' +
      'John Doe,+216 22 111 222,Robe Silk,2,120.5,pending\n' +
      'Bad Row,invalid-phone,Robe,0,-5,unknown\n';
    const fileBuffer = Buffer.from(csvContent, 'utf-8');

    const result = await service.importCsv(7, fileBuffer);

    expect(result.imported).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].row).toBe(3);
    expect(prismaTransaction).toHaveBeenCalled();
    expect(callOrchestrator.pollOnce).toHaveBeenCalledTimes(1);
  });

  it('does not wake call polling when a CSV contains no valid rows', async () => {
    const csvContent =
      'customer,phone,item,quantity,total\n' +
      'Bad Row,invalid-phone,Robe,1,120.5\n';

    const result = await service.importCsv(7, Buffer.from(csvContent, 'utf-8'));

    expect(result.imported).toBe(0);
    expect(result.failed).toBe(1);
    expect(prismaTransaction).not.toHaveBeenCalled();
    expect(callOrchestrator.pollOnce).not.toHaveBeenCalled();
  });

  it('imports multi-item CSV rows with semicolon-separated items and quantities', async () => {
    prismaTransaction.mockResolvedValue([]);
    const csvContent =
      'customer,phone,item,quantity,total\n' +
      'Sonia Ben Ali,+216 22 111 222,Robe en soie Rouge; Écharpe satinée Beige; Sac à main Noir,2; 1; 1,240.5\n';
    const fileBuffer = Buffer.from(csvContent, 'utf-8');

    const result = await service.importCsv(7, fileBuffer);

    expect(result.imported).toBe(1);
    expect(result.failed).toBe(0);
    expect(prismaTransaction).toHaveBeenCalled();
    expect(callOrchestrator.pollOnce).toHaveBeenCalledTimes(1);
  });
});

