import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { CallCallbackService } from './call-callback.service';

describe('CallCallbackService', () => {
  let service: CallCallbackService;
  let prismaMock: any;
  let configMock: { get: jest.Mock };

  const sampleCall = {
    id: 101,
    orderId: 50,
    attempt: 1,
    taskId: 'task-1234-uuid',
    status: 'pending',
    providerCallId: null,
    transportPhase: 'dispatched',
    failureReason: null,
  };

  beforeEach(() => {
    prismaMock = {
      call: {
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      order: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    prismaMock.$transaction = jest.fn((callback) => callback(prismaMock));
    configMock = { get: jest.fn((_key, fallback) => fallback) };
    service = new CallCallbackService(
      prismaMock as unknown as PrismaService,
      configMock as unknown as ConfigService,
    );
  });

  it('updates transportPhase and providerCallId on lifecycle event', async () => {
    prismaMock.call.findUnique.mockResolvedValue(sampleCall);
    prismaMock.call.update.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
      ...sampleCall,
      ...data,
    }));

    const result = await service.handleEvent({
      taskId: 'task-1234-uuid',
      phase: 'ringing',
      providerCallId: 'ringio-uuid-5678',
      timestamp: new Date().toISOString(),
    });

    expect(prismaMock.call.update).toHaveBeenCalledWith({
      where: { id: 101 },
      data: expect.objectContaining({
        transportPhase: 'ringing',
        providerCallId: 'ringio-uuid-5678',
      }),
    });
    expect(result.transportPhase).toBe('ringing');
  });

  it('confirms the order only on a clear, confident Maria decision', async () => {
    prismaMock.call.findUnique.mockResolvedValue(sampleCall);

    const result = await service.handleResult({
      taskId: 'task-1234-uuid',
      disposition: 'completed',
      intent: 'CONFIRMED',
      confidence: 0.9,
      language: 'TUNISIAN_ARABIC',
      durationSeconds: 45,
      timestamp: new Date().toISOString(),
    });

    expect(prismaMock.call.updateMany).toHaveBeenCalledWith({
      where: { id: 101, status: 'pending' },
      data: expect.objectContaining({
        status: 'confirmed',
        disposition: 'confirmed',
        language: 'Darija',
        durationSeconds: 45,
      }),
    });
    expect(prismaMock.order.updateMany).toHaveBeenCalledWith({
      where: { id: 50, status: 'pending' },
      data: { status: 'confirmed' },
    });
    expect(result.status).toBe('confirmed');
    expect(result.applied).toBe(true);
  });

  it('does not claim success if the order stopped being pending during the call', async () => {
    prismaMock.call.findUnique.mockResolvedValue(sampleCall);
    prismaMock.order.updateMany.mockResolvedValueOnce({ count: 0 });

    const result = await service.handleResult({
      taskId: 'task-1234-uuid',
      disposition: 'completed',
      intent: 'CONFIRMED',
      confidence: 0.9,
      timestamp: new Date().toISOString(),
    });

    expect(prismaMock.call.update).toHaveBeenCalledWith({
      where: { id: 101 },
      data: expect.objectContaining({
        status: 'failed',
        disposition: 'policy_blocked',
      }),
    });
    expect(result).toMatchObject({ status: 'failed', disposition: 'policy_blocked' });
  });

  it('cancels only on a clear, confident Maria decision', async () => {
    prismaMock.call.findUnique.mockResolvedValue(sampleCall);

    const result = await service.handleResult({
      taskId: 'task-1234-uuid',
      disposition: 'completed',
      intent: 'CANCELLED',
      confidence: 0.7,
      timestamp: new Date().toISOString(),
    });

    expect(prismaMock.order.updateMany).toHaveBeenCalledWith({
      where: { id: 50, status: 'pending' },
      data: { status: 'cancelled' },
    });
    expect(result).toMatchObject({ status: 'failed', disposition: 'declined' });
  });

  it('does not allow Maria to force review before the final attempt', async () => {
    prismaMock.call.findUnique.mockResolvedValue(sampleCall);

    const result = await service.handleResult({
      taskId: 'task-1234-uuid',
      disposition: 'needs_human',
      intent: 'UNCLEAR',
      confidence: 0.2,
      timestamp: new Date().toISOString(),
    });

    expect(result).toMatchObject({ status: 'failed', disposition: 'ambiguous' });
    expect(prismaMock.order.updateMany).not.toHaveBeenCalled();
  });

  it('retries a low-confidence result without changing the order', async () => {
    prismaMock.call.findUnique.mockResolvedValue(sampleCall);

    const result = await service.handleResult({
      taskId: 'task-1234-uuid',
      disposition: 'completed',
      intent: 'CONFIRMED',
      confidence: 0.69,
      timestamp: new Date().toISOString(),
    });

    expect(result).toMatchObject({ status: 'failed', disposition: 'ambiguous' });
    expect(prismaMock.order.updateMany).not.toHaveBeenCalled();
  });

  it('routes an unresolved final attempt to human review and marks the order unreachable', async () => {
    prismaMock.call.findUnique.mockResolvedValue({ ...sampleCall, attempt: 3 });

    const result = await service.handleResult({
      taskId: 'task-1234-uuid',
      disposition: 'completed',
      intent: 'UNCLEAR',
      confidence: 0.4,
      timestamp: new Date().toISOString(),
    });

    expect(result).toMatchObject({ status: 'failed', disposition: 'needs_human' });
    expect(result.failureReason).toContain('final call attempt');
    expect(prismaMock.order.updateMany).toHaveBeenCalledWith({
      where: { id: 50, status: 'pending' },
      data: { status: 'unreachable' },
    });
  });

  it('marks an unanswered final attempt as unreachable', async () => {
    prismaMock.call.findUnique.mockResolvedValue({ ...sampleCall, attempt: 3 });

    await service.handleResult({
      taskId: 'task-1234-uuid',
      disposition: 'no_answer',
      timestamp: new Date().toISOString(),
    });

    expect(prismaMock.order.updateMany).toHaveBeenCalledWith({
      where: { id: 50, status: 'pending' },
      data: { status: 'unreachable' },
    });
  });

  it('throws NotFoundException if taskId does not exist', async () => {
    prismaMock.call.findUnique.mockResolvedValue(null);

    await expect(
      service.handleEvent({
        taskId: 'unknown-task',
        phase: 'connecting',
        timestamp: new Date().toISOString(),
      }),
    ).rejects.toThrow(NotFoundException);
  });
});
