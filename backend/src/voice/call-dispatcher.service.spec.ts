import { ConflictException, NotFoundException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { FakeVoiceAgentClient } from './adapters/fake-voice-agent-client';
import { CallDispatcherService } from './call-dispatcher.service';

describe('CallDispatcherService', () => {
  let service: CallDispatcherService;
  let fakeClient: FakeVoiceAgentClient;
  let prismaMock: {
    call: {
      findFirst: jest.Mock;
      update: jest.Mock;
    };
  };

  const sampleCall = {
    id: 101,
    status: 'pending',
    taskId: null,
    transportPhase: null,
    language: 'ar-TN',
    order: {
      id: 50,
      boutiqueId: 1,
      customer: 'Sami Ben Ali',
      phone: '+216 20 123 456',
      items: [{ productName: 'Robe d’été', quantity: 2 }],
      total: new Decimal('120.500'),
      boutique: {
        id: 1,
        callLanguages: ['ar-TN', 'fr'],
      },
    },
  };

  beforeEach(() => {
    fakeClient = new FakeVoiceAgentClient();
    prismaMock = {
      call: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };
    service = new CallDispatcherService(
      prismaMock as unknown as PrismaService,
      fakeClient,
    );
  });

  it('dispatches a pending call and marks it as dispatched', async () => {
    prismaMock.call.findFirst.mockResolvedValue(sampleCall);
    prismaMock.call.update.mockImplementation(({ data }) => ({
      ...sampleCall,
      ...data,
    }));

    const result = await service.dispatchCall(1, 101);

    expect(fakeClient.dispatched).toHaveLength(1);
    const task = fakeClient.dispatched[0];
    expect(task.orderlyCallId).toBe(101);
    expect(task.destination).toBe('+21620123456');
    expect(task.scenario.customer).toBe('Sami Ben Ali');
    expect(task.scenario.item).toBe('Robe d’été x2');
    expect(task.scenario.quantity).toBe(2);
    expect(task.scenario.total).toBe('120.500 TND');

    expect(prismaMock.call.update).toHaveBeenCalledWith({
      where: { id: 101 },
      data: expect.objectContaining({
        taskId: task.taskId,
        transportPhase: 'dispatched',
        failureReason: null,
      }),
    });
    expect(result.transportPhase).toBe('dispatched');
  });

  it('records failureReason when the voice agent rejects the task', async () => {
    fakeClient.shouldAccept = false;
    fakeClient.rejectError = 'No mobile app registered';

    prismaMock.call.findFirst.mockResolvedValue(sampleCall);
    prismaMock.call.update.mockImplementation(({ data }) => ({
      ...sampleCall,
      ...data,
    }));

    const result = await service.dispatchCall(1, 101);

    expect(prismaMock.call.update).toHaveBeenCalledWith({
      where: { id: 101 },
      data: expect.objectContaining({
        transportPhase: 'rejected',
        failureReason: 'No mobile app registered',
      }),
    });
    expect(result.transportPhase).toBe('rejected');
  });

  it('throws NotFoundException if call does not exist or wrong boutique', async () => {
    prismaMock.call.findFirst.mockResolvedValue(null);

    await expect(service.dispatchCall(1, 999)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws ConflictException if call is not pending', async () => {
    prismaMock.call.findFirst.mockResolvedValue({
      ...sampleCall,
      status: 'confirmed',
    });

    await expect(service.dispatchCall(1, 101)).rejects.toThrow(
      ConflictException,
    );
  });
});
