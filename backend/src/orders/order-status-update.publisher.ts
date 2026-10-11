export type ExternalOrderStatus = 'confirmed' | 'cancelled';

export interface OrderStatusUpdate {
  boutiqueId: number;
  orderId: number;
  status: ExternalOrderStatus;
}

export interface OrderStatusUpdatePublisher {
  publish(update: OrderStatusUpdate): Promise<void>;
}

export const ORDER_STATUS_UPDATE_PUBLISHER = Symbol(
  'ORDER_STATUS_UPDATE_PUBLISHER',
);