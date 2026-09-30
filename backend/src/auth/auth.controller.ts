import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { AllowUnverified } from './allow-unverified.decorator';
import { AuthThrottlerGuard } from './auth-throttler.guard';
import { AUTH_UPLOAD_LIMIT_BYTES } from './auth.constants';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateAppearanceDto } from './dto/update-appearance.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { JwtPayload } from './jwt-payload';
import { Public } from './public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @UseGuards(AuthThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @UseGuards(AuthThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /** Public: the link may be opened on another device, without a session. */
  @Public()
  @Post('verify-email')
  @HttpCode(200)
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto.token);
  }

  @AllowUnverified()
  @Post('resend-verification')
  @HttpCode(200)
  resendVerification(@CurrentUser() user: JwtPayload) {
    return this.authService.resendVerification(user.sub);
  }

  @AllowUnverified()
  @Get('me')
  me(@CurrentUser() user: JwtPayload) {
    return this.authService.me(user.sub);
  }

  @Patch('profile')
  updateProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(user.sub, dto);
  }

  @Patch('appearance')
  updateAppearance(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateAppearanceDto,
  ) {
    return this.authService.updateAppearance(user.sub, dto);
  }

  @Patch('change-password')
  changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user.sub, dto);
  }

  /** multipart/form-data with the image in the "file" field. Allowed before verification: the
   * sign-up form sends the picture right after creating the account. */
  @AllowUnverified()
  @Post('avatar')
  @HttpCode(200)
  @UseInterceptors(
    // Hard cap while reading the body; the 2 MB rule is enforced with a clear message in the service.
    FileInterceptor('file', {
      limits: { fileSize: AUTH_UPLOAD_LIMIT_BYTES, files: 1 },
    }),
  )
  uploadAvatar(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    return this.authService.uploadAvatar(user.sub, file);
  }

  @Delete('avatar')
  removeAvatar(@CurrentUser() user: JwtPayload) {
    return this.authService.removeAvatar(user.sub);
  }
}
