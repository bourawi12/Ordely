import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from './orders.service';

describe('OrdersService', () => {
  let service: OrdersService;
  const order = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
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
        { provide: PrismaService, useValue: { order } },
      ],
    }).compile();
    service = moduleRef.get(OrdersService);
  });

  it('lists orders newest first', async () => {
    order.findMany.mockResolvedValue([]);
    await service.findAll();
    expect(order.findMany).toHaveBeenCalledWith({ orderBy: { id: 'desc' } });
  });

  it('creates an order', async () => {
    const dto = {
      customer: 'Ada',
      phone: '+216 22 000 000',
      item: 'Coffee',
      quantity: 2,
      total: 12.5,
    };
    order.create.mockResolvedValue({ id: 1, status: 'pending', ...dto });
    await expect(service.create(dto)).resolves.toMatchObject({ id: 1 });
    expect(order.create).toHaveBeenCalledWith({ data: dto });
  });

  it('updates the status of an existing order', async () => {
    order.count.mockResolvedValue(1);
    order.update.mockResolvedValue({ id: 1, status: 'confirmed' });
    await expect(
      service.update(1, { status: 'confirmed' }),
    ).resolves.toMatchObject({
      status: 'confirmed',
    });
  });

  it('throws NotFound for missing orders', async () => {
    order.findUnique.mockResolvedValue(null);
    order.count.mockResolvedValue(0);
    order.deleteMany.mockResolvedValue({ count: 0 });
    await expect(service.findOne(99)).rejects.toThrow(NotFoundException);
    await expect(service.update(99, { status: 'confirmed' })).rejects.toThrow(
      NotFoundException,
    );
    await expect(service.remove(99)).rejects.toThrow(NotFoundException);
  });
});
