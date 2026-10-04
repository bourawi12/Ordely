import { ConfigService } from '@nestjs/config';
import { RingioAdapter } from './ringio.adapter';

describe('RingioAdapter', () => {
  let adapter: RingioAdapter;
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
    configMock = {
      get: jest.fn((key: string) => {
        if (key === 'VOICE_AGENT_BASE_URL') return 'http://127.0.0.1:4200';
        if (key === 'AGENT_SERVICE_TOKEN') return 'test-token';
        return undefined;
      }),
    };
    adapter = new RingioAdapter(configMock as unknown as ConfigService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('starts a task successfully when the agent accepts', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 202,
      json: jest.fn().mockResolvedValue({ phase: 'starting' }),
    });

    const result = await adapter.startTask(sampleTask);

    expect(result).toEqual({ accepted: true });
    expect(global.fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:4200/api/task/start',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }),
      }),
    );
  });

  it('returns accepted: false with error message when agent returns 409', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: jest
        .fn()
        .mockResolvedValue({ error: 'An agent call is already running.' }),
    });

    const result = await adapter.startTask(sampleTask);

    expect(result).toEqual({
      accepted: false,
      error: 'An agent call is already running.',
    });
  });

  it('stops a task by calling the stop endpoint', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 202,
      json: jest.fn().mockResolvedValue({ phase: 'ending' }),
    });

    await adapter.stopTask('test-task-1');

    expect(global.fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:4200/api/task/stop',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ taskId: 'test-task-1' }),
      }),
    );
  });

  it('returns healthy status on healthCheck', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });

    const healthy = await adapter.healthCheck();
    expect(healthy).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:4200/api/health',
      expect.objectContaining({ method: 'GET' }),
    );
  });
});
