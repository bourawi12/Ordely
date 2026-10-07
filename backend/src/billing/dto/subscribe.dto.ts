import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PLAN_CODES } from '../../admin/plans';

export class SubscribeDto {
  @IsIn(PLAN_CODES)
  plan: string;

  /** Required for a paid plan: the card token from the provider's checkout. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  paymentToken?: string;
}
