import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { CALL_STATUSES, CallStatus } from '../call-status';

export class TranscriptLineDto {
  @IsIn(['agent', 'customer'])
  speaker: 'agent' | 'customer';

  @IsString()
  @MaxLength(4000)
  text: string;
}

export class UpdateCallDto {
  @IsIn(CALL_STATUSES)
  status: CallStatus;

  @IsOptional()
  @IsInt()
  @Min(0)
  durationSeconds?: number;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  language?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TranscriptLineDto)
  transcript?: TranscriptLineDto[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  recordingUrl?: string;
}
