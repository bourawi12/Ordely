import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { DAY_MS, DEFAULT_TIMEZONE } from '../common/time';
import { PrismaService } from '../prisma/prisma.service';

const WINDOW_DAYS = 30;

export interface Metric {
  value: number;
  previous: number;
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** Everything is scoped to one shop: its orders, and the calls made for them. */
  async summary(boutiqueId: number) {
    const calls = { order: { boutiqueId } } satisfies Prisma.CallWhereInput;
    const now = Date.now();
    const current = { gte: new Date(now - WINDOW_DAYS * DAY_MS) };
    const previous = {
      gte: new Date(now - 2 * WINDOW_DAYS * DAY_MS),
      lt: current.gte,
    };

    const [
      totalOrders,
      confirmedOrders,
      cancelledOrders,
      failedCalls,
      avgDuration,
      week,
      recentCalls,
      pendingOrders,
      pendingCount,
      retryableCount,
      reviewCount,
    ] = await Promise.all([
      this.metric(
        (createdAt) =>
          this.prisma.order.count({ where: { boutiqueId, createdAt } }),
        current,
        previous,
      ),
      this.metric(
        (createdAt) =>
          this.prisma.order.count({
            where: { boutiqueId, createdAt, status: 'confirmed' },
          }),
        current,
        previous,
      ),
      this.metric(
        (createdAt) =>
          this.prisma.order.count({
            where: { boutiqueId, createdAt, status: 'cancelled' },
          }),
        current,
        previous,
      ),
      this.metric(
        (createdAt) =>
          this.prisma.call.count({
            where: {
              ...calls,
              createdAt,
              status: { in: ['failed', 'no_answer'] },
            },
          }),
        current,
        previous,
      ),
      this.metric(
        async (createdAt) => {
          const agg = await this.prisma.call.aggregate({
            where: { ...calls, createdAt, durationSeconds: { not: null } },
            _avg: { durationSeconds: true },
          });
          return Math.round(agg._avg.durationSeconds ?? 0);
        },
        current,
        previous,
      ),
      this.confirmationsLast7Days(boutiqueId),
      this.prisma.call.findMany({
        where: { ...calls, status: { not: 'pending' } },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { order: { select: { id: true, customer: true } } },
      }),
      this.prisma.order.findMany({
        where: { boutiqueId, status: 'pending' },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          items: true,
          calls: {
            where: { status: 'pending' },
            select: { id: true },
            take: 1,
          },
        },
      }),
      this.prisma.order.count({ where: { boutiqueId, status: 'pending' } }),
      this.prisma.call.count({
        where: {
          status: { in: ['failed', 'no_answer'] },
          order: {
            boutiqueId,
            status: { in: ['pending', 'unreachable'] },
          },
        },
      }),
      this.prisma.call.count({
        where: {
          disposition: 'needs_human',
          order: { boutiqueId, status: 'unreachable' },
        },
      }),
    ]);

    return {
      stats: {
        totalOrders,
        confirmedOrders,
        cancelledOrders,
        failedCalls,
        avgDuration,
      },
      week,
      recentCalls,
      pendingOrders: pendingOrders.map(({ calls, ...order }) => ({
        ...order,
        callQueued: calls.length > 0,
      })),
      pendingCount,
      actionCounts: {
        retryable: retryableCount,
        needsReview: reviewCount,
      },
    };
  }

  private async metric(
    fetch: (createdAt: Prisma.DateTimeFilter) => Promise<number>,
    current: Prisma.DateTimeFilter,
    previous: Prisma.DateTimeFilter,
  ): Promise<Metric> {
    const [value, prev] = await Promise.all([fetch(current), fetch(previous)]);
    return { value, previous: prev };
  }

  /** Confirmed calls per local day for the last 7 days (oldest first, zero-filled). */
  private confirmationsLast7Days(boutiqueId: number) {
    const tz = this.config.get<string>('APP_TIMEZONE', DEFAULT_TIMEZONE);
    return this.prisma.$queryRaw<
      { date: string; confirmed: number }[]
    >(Prisma.sql`
      WITH days AS (
        SELECT generate_series(
          (now() AT TIME ZONE ${tz})::date - 6,
          (now() AT TIME ZONE ${tz})::date,
          interval '1 day'
        )::date AS day
      )
      SELECT to_char(days.day, 'YYYY-MM-DD') AS date,
             COUNT(calls.id)::int AS confirmed
      FROM days
      LEFT JOIN (
        SELECT calls.id, calls."createdAt"
        FROM calls
        JOIN orders ON orders.id = calls."orderId"
        WHERE calls.status = 'confirmed' AND orders."boutiqueId" = ${boutiqueId}
      ) calls
        ON (calls."createdAt" AT TIME ZONE ${tz})::date = days.day
      GROUP BY days.day
      ORDER BY days.day
    `);
  }
}
