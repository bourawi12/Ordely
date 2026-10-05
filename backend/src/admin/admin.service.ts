import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { toCsv } from '../common/csv';
import { DAY_MS, DEFAULT_TIMEZONE, startOf } from '../common/time';
import { PrismaService } from '../prisma/prisma.service';
import {
  ACTIVITY,
  MERCHANTS_CTE,
  PLANS_CTE,
  planAt,
  revenueIn,
} from './admin.sql';
import {
  CohortsQueryDto,
  ExportQueryDto,
  MerchantsQueryDto,
  PeriodQueryDto,
} from './dto/admin-query.dto';
import {
  DORMANT_DAYS,
  funnel,
  healthScore,
  HealthInput,
  merchantStatus,
  MerchantStatus,
} from './health';
import { Period, resolvePeriod } from './period';
import { planOf, PLANS } from './plans';

const CACHE_TTL_MS = 60_000;
const CACHE_MAX = 200;
/** Above this share of the monthly quota: an upsell candidate. */
export const UPSELL_THRESHOLD = 0.8;

export interface Metric {
  value: number;
  previous: number;
}

/** One merchant (shop + owner account) with its numbers. Never any end customer's data. */
export interface MerchantRow {
  id: number;
  name: string;
  ownerName: string | null;
  ownerEmail: string | null;
  signupAt: Date;
  /** Plan today ("free" once churned). */
  plan: string;
  /** The paid plan the shop subscribed to, even if churned since (revenue is attributed to it). */
  paidPlan: string | null;
  planStartedAt: Date | null;
  churnedAt: Date | null;
  onboarded: boolean;
  sector: string | null;
  orders: number;
  ordersTotal: number;
  calls: number;
  confirmed: number;
  refused: number;
  noAnswer: number;
  seconds: number;
  callsPrev: number;
  secondsPrev: number;
  monthCalls: number;
  quota: number;
  quotaUsed: number;
  callsTotal: number;
  lastActivityAt: Date | null;
  confirmationRate: number | null;
  revenue: number;
  revenuePrev: number;
  cost: number;
  margin: number;
  health: number;
  status: MerchantStatus;
}

type RawMerchant = Omit<
  MerchantRow,
  | 'name'
  | 'onboarded'
  | 'quota'
  | 'quotaUsed'
  | 'confirmationRate'
  | 'cost'
  | 'margin'
  | 'health'
  | 'status'
> & {
  name: string | null;
  onboardingCompletedAt: Date | null;
  calls14: number;
  callsPrev14: number;
};

const rate = (part: number, whole: number) => (whole > 0 ? part / whole : 0);

/**
 * The internal back office: aggregates over all merchants for product, pricing and growth
 * decisions. Reads only aggregates and merchant account info, never end customers' names or
 * phone numbers. Heavy reports are cached for a minute.
 */
@Injectable()
export class AdminService {
  private readonly cache = new Map<
    string,
    { expires: number; value: unknown }
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private get timezone() {
    return this.config.get<string>('APP_TIMEZONE', DEFAULT_TIMEZONE);
  }

  /** Estimated cost of one connected minute and of one call attempt, in TND. */
  get costs() {
    return {
      perMinute: Number(this.config.get('COST_PER_MINUTE', 0.35)),
      perCall: Number(this.config.get('COST_PER_CALL', 0.02)),
    };
  }

  private async cached<T>(key: string, compute: () => Promise<T>): Promise<T> {
    const hit = this.cache.get(key);
    if (hit && hit.expires > Date.now()) return hit.value as T;
    const value = await compute();
    if (this.cache.size >= CACHE_MAX) this.cache.clear();
    this.cache.set(key, { expires: Date.now() + CACHE_TTL_MS, value });
    return value;
  }

  private period(q: PeriodQueryDto): Period {
    const p = resolvePeriod(q);
    // Round "now" up to the next minute so that cache keys repeat within a minute (up, so
    // that nothing that already happened falls outside the window).
    if (q.range !== 'custom') {
      const to = new Date(Math.ceil(p.to.getTime() / 60_000) * 60_000);
      return resolvePeriod({ range: p.range }, to);
    }
    return p;
  }

  // ---------------------------------------------------------------- Overview

  async overview(q: PeriodQueryDto) {
    const p = this.period(q);
    return this.cached(
      `overview:${p.from.getTime()}:${p.to.getTime()}`,
      async () => {
        const [[k], plans, [f]] = await Promise.all([
          this.prisma.$queryRaw<Record<string, number>[]>(Prisma.sql`
          WITH ${MERCHANTS_CTE},
          fc AS (
            SELECT o."boutiqueId" AS b, MIN(c."createdAt") AS t
            FROM calls c JOIN orders o ON o.id = c."orderId"
            WHERE c.status <> 'pending' GROUP BY 1
          ),
          act AS (
            SELECT a.b,
              BOOL_OR(a.t >= ${p.to}::timestamptz - interval '30 days' AND a.t < ${p.to}) AS "nowActive",
              BOOL_OR(a.t >= ${p.from}::timestamptz - interval '30 days' AND a.t < ${p.from}) AS "prevActive"
            FROM ${ACTIVITY} a
            WHERE a.t >= ${p.from}::timestamptz - interval '30 days' AND a.t < ${p.to}
            GROUP BY a.b
          )
          SELECT
            COUNT(*) FILTER (WHERE m."createdAt" < ${p.to})::int AS "totalNow",
            COUNT(*) FILTER (WHERE m."createdAt" < ${p.from})::int AS "totalPrev",
            COUNT(*) FILTER (WHERE m."createdAt" >= ${p.from} AND m."createdAt" < ${p.to})::int AS "signupsNow",
            COUNT(*) FILTER (WHERE m."createdAt" >= ${p.prevFrom} AND m."createdAt" < ${p.from})::int AS "signupsPrev",
            COUNT(*) FILTER (WHERE fc.t < ${p.to})::int AS "activatedNow",
            COUNT(*) FILTER (WHERE fc.t < ${p.from})::int AS "activatedPrev",
            COUNT(*) FILTER (WHERE act."nowActive")::int AS "activeNow",
            COUNT(*) FILTER (WHERE act."prevActive")::int AS "activePrev",
            COUNT(*) FILTER (WHERE m."createdAt" < ${p.to} AND ${planAt(p.to)} <> 'free')::int AS "paidNow",
            COUNT(*) FILTER (WHERE m."createdAt" < ${p.from} AND ${planAt(p.from)} <> 'free')::int AS "paidPrev",
            COUNT(*) FILTER (WHERE m."churnedAt" >= ${p.from} AND m."churnedAt" < ${p.to})::int AS "churnedNow",
            COUNT(*) FILTER (WHERE m."churnedAt" >= ${p.prevFrom} AND m."churnedAt" < ${p.from})::int AS "churnedPrev"
          FROM merchants m
          LEFT JOIN fc ON fc.b = m.id
          LEFT JOIN act ON act.b = m.id
        `),
          this.planMix(p),
          this.prisma.$queryRaw<Record<string, number>[]>(Prisma.sql`
          WITH ${MERCHANTS_CTE},
          fo AS (SELECT DISTINCT "boutiqueId" AS b FROM orders),
          fc AS (
            SELECT o."boutiqueId" AS b, COUNT(*)::int AS n
            FROM calls c JOIN orders o ON o.id = c."orderId"
            WHERE c.status <> 'pending' GROUP BY 1
          )
          SELECT
            COUNT(*)::int AS "signup",
            COUNT(*) FILTER (WHERE m."onboardingCompletedAt" IS NOT NULL)::int AS "onboarded",
            COUNT(fo.b)::int AS "firstOrder",
            COUNT(fc.b)::int AS "firstCall",
            COUNT(*) FILTER (WHERE fc.n >= 100)::int AS "hundredCalls",
            COUNT(*) FILTER (WHERE m."planStartedAt" IS NOT NULL)::int AS "paid"
          FROM merchants m
          LEFT JOIN fo ON fo.b = m.id
          LEFT JOIN fc ON fc.b = m.id
          WHERE m."createdAt" >= ${p.from} AND m."createdAt" < ${p.to}
        `),
        ]);

        const metric = (name: string): Metric => ({
          value: k[`${name}Now`],
          previous: k[`${name}Prev`],
        });
        const mrr: Metric = {
          value: plans.reduce((s, x) => s + x.mrr.value, 0),
          previous: plans.reduce((s, x) => s + x.mrr.previous, 0),
        };
        return {
          period: p,
          kpis: {
            totalMerchants: metric('total'),
            newSignups: metric('signups'),
            activatedMerchants: metric('activated'),
            activeMerchants: metric('active'),
            paidMerchants: metric('paid'),
            freeMerchants: {
              value: k.totalNow - k.paidNow,
              previous: k.totalPrev - k.paidPrev,
            },
            mrr,
            churnedMerchants: metric('churned'),
          },
          plans,
          funnel: funnel([
            { key: 'signup', label: 'Signed up', count: f.signup },
            {
              key: 'onboarded',
              label: 'Onboarding completed',
              count: f.onboarded,
            },
            {
              key: 'firstOrder',
              label: 'First order imported',
              count: f.firstOrder,
            },
            { key: 'firstCall', label: 'First AI call', count: f.firstCall },
            { key: 'hundredCalls', label: '100 calls', count: f.hundredCalls },
            { key: 'paid', label: 'Upgraded to paid', count: f.paid },
          ]),
        };
      },
    );
  }

  /** Merchants and MRR per plan at the end of the period and at its start. */
  private async planMix(p: Period) {
    const rows = await this.prisma.$queryRaw<
      { code: string; now: number; prev: number }[]
    >(Prisma.sql`
      WITH ${MERCHANTS_CTE}, ${PLANS_CTE}
      SELECT pl.code,
        COUNT(m.id) FILTER (WHERE m."createdAt" < ${p.to} AND ${planAt(p.to)} = pl.code)::int AS "now",
        COUNT(m.id) FILTER (WHERE m."createdAt" < ${p.from} AND ${planAt(p.from)} = pl.code)::int AS "prev"
      FROM plans pl CROSS JOIN merchants m
      GROUP BY pl.code
    `);
    return PLANS.map((plan) => {
      const r = rows.find((x) => x.code === plan.code) ?? { now: 0, prev: 0 };
      return {
        plan: plan.code,
        label: plan.label,
        price: plan.price,
        merchants: { value: r.now, previous: r.prev },
        mrr: { value: r.now * plan.price, previous: r.prev * plan.price },
      };
    });
  }

  // ---------------------------------------------------------------- Merchants

  /** One row per merchant with its numbers over the period: the base of several reports. */
  async merchantRows(p: Period): Promise<MerchantRow[]> {
    return this.cached(
      `rows:${p.from.getTime()}:${p.to.getTime()}`,
      async () => {
        const now = new Date();
        const monthStart = await startOf(this.prisma, 'month', this.timezone);
        const raw = await this.prisma.$queryRaw<RawMerchant[]>(Prisma.sql`
        WITH ${MERCHANTS_CTE}, ${PLANS_CTE},
        owner AS (
          SELECT DISTINCT ON (u."boutiqueId") u."boutiqueId" AS b, u.name, u.email
          FROM users u WHERE NOT u."isPlatformAdmin"
          ORDER BY u."boutiqueId", u.id
        ),
        o AS (
          SELECT "boutiqueId" AS b,
            COUNT(*) FILTER (WHERE "createdAt" >= ${p.from} AND "createdAt" < ${p.to})::int AS orders,
            COUNT(*)::int AS "ordersTotal",
            MAX("createdAt") AS "lastOrder"
          FROM orders GROUP BY 1
        ),
        c AS (
          SELECT o."boutiqueId" AS b,
            COUNT(*) FILTER (WHERE c.status <> 'pending' AND c."createdAt" >= ${p.from} AND c."createdAt" < ${p.to})::int AS calls,
            COUNT(*) FILTER (WHERE c.status = 'confirmed' AND c."createdAt" >= ${p.from} AND c."createdAt" < ${p.to})::int AS confirmed,
            COUNT(*) FILTER (WHERE c.status = 'failed' AND c."createdAt" >= ${p.from} AND c."createdAt" < ${p.to})::int AS refused,
            COUNT(*) FILTER (WHERE c.status = 'no_answer' AND c."createdAt" >= ${p.from} AND c."createdAt" < ${p.to})::int AS "noAnswer",
            COALESCE(SUM(c."durationSeconds") FILTER (WHERE c."createdAt" >= ${p.from} AND c."createdAt" < ${p.to}), 0)::int AS seconds,
            COUNT(*) FILTER (WHERE c.status <> 'pending' AND c."createdAt" >= ${p.prevFrom} AND c."createdAt" < ${p.prevTo})::int AS "callsPrev",
            COALESCE(SUM(c."durationSeconds") FILTER (WHERE c."createdAt" >= ${p.prevFrom} AND c."createdAt" < ${p.prevTo}), 0)::int AS "secondsPrev",
            COUNT(*) FILTER (WHERE c.status <> 'pending' AND c."createdAt" >= ${monthStart})::int AS "monthCalls",
            COUNT(*) FILTER (WHERE c.status <> 'pending' AND c."createdAt" >= ${now}::timestamptz - interval '14 days')::int AS "calls14",
            COUNT(*) FILTER (WHERE c.status <> 'pending' AND c."createdAt" >= ${now}::timestamptz - interval '28 days'
              AND c."createdAt" < ${now}::timestamptz - interval '14 days')::int AS "callsPrev14",
            COUNT(*) FILTER (WHERE c.status <> 'pending')::int AS "callsTotal",
            MAX(c."createdAt") AS "lastCall"
          FROM calls c JOIN orders o ON o.id = c."orderId"
          GROUP BY 1
        )
        SELECT m.id, m.name, owner.name AS "ownerName", owner.email AS "ownerEmail",
          m."createdAt" AS "signupAt", ${planAt(now)} AS plan, m.plan AS "paidPlan",
          m."planStartedAt", m."churnedAt", m."onboardingCompletedAt", m.sector,
          COALESCE(o.orders, 0) AS orders, COALESCE(o."ordersTotal", 0) AS "ordersTotal",
          COALESCE(c.calls, 0) AS calls, COALESCE(c.confirmed, 0) AS confirmed,
          COALESCE(c.refused, 0) AS refused, COALESCE(c."noAnswer", 0) AS "noAnswer",
          COALESCE(c.seconds, 0) AS seconds,
          COALESCE(c."callsPrev", 0) AS "callsPrev", COALESCE(c."secondsPrev", 0) AS "secondsPrev",
          COALESCE(c."monthCalls", 0) AS "monthCalls",
          COALESCE(c."calls14", 0) AS "calls14", COALESCE(c."callsPrev14", 0) AS "callsPrev14",
          COALESCE(c."callsTotal", 0) AS "callsTotal",
          GREATEST(o."lastOrder", c."lastCall") AS "lastActivityAt",
          ${revenueIn(p.from, p.to)} AS revenue,
          ${revenueIn(p.prevFrom, p.prevTo)} AS "revenuePrev"
        FROM merchants m
        LEFT JOIN owner ON owner.b = m.id
        LEFT JOIN o ON o.b = m.id
        LEFT JOIN c ON c.b = m.id
        LEFT JOIN plans p ON p.code = m.plan AND m."planStartedAt" IS NOT NULL
      `);

        const { perMinute, perCall } = this.costs;
        return raw.map((r): MerchantRow => {
          const health: HealthInput = {
            signupAt: r.signupAt,
            lastActivityAt: r.lastActivityAt,
            churnedAt: r.churnedAt,
            onboarded: r.onboardingCompletedAt !== null,
            calls14: r.calls14,
            callsPrev14: r.callsPrev14,
            confirmationRate: r.calls > 0 ? r.confirmed / r.calls : null,
          };
          const quota = planOf(r.plan).quota;
          const cost = (r.seconds / 60) * perMinute + r.calls * perCall;
          return {
            id: r.id,
            name: r.name ?? `Shop #${r.id}`,
            ownerName: r.ownerName,
            ownerEmail: r.ownerEmail,
            signupAt: r.signupAt,
            plan: r.plan,
            paidPlan: r.paidPlan,
            planStartedAt: r.planStartedAt,
            churnedAt: r.churnedAt,
            onboarded: health.onboarded,
            sector: r.sector,
            orders: r.orders,
            ordersTotal: r.ordersTotal,
            calls: r.calls,
            confirmed: r.confirmed,
            refused: r.refused,
            noAnswer: r.noAnswer,
            seconds: r.seconds,
            callsPrev: r.callsPrev,
            secondsPrev: r.secondsPrev,
            monthCalls: r.monthCalls,
            quota,
            quotaUsed: rate(r.monthCalls, quota),
            callsTotal: r.callsTotal,
            lastActivityAt: r.lastActivityAt,
            confirmationRate: health.confirmationRate,
            revenue: r.revenue,
            revenuePrev: r.revenuePrev,
            cost,
            margin: r.revenue - cost,
            health: healthScore(health, now),
            status: merchantStatus(health, now),
          };
        });
      },
    );
  }

  async merchants(q: MerchantsQueryDto) {
    const p = this.period(q);
    let rows = await this.merchantRows(p);
    const search = q.search?.toLowerCase();
    if (search) {
      rows = rows.filter((r) =>
        [r.name, r.ownerName, r.ownerEmail].some((v) =>
          v?.toLowerCase().includes(search),
        ),
      );
    }
    if (q.plan) rows = rows.filter((r) => r.plan === q.plan);
    if (q.status) rows = rows.filter((r) => r.status === q.status);

    const sort = q.sort ?? 'health';
    const dir =
      (q.dir ?? (sort === 'name' ? 'asc' : 'desc')) === 'asc' ? 1 : -1;
    const key = (r: MerchantRow): number | string => {
      switch (sort) {
        case 'name':
          return r.name.toLowerCase();
        case 'plan':
          return PLANS.findIndex((x) => x.code === r.plan);
        case 'signupAt':
          return r.signupAt.getTime();
        case 'lastActivityAt':
          return r.lastActivityAt?.getTime() ?? 0;
        case 'confirmationRate':
          return r.confirmationRate ?? -1;
        default:
          return r[sort];
      }
    };
    rows = [...rows].sort((a, b) => {
      const x = key(a);
      const y = key(b);
      return (x < y ? -1 : x > y ? 1 : a.id - b.id) * dir;
    });
    return { period: p, total: rows.length, rows };
  }

  async merchant(id: number, q: PeriodQueryDto) {
    const p = this.period(q);
    const row = (await this.merchantRows(p)).find((r) => r.id === id);
    if (!row) throw new NotFoundException(`Merchant ${id} not found`);
    const tz = this.timezone;
    const [shop, daily] = await Promise.all([
      this.prisma.boutique.findUnique({
        where: { id },
        select: {
          platform: true,
          callLanguages: true,
          callStartTime: true,
          callEndTime: true,
          confirmationProcess: true,
          deliveryZones: true,
          dailyOrderVolume: true,
          acquisitionSource: true,
          carrier: true,
          onboardingCompletedAt: true,
        },
      }),
      this.prisma.$queryRaw<
        { date: string; orders: number; calls: number; confirmed: number }[]
      >(Prisma.sql`
        WITH days AS (${this.daysSeries(p)}),
        od AS (
          SELECT ("createdAt" AT TIME ZONE ${tz})::date AS day, COUNT(*)::int AS orders
          FROM orders WHERE "boutiqueId" = ${id}
            AND "createdAt" >= ${p.from} AND "createdAt" < ${p.to}
          GROUP BY 1
        ),
        cd AS (
          SELECT (c."createdAt" AT TIME ZONE ${tz})::date AS day,
            COUNT(*) FILTER (WHERE c.status <> 'pending')::int AS calls,
            COUNT(*) FILTER (WHERE c.status = 'confirmed')::int AS confirmed
          FROM calls c JOIN orders o ON o.id = c."orderId"
          WHERE o."boutiqueId" = ${id} AND c."createdAt" >= ${p.from} AND c."createdAt" < ${p.to}
          GROUP BY 1
        )
        SELECT to_char(days.day, 'YYYY-MM-DD') AS date,
          COALESCE(od.orders, 0) AS orders, COALESCE(cd.calls, 0) AS calls,
          COALESCE(cd.confirmed, 0) AS confirmed
        FROM days LEFT JOIN od USING (day) LEFT JOIN cd USING (day)
        ORDER BY days.day
      `),
    ]);
    return { period: p, merchant: row, shop, daily };
  }

  private daysSeries(p: Period) {
    const tz = this.timezone;
    return Prisma.sql`SELECT generate_series(
      (${p.from}::timestamptz AT TIME ZONE ${tz})::date,
      ((${p.to}::timestamptz - interval '1 second') AT TIME ZONE ${tz})::date,
      interval '1 day'
    )::date AS day`;
  }

  // ---------------------------------------------------------------- Usage

  async usage(q: PeriodQueryDto) {
    const p = this.period(q);
    const tz = this.timezone;
    return this.cached(
      `usage:${p.from.getTime()}:${p.to.getTime()}`,
      async () => {
        const [daily, [prev], rows] = await Promise.all([
          this.prisma.$queryRaw<
            {
              date: string;
              calls: number;
              orders: number;
              activeMerchants: number;
            }[]
          >(Prisma.sql`
          WITH ${MERCHANTS_CTE},
          days AS (${this.daysSeries(p)}),
          cd AS (
            SELECT (c."createdAt" AT TIME ZONE ${tz})::date AS day, COUNT(*)::int AS calls,
              COUNT(DISTINCT o."boutiqueId")::int AS merchants
            FROM calls c JOIN orders o ON o.id = c."orderId" JOIN merchants m ON m.id = o."boutiqueId"
            WHERE c.status <> 'pending' AND c."createdAt" >= ${p.from} AND c."createdAt" < ${p.to}
            GROUP BY 1
          ),
          od AS (
            SELECT (o."createdAt" AT TIME ZONE ${tz})::date AS day, COUNT(*)::int AS orders
            FROM orders o JOIN merchants m ON m.id = o."boutiqueId"
            WHERE o."createdAt" >= ${p.from} AND o."createdAt" < ${p.to}
            GROUP BY 1
          )
          SELECT to_char(days.day, 'YYYY-MM-DD') AS date,
            COALESCE(cd.calls, 0) AS calls, COALESCE(od.orders, 0) AS orders,
            COALESCE(cd.merchants, 0) AS "activeMerchants"
          FROM days LEFT JOIN cd USING (day) LEFT JOIN od USING (day)
          ORDER BY days.day
        `),
          this.prisma.$queryRaw<{ orders: number }[]>(Prisma.sql`
          WITH ${MERCHANTS_CTE}
          SELECT COUNT(*)::int AS orders FROM orders o JOIN merchants m ON m.id = o."boutiqueId"
          WHERE o."createdAt" >= ${p.prevFrom} AND o."createdAt" < ${p.prevTo}
        `),
          this.merchantRows(p),
        ]);

        const now = Date.now();
        const calls = rows.reduce((s, r) => s + r.calls, 0);
        const callsPrev = rows.reduce((s, r) => s + r.callsPrev, 0);
        const callers = rows.filter((r) => r.calls > 0).length;
        const callersPrev = rows.filter((r) => r.callsPrev > 0).length;
        const live = rows.filter((r) => r.status !== 'churned');
        const brief = (r: MerchantRow) => ({
          id: r.id,
          name: r.name,
          plan: r.plan,
        });
        return {
          period: p,
          totals: {
            calls: { value: calls, previous: callsPrev },
            orders: {
              value: rows.reduce((s, r) => s + r.orders, 0),
              previous: prev.orders,
            },
            avgCallsPerMerchant: {
              value: rate(calls, callers),
              previous: rate(callsPrev, callersPrev),
            },
            /** Average share of the monthly quota used, over merchants not churned. */
            avgQuotaUsed: rate(
              live.reduce((s, r) => s + r.quotaUsed, 0),
              live.length,
            ),
          },
          daily,
          upsell: live
            .filter((r) => r.quotaUsed >= UPSELL_THRESHOLD)
            .sort((a, b) => b.quotaUsed - a.quotaUsed)
            .map((r) => ({
              ...brief(r),
              used: r.monthCalls,
              quota: r.quota,
              share: r.quotaUsed,
            })),
          dormant: rows
            .filter((r) => r.status === 'dormant' && r.lastActivityAt)
            .map((r) => ({
              ...brief(r),
              lastActivityAt: r.lastActivityAt,
              daysIdle: Math.floor(
                (now - r.lastActivityAt!.getTime()) / DAY_MS,
              ),
              callsTotal: r.callsTotal,
            }))
            .sort((a, b) => a.daysIdle - b.daysIdle),
          dormantDays: DORMANT_DAYS,
          top: [...rows]
            .sort((a, b) => b.calls - a.calls)
            .filter((r) => r.calls > 0)
            .slice(0, 10)
            .map((r) => ({ ...brief(r), calls: r.calls, orders: r.orders })),
        };
      },
    );
  }

  // ---------------------------------------------------------------- Call quality

  async quality(q: PeriodQueryDto) {
    const p = this.period(q);
    const tz = this.timezone;
    return this.cached(
      `quality:${p.from.getTime()}:${p.to.getTime()}`,
      async () => {
        const totals = (a: Date, b: Date) =>
          this.prisma.$queryRaw<
            {
              calls: number;
              confirmed: number;
              refused: number;
              noAnswer: number;
              avgDuration: number;
              avgAttempts: number;
            }[]
          >(Prisma.sql`
          WITH ${MERCHANTS_CTE}
          SELECT COUNT(*)::int AS calls,
            COUNT(*) FILTER (WHERE c.status = 'confirmed')::int AS confirmed,
            COUNT(*) FILTER (WHERE c.status = 'failed')::int AS refused,
            COUNT(*) FILTER (WHERE c.status = 'no_answer')::int AS "noAnswer",
            COALESCE(AVG(c."durationSeconds") FILTER (WHERE c."durationSeconds" IS NOT NULL), 0)::float8 AS "avgDuration",
            COALESCE(AVG(c.attempt) FILTER (WHERE c.status = 'confirmed'), 0)::float8 AS "avgAttempts"
          FROM calls c JOIN orders o ON o.id = c."orderId" JOIN merchants m ON m.id = o."boutiqueId"
          WHERE c.status <> 'pending' AND c."createdAt" >= ${a} AND c."createdAt" < ${b}
        `);
        const finished = Prisma.sql`
        FROM calls c JOIN orders o ON o.id = c."orderId" JOIN merchants m ON m.id = o."boutiqueId"
        WHERE c.status <> 'pending' AND c."createdAt" >= ${p.from} AND c."createdAt" < ${p.to}`;

        const [[cur], [prev], heatmap, byLanguage, bySector, rows] =
          await Promise.all([
            totals(p.from, p.to),
            totals(p.prevFrom, p.prevTo),
            this.prisma.$queryRaw<
              {
                weekday: number;
                hour: number;
                calls: number;
                confirmed: number;
              }[]
            >(Prisma.sql`
          WITH ${MERCHANTS_CTE}
          SELECT EXTRACT(ISODOW FROM c."createdAt" AT TIME ZONE ${tz})::int AS weekday,
            EXTRACT(HOUR FROM c."createdAt" AT TIME ZONE ${tz})::int AS hour,
            COUNT(*)::int AS calls,
            COUNT(*) FILTER (WHERE c.status = 'confirmed')::int AS confirmed
          ${finished}
          GROUP BY 1, 2 ORDER BY 1, 2
        `),
            this.prisma.$queryRaw<
              {
                language: string;
                calls: number;
                confirmed: number;
                avgDuration: number;
              }[]
            >(Prisma.sql`
          WITH ${MERCHANTS_CTE}
          SELECT c.language, COUNT(*)::int AS calls,
            COUNT(*) FILTER (WHERE c.status = 'confirmed')::int AS confirmed,
            COALESCE(AVG(c."durationSeconds"), 0)::float8 AS "avgDuration"
          ${finished} AND c.language IS NOT NULL
          GROUP BY 1 ORDER BY calls DESC
        `),
            this.prisma.$queryRaw<
              {
                sector: string;
                calls: number;
                confirmed: number;
                refused: number;
              }[]
            >(Prisma.sql`
          WITH ${MERCHANTS_CTE}
          SELECT COALESCE(m.sector, 'unknown') AS sector, COUNT(*)::int AS calls,
            COUNT(*) FILTER (WHERE c.status = 'confirmed')::int AS confirmed,
            COUNT(*) FILTER (WHERE c.status = 'failed')::int AS refused
          ${finished}
          GROUP BY 1 ORDER BY calls DESC
        `),
            this.merchantRows(p),
          ]);

        const rates = (t: typeof cur) => ({
          confirmationRate: rate(t.confirmed, t.calls),
          cancellationRate: rate(t.refused, t.calls),
          noAnswerRate: rate(t.noAnswer, t.calls),
        });
        const r1 = rates(cur);
        const r0 = rates(prev);
        return {
          period: p,
          totals: {
            calls: { value: cur.calls, previous: prev.calls },
            confirmationRate: {
              value: r1.confirmationRate,
              previous: r0.confirmationRate,
            },
            cancellationRate: {
              value: r1.cancellationRate,
              previous: r0.cancellationRate,
            },
            noAnswerRate: { value: r1.noAnswerRate, previous: r0.noAnswerRate },
            avgDuration: { value: cur.avgDuration, previous: prev.avgDuration },
            avgAttempts: { value: cur.avgAttempts, previous: prev.avgAttempts },
          },
          heatmap,
          byLanguage,
          bySector,
          byMerchant: rows
            .filter((r) => r.calls > 0)
            .sort((a, b) => b.calls - a.calls)
            .slice(0, 25)
            .map((r) => ({
              id: r.id,
              name: r.name,
              calls: r.calls,
              confirmationRate: rate(r.confirmed, r.calls),
              cancellationRate: rate(r.refused, r.calls),
              noAnswerRate: rate(r.noAnswer, r.calls),
              avgDuration: rate(r.seconds, r.confirmed + r.refused),
            })),
        };
      },
    );
  }

  // ---------------------------------------------------------------- Revenue

  async revenue(q: PeriodQueryDto) {
    const p = this.period(q);
    const [rows, plans] = await Promise.all([
      this.merchantRows(p),
      this.planMix(p),
    ]);
    const { perMinute, perCall } = this.costs;
    const sum = (f: (r: MerchantRow) => number) =>
      rows.reduce((s, r) => s + f(r), 0);
    const revenue = sum((r) => r.revenue);
    const revenuePrev = sum((r) => r.revenuePrev);
    const cost = sum((r) => r.cost);
    const costPrev = sum(
      (r) => (r.secondsPrev / 60) * perMinute + r.callsPrev * perCall,
    );
    const calls = sum((r) => r.calls);
    const callsPrev = sum((r) => r.callsPrev);
    return {
      period: p,
      costs: { perMinute, perCall, currency: 'TND' },
      totals: {
        revenue: { value: revenue, previous: revenuePrev },
        cost: { value: cost, previous: costPrev },
        grossMargin: {
          value: revenue - cost,
          previous: revenuePrev - costPrev,
        },
        marginRate: {
          value: rate(revenue - cost, revenue),
          previous: rate(revenuePrev - costPrev, revenuePrev),
        },
        revenuePerCall: {
          value: rate(revenue, calls),
          previous: rate(revenuePrev, callsPrev),
        },
        costPerCall: {
          value: rate(cost, calls),
          previous: rate(costPrev, callsPrev),
        },
        mrr: {
          value: plans.reduce((s, x) => s + x.mrr.value, 0),
          previous: plans.reduce((s, x) => s + x.mrr.previous, 0),
        },
      },
      byPlan: PLANS.map((plan) => {
        const ofPlan = rows.filter((r) => r.plan === plan.code);
        const rev = rows
          .filter((r) => r.paidPlan === plan.code)
          .reduce((s, r) => s + r.revenue, 0);
        const c = ofPlan.reduce((s, r) => s + r.cost, 0);
        return {
          plan: plan.code,
          label: plan.label,
          price: plan.price,
          merchants: ofPlan.length,
          mrr: plans.find((x) => x.plan === plan.code)?.mrr.value ?? 0,
          revenue: rev,
          cost: c,
          margin: rev - c,
        };
      }),
      byMerchant: rows
        .filter((r) => r.revenue > 0 || r.cost > 0)
        .sort((a, b) => a.margin - b.margin)
        .map((r) => ({
          id: r.id,
          name: r.name,
          plan: r.plan,
          calls: r.calls,
          minutes: r.seconds / 60,
          revenue: r.revenue,
          cost: r.cost,
          margin: r.margin,
        })),
    };
  }

  // ---------------------------------------------------------------- Cohorts

  async cohorts(q: CohortsQueryDto) {
    const weeks = q.weeks ?? 12;
    const tz = this.timezone;
    const now = new Date(Math.ceil(Date.now() / 60_000) * 60_000);
    return this.cached(`cohorts:${weeks}:${now.getTime()}`, async () => {
      const since = new Date(now.getTime() - weeks * 7 * DAY_MS);
      const rows = await this.prisma.$queryRaw<
        {
          week: string;
          size: number;
          w1: number;
          w2: number;
          w4: number;
          w8: number;
        }[]
      >(Prisma.sql`
        WITH ${MERCHANTS_CTE},
        cm AS (
          SELECT m.id, m."createdAt" AS signup,
            date_trunc('week', m."createdAt" AT TIME ZONE ${tz}) AS cohort
          FROM merchants m
          WHERE m."createdAt" >= date_trunc('week', ${since}::timestamptz AT TIME ZONE ${tz}) AT TIME ZONE ${tz}
        ),
        act AS (
          SELECT a.b,
            BOOL_OR(a.t >= cm.signup + interval '7 days' AND a.t < cm.signup + interval '14 days') AS w1,
            BOOL_OR(a.t >= cm.signup + interval '14 days' AND a.t < cm.signup + interval '21 days') AS w2,
            BOOL_OR(a.t >= cm.signup + interval '28 days' AND a.t < cm.signup + interval '35 days') AS w4,
            BOOL_OR(a.t >= cm.signup + interval '56 days' AND a.t < cm.signup + interval '63 days') AS w8
          FROM ${ACTIVITY} a JOIN cm ON cm.id = a.b
          WHERE a.t >= cm.signup + interval '7 days'
          GROUP BY a.b
        )
        SELECT to_char(cm.cohort, 'YYYY-MM-DD') AS week, COUNT(*)::int AS size,
          COUNT(*) FILTER (WHERE act.w1)::int AS w1, COUNT(*) FILTER (WHERE act.w2)::int AS w2,
          COUNT(*) FILTER (WHERE act.w4)::int AS w4, COUNT(*) FILTER (WHERE act.w8)::int AS w8
        FROM cm LEFT JOIN act ON act.b = cm.id
        GROUP BY cm.cohort ORDER BY cm.cohort DESC
      `);
      return {
        weeks,
        cohorts: rows.map((r) => {
          // A week-k figure is shown once every member of the cohort has lived through it.
          const start = new Date(`${r.week}T00:00:00+01:00`).getTime();
          const ready = (k: number) =>
            start + (7 + 7 * (k + 1)) * DAY_MS <= now.getTime();
          const share = (k: number, n: number) =>
            ready(k) ? rate(n, r.size) : null;
          return {
            week: r.week,
            size: r.size,
            retention: {
              week1: share(1, r.w1),
              week2: share(2, r.w2),
              week4: share(4, r.w4),
              week8: share(8, r.w8),
            },
          };
        }),
      };
    });
  }

  // ---------------------------------------------------------------- CSV

  async exportCsv(dataset: string, q: ExportQueryDto): Promise<string> {
    const pct = (v: number | null) => (v === null ? '' : (v * 100).toFixed(1));
    const money = (v: number) => v.toFixed(3);
    switch (dataset) {
      case 'merchants': {
        const { rows } = await this.merchants(q);
        return toCsv(
          [
            'merchant_id',
            'shop',
            'owner_name',
            'owner_email',
            'signup_at',
            'plan',
            'status',
            'health',
            'calls_this_month',
            'monthly_quota',
            'quota_used_pct',
            'orders',
            'calls',
            'confirmation_rate_pct',
            'last_activity_at',
            'revenue_tnd',
            'cost_tnd',
            'margin_tnd',
          ],
          rows.map((r) => [
            r.id,
            r.name,
            r.ownerName,
            r.ownerEmail,
            r.signupAt,
            r.plan,
            r.status,
            r.health,
            r.monthCalls,
            r.quota,
            pct(r.quotaUsed),
            r.orders,
            r.calls,
            pct(r.confirmationRate),
            r.lastActivityAt,
            money(r.revenue),
            money(r.cost),
            money(r.margin),
          ]),
        );
      }
      case 'overview': {
        const o = await this.overview(q);
        return toCsv(
          ['section', 'metric', 'value', 'previous_or_share'],
          [
            ...Object.entries(o.kpis).map(([k, m]) => [
              'kpi',
              k,
              m.value,
              m.previous,
            ]),
            ...o.plans.map((x) => [
              'mrr_by_plan',
              x.plan,
              x.mrr.value,
              x.mrr.previous,
            ]),
            ...o.funnel.map((s) => ['funnel', s.key, s.count, pct(s.ofTotal)]),
          ],
        );
      }
      case 'usage': {
        const u = await this.usage(q);
        return toCsv(
          ['date', 'calls', 'orders', 'active_merchants'],
          u.daily.map((d) => [d.date, d.calls, d.orders, d.activeMerchants]),
        );
      }
      case 'quality': {
        const x = await this.quality(q);
        return toCsv(
          [
            'merchant_id',
            'shop',
            'calls',
            'confirmation_rate_pct',
            'cancellation_rate_pct',
            'no_answer_rate_pct',
            'avg_duration_s',
          ],
          x.byMerchant.map((r) => [
            r.id,
            r.name,
            r.calls,
            pct(r.confirmationRate),
            pct(r.cancellationRate),
            pct(r.noAnswerRate),
            Math.round(r.avgDuration),
          ]),
        );
      }
      case 'revenue': {
        const r = await this.revenue(q);
        return toCsv(
          [
            'plan',
            'price_tnd',
            'merchants',
            'mrr_tnd',
            'revenue_tnd',
            'cost_tnd',
            'margin_tnd',
          ],
          r.byPlan.map((x) => [
            x.plan,
            x.price,
            x.merchants,
            money(x.mrr),
            money(x.revenue),
            money(x.cost),
            money(x.margin),
          ]),
        );
      }
      case 'cohorts': {
        const c = await this.cohorts(q);
        return toCsv(
          [
            'cohort_week',
            'merchants',
            'week1_pct',
            'week2_pct',
            'week4_pct',
            'week8_pct',
          ],
          c.cohorts.map((x) => [
            x.week,
            x.size,
            pct(x.retention.week1),
            pct(x.retention.week2),
            pct(x.retention.week4),
            pct(x.retention.week8),
          ]),
        );
      }
      default:
        throw new NotFoundException(`Unknown export ${dataset}`);
    }
  }
}
