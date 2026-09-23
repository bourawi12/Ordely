import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateOrderDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  customer: string;

  @Transform(trim)
  @Matches(/^\+?[0-9][0-9 ]{6,18}$/, {
    message: 'phone must be a valid phone number',
  })
  phone: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  item: string;

  @IsInt()
  @Min(1)
  @Max(1000)
  quantity: number;

  /** Order value in TND. */
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Max(1_000_000)
  total: number;
}
