import { BadRequestException } from '@nestjs/common';
import { csvCell } from '../common/csv';
import { funnel, healthScore, HealthInput, merchantStatus } from './health';
import { resolvePeriod } from './period';

const DAY = 24 * 60 * 60 * 1000;
const now = new Date('2026-10-05T12:00:00Z');
const daysAgo = (n: number) => new Date(now.getTime() - n * DAY);

describe('resolvePeriod', () => {
  it('covers the last N Tunis days, today included, against the N days before', () => {
    // 12:00 UTC is 13:00 in Tunis: today started at 23:00 UTC the day before.
    const p = resolvePeriod({}, now);
    expect(p.range).toBe('30d');
    expect(p.to).toEqual(now);
    expect(p.from.toISOString()).toBe('2026-09-05T23:00:00.000Z');
    expect(p.prevFrom.toISOString()).toBe('2026-08-06T23:00:00.000Z');
    expect(p.prevTo).toEqual(daysAgo(30));
    const week = resolvePeriod({ range: '7d' }, now);
    expect(week.days).toBe(7);
    expect(week.from.toISOString()).toBe('2026-09-28T23:00:00.000Z');
  });

  it('reads a custom range as whole Tunis days, both ends included', () => {
    const p = resolvePeriod(
      { range: 'custom', from: '2026-09-01', to: '2026-09-30' },
      now,
    );
    expect(p.from.toISOString()).toBe('2026-08-31T23:00:00.000Z');
    expect(p.to.toISOString()).toBe('2026-09-30T23:00:00.000Z');
    expect(p.days).toBe(30);
    expect(p.prevFrom.toISOString()).toBe('2026-08-01T23:00:00.000Z');
  });

  it('refuses a custom range that is incomplete, reversed or longer than a year', () => {
    for (const q of [
      { range: 'custom' as const, from: '2026-09-01' },
      { range: 'custom' as const, from: '2026-09-10', to: '2026-09-01' },
      { range: 'custom' as const, from: '2024-01-01', to: '2026-01-01' },
    ]) {
      expect(() => resolvePeriod(q, now)).toThrow(BadRequestException);
    }
  });
});

describe('health score and status', () => {
  const base: HealthInput = {
    signupAt: daysAgo(60),
    lastActivityAt: daysAgo(1),
    churnedAt: null,
    onboarded: true,
    calls14: 100,
    callsPrev14: 90,
    confirmationRate: 0.8,
  };

  it('adds recency, results, momentum and setup', () => {
    expect(healthScore(base, now)).toBe(40 + 24 + 20 + 10);
    expect(healthScore({ ...base, lastActivityAt: daysAgo(10) }, now)).toBe(
      25 + 24 + 20 + 10,
    );
    // Calls down 20%: half the momentum; down 50%: none.
    expect(healthScore({ ...base, calls14: 72 }, now)).toBe(40 + 24 + 10 + 10);
    expect(healthScore({ ...base, calls14: 45 }, now)).toBe(40 + 24 + 0 + 10);
  });

  it('scores a merchant that never did anything at 0 (or 10 once set up)', () => {
    const idle = {
      ...base,
      lastActivityAt: null,
      calls14: 0,
      callsPrev14: 0,
      confirmationRate: null,
    };
    expect(healthScore({ ...idle, onboarded: false }, now)).toBe(0);
    expect(healthScore(idle, now)).toBe(10);
  });

  it('labels churned first, then new, then dormant after 14 idle days', () => {
    expect(merchantStatus(base, now)).toBe('active');
    expect(merchantStatus({ ...base, lastActivityAt: daysAgo(14) }, now)).toBe(
      'dormant',
    );
    expect(merchantStatus({ ...base, lastActivityAt: null }, now)).toBe(
      'dormant',
    );
    expect(
      merchantStatus(
        { ...base, signupAt: daysAgo(3), lastActivityAt: null },
        now,
      ),
    ).toBe('new');
    expect(
      merchantStatus(
        { ...base, signupAt: daysAgo(3), churnedAt: daysAgo(1) },
        now,
      ),
    ).toBe('churned');
  });
});

describe('funnel', () => {
  it('gives each step its share of signups and the drop since the step before', () => {
    const steps = funnel([
      { key: 'a', label: 'A', count: 200 },
      { key: 'b', label: 'B', count: 150 },
      { key: 'c', label: 'C', count: 0 },
      { key: 'd', label: 'D', count: 0 },
    ]);
    expect(steps.map((s) => s.ofTotal)).toEqual([1, 0.75, 0, 0]);
    expect(steps.map((s) => s.dropOff)).toEqual([0, 0.25, 1, 0]);
    expect(funnel([{ key: 'a', label: 'A', count: 0 }])[0].ofTotal).toBe(0);
  });
});

describe('csvCell', () => {
  it('quotes separators and neutralises formulas', () => {
    expect(csvCell('Chez "Ada", Sfax')).toBe('"Chez ""Ada"", Sfax"');
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell(null)).toBe('');
  });
});
