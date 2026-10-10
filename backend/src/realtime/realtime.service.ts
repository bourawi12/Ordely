import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';

export interface OrderStatusChangedPayload {
  orderId: number;
  status: string;
  updatedAt: string;
}

export interface OrderCreatedPayload {
  orderId: number;
  status: string;
  createdAt: string;
}

export interface CallStatusChangedPayload {
  callId: number;
  orderId: number;
  status: string;
  updatedAt: string;
  transportPhase?: string | null;
}

/** Emits real-time events to authenticated boutique rooms. */
@Injectable()
export class RealtimeService {
  private server: Server | null = null;

  /** Called once by RealtimeGateway after the Socket.IO server is initialised. */
  setServer(server: Server) {
    this.server = server;
  }

  private room(boutiqueId: number): string {
    return `boutique:${boutiqueId}`;
  }

  emitOrderCreated(
    boutiqueId: number,
    payload: OrderCreatedPayload,
  ) {
    this.server?.to(this.room(boutiqueId)).emit('order.created', payload);
  }

  emitOrderStatusChanged(
    boutiqueId: number,
    payload: OrderStatusChangedPayload,
  ) {
    this.server?.to(this.room(boutiqueId)).emit('order.status_changed', payload);
  }

  emitCallStatusChanged(
    boutiqueId: number,
    payload: CallStatusChangedPayload,
  ) {
    this.server?.to(this.room(boutiqueId)).emit('call.status_changed', payload);
  }
}
