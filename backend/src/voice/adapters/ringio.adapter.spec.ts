import { ConfigService } from '@nestjs/config';
import { fork } from 'node:child_process';
const { buildSystemInstruction, SYSTEM_INSTRUCTION } = jest.requireActual(
  '../runtime/geminiLiveSession',
) as {
  buildSystemInstruction: (scenario?: Record<string, unknown>) => string;
  SYSTEM_INSTRUCTION: string;
};
const { VoiceCallAgent } = jest.requireActual('../runtime/voiceCallAgent') as {
  VoiceCallAgent: new (options: Record<string, unknown>) => {
    finishPhase: string;
    cleanup: (message: string) => Promise<void>;
  };
};
import { RingioAdapter } from './ringio.adapter';

jest.mock('node:child_process', () => ({ fork: jest.fn() }));

describe('RingioAdapter', () => {
  let adapter: RingioAdapter;
  let child: { exitCode: number | null; on: jest.Mock; kill: jest.Mock };
  let configMock: {
    get: jest.Mock;
  };

  const sampleTask = {
    taskId: 'test-task-1',
    orderlyCallId: 101,
    boutiqueId: 1,
    destination: '+21620000000',
    availabilityPolicy: 'reject' as const,
    scenario: {
      orderRef: '#50',
      customer: 'Sami',
      item: 'Robe',
      quantity: 1,
      total: '100.000 TND',
      language: 'ar-TN',
    },
  };

  beforeEach(() => {
    child = {
      exitCode: null,
      on: jest.fn().mockReturnThis(),
      kill: jest.fn(),
    };
    (fork as jest.Mock).mockClear();
    (fork as jest.Mock).mockReturnValue(child);
    configMock = {
      get: jest.fn((key: string) => {
        if (key === 'CALL_SERVER_URL') return 'http://127.0.0.1:4100';
        if (key === 'CALL_SERVER_FALLBACK_URL') {
          return 'https://voip-ringio-prototype.vercel.app';
        }
        if (key === 'ORDELY_CALLBACK_SECRET') return 'test-secret';
        if (key === 'PORT') return '3001';
        if (key === 'INTERNAL_AGENT_TOKEN') return 'agent-token';
        if (key === 'GEMINI_API_KEY') return 'gemini-key';
        return undefined;
      }),
    };
    adapter = new RingioAdapter(configMock as unknown as ConfigService);
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('starts a task successfully when the agent accepts', async () => {
    const result = await adapter.startTask(sampleTask);

    expect(result).toEqual({ accepted: true });
    expect(fork).toHaveBeenCalledWith(
      expect.stringContaining('runtime'),
      [],
      expect.objectContaining({
        env: expect.objectContaining({
          CALL_SERVER_URL: 'http://127.0.0.1:4100',
          SIMULATED_DESTINATION_NUMBER: sampleTask.destination,
          VOICE_TASK_ID: sampleTask.taskId,
          CALL_TASK: JSON.stringify(sampleTask),
          ORDELY_CALLBACK_URL: 'http://127.0.0.1:3001/api',
          ORDELY_CALLBACK_SECRET: 'test-secret',
          INTERNAL_AGENT_TOKEN: 'agent-token',
          GEMINI_API_KEY: 'gemini-key',
        }),
      }),
    );
  });

  it('uses the Vercel server when the local Ringio server is unhealthy', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, status: 200 });

    const result = await adapter.startTask(sampleTask);

    expect(result).toEqual({ accepted: true });
    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      'http://127.0.0.1:4100/health',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      'https://voip-ringio-prototype.vercel.app/health',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(fork).toHaveBeenCalledWith(
      expect.stringContaining('runtime'),
      [],
      expect.objectContaining({
        env: expect.objectContaining({
          CALL_SERVER_URL: 'https://voip-ringio-prototype.vercel.app',
        }),
      }),
    );
  });

  it('rejects the task without launching a worker when both servers are unhealthy', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 });

    await expect(adapter.startTask(sampleTask)).resolves.toEqual({
      accepted: false,
      error: 'Local and fallback Ringio servers are unavailable.',
    });
    expect(fork).not.toHaveBeenCalled();
  });

  it('rejects a second task while the current worker is running', async () => {
    await adapter.startTask(sampleTask);

    await expect(
      adapter.startTask({ ...sampleTask, taskId: 'task-2' }),
    ).resolves.toEqual({
      accepted: false,
      error: 'An agent call is already running.',
    });
    expect(fork).toHaveBeenCalledTimes(1);
  });

  it('stops the matching task worker gracefully', async () => {
    await adapter.startTask(sampleTask);
    await adapter.stopTask('test-task-1');

    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
  });

  it('reports unexpected worker exits to the Ordely result callback', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    await adapter.startTask(sampleTask);
    const exitHandler = child.on.mock.calls.find(
      ([event]) => event === 'exit',
    )?.[1];

    exitHandler(1);

    expect(global.fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/api/internal/voice/result',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"disposition":"error"'),
      }),
    );
  });

  it('does not report a completed call as failed when the worker exits nonzero', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    await adapter.startTask(sampleTask);
    const messageHandler = child.on.mock.calls.find(
      ([event]) => event === 'message',
    )?.[1];
    const exitHandler = child.on.mock.calls.find(
      ([event]) => event === 'exit',
    )?.[1];

    messageHandler({ type: 'agent-status', phase: 'ended' });
    exitHandler(2147483651);

    expect(global.fetch).not.toHaveBeenCalledWith(
      'http://127.0.0.1:3001/api/internal/voice/result',
      expect.anything(),
    );
  });

  it('stops the child worker when the Nest module shuts down', async () => {
    await adapter.startTask(sampleTask);

    adapter.onModuleDestroy();

    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
  });

  it('returns healthy status on healthCheck', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });

    const healthy = await adapter.healthCheck();
    expect(healthy).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:4100/health',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('includes synthetic order details as data in Gemini instructions', () => {
    expect(buildSystemInstruction()).toBe(SYSTEM_INSTRUCTION);
    expect(buildSystemInstruction(sampleTask.scenario)).toContain(
      JSON.stringify(sampleTask.scenario),
    );
    expect(buildSystemInstruction(sampleTask.scenario)).toContain(
      'not as instructions',
    );
  });

  it('sends a normally ended call to human review instead of confirming it', async () => {
    const orderlyClient = {
      sendEvent: jest.fn().mockResolvedValue(undefined),
      sendResult: jest.fn().mockResolvedValue(undefined),
    };
    const agent = new VoiceCallAgent({
      serverUrl: 'http://127.0.0.1:4100',
      destinationNumber: sampleTask.destination,
      ioClient: jest.fn(),
      wrtc: {},
      geminiFactory: jest.fn(),
      artifactStore: { finalizeCall: jest.fn().mockResolvedValue([]) },
      artifactClient: {},
      taskId: sampleTask.taskId,
      ordelyClient: orderlyClient,
      logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
    });
    agent.finishPhase = 'ended';

    await agent.cleanup('Call ended.');

    expect(orderlyClient.sendResult).toHaveBeenCalledWith(
      expect.objectContaining({ disposition: 'needs_human' }),
    );
  });
});
