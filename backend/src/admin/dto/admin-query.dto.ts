import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { MERCHANT_STATUSES, MerchantStatus } from '../health';
import { PERIOD_RANGES, PeriodRange } from '../period';
import { PLAN_CODES } from '../plans';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export class PeriodQueryDto {
  @IsOptional()
  @IsIn(PERIOD_RANGES)
  range?: PeriodRange;

  /** Custom range only: first day, YYYY-MM-DD (Tunis). */
  @IsOptional()
  @Matches(DAY, { message: 'from must be YYYY-MM-DD' })
  from?: string;

  /** Custom range only: last day included, YYYY-MM-DD (Tunis). */
  @IsOptional()
  @Matches(DAY, { message: 'to must be YYYY-MM-DD' })
  to?: string;
}

export const MERCHANT_SORTS = [
  'name',
  'signupAt',
  'plan',
  'quotaUsed',
  'orders',
  'calls',
  'confirmationRate',
  'lastActivityAt',
  'health',
] as const;
export type MerchantSort = (typeof MERCHANT_SORTS)[number];

export class MerchantsQueryDto extends PeriodQueryDto {
  /** Shop name, owner name or owner e-mail. */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsIn(PLAN_CODES)
  plan?: string;

  @IsOptional()
  @IsIn(MERCHANT_STATUSES)
  status?: MerchantStatus;

  @IsOptional()
  @IsIn(MERCHANT_SORTS)
  sort?: MerchantSort;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  dir?: 'asc' | 'desc';
}

export class CohortsQueryDto {
  /** How many weekly cohorts, the latest first. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(4)
  @Max(26)
  weeks?: number;
}

/** Export takes any of the filters of the dataset it exports. */
export class ExportQueryDto extends MerchantsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(4)
  @Max(26)
  weeks?: number;
}
