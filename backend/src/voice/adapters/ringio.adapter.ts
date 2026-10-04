import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  StartTaskResult,
  VoiceAgentClient,
} from '../voice-agent-client.interface';
import { VoiceCallTask } from '../voice.types';

@Injectable()
export class RingioAdapter implements VoiceAgentClient {
  private readonly logger = new Logger(RingioAdapter.name);

  constructor(private readonly config: ConfigService) {}

  private get baseUrl(): string {
    return (
      this.config.get<string>('VOICE_AGENT_BASE_URL') ?? 'http://127.0.0.1:4200'
    ).replace(/\/$/, '');
  }

  private get serviceToken(): string {
    return this.config.get<string>('AGENT_SERVICE_TOKEN') ?? 'dev-test-token';
  }

  async startTask(task: VoiceCallTask): Promise<StartTaskResult> {
    try {
      const res = await fetch(`${this.baseUrl}/api/task/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.serviceToken}`,
        },
        body: JSON.stringify(task),
      });

      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        return { accepted: true };
      }

      const errorMessage =
        (body as { error?: string })?.error ?? `HTTP ${res.status}`;
      this.logger.warn(
        `Ringio agent rejected task ${task.taskId}: ${errorMessage}`,
      );
      return { accepted: false, error: errorMessage };
    } catch (err) {
      const msg = (err as Error).message;
      this.logger.error(`Failed to reach Ringio agent: ${msg}`);
      return { accepted: false, error: msg };
    }
  }

  async stopTask(taskId: string): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/api/task/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.serviceToken}`,
        },
        body: JSON.stringify({ taskId }),
      });
    } catch (err) {
      this.logger.error(
        `Failed to stop Ringio task ${taskId}: ${(err as Error).message}`,
      );
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/health`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.serviceToken}`,
        },
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
