import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PASSWORD_RULE, PASSWORD_RULE_MESSAGE } from '../password';

export class ResetPasswordDto {
  /** The token from the emailed link. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  token: string;

  // bcrypt only uses the first 72 bytes of a password.
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(PASSWORD_RULE, { message: PASSWORD_RULE_MESSAGE })
  password: string;
}
