import { IsInt, Min } from 'class-validator';

export class QueueCallDto {
  @IsInt()
  @Min(1)
  orderId: number;
}
