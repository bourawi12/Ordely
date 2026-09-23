import { IsIn } from 'class-validator';

export const ORDER_STATUSES = ['pending', 'confirmed', 'cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export class UpdateOrderDto {
  @IsIn(ORDER_STATUSES)
  status: OrderStatus;
}
