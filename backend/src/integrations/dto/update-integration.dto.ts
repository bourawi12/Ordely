import { IsBoolean, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class UpdateIntegrationDto {
  @IsOptional()
  @IsString()
  @IsUrl({ require_tld: false }, { message: 'webhookUrl must be a valid URL' })
  @MaxLength(500)
  webhookUrl?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}