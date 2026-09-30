import { Transform } from 'class-transformer';
import { IsIn, IsOptional, Matches } from 'class-validator';
import { HEX_COLOR, THEME_MODES, ThemeMode } from '../theme';

/** An omitted field keeps its current value. */
export class UpdateAppearanceDto {
  /** "#rrggbb", or null to go back to the Ordely blue. */
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @Matches(HEX_COLOR, { message: 'accentColor must be a #RRGGBB colour' })
  accentColor?: string | null;

  @IsOptional()
  @IsIn(THEME_MODES)
  themeMode?: ThemeMode;
}
