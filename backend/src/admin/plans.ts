/**
 * Plan catalogue used by the back office (MRR, revenue, quotas). Prices are monthly, in TND.
 * A shop's plan is boutiques.plan (null = free). The merchant app still shows the single plan
 * from PLAN_NAME / PLAN_CALL_LIMIT; the free quota here follows PLAN_CALL_LIMIT's default.
 */
export interface Plan {
  code: string;
  label: string;
  /** Monthly price in TND. */
  price: number;
  /** Calls included per calendar month. */
  quota: number;
}

export const PLANS: readonly Plan[] = [
  { code: 'starter', label: 'Starter', price: 79, quota: 1500 },
  { code: 'growth', label: 'Growth', price: 199, quota: 5000 },
  { code: 'pro', label: 'Pro', price: 449, quota: 15000 },
];

export const PLAN_CODES = PLANS.map((p) => p.code);
export const PAID_PLAN_CODES = PLAN_CODES.filter((c) => c !== 'free');

export function planOf(code: string | null | undefined): Plan {
  return PLANS.find((p) => p.code === code) ?? PLANS[0];
}
