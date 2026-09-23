import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  CALL_RANGES,
  CALL_STATUSES,
  CallRange,
  CallStatus,
} from '../call-status';

export class CallFiltersDto {
  @IsOptional()
  @IsIn(CALL_STATUSES)
  status?: CallStatus;

  /** Matches customer name, phone number or order number. */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsIn(CALL_RANGES)
  range: CallRange = 'all';
}

export class ListCallsDto extends CallFiltersDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 10;
}
