import { IsIn } from 'class-validator';
import { RECLAMATION_STATUSES, ReclamationStatus } from '../reclamation-status';

export class UpdateReclamationDto {
  @IsIn(RECLAMATION_STATUSES)
  status: ReclamationStatus;
}