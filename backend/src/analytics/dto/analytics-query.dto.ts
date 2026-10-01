import { IsIn, IsOptional } from 'class-validator';

export const ANALYTICS_RANGES = ['7d', '30d', '90d'] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

export class AnalyticsQueryDto {
  @IsOptional()
  @IsIn(ANALYTICS_RANGES)
  range: AnalyticsRange = '30d';
}
