import { ArrayUnique, IsArray, IsIn, IsOptional } from 'class-validator';
import {
  ACQUISITION_SOURCES,
  ALL_ZONES,
  CARRIERS,
  GOUVERNORATS,
  ORDER_VOLUMES,
  SECTORS,
} from '../boutique-options';

/** Onboarding screen 3 (optional, skippable): business context and marketing answers. */
export class DetailsDto {
  @IsOptional()
  @IsIn(SECTORS, { message: "Secteur d'activité inconnu." })
  sector?: (typeof SECTORS)[number];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn([...GOUVERNORATS, ALL_ZONES], {
    each: true,
    message: 'Zone de livraison inconnue.',
  })
  deliveryZones?: string[];

  @IsOptional()
  @IsIn(ORDER_VOLUMES, { message: 'Volume de commandes inconnu.' })
  dailyOrderVolume?: (typeof ORDER_VOLUMES)[number];

  @IsOptional()
  @IsIn(ACQUISITION_SOURCES, { message: 'Réponse inconnue.' })
  acquisitionSource?: (typeof ACQUISITION_SOURCES)[number];

  @IsOptional()
  @IsIn(CARRIERS, { message: 'Transporteur inconnu.' })
  carrier?: (typeof CARRIERS)[number];
}
