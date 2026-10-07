import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { VoiceDispatcherService } from './voice-dispatcher.service';

describe('VoiceDispatcherService', () => {
  const call = { count: jest.fn(), findMany: jest.fn(), updateMany: jest.fn() };
  const env: Record<string, string> = {
    VOICE_AGENT_URL: 'http://agent.test:4200',
    VOICE_AGENT_TOKEN: 'agent-token',
    VOICE_TEST_DESTINATION: '+15550001234',
  };
  const config = {
    get: (k: string, d?: unknown) => env[k] ?? d,
  } as unknown as ConfigService;
  const fetchMock = jest.fn();
  // 10:00 in Tunis.
  const now = new Date('2026-10-05T09:00:00Z');
  let service: VoiceDispatcherService;

  const queued = (over: Record<string, unknown> = {}) => ({
    id: 7,
    attempt: 1,
    order: {
      id: 70,
      customer: 'Ines',
      phone: '+216 22 111 222',
      total: new Prisma.Decimal(240),
      items: [
        {
          productName: 'Montre',
          quantity: 2,
          unitPrice: new Prisma.Decimal(120),
        },
      ],
      boutique: {
        name: 'Chez Ada',
        callLanguages: ['darija'],
        callStartTime: '09:00',
        callEndTime: '20:00',
      },
    },
    ...over,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    global.fetch = fetchMock;
    service = new VoiceDispatcherService(
      { call } as unknown as PrismaService,
      config,
    );
    call.updateMany.mockResolvedValue({ count: 1 });
    call.count.mockResolvedValue(0);
  });

  it('hands the oldest queued call to the agent, with the order and the test number', async () => {
    call.findMany.mockResolvedValue([queued()]);
    fetchMock.mockResolvedValue({ ok: true, status: 202 });

    await expect(service.tick(now)).resolves.toBe('dispatched');

    // Claimed before sending, so it can't be sent twice.
    expect(call.updateMany.mock.calls[1][0]).toEqual({
      where: { id: 7, dispatchedAt: null, status: 'pending' },
      data: { dispatchedAt: now },
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://agent.test:4200/api/task/start');
    expect(init.headers.Authorization).toBe('Bearer agent-token');
    expect(JSON.parse(init.body)).toMatchObject({
      taskId: 'call-7',
      destination: '+15550001234',
      order: {
        id: 70,
        customerName: 'Ines',
        items: [{ name: 'Montre', quantity: 2, unitPrice: '120' }],
        total: '240',
      },
      shop: { name: 'Chez Ada', languages: ['darija'] },
    });
  });

  it('puts the call back in the queue when the agent is busy or unreachable', async () => {
    call.findMany.mockResolvedValue([queued()]);
    fetchMock.mockResolvedValueOnce({ ok: false, status: 409 });
    await expect(service.tick(now)).resolves.toBe('busy');
    fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    await expect(service.tick(now)).resolves.toBe('failed');
    const released = call.updateMany.mock.calls.filter(
      ([arg]) => arg.data.dispatchedAt === null,
    );
    expect(released).toHaveLength(2);
  });

  it("waits while a call is in progress, and outside the shop's call hours", async () => {
    call.count.mockResolvedValueOnce(1);
    await expect(service.tick(now)).resolves.toBe('busy');
    call.findMany.mockResolvedValue([queued()]);
    // 22:00 in Tunis.
    await expect(service.tick(new Date('2026-10-05T21:00:00Z'))).resolves.toBe(
      'idle',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('closes calls that never reported back', async () => {
    call.findMany.mockResolvedValue([]);
    await service.tick(now);
    expect(call.updateMany.mock.calls[0][0]).toEqual({
      where: {
        status: 'pending',
        dispatchedAt: { lt: new Date(now.getTime() - 10 * 60_000) },
      },
      data: { status: 'no_answer' },
    });
  });
});
