import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { PLATFORMS } from '../boutique-options';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** Onboarding screen 1 (required): who the agent calls on behalf of. */
export class IdentityDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Le nom de la boutique est obligatoire.' })
  @MaxLength(100, {
    message: 'Le nom de la boutique est trop long (100 caractères max).',
  })
  name: string;

  @Transform(trim)
  @Matches(/^\+?[0-9][0-9 ]{6,18}$/, {
    message: 'Numéro de téléphone invalide.',
  })
  businessPhone: string;

  @IsIn(PLATFORMS, { message: 'Choisissez une plateforme.' })
  platform: (typeof PLATFORMS)[number];
}
