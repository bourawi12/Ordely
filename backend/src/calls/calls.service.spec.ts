import { ConflictException } from '@nestjs/common';
import { CallsService } from './calls.service';

describe('CallsService queue policy', () => {
  let service: CallsService;
  let prisma: {
    order: { findFirst: jest.Mock; findMany: jest.Mock };
    call: { create: jest.Mock; createMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let realtime: { emitCallStatusChanged: jest.Mock };

  const boutique = { callStartTime: '00:00', callEndTime: '23:59' };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-07T10:00:00.000Z'));
    prisma = {
      order: { findFirst: jest.fn(), findMany: jest.fn() },
      call: {
        create: jest.fn().mockResolvedValue({
          id: 22,
          orderId: 50,
          status: 'pending',
          attempt: 1,
          createdAt: new Date(),
        }),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: jest.fn(),
    };
    realtime = { emitCallStatusChanged: jest.fn() };
    service = new CallsService(
      prisma as never,
      { get: jest.fn() } as never,
      {} as never,
      realtime as never,
    );
  });

  afterEach(() => jest.useRealTimers());

  it('queues attempt 1 for a pending order during boutique hours', async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: 50,
      status: 'pending',
      calls: [],
      boutique,
    });

    await service.queue(1, 50);

    expect(prisma.call.create).toHaveBeenCalledWith({
      data: { orderId: 50, attempt: 1 },
      include: expect.any(Object),
    });
  });

  it('does not queue attempt 2 before its 30-minute delay', async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: 50,
      status: 'pending',
      boutique,
      calls: [
        {
          attempt: 1,
          status: 'no_answer',
          disposition: 'no_answer',
          completedAt: new Date('2026-10-07T09:31:00.000Z'),
        },
      ],
    });

    await expect(service.queue(1, 50)).rejects.toThrow(ConflictException);
    expect(prisma.call.create).not.toHaveBeenCalled();
  });

  it('does not queue more than three attempts', async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: 50,
      status: 'pending',
      boutique,
      calls: [1, 2, 3].map((attempt) => ({
        attempt,
        status: 'no_answer',
        disposition: 'no_answer',
        completedAt: new Date('2026-10-07T06:00:00.000Z'),
      })),
    });

    await expect(service.queue(1, 50)).rejects.toThrow(ConflictException);
    expect(prisma.call.create).not.toHaveBeenCalled();
  });

  it('reopens an unreachable order and queues a manual retry', async () => {
    const tx = {
      order: {
        findFirst: jest.fn().mockResolvedValue({
          status: 'unreachable',
          calls: [{ status: 'failed', attempt: 3, disposition: 'needs_human' }],
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      call: {
        create: jest.fn().mockResolvedValue({
          id: 23,
          orderId: 50,
          status: 'pending',
          attempt: 4,
          createdAt: new Date(),
        }),
      },
    };
    prisma.$transaction.mockImplementation((callback) => callback(tx));

    await service.retryAfterReview(1, 50);

    expect(tx.order.updateMany).toHaveBeenCalledWith({
      where: { id: 50, boutiqueId: 1, status: 'unreachable' },
      data: { status: 'pending' },
    });
    expect(tx.call.create).toHaveBeenCalledWith({
      data: { orderId: 50, attempt: 4 },
      include: expect.any(Object),
    });
  });

  it('bulk-queues only eligible orders and skips duplicate inserts', async () => {
    prisma.order.findMany.mockResolvedValue([
      { id: 50, boutique, calls: [] },
      {
        id: 51,
        boutique,
        calls: [
          {
            attempt: 1,
            status: 'no_answer',
            disposition: 'no_answer',
            completedAt: new Date('2026-10-07T09:31:00.000Z'),
          },
        ],
      },
    ]);

    await expect(service.queueAllPending(1)).resolves.toEqual({ queued: 1 });
    expect(prisma.call.createMany).toHaveBeenCalledWith({
      data: [{ orderId: 50, attempt: 1 }],
      skipDuplicates: true,
    });
  });
});
