import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { StorageService } from '../storage/storage.service';
import { VoiceCallbacksService } from './voice-callbacks.service';

const call = {
  id: 101,
  orderId: 50,
  attempt: 1,
  taskId: 'call-101',
  status: 'pending',
  dispatchedAt: new Date(),
  providerCallId: null,
  order: { boutiqueId: 7 },
};

describe('VoiceCallbacksService realtime publishing', () => {
  let service: VoiceCallbacksService;
  let prisma: any;
  let realtime: {
    emitCallStatusChanged: jest.Mock;
    emitOrderStatusChanged: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      call: {
        findUnique: jest.fn().mockResolvedValue(call),
        update: jest.fn().mockResolvedValue(call),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      order: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    prisma.$transaction = jest.fn((callback: (tx: any) => unknown) => callback(prisma));
    realtime = {
      emitCallStatusChanged: jest.fn(),
      emitOrderStatusChanged: jest.fn(),
    };
    service = new VoiceCallbacksService(
      prisma as PrismaService,
      {} as StorageService,
      { get: jest.fn((_key, fallback) => fallback) } as unknown as ConfigService,
      realtime as unknown as RealtimeService,
    );
  });

  it('publishes lifecycle progress to the shop room', async () => {
    await service.event({
      taskId: 'call-101',
      phase: 'ringing',
      timestamp: new Date().toISOString(),
    });

    expect(realtime.emitCallStatusChanged).toHaveBeenCalledWith(
      7,
      expect.objectContaining({
        callId: 101,
        orderId: 50,
        status: 'pending',
        transportPhase: 'ringing',
      }),
    );
  });

  it('publishes call and order transitions after an applied result', async () => {
    await service.result({
      taskId: 'call-101',
      disposition: 'completed',
      intent: 'CONFIRMED',
      confidence: 0.9,
    });

    expect(realtime.emitCallStatusChanged).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ callId: 101, orderId: 50, status: 'confirmed' }),
    );
    expect(realtime.emitOrderStatusChanged).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ orderId: 50, status: 'confirmed' }),
    );
  });

  it('stores Darija when the agent omits a language', async () => {
    await service.result({
      taskId: 'call-101',
      disposition: 'no_answer',
    });

    expect(prisma.call.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ language: 'Darija' }) }),
    );
  });

  it('does not publish an ignored result', async () => {
    prisma.call.updateMany.mockResolvedValueOnce({ count: 0 });

    const result = await service.result({
      taskId: 'call-101',
      disposition: 'completed',
      intent: 'CONFIRMED',
      confidence: 0.9,
    });

    expect(result.applied).toBe(false);
    expect(realtime.emitCallStatusChanged).not.toHaveBeenCalled();
    expect(realtime.emitOrderStatusChanged).not.toHaveBeenCalled();
  });
});
