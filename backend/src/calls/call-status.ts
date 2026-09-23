export const CALL_STATUSES = [
  'pending',
  'confirmed',
  'failed',
  'no_answer',
] as const;
export type CallStatus = (typeof CALL_STATUSES)[number];

export const CALL_RANGES = ['today', '7d', '30d', 'all'] as const;
export type CallRange = (typeof CALL_RANGES)[number];
