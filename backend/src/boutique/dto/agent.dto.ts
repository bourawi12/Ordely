import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  Matches,
} from 'class-validator';
import { CALL_LANGUAGES, CONFIRMATION_PROCESSES } from '../boutique-options';

const HOUR = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Onboarding screen 2 (required). The window length is checked in BoutiqueService. */
export class AgentDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Choisissez au moins une langue.' })
  @ArrayUnique()
  @IsIn(CALL_LANGUAGES, { each: true, message: 'Langue inconnue.' })
  callLanguages: (typeof CALL_LANGUAGES)[number][];

  @Matches(HOUR, { message: 'Heure de début invalide (HH:MM).' })
  callStartTime: string;

  @Matches(HOUR, { message: 'Heure de fin invalide (HH:MM).' })
  callEndTime: string;

  @IsOptional()
  @IsIn(CONFIRMATION_PROCESSES, { message: 'Réponse inconnue.' })
  confirmationProcess?: (typeof CONFIRMATION_PROCESSES)[number];
}
