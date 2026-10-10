import { ConflictException, NotFoundException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../prisma/prisma.service';
import { CallDispatcherService } from './call-dispatcher.service';
import { FakeVoiceAgentClient } from '../../voice/adapters/fake-voice-agent-client';

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
        name: 'Demo Boutique',
        confirmationProcess: 'default',
        callLanguages: ['ar-TN', 'fr'],
        callStartTime: '00:00',
        callEndTime: '23:59',
      },
    },
  };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-07T10:00:00.000Z'));
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

  afterEach(() => {
    jest.useRealTimers();
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
    expect(task.scenario.boutique).toMatchObject({
      id: 1,
      name: 'Demo Boutique',
      confirmationProcess: 'default',
    });
    expect(task.scenario.instructions).toEqual(
      expect.arrayContaining([
        'Verify the order details with the customer before confirming.',
        'Boutique: Demo Boutique.',
        'Confirmation process: default.',
      ]),
    );

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

  it('defers dispatch outside the boutique call window', async () => {
    prismaMock.call.findFirst.mockResolvedValue({
      ...sampleCall,
      order: {
        ...sampleCall.order,
        boutique: {
          ...sampleCall.order.boutique,
          callStartTime: '09:00',
          callEndTime: '17:00',
        },
      },
    });
    jest.setSystemTime(new Date('2026-10-07T17:00:00.000Z'));

    const result = await service.dispatchCall(1, 101);

    expect(result).toMatchObject({
      deferred: true,
      deferredReason: 'outside_call_window',
    });
    expect(fakeClient.dispatched).toHaveLength(0);
    expect(prismaMock.call.update).not.toHaveBeenCalled();
  });

  it('keeps an attempt pending when Ringio capacity disappears before launch', async () => {
    prismaMock.call.findFirst.mockResolvedValue(sampleCall);
    fakeClient.capacityAvailable = false;

    const result = await service.dispatchCall(1, 101);

    expect(result).toMatchObject({
      deferred: true,
      deferredReason: 'capacity_unavailable',
    });
    expect(fakeClient.dispatched).toHaveLength(0);
    expect(prismaMock.call.update).not.toHaveBeenCalled();
  });
});
