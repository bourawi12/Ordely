import {
  StartTaskResult,
  VoiceAgentClient,
} from '../voice-agent-client.interface';
import { VoiceCallTask } from '../voice.types';

/**
 * Fake implementation of VoiceAgentClient for unit tests and local mock runs (LSP).
 */
export class FakeVoiceAgentClient implements VoiceAgentClient {
  public dispatched: VoiceCallTask[] = [];
  public stopped: string[] = [];
  public healthy = true;
  public capacityAvailable = true;
  public shouldAccept = true;
  public rejectError?: string;

  async startTask(task: VoiceCallTask): Promise<StartTaskResult> {
    if (!this.capacityAvailable) {
      return {
        accepted: false,
        deferred: true,
        error: 'No mobile app is currently available.',
      };
    }
    if (!this.shouldAccept) {
      return {
        accepted: false,
        error: this.rejectError || 'Agent rejected task',
      };
    }
    this.dispatched.push(task);
    return { accepted: true };
  }

  async stopTask(taskId: string): Promise<void> {
    this.stopped.push(taskId);
  }

  async checkCapacity(): Promise<boolean> {
    return this.healthy && this.capacityAvailable;
  }

  async healthCheck(): Promise<boolean> {
    return this.healthy;
  }

  reset() {
    this.dispatched = [];
    this.stopped = [];
    this.healthy = true;
    this.capacityAvailable = true;
    this.shouldAccept = true;
    this.rejectError = undefined;
  }
}
