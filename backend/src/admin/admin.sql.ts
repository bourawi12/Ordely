import { Prisma } from '@prisma/client';
import { PLANS } from './plans';

/**
 * SQL building blocks shared by the back office queries. Every query starts from `merchants`:
 * shops with at least one non-admin user (the Ordely team's own shops are not customers).
 */
export const MERCHANTS_CTE = Prisma.sql`merchants AS (
  SELECT b.* FROM boutiques b
  WHERE EXISTS (
    SELECT 1 FROM users u WHERE u."boutiqueId" = b.id AND NOT u."isPlatformAdmin"
  )
)`;

/** The plan catalogue as a table: plans(code, price, quota). */
export const PLANS_CTE = Prisma.sql`plans(code, price, quota) AS (VALUES ${Prisma.join(
  PLANS.map(
    (p) => Prisma.sql`(${p.code}::text, ${p.price}::numeric, ${p.quota}::int)`,
  ),
)})`;

/** Every order and call as (shop, moment): what "activity" means. */
export const ACTIVITY = Prisma.sql`(
  SELECT "boutiqueId" AS b, "createdAt" AS t FROM orders
  UNION ALL
  SELECT o."boutiqueId", c."createdAt" FROM calls c JOIN orders o ON o.id = c."orderId"
)`;

/** The plan code a merchant (alias m) was on at moment t: its paid plan, else "free". */
export function planAt(t: Date) {
  return Prisma.sql`(CASE
    WHEN m.plan IS NOT NULL AND m."planStartedAt" <= ${t}
      AND (m."churnedAt" IS NULL OR m."churnedAt" > ${t})
    THEN m.plan ELSE 'free' END)`;
}

/**
 * Subscription revenue a merchant (alias m, plan alias p joined on m.plan) earned in [a, b):
 * the monthly price prorated to the days its paid plan was running (30-day months).
 */
export function revenueIn(a: Date, b: Date) {
  return Prisma.sql`COALESCE(p.price * GREATEST(0, EXTRACT(EPOCH FROM (
    LEAST(${b}::timestamptz, COALESCE(m."churnedAt", ${b}::timestamptz))
    - GREATEST(${a}::timestamptz, m."planStartedAt")
  ))) / 2592000, 0)::float8`;
}
