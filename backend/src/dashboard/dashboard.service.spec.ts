import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  it('counts cancelled orders for the current and previous 30-day windows', async () => {
    const orderCount = jest.fn(({ where }) => {
      if (where.status === 'cancelled') {
        return Promise.resolve(where.createdAt.lt ? 3 : 7);
      }
      if (where.status === 'confirmed') {
        return Promise.resolve(2);
      }
      if (where.status === 'pending') {
        return Promise.resolve(0);
      }
      return Promise.resolve(10);
    });
    const prisma = {
      order: {
        count: orderCount,
        findMany: jest.fn().mockResolvedValue([]),
      },
      call: {
        count: jest.fn().mockResolvedValue(0),
        aggregate: jest.fn().mockResolvedValue({ _avg: { durationSeconds: null } }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    const service = new DashboardService(
      prisma as never,
      { get: jest.fn().mockReturnValue('Africa/Tunis') } as never,
    );

    const summary = await service.summary(42);

    expect(summary.stats.cancelledOrders).toEqual({ value: 7, previous: 3 });
    expect(orderCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ boutiqueId: 42, status: 'cancelled' }),
      }),
    );
  });
});