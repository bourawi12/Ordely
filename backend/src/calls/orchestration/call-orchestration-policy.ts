import { DEFAULT_TIMEZONE } from '../../common/time';

export interface CallAttemptRecord {
  attempt: number;
  status: string;
  disposition: string | null;
  completedAt: Date | null;
}

const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [30 * 60_000, 2 * 60 * 60_000];

export function nextAttemptNumber(
  calls: CallAttemptRecord[],
  now = new Date(),
): number | null {
  if (calls.length >= MAX_ATTEMPTS) return null;
  if (calls.length === 0) return 1;

  const latest = calls.reduce((current, call) =>
    call.attempt > current.attempt ? call : current,
  );
  if (
    latest.attempt !== calls.length ||
    latest.attempt >= MAX_ATTEMPTS ||
    !['no_answer', 'error'].includes(latest.disposition ?? '') ||
    !latest.completedAt
  ) {
    return null;
  }

  const retryDelay = RETRY_DELAYS_MS[latest.attempt - 1];
  return now.getTime() >= latest.completedAt.getTime() + retryDelay
    ? latest.attempt + 1
    : null;
}

export function isWithinCallWindow(
  startTime: string | null,
  endTime: string | null,
  now = new Date(),
  timeZone = DEFAULT_TIMEZONE,
): boolean {
  if (!startTime || !endTime) return false;
  const start = parseClock(startTime);
  const end = parseClock(endTime);
  if (start === null || end === null || start >= end) return false;

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value);
  const current = hour * 60 + minute;
  return current >= start && current < end;
}

function parseClock(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour < 24 && minute < 60 ? hour * 60 + minute : null;
}
