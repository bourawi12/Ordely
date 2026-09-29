import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  // bcrypt only uses the first 72 bytes of a password.
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword: string;
}
