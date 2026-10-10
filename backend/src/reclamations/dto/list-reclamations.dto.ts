import { IsIn, IsOptional } from 'class-validator';
import { RECLAMATION_STATUSES, ReclamationStatus } from '../reclamation-status';

export class ListReclamationsDto {
  @IsOptional()
  @IsIn(RECLAMATION_STATUSES)
  status?: ReclamationStatus;
}