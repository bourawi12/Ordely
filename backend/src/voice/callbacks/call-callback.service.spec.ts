import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CallCallbackService } from './call-callback.service';

describe('CallCallbackService', () => {
  let service: CallCallbackService;
  let prismaMock: {
    call: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };

  const sampleCall = {
    id: 101,
    taskId: 'task-1234-uuid',
    status: 'pending',
    transportPhase: 'dispatched',
    failureReason: null,
  };

  beforeEach(() => {
    prismaMock = {
      call: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    service = new CallCallbackService(prismaMock as unknown as PrismaService);
  });

  it('updates transportPhase and providerCallId on lifecycle event', async () => {
    prismaMock.call.findUnique.mockResolvedValue(sampleCall);
    prismaMock.call.update.mockImplementation(({ data }) => ({
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

  it('updates Call status to confirmed on confirmed disposition', async () => {
    prismaMock.call.findUnique.mockResolvedValue(sampleCall);
    prismaMock.call.update.mockImplementation(({ data }) => ({
      ...sampleCall,
      ...data,
    }));

    const result = await service.handleResult({
      taskId: 'task-1234-uuid',
      disposition: 'confirmed',
      durationSeconds: 45,
      timestamp: new Date().toISOString(),
    });

    expect(prismaMock.call.update).toHaveBeenCalledWith({
      where: { id: 101 },
      data: expect.objectContaining({
        status: 'confirmed',
        disposition: 'confirmed',
        durationSeconds: 45,
      }),
    });
    expect(result.status).toBe('confirmed');
  });

  it('sets failureReason and keeps pending status on needs_human disposition', async () => {
    prismaMock.call.findUnique.mockResolvedValue(sampleCall);
    prismaMock.call.update.mockImplementation(({ data }) => ({
      ...sampleCall,
      ...data,
    }));

    const result = await service.handleResult({
      taskId: 'task-1234-uuid',
      disposition: 'needs_human',
      timestamp: new Date().toISOString(),
    });

    expect(result.status).toBe('pending');
    expect(result.failureReason).toContain('manual review');
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
