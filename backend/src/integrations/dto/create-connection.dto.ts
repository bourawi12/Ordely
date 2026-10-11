import { IsBoolean, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class CreateConnectionDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(500)
  webhookUrl?: string;

  @IsOptional()
  @IsBoolean()
  rotateWebhookSecret?: boolean;
}