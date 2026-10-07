import { Plan, planOf, PLANS } from '../admin/plans';

/**
 * Billing rules kept free of I/O. Plans and prices come from the shared catalogue
 * (src/admin/plans.ts), the same one the back office uses for MRR and quotas.
 */

/**
 * The plan that fits a shop's declared daily order volume (boutique-options ORDER_VOLUMES),
 * assuming about 1.3 calls per order over 30 days. No answer yet: the free plan.
 */
const RECOMMENDED: Record<string, string> = {
  lt20: 'free', //     < 20/day  → up to ~500 calls a month
  '20_50': 'starter', // up to ~1,500
  '50_100': 'growth', // up to ~5,000
  '100_300': 'pro', //  up to ~15,000
  gt300: 'pro',
};

export function recommendedPlan(
  dailyOrderVolume: string | null | undefined,
): Plan {
  return planOf(RECOMMENDED[dailyOrderVolume ?? ''] ?? 'free');
}

/** The plan a shop is on right now: its paid plan while it runs, otherwise free. */
export function currentPlan(shop: {
  plan: string | null;
  planStartedAt: Date | null;
  churnedAt: Date | null;
}): Plan {
  const running = shop.plan && shop.planStartedAt && !shop.churnedAt;
  return running ? planOf(shop.plan) : PLANS[0];
}
