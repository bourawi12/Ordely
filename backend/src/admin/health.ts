import { DAY_MS } from '../common/time';

export const MERCHANT_STATUSES = [
  'active',
  'new',
  'dormant',
  'churned',
] as const;
export type MerchantStatus = (typeof MERCHANT_STATUSES)[number];

/** No order and no call for this long: dormant (churn risk). */
export const DORMANT_DAYS = 14;
/** Signed up this recently: "new", whatever the activity. */
export const NEW_DAYS = 14;

export interface HealthInput {
  signupAt: Date;
  lastActivityAt: Date | null;
  churnedAt: Date | null;
  onboarded: boolean;
  /** Finished calls in the last 14 days and the 14 days before. */
  calls14: number;
  callsPrev14: number;
  /** Confirmed / finished calls over the selected period; null without calls. */
  confirmationRate: number | null;
}

/**
 * Health score, 0–100: a quick "is this merchant doing well with Ordely" signal.
 *  - Recency (40): last order or call ≤ 7 days ago 40, ≤ 14 days 25, ≤ 30 days 10, else 0.
 *  - Results (30): confirmation rate over the period × 30 (0 without calls).
 *  - Momentum (20): calls in the last 14 days vs the 14 before: growing or steady 20,
 *    down by less than 30% 10, down more (or no calls at all) 0.
 *  - Setup (10): onboarding completed.
 * A churned merchant (cancelled subscription) keeps its score: the status says it.
 */
export function healthScore(m: HealthInput, now = new Date()): number {
  const idle = m.lastActivityAt
    ? (now.getTime() - m.lastActivityAt.getTime()) / DAY_MS
    : Infinity;
  const recency = idle <= 7 ? 40 : idle <= 14 ? 25 : idle <= 30 ? 10 : 0;
  const results = Math.round((m.confirmationRate ?? 0) * 30);
  let momentum = 0;
  if (m.calls14 > 0 && m.callsPrev14 === 0) momentum = 20;
  else if (m.callsPrev14 > 0) {
    const ratio = m.calls14 / m.callsPrev14;
    momentum = ratio >= 1 ? 20 : ratio >= 0.7 ? 10 : 0;
  }
  return recency + results + momentum + (m.onboarded ? 10 : 0);
}

/** churned > new > dormant > active, in that order of precedence. */
export function merchantStatus(
  m: HealthInput,
  now = new Date(),
): MerchantStatus {
  if (m.churnedAt && m.churnedAt <= now) return 'churned';
  if (now.getTime() - m.signupAt.getTime() < NEW_DAYS * DAY_MS) return 'new';
  if (
    !m.lastActivityAt ||
    now.getTime() - m.lastActivityAt.getTime() >= DORMANT_DAYS * DAY_MS
  ) {
    return 'dormant';
  }
  return 'active';
}

export interface FunnelStep {
  key: string;
  label: string;
  count: number;
  /** Share of the first step. */
  ofTotal: number;
  /** Share lost since the previous step (0 for the first). */
  dropOff: number;
}

export function funnel(
  steps: { key: string; label: string; count: number }[],
): FunnelStep[] {
  const first = steps[0]?.count ?? 0;
  return steps.map((s, i) => {
    const prev = i === 0 ? s.count : steps[i - 1].count;
    return {
      ...s,
      ofTotal: first > 0 ? s.count / first : 0,
      dropOff: i === 0 || prev === 0 ? 0 : Math.max(0, 1 - s.count / prev),
    };
  });
}
