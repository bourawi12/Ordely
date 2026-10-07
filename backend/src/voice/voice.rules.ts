/**
 * Business rules of the voice agent integration, kept free of I/O so they can be tested alone.
 * The agent (Ringio) reports what it heard; Ordely decides what that means for the order.
 */

export const INTENTS = ['CONFIRMED', 'CANCELLED', 'UNCLEAR'] as const;
export type Intent = (typeof INTENTS)[number];

/** Agent language codes and the labels Ordely stores on calls (as in the rest of the app). */
export const LANGUAGE_LABELS = {
  FRENCH: 'French',
  ENGLISH: 'English',
  TUNISIAN_ARABIC: 'Darija',
  MIXED: 'Mixed',
} as const;
export type LanguageCode = keyof typeof LANGUAGE_LABELS;

/**
 * What a finished call means:
 *  - confirmed / cancelled: the customer clearly said so → the order changes;
 *  - no_answer: the phone was not answered (or the call failed technically);
 *  - unresolved: they talked, but without a clear, confident decision → the order stays
 *    pending for another attempt. An ambiguous answer is never a confirmation.
 */
export type Outcome = 'confirmed' | 'cancelled' | 'no_answer' | 'unresolved';

/** How each outcome is stored on the call (statuses already used by the app). */
export const CALL_STATUS: Record<Outcome, string> = {
  confirmed: 'confirmed',
  cancelled: 'failed',
  no_answer: 'no_answer',
  unresolved: 'no_answer',
};

export function decideOutcome(
  result: {
    disposition: string;
    intent?: string | null;
    confidence?: number | null;
  },
  minConfidence: number,
): Outcome {
  if (result.disposition === 'no_answer' || result.disposition === 'rejected')
    return 'no_answer';
  if (result.disposition === 'error') return 'no_answer';
  // Older agents always report "confirmed" without an intent: never trusted on its own.
  const confident =
    typeof result.confidence === 'number' &&
    result.confidence >= minConfidence &&
    result.confidence <= 1;
  if (confident && result.intent === 'CONFIRMED') return 'confirmed';
  if (confident && result.intent === 'CANCELLED') return 'cancelled';
  return 'unresolved';
}

export interface TranscriptPart {
  seq: number;
  speaker: 'agent' | 'customer';
  text: string;
}

/**
 * Speech recognition streams words and pieces of sentences. Fragments are put back in order
 * (they can arrive out of order), duplicates dropped, and consecutive fragments of the same
 * speaker joined into one line.
 */
export function mergeTranscript(parts: TranscriptPart[]) {
  const bySeq = new Map<number, TranscriptPart>();
  for (const p of parts) if (!bySeq.has(p.seq)) bySeq.set(p.seq, p);
  const lines: { speaker: 'agent' | 'customer'; text: string }[] = [];
  for (const p of [...bySeq.values()].sort((a, b) => a.seq - b.seq)) {
    const last = lines[lines.length - 1];
    if (last && last.speaker === p.speaker) last.text += p.text;
    else lines.push({ speaker: p.speaker, text: p.text });
  }
  return lines
    .map((l) => ({ ...l, text: l.text.replace(/\s+/g, ' ').trim() }))
    .filter((l) => l.text);
}

/** Africa/Tunis is UTC+1 all year. */
const TUNIS_OFFSET_MINUTES = 60;

/** Whether `now` falls in the shop's call window ("HH:MM", Tunis). No window set: any time. */
export function withinCallHours(
  start: string | null,
  end: string | null,
  now: Date,
): boolean {
  if (!start || !end) return true;
  const minutes = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  };
  const local =
    (now.getUTCHours() * 60 + now.getUTCMinutes() + TUNIS_OFFSET_MINUTES) %
    1440;
  return local >= minutes(start) && local < minutes(end);
}

/** The id the agent carries for a call, and back. */
export const taskIdFor = (callId: number) => `call-${callId}`;
export function callIdFrom(taskId: string): number | null {
  const match = /^call-(\d{1,10})$/.exec(taskId);
  return match ? Number(match[1]) : null;
}
