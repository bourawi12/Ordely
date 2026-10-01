import { IsIn, IsOptional } from 'class-validator';
import { ORDER_STATUSES, OrderStatus } from './update-order.dto';

export class ListOrdersDto {
  @IsOptional()
  @IsIn(ORDER_STATUSES)
  status?: OrderStatus;
}
