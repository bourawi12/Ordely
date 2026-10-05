import { BadRequestException } from '@nestjs/common';
import { DAY_MS } from '../common/time';

export const PERIOD_RANGES = ['7d', '30d', '90d', 'custom'] as const;
export type PeriodRange = (typeof PERIOD_RANGES)[number];

/** Africa/Tunis is UTC+1 all year (no daylight saving): days are local days. */
const TUNIS_OFFSET = '+01:00';
const TUNIS_OFFSET_MS = 60 * 60 * 1000;
const MAX_DAYS = 366;

export interface Period {
  range: PeriodRange;
  /** [from, to): the selected window. */
  from: Date;
  to: Date;
  /** The window of the same length just before, for "change vs previous period". */
  prevFrom: Date;
  prevTo: Date;
  days: number;
}

/**
 * 7d / 30d / 90d: the last N Tunis days, today included (so far), compared with the same
 * N days one period earlier. A custom range runs from the start of `from` to the end of `to`
 * (both YYYY-MM-DD, Tunis days, inclusive), never past now, compared with the days just before.
 */
export function resolvePeriod(
  query: { range?: PeriodRange; from?: string; to?: string },
  now = new Date(),
): Period {
  const range = query.range ?? '30d';
  let from: Date;
  let to: Date;
  if (range === 'custom') {
    if (!query.from || !query.to) {
      throw new BadRequestException('A custom range needs both from and to');
    }
    from = new Date(`${query.from}T00:00:00${TUNIS_OFFSET}`);
    const end = new Date(`${query.to}T00:00:00${TUNIS_OFFSET}`);
    if (Number.isNaN(from.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('Invalid date');
    }
    to = new Date(Math.min(end.getTime() + DAY_MS, now.getTime()));
    if (to <= from) {
      throw new BadRequestException(
        'from must be before to, and not in the future',
      );
    }
    if (to.getTime() - from.getTime() > MAX_DAYS * DAY_MS) {
      throw new BadRequestException(
        `A range can cover ${MAX_DAYS} days at most`,
      );
    }
  } else {
    const n = Number.parseInt(range, 10);
    const today =
      Math.floor((now.getTime() + TUNIS_OFFSET_MS) / DAY_MS) * DAY_MS -
      TUNIS_OFFSET_MS;
    to = now;
    from = new Date(today - (n - 1) * DAY_MS);
    return {
      range,
      from,
      to,
      prevFrom: new Date(from.getTime() - n * DAY_MS),
      prevTo: new Date(to.getTime() - n * DAY_MS),
      days: n,
    };
  }
  const span = to.getTime() - from.getTime();
  return {
    range,
    from,
    to,
    prevFrom: new Date(from.getTime() - span),
    prevTo: from,
    days: Math.round(span / DAY_MS),
  };
}
