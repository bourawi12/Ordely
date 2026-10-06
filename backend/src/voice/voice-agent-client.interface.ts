import { VoiceCallTask } from './voice.types';

export interface StartTaskResult {
  accepted: boolean;
  error?: string;
}

/**
 * Port for dispatching a voice call to an external voice agent runtime.
 * Ordely core services depend strictly on this abstraction (DIP).
 */
export interface VoiceAgentClient {
  /**
   * Dispatches a call task to the agent runtime asynchronously.
   * Returns acceptance confirmation (HTTP 202-like), not blocking for call duration.
   */
  startTask(task: VoiceCallTask): Promise<StartTaskResult>;

  /**
   * Requests graceful termination of an active call task.
   */
  stopTask(taskId: string): Promise<void>;

  /**
   * Probes external voice agent runtime health and reachability.
   */
  healthCheck(): Promise<boolean>;
}

export const VOICE_AGENT_CLIENT = Symbol('VOICE_AGENT_CLIENT');
