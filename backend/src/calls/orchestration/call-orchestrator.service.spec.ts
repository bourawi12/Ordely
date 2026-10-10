import { PrismaService } from '../../prisma/prisma.service';
import { CallDispatcherService } from './call-dispatcher.service';
import { CallOrchestratorService } from './call-orchestrator.service';
import { FakeVoiceAgentClient } from '../../voice/adapters/fake-voice-agent-client';

describe('CallOrchestratorService', () => {
  let service: CallOrchestratorService;
  let voiceAgent: FakeVoiceAgentClient;
  let prisma: {
    order: { findMany: jest.Mock; updateMany: jest.Mock };
    call: { create: jest.Mock; findMany: jest.Mock; updateMany: jest.Mock };
  };
  let dispatcher: { dispatchCall: jest.Mock };

  const order = {
    id: 50,
    boutiqueId: 1,
    boutique: { callStartTime: '09:00', callEndTime: '17:00' },
    calls: [],
  };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-07T10:00:00.000Z'));
    voiceAgent = new FakeVoiceAgentClient();
    prisma = {
      order: {
        findMany: jest.fn().mockResolvedValue([order]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      call: {
        create: jest.fn().mockResolvedValue({ id: 101 }),
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    dispatcher = {
      dispatchCall: jest.fn().mockResolvedValue({ status: 'pending' }),
    };
    service = new CallOrchestratorService(
      prisma as unknown as PrismaService,
      dispatcher as unknown as CallDispatcherService,
      voiceAgent,
    );
  });

  afterEach(() => jest.useRealTimers());

  it('automatically creates and dispatches the first attempt', async () => {
    await service.pollOnce();

    expect(prisma.call.create).toHaveBeenCalledWith({
      data: { orderId: 50, attempt: 1 },
      select: { id: true },
    });
    expect(dispatcher.dispatchCall).toHaveBeenCalledWith(1, 101);
  });

  it('does not create or consume an attempt when no mobile app is available', async () => {
    voiceAgent.capacityAvailable = false;

    await service.pollOnce();

    expect(prisma.call.create).not.toHaveBeenCalled();
    expect(dispatcher.dispatchCall).not.toHaveBeenCalled();
  });

  it('automatically queues the next retry after its delay', async () => {
    prisma.order.findMany.mockResolvedValue([
      {
        ...order,
        calls: [
          {
            id: 100,
            attempt: 1,
            status: 'no_answer',
            disposition: 'no_answer',
            completedAt: new Date('2026-10-07T09:00:00.000Z'),
            dispatchedAt: new Date('2026-10-07T08:00:00.000Z'),
            taskId: 'prior-task',
          },
        ],
      },
    ]);

    await service.pollOnce();

    expect(prisma.call.create).toHaveBeenCalledWith({
      data: { orderId: 50, attempt: 2 },
      select: { id: true },
    });
    expect(dispatcher.dispatchCall).toHaveBeenCalledWith(1, 101);
  });

  it('defers after closing and dispatches at the next day opening', async () => {
    jest.setSystemTime(new Date('2026-10-07T16:00:00.000Z'));

    await service.pollOnce();

    expect(prisma.call.create).not.toHaveBeenCalled();
    expect(dispatcher.dispatchCall).not.toHaveBeenCalled();

    jest.setSystemTime(new Date('2026-10-08T08:00:00.000Z'));
    await service.pollOnce();

    expect(prisma.call.create).toHaveBeenCalledWith({
      data: { orderId: 50, attempt: 1 },
      select: { id: true },
    });
    expect(dispatcher.dispatchCall).toHaveBeenCalledWith(1, 101);
  });

  it('advances past batches of orders that cannot be retried', async () => {
    const completedAt = new Date('2026-10-07T09:00:00.000Z');
    prisma.order.findMany
      .mockResolvedValueOnce(
        Array.from({ length: 100 }, (_, index) => ({
          ...order,
          id: index + 1,
          calls: [
            {
              id: index + 1000,
              attempt: 1,
              status: 'failed',
              disposition: 'needs_human',
              completedAt,
              dispatchedAt: completedAt,
              taskId: `task-${index}`,
            },
          ],
        })),
      )
      .mockResolvedValueOnce([{ ...order, id: 101 }]);

    await service.pollOnce();
    expect(prisma.call.create).not.toHaveBeenCalled();

    await service.pollOnce();

    expect(prisma.order.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ cursor: { id: 100 }, skip: 1 }),
    );
    expect(prisma.call.create).toHaveBeenCalledWith({
      data: { orderId: 101, attempt: 1 },
      select: { id: true },
    });
  });

  it('reuses an existing pending attempt rather than allocating another', async () => {
    prisma.order.findMany.mockResolvedValue([
      {
        ...order,
        calls: [
          {
            id: 101,
            attempt: 1,
            status: 'pending',
            disposition: null,
            completedAt: null,
            dispatchedAt: null,
            taskId: null,
          },
        ],
      },
    ]);

    await service.pollOnce();

    expect(prisma.call.create).not.toHaveBeenCalled();
    expect(dispatcher.dispatchCall).toHaveBeenCalledWith(1, 101);
  });

  it('closes stale calls and makes the next attempt eligible', async () => {
    prisma.call.findMany.mockResolvedValue([
      { id: 100, orderId: 50, attempt: 1 },
    ]);
    prisma.order.findMany.mockResolvedValue([
      {
        ...order,
        calls: [
          {
            id: 100,
            attempt: 1,
            status: 'no_answer',
            disposition: 'no_answer',
            completedAt: new Date('2026-10-07T09:00:00.000Z'),
            dispatchedAt: new Date('2026-10-07T08:00:00.000Z'),
            taskId: 'prior-task',
          },
        ],
      },
    ]);

    await service.pollOnce();

    expect(prisma.call.updateMany).toHaveBeenCalledWith({
      where: { id: 100, status: 'pending' },
      data: expect.objectContaining({
        status: 'no_answer',
        disposition: 'no_answer',
      }),
    });
    expect(prisma.call.create).toHaveBeenCalledWith({
      data: { orderId: 50, attempt: 2 },
      select: { id: true },
    });
  });

  it('marks a stale final attempt unreachable', async () => {
    prisma.call.findMany.mockResolvedValue([
      { id: 100, orderId: 50, attempt: 3 },
    ]);

    await service.pollOnce();

    expect(prisma.order.updateMany).toHaveBeenCalledWith({
      where: { id: 50, status: 'pending' },
      data: { status: 'unreachable' },
    });
  });

  it('runs one follow-up poll when a wake arrives during an active poll', async () => {
    let finishFirstPoll!: (orders: typeof order[]) => void;
    prisma.order.findMany
      .mockImplementationOnce(
        () => new Promise((resolve) => { finishFirstPoll = resolve; }),
      )
      .mockResolvedValue([]);

    const firstPoll = service.pollOnce();
    await service.pollOnce();
    await service.pollOnce();
    finishFirstPoll([]);
    await firstPoll;
    await Promise.resolve();

    expect(prisma.order.findMany).toHaveBeenCalledTimes(2);
  });
});
