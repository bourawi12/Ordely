import {
  isWithinCallWindow,
  nextAttemptNumber,
} from './call-orchestration-policy';

describe('call orchestration policy', () => {
  const completedAt = new Date('2026-10-07T08:00:00.000Z');

  it('starts every eligible order at attempt 1', () => {
    expect(nextAttemptNumber([])).toBe(1);
  });

  it('limits an order to three attempts', () => {
    expect(
      nextAttemptNumber([
        {
          attempt: 1,
          status: 'no_answer',
          disposition: 'no_answer',
          completedAt,
        },
        { attempt: 2, status: 'failed', disposition: 'error', completedAt },
        {
          attempt: 3,
          status: 'no_answer',
          disposition: 'no_answer',
          completedAt,
        },
      ]),
    ).toBeNull();
  });

  it('waits 30 minutes after attempt 1 and retries no-answer calls', () => {
    const attempt = {
      attempt: 1,
      status: 'no_answer',
      disposition: 'no_answer',
      completedAt,
    };
    expect(
      nextAttemptNumber(
        [attempt],
        new Date(completedAt.getTime() + 29 * 60_000),
      ),
    ).toBeNull();
    expect(
      nextAttemptNumber(
        [attempt],
        new Date(completedAt.getTime() + 30 * 60_000),
      ),
    ).toBe(2);
  });

  it('waits two hours after attempt 2 and retries errors', () => {
    const calls = [
      {
        attempt: 1,
        status: 'no_answer',
        disposition: 'no_answer',
        completedAt,
      },
      { attempt: 2, status: 'failed', disposition: 'error', completedAt },
    ];
    expect(
      nextAttemptNumber(calls, new Date(completedAt.getTime() + 119 * 60_000)),
    ).toBeNull();
    expect(
      nextAttemptNumber(calls, new Date(completedAt.getTime() + 120 * 60_000)),
    ).toBe(3);
  });

  it('does not retry incomplete, active, or human-review calls', () => {
    expect(
      nextAttemptNumber(
        [
          {
            attempt: 1,
            status: 'pending',
            disposition: null,
            completedAt: null,
          },
        ],
        new Date(completedAt.getTime() + 60 * 60_000),
      ),
    ).toBeNull();
    expect(
      nextAttemptNumber(
        [
          {
            attempt: 1,
            status: 'failed',
            disposition: 'needs_human',
            completedAt,
          },
        ],
        new Date(completedAt.getTime() + 60 * 60_000),
      ),
    ).toBeNull();
  });

  it('uses boutique-local hours with inclusive opening and exclusive closing', () => {
    expect(
      isWithinCallWindow('09:00', '17:00', new Date('2026-10-07T08:00:00Z')),
    ).toBe(true);
    expect(
      isWithinCallWindow('09:00', '17:00', new Date('2026-10-07T15:59:00Z')),
    ).toBe(true);
    expect(
      isWithinCallWindow('09:00', '17:00', new Date('2026-10-07T16:00:00Z')),
    ).toBe(false);
    expect(
      isWithinCallWindow('09:00', '17:00', new Date('2026-10-07T07:59:00Z')),
    ).toBe(false);
  });

  it('fails closed for missing or invalid boutique hours', () => {
    expect(isWithinCallWindow(null, '17:00')).toBe(false);
    expect(isWithinCallWindow('19:00', '17:00')).toBe(false);
    expect(isWithinCallWindow('09:75', '17:00')).toBe(false);
  });
});
