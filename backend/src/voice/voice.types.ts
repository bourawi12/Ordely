/**
 * Voice integration contracts and event models.
 * Decouples Ordely core from any specific external voice provider.
 */

export interface VoiceCallTaskScenario {
  orderRef: string;
  customer: string;
  item: string;
  quantity: number;
  total: string;
  language: string;
  boutique?: {
    id?: number | null;
    name?: string | null;
    confirmationProcess?: string | null;
  };
  instructions?: string[];
}

export interface VoiceCallTask {
  taskId: string;
  orderlyCallId: number;
  boutiqueId: number;
  destination: string;
  availabilityPolicy: 'reject' | 'queue';
  scenario: VoiceCallTaskScenario;
}

export type VoiceCallPhase =
  | 'dispatched'
  | 'registering'
  | 'dialing'
  | 'queued'
  | 'ringing'
  | 'connecting'
  | 'greeting'
  | 'live'
  | 'ending'
  | 'ended'
  | 'rejected'
  | 'error';

export interface VoiceCallEvent {
  taskId: string;
  phase: VoiceCallPhase;
  providerCallId?: string;
  timestamp: string;
  message?: string;
}

export type VoiceDisposition =
  | 'completed'
  | 'confirmed'
  | 'declined'
  | 'no_answer'
  | 'ambiguous'
  | 'needs_human'
  | 'policy_blocked'
  | 'error';

export interface VoiceCallResult {
  taskId: string;
  providerCallId?: string;
  disposition: VoiceDisposition;
  intent?: 'CONFIRMED' | 'CANCELLED' | 'UNCLEAR';
  confidence?: number;
  language?: 'FRENCH' | 'ENGLISH' | 'TUNISIAN_ARABIC' | 'MIXED';
  durationSeconds?: number;
  timestamp: string;
  error?: string;
}

export interface TranscriptEntry {
  taskId: string;
  sequence: number;
  speaker: 'agent' | 'customer';
  text: string;
  timestamp: string;
}
