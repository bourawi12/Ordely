import { Test, TestingModule } from '@nestjs/testing';
import { Server } from 'socket.io';
import { RealtimeService } from './realtime.service';

describe('RealtimeService', () => {
  let service: RealtimeService;
  let mockServer: Partial<Server>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RealtimeService],
    }).compile();

    service = module.get<RealtimeService>(RealtimeService);

    mockServer = {
      to: jest.fn().mockReturnValue({
        emit: jest.fn(),
      }),
    };

    service.setServer(mockServer as Server);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should emit order.status_changed to boutique room', () => {
    const emitFn = jest.fn();
    (mockServer.to as jest.Mock).mockReturnValue({ emit: emitFn });

    service.emitOrderStatusChanged(1, {
      orderId: 42,
      status: 'confirmed',
      updatedAt: '2026-10-05T12:00:00.000Z',
    });

    expect(mockServer.to).toHaveBeenCalledWith('boutique:1');
    expect(emitFn).toHaveBeenCalledWith('order.status_changed', {
      orderId: 42,
      status: 'confirmed',
      updatedAt: '2026-10-05T12:00:00.000Z',
    });
  });

  it('should emit call.status_changed to boutique room', () => {
    const emitFn = jest.fn();
    (mockServer.to as jest.Mock).mockReturnValue({ emit: emitFn });

    service.emitCallStatusChanged(2, {
      callId: 10,
      orderId: 42,
      status: 'completed',
      updatedAt: '2026-10-05T12:00:00.000Z',
    });

    expect(mockServer.to).toHaveBeenCalledWith('boutique:2');
    expect(emitFn).toHaveBeenCalledWith('call.status_changed', {
      callId: 10,
      orderId: 42,
      status: 'completed',
      updatedAt: '2026-10-05T12:00:00.000Z',
    });
  });
});
