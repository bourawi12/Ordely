import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { DAY_MS, DEFAULT_TIMEZONE } from '../common/time';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsRange } from './dto/analytics-query.dto';

const RANGE_DAYS: Record<AnalyticsRange, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};
const TOP_PRODUCTS = 8;

export interface Metric {
  value: number;
  previous: number;
}

interface WindowTotals {
  orders: number;
  confirmed: number;
  cancelled: number;
  confirmedRevenue: number;
  cancelledValue: number;
  avgOrderValue: number;
  finishedCalls: number;
  answeredCalls: number;
  avgAttempts: number;
  avgMinutesToConfirm: number;
}

/** Share of `part` in `whole`, 0 when there is nothing to divide. */
export function rate(part: number, whole: number): number {
  return whole > 0 ? part / whole : 0;
}

/**
 * The shop's analytics over the last 7, 30 or 90 days, each KPI next to the period before.
 * Orders count by the day they were placed; calls by the moment they were made. Every query
 * is scoped to one shop (calls through their order).
 */
@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private get timezone() {
    return this.config.get<string>('APP_TIMEZONE', DEFAULT_TIMEZONE);
  }

  async report(boutiqueId: number, range: AnalyticsRange) {
    const days = RANGE_DAYS[range];
    const to = new Date();
    const from = new Date(to.getTime() - days * DAY_MS);
    const before = new Date(from.getTime() - days * DAY_MS);

    const [
      current,
      previous,
      daily,
      callOutcomes,
      byHour,
      byWeekday,
      byProduct,
      byLanguage,
      byAttempt,
    ] = await Promise.all([
      this.totals(boutiqueId, from, to),
      this.totals(boutiqueId, before, from),
      this.daily(boutiqueId, days),
      this.callOutcomes(boutiqueId, from),
      this.byHour(boutiqueId, from),
      this.byWeekday(boutiqueId, from),
      this.byProduct(boutiqueId, from),
      this.byLanguage(boutiqueId, from),
      this.byAttempt(boutiqueId, from),
    ]);

    const metric = (pick: (t: WindowTotals) => number): Metric => ({
      value: pick(current),
      previous: pick(previous),
    });

    return {
      range,
      from: from.toISOString(),
      to: to.toISOString(),
      kpis: {
        orders: metric((t) => t.orders),
        confirmationRate: metric((t) => rate(t.confirmed, t.orders)),
        confirmedRevenue: metric((t) => t.confirmedRevenue),
        cancelledValue: metric((t) => t.cancelledValue),
        answerRate: metric((t) => rate(t.answeredCalls, t.finishedCalls)),
        avgAttempts: metric((t) => t.avgAttempts),
        avgMinutesToConfirm: metric((t) => t.avgMinutesToConfirm),
        avgOrderValue: metric((t) => t.avgOrderValue),
      },
      outcomes: {
        confirmed: current.confirmed,
        cancelled: current.cancelled,
        pending: current.orders - current.confirmed - current.cancelled,
      },
      callOutcomes,
      daily,
      byHour,
      byWeekday,
      byProduct,
      byLanguage,
      byAttempt,
    };
  }

  private async totals(
    boutiqueId: number,
    from: Date,
    to: Date,
  ): Promise<WindowTotals> {
    const [[orders], [calls], [confirmations]] = await Promise.all([
      this.prisma.$queryRaw<
        Pick<
          WindowTotals,
          | 'orders'
          | 'confirmed'
          | 'cancelled'
          | 'confirmedRevenue'
          | 'cancelledValue'
          | 'avgOrderValue'
        >[]
      >(Prisma.sql`
        SELECT COUNT(*)::int AS "orders",
               COUNT(*) FILTER (WHERE status = 'confirmed')::int AS "confirmed",
               COUNT(*) FILTER (WHERE status = 'cancelled')::int AS "cancelled",
               COALESCE(SUM(total) FILTER (WHERE status = 'confirmed'), 0)::float8 AS "confirmedRevenue",
               COALESCE(SUM(total) FILTER (WHERE status = 'cancelled'), 0)::float8 AS "cancelledValue",
               COALESCE(AVG(total), 0)::float8 AS "avgOrderValue"
        FROM orders
        WHERE "boutiqueId" = ${boutiqueId}
          AND "createdAt" >= ${from} AND "createdAt" < ${to}
      `),
      this.prisma.$queryRaw<
        Pick<WindowTotals, 'finishedCalls' | 'answeredCalls'>[]
      >(Prisma.sql`
        SELECT COUNT(*) FILTER (WHERE c.status <> 'pending')::int AS "finishedCalls",
               COUNT(*) FILTER (WHERE c.status IN ('confirmed', 'failed'))::int AS "answeredCalls"
        FROM calls c
        JOIN orders o ON o.id = c."orderId"
        WHERE o."boutiqueId" = ${boutiqueId}
          AND c."createdAt" >= ${from} AND c."createdAt" < ${to}
      `),
      // For the orders placed in the window that got confirmed: which attempt did it, and when.
      this.prisma.$queryRaw<
        Pick<WindowTotals, 'avgAttempts' | 'avgMinutesToConfirm'>[]
      >(Prisma.sql`
        SELECT COALESCE(AVG(c.attempt), 0)::float8 AS "avgAttempts",
               COALESCE(AVG(EXTRACT(EPOCH FROM (c."createdAt" - o."createdAt")) / 60), 0)::float8
                 AS "avgMinutesToConfirm"
        FROM orders o
        JOIN calls c ON c."orderId" = o.id AND c.status = 'confirmed'
        WHERE o."boutiqueId" = ${boutiqueId}
          AND o."createdAt" >= ${from} AND o."createdAt" < ${to}
      `),
    ]);
    return { ...orders, ...calls, ...confirmations };
  }

  /** Orders per local day, by their current outcome (oldest first, zero-filled). */
  private daily(boutiqueId: number, days: number) {
    const tz = this.timezone;
    return this.prisma.$queryRaw<
      { date: string; confirmed: number; cancelled: number; pending: number }[]
    >(Prisma.sql`
      WITH days AS (
        SELECT generate_series(
          (now() AT TIME ZONE ${tz})::date - ${days - 1}::int,
          (now() AT TIME ZONE ${tz})::date,
          interval '1 day'
        )::date AS day
      )
      SELECT to_char(days.day, 'YYYY-MM-DD') AS "date",
             COUNT(o.id) FILTER (WHERE o.status = 'confirmed')::int AS "confirmed",
             COUNT(o.id) FILTER (WHERE o.status = 'cancelled')::int AS "cancelled",
             COUNT(o.id) FILTER (WHERE o.status = 'pending')::int AS "pending"
      FROM days
      LEFT JOIN orders o
        ON o."boutiqueId" = ${boutiqueId}
       AND (o."createdAt" AT TIME ZONE ${tz})::date = days.day
      GROUP BY days.day
      ORDER BY days.day
    `);
  }

  private async callOutcomes(boutiqueId: number, from: Date) {
    const rows = await this.prisma.call.groupBy({
      by: ['status'],
      where: { createdAt: { gte: from }, order: { boutiqueId } },
      _count: true,
    });
    const counts = { confirmed: 0, failed: 0, no_answer: 0, pending: 0 };
    for (const row of rows) {
      if (row.status in counts) {
        counts[row.status as keyof typeof counts] = row._count;
      }
    }
    return counts;
  }

  /** Finished calls per local hour (0–23, zero-filled): how many, how many answered. */
  private async byHour(boutiqueId: number, from: Date) {
    const tz = this.timezone;
    const rows = await this.prisma.$queryRaw<
      { hour: number; calls: number; answered: number; confirmed: number }[]
    >(Prisma.sql`
      SELECT EXTRACT(HOUR FROM c."createdAt" AT TIME ZONE ${tz})::int AS "hour",
             COUNT(*)::int AS "calls",
             COUNT(*) FILTER (WHERE c.status IN ('confirmed', 'failed'))::int AS "answered",
             COUNT(*) FILTER (WHERE c.status = 'confirmed')::int AS "confirmed"
      FROM calls c
      JOIN orders o ON o.id = c."orderId"
      WHERE o."boutiqueId" = ${boutiqueId}
        AND c."createdAt" >= ${from}
        AND c.status <> 'pending'
      GROUP BY 1
    `);
    return Array.from({ length: 24 }, (_, hour) => {
      const row = rows.find((r) => r.hour === hour);
      return { hour, calls: 0, answered: 0, confirmed: 0, ...row };
    });
  }

  /** Orders per local weekday (1 = Monday … 7 = Sunday, zero-filled) and how many got confirmed. */
  private async byWeekday(boutiqueId: number, from: Date) {
    const tz = this.timezone;
    const rows = await this.prisma.$queryRaw<
      { weekday: number; orders: number; confirmed: number }[]
    >(Prisma.sql`
      SELECT EXTRACT(ISODOW FROM o."createdAt" AT TIME ZONE ${tz})::int AS "weekday",
             COUNT(*)::int AS "orders",
             COUNT(*) FILTER (WHERE o.status = 'confirmed')::int AS "confirmed"
      FROM orders o
      WHERE o."boutiqueId" = ${boutiqueId} AND o."createdAt" >= ${from}
      GROUP BY 1
    `);
    return Array.from({ length: 7 }, (_, i) => {
      const row = rows.find((r) => r.weekday === i + 1);
      return { weekday: i + 1, orders: 0, confirmed: 0, ...row };
    });
  }

  /** The best-selling items: orders, outcomes and confirmed revenue. */
  private byProduct(boutiqueId: number, from: Date) {
    return this.prisma.$queryRaw<
      {
        item: string;
        orders: number;
        confirmed: number;
        cancelled: number;
        revenue: number;
      }[]
    >(Prisma.sql`
      SELECT o.item AS "item",
             COUNT(*)::int AS "orders",
             COUNT(*) FILTER (WHERE o.status = 'confirmed')::int AS "confirmed",
             COUNT(*) FILTER (WHERE o.status = 'cancelled')::int AS "cancelled",
             COALESCE(SUM(o.total) FILTER (WHERE o.status = 'confirmed'), 0)::float8 AS "revenue"
      FROM orders o
      WHERE o."boutiqueId" = ${boutiqueId} AND o."createdAt" >= ${from}
      GROUP BY o.item
      ORDER BY "orders" DESC, "revenue" DESC
      LIMIT ${TOP_PRODUCTS}
    `);
  }

  /** Answered calls per language the agent spoke. */
  private byLanguage(boutiqueId: number, from: Date) {
    return this.prisma.$queryRaw<
      {
        language: string;
        calls: number;
        confirmed: number;
        avgDuration: number;
      }[]
    >(Prisma.sql`
      SELECT c.language AS "language",
             COUNT(*)::int AS "calls",
             COUNT(*) FILTER (WHERE c.status = 'confirmed')::int AS "confirmed",
             COALESCE(AVG(c."durationSeconds"), 0)::float8 AS "avgDuration"
      FROM calls c
      JOIN orders o ON o.id = c."orderId"
      WHERE o."boutiqueId" = ${boutiqueId}
        AND c."createdAt" >= ${from}
        AND c.language IS NOT NULL
      GROUP BY c.language
      ORDER BY "calls" DESC
    `);
  }

  /** Finished calls per attempt number: how often each attempt still confirms. */
  private byAttempt(boutiqueId: number, from: Date) {
    return this.prisma.$queryRaw<
      { attempt: number; calls: number; confirmed: number }[]
    >(Prisma.sql`
      SELECT c.attempt AS "attempt",
             COUNT(*)::int AS "calls",
             COUNT(*) FILTER (WHERE c.status = 'confirmed')::int AS "confirmed"
      FROM calls c
      JOIN orders o ON o.id = c."orderId"
      WHERE o."boutiqueId" = ${boutiqueId}
        AND c."createdAt" >= ${from}
        AND c.status <> 'pending'
      GROUP BY c.attempt
      ORDER BY c.attempt
    `);
  }
}
