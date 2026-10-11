import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class ExternalOrderItemDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  productName: string;

  @IsNumber()
  @Min(1)
  @Max(1000)
  quantity: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Max(1_000_000)
  unitPrice?: number;
}

export class ExternalOrderCustomerDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @Transform(trim)
  @Matches(/^\+?[0-9][0-9 ]{6,18}$/, {
    message: 'customer.phone must be a valid phone number',
  })
  phone: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  address: string;

  @IsOptional()
  @Transform(trim)
  @IsEmail()
  email?: string;
}

export class ExternalOrderDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  externalOrderId: string;

  @ValidateNested()
  @Type(() => ExternalOrderCustomerDto)
  customer: ExternalOrderCustomerDto;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ExternalOrderItemDto)
  items: ExternalOrderItemDto[];

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Max(1_000_000)
  total?: number;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @IsOptional()
  @IsObject()
  shippingAddress?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}