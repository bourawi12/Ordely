import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { CreateOrderItemDto } from '../../orders/dto/create-order-item.dto';

class IntegrationCustomerDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsNotEmpty()
  address: string;
}

export class CreateIntegrationOrderDto {
  @IsString()
  @IsNotEmpty()
  externalOrderId: string;

  @IsObject()
  @ValidateNested()
  @Type(() => IntegrationCustomerDto)
  customer: IntegrationCustomerDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];

  @IsOptional()
  @IsNumber()
  total?: number;
}