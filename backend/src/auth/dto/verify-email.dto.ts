import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class VerifyEmailDto {
  /** The token from the emailed link. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  token: string;
}
