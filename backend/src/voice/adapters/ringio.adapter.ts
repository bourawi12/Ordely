import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { fork, type ChildProcess } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  StartTaskResult,
  VoiceAgentClient,
} from '../voice-agent-client.interface';
import { VoiceCallTask } from '../voice.types';

@Injectable()
export class RingioAdapter implements VoiceAgentClient, OnModuleDestroy {
  private readonly logger = new Logger(RingioAdapter.name);
  private child: ChildProcess | null = null;
  private activeTaskId: string | null = null;
  private readyCallServerUrl: string | null = null;

  constructor(private readonly config: ConfigService) {}

  private get callServerUrl(): string {
    return (
      this.config.get<string>('CALL_SERVER_URL') ?? 'http://127.0.0.1:4100'
    ).replace(/\/$/, '');
  }

  private get fallbackCallServerUrl(): string {
    return (
      this.config.get<string>('CALL_SERVER_FALLBACK_URL') ||
      'https://voip-ringio-prototype.vercel.app'
    ).replace(/\/$/, '');
  }

  private async getAvailableCallServerUrl(): Promise<string | null> {
    const urls = [...new Set([this.callServerUrl, this.fallbackCallServerUrl])];
    for (const url of urls) {
      try {
        const response = await fetch(`${url}/health`, {
          signal: AbortSignal.timeout(3000),
        });
        if (response.ok) {
          if (url !== this.callServerUrl) {
            this.logger.warn(
              `Local Ringio server is unavailable; using fallback ${url}.`,
            );
          }
          return url;
        }
      } catch {
        // Try the next configured server.
      }
    }
    return null;
  }

  private async hasCapacity(url: string): Promise<boolean> {
    try {
      const response = await fetch(`${url}/api/capacity`, {
        signal: AbortSignal.timeout(3000),
      });
      if (!response.ok) return false;
      const capacity = (await response.json()) as { canLaunchCall?: unknown };
      return capacity.canLaunchCall === true;
    } catch {
      return false;
    }
  }

  async checkCapacity(): Promise<boolean> {
    const url = await this.getAvailableCallServerUrl();
    if (!url || !(await this.hasCapacity(url))) {
      this.readyCallServerUrl = null;
      return false;
    }
    this.readyCallServerUrl = url;
    return true;
  }

  private get callbackUrl(): string {
    const port = this.config.get<string>('PORT') ?? '3001';
    return (
      this.config.get<string>('ORDELY_CALLBACK_URL') ??
      `http://127.0.0.1:${port}/api`
    ).replace(/\/$/, '');
  }

  async startTask(task: VoiceCallTask): Promise<StartTaskResult> {
    if (this.child && this.child.exitCode === null) {
      return {
        accepted: false,
        deferred: true,
        error: 'An agent call is already running.',
      };
    }

    try {
      const callServerUrl =
        this.readyCallServerUrl ?? (await this.getAvailableCallServerUrl());
      this.readyCallServerUrl = null;
      if (!callServerUrl) {
        return {
          accepted: false,
          deferred: true,
          error: 'Local and fallback Ringio servers are unavailable.',
        };
      }
      if (!(await this.hasCapacity(callServerUrl))) {
        return {
          accepted: false,
          deferred: true,
          error: 'No mobile app is currently available.',
        };
      }

      const child = fork(join(__dirname, '../runtime/agent.js'), [], {
        env: {
          ...process.env,
          CALL_SERVER_URL: callServerUrl,
          CALL_AVAILABILITY_POLICY: task.availabilityPolicy,
          SIMULATED_DESTINATION_NUMBER: task.destination,
          VOICE_TASK_ID: task.taskId,
          CALL_TASK: JSON.stringify(task),
          ORDELY_CALLBACK_URL: this.callbackUrl,
          ORDELY_CALLBACK_SECRET:
            this.config.get<string>('ORDELY_CALLBACK_SECRET') ??
            'dev-test-token',
          INTERNAL_AGENT_TOKEN:
            this.config.get<string>('INTERNAL_AGENT_TOKEN') ?? '',
          GEMINI_API_KEY: this.config.get<string>('GEMINI_API_KEY') ?? '',
          VOICE_RECORDINGS_DIR:
            this.config.get<string>('VOICE_RECORDINGS_DIR') ??
            join(tmpdir(), 'ordely-voice-recordings'),
        },
        stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
      });

      this.child = child;
      this.activeTaskId = task.taskId;
      let failureReported = false;
      const reportFailure = (message: string) => {
        if (failureReported) return;
        failureReported = true;
        void this.reportTaskFailure(task.taskId, message);
      };
      let callEnded = false;
      child.on('message', (message: { type?: string; phase?: string }) => {
        if (message?.type === 'agent-status' && message.phase === 'ended') {
          callEnded = true;
        }
      });
      child.on('error', (error) => {
        this.logger.error(
          `Could not start voice task ${task.taskId}: ${error.message}`,
        );
        reportFailure(error.message);
        this.clearChild(child);
      });
      child.on('exit', (code) => {
        if (code !== 0 && !callEnded) {
          this.logger.warn(
            `Voice task ${task.taskId} exited with code ${code}.`,
          );
          reportFailure(`Voice worker exited with code ${code}.`);
        }
        this.clearChild(child);
      });
      return { accepted: true };
    } catch (err) {
      const msg = (err as Error).message;
      this.logger.error(`Failed to launch voice task ${task.taskId}: ${msg}`);
      return { accepted: false, error: msg };
    }
  }

  async stopTask(taskId: string): Promise<void> {
    if (
      !this.child ||
      this.child.exitCode !== null ||
      this.activeTaskId !== taskId
    ) {
      return;
    }

    this.child.kill('SIGTERM');
  }

  onModuleDestroy(): void {
    if (this.child && this.child.exitCode === null) {
      this.child.kill('SIGTERM');
    }
  }

  async healthCheck(): Promise<boolean> {
    return (await this.getAvailableCallServerUrl()) !== null;
  }

  private clearChild(child: ChildProcess): void {
    if (this.child !== child) return;
    this.child = null;
    this.activeTaskId = null;
  }

  private async reportTaskFailure(
    taskId: string,
    error: string,
  ): Promise<void> {
    try {
      const response = await fetch(
        `${this.callbackUrl}/internal/voice/result`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.config.get<string>('ORDELY_CALLBACK_SECRET') ?? 'dev-test-token'}`,
          },
          body: JSON.stringify({ taskId, disposition: 'error', error }),
        },
      );
      if (!response.ok) {
        this.logger.warn(
          `Could not report voice worker failure (${response.status}).`,
        );
      }
    } catch (err) {
      this.logger.error(
        `Could not report voice worker failure: ${(err as Error).message}`,
      );
    }
  }
}
