import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { INTENTS, LANGUAGE_LABELS } from '../voice.rules';

/** Fields every agent callback carries. Shapes follow Ringio's OrdelyCallbackClient. */
class TaskRef {
  @IsString()
  @Matches(/^call-\d{1,10}$/, { message: 'Unknown task' })
  taskId: string;
}

export class VoiceEventDto extends TaskRef {
  @IsString()
  @MaxLength(40)
  phase: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  providerCallId?: string;

  @IsOptional()
  @IsString()
  timestamp?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;
}

export class VoiceTranscriptDto extends TaskRef {
  @IsInt()
  @Min(0)
  sequence: number;

  /** Ringio sends "customer" (mapped from its "mobile") or "agent". */
  @IsIn(['agent', 'customer', 'mobile'])
  speaker: 'agent' | 'customer' | 'mobile';

  @IsString()
  @IsNotEmpty()
  @MaxLength(10_000)
  text: string;

  @IsOptional()
  @IsString()
  timestamp?: string;
}

export class VoiceResultDto extends TaskRef {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  providerCallId?: string;

  /** completed | no_answer | rejected | error (older agents: "confirmed" for any finished call). */
  @IsString()
  @MaxLength(20)
  disposition: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(24 * 60 * 60)
  durationSeconds?: number;

  /** The agent's reading of the customer's decision; required to change an order. */
  @IsOptional()
  @IsIn(INTENTS)
  intent?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence?: number;

  @IsOptional()
  @IsIn(Object.keys(LANGUAGE_LABELS))
  language?: string;

  @IsOptional()
  @IsString()
  timestamp?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  error?: string;
}

/** multipart/form-data: these fields plus the WAV in "file". */
export class VoiceRecordingDto extends TaskRef {
  @IsIn(['agent', 'customer', 'mobile'])
  speaker: 'agent' | 'customer' | 'mobile';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  durationMs?: number;
}
