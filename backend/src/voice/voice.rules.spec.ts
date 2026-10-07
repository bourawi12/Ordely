import {
  callIdFrom,
  decideOutcome,
  mergeTranscript,
  taskIdFor,
  withinCallHours,
} from './voice.rules';

describe('decideOutcome', () => {
  const done = { disposition: 'completed' };

  it('changes an order only on a clear, confident yes or no', () => {
    expect(
      decideOutcome({ ...done, intent: 'CONFIRMED', confidence: 0.9 }, 0.8),
    ).toBe('confirmed');
    expect(
      decideOutcome({ ...done, intent: 'CANCELLED', confidence: 0.8 }, 0.8),
    ).toBe('cancelled');
    expect(
      decideOutcome({ ...done, intent: 'CONFIRMED', confidence: 0.79 }, 0.8),
    ).toBe('unresolved');
    expect(
      decideOutcome({ ...done, intent: 'UNCLEAR', confidence: 0.99 }, 0.8),
    ).toBe('unresolved');
  });

  it('never trusts a finished call without an intent (older agents say "confirmed")', () => {
    expect(decideOutcome({ disposition: 'confirmed' }, 0.8)).toBe('unresolved');
    expect(decideOutcome({ ...done, intent: 'CONFIRMED' }, 0.8)).toBe(
      'unresolved',
    );
    expect(
      decideOutcome({ ...done, intent: 'CONFIRMED', confidence: 2 }, 0.8),
    ).toBe('unresolved');
  });

  it('reads an unanswered or failed call as no answer, whatever the intent', () => {
    for (const disposition of ['no_answer', 'rejected', 'error']) {
      expect(
        decideOutcome({ disposition, intent: 'CONFIRMED', confidence: 1 }, 0.8),
      ).toBe('no_answer');
    }
  });
});

describe('mergeTranscript', () => {
  it('orders fragments, drops repeats and joins each speaker turn', () => {
    expect(
      mergeTranscript([
        { seq: 3, speaker: 'customer', text: ' Ey,' },
        { seq: 1, speaker: 'agent', text: 'Aslema ' },
        { seq: 2, speaker: 'agent', text: 'Ines, tconfirmi?' },
        { seq: 4, speaker: 'customer', text: ' nconfirmi.' },
        { seq: 4, speaker: 'customer', text: ' nconfirmi.' },
        { seq: 5, speaker: 'agent', text: '   ' },
      ]),
    ).toEqual([
      { speaker: 'agent', text: 'Aslema Ines, tconfirmi?' },
      { speaker: 'customer', text: 'Ey, nconfirmi.' },
    ]);
  });
});

describe('withinCallHours', () => {
  // 09:00–20:00 Tunis = 08:00–19:00 UTC.
  it('uses Tunis time and allows any time without a window', () => {
    expect(
      withinCallHours('09:00', '20:00', new Date('2026-10-05T08:00:00Z')),
    ).toBe(true);
    expect(
      withinCallHours('09:00', '20:00', new Date('2026-10-05T07:59:00Z')),
    ).toBe(false);
    expect(
      withinCallHours('09:00', '20:00', new Date('2026-10-05T19:00:00Z')),
    ).toBe(false);
    expect(withinCallHours(null, null, new Date('2026-10-05T02:00:00Z'))).toBe(
      true,
    );
  });
});

describe('task ids', () => {
  it('round-trip, and anything else is refused', () => {
    expect(callIdFrom(taskIdFor(42))).toBe(42);
    expect(callIdFrom('call-42; DROP')).toBeNull();
    expect(callIdFrom('order-42')).toBeNull();
  });
});
