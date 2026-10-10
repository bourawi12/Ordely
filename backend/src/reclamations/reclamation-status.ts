export const RECLAMATION_STATUSES = ['open', 'in_progress', 'resolved'] as const;
export type ReclamationStatus = (typeof RECLAMATION_STATUSES)[number];