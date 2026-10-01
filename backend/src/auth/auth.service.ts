import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { MailService } from '../mail/mail.service';
import { resetPasswordMessage } from '../mail/reset-password.template';
import { verifyEmailMessage } from '../mail/verify-email.template';
import { PrismaService } from '../prisma/prisma.service';
import { detectImageType } from '../storage/image-type';
import { StorageService } from '../storage/storage.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateAppearanceDto } from './dto/update-appearance.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtPayload } from './jwt-payload';

const BCRYPT_ROUNDS = 12;
// Compared against when the email is unknown, so both failure paths take the same time.
const DUMMY_HASH = bcrypt.hashSync('timing-equalizer', BCRYPT_ROUNDS);

/** Largest accepted profile picture, in bytes. */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

/** How long an emailed verification link works. */
export const VERIFY_LINK_TTL_MS = 24 * 60 * 60 * 1000;
/** Minimum time between two verification emails for the same account. */
export const VERIFY_RESEND_COOLDOWN_MS = 60 * 1000;

/** How long an emailed "forgot password" link works. */
export const RESET_LINK_TTL_MS = 60 * 60 * 1000;
/** Minimum time between two reset emails for the same account. */
export const RESET_RESEND_COOLDOWN_MS = 60 * 1000;

/** Only this hash is stored: a database leak must not hand out working links. */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** A fresh link token and the columns that remember it. */
function newVerifyToken() {
  const token = randomBytes(32).toString('base64url');
  const now = Date.now();
  return {
    token,
    data: {
      emailVerifyTokenHash: hashToken(token),
      emailVerifyExpiresAt: new Date(now + VERIFY_LINK_TTL_MS),
      emailVerifySentAt: new Date(now),
    },
  };
}

/**
 * A user as the API returns it: no password hash or verification secrets, and a signed URL
 * instead of the storage key.
 */
export type PublicUser = Omit<
  User,
  | 'passwordHash'
  | 'avatarKey'
  | 'emailVerifyTokenHash'
  | 'emailVerifyExpiresAt'
  | 'emailVerifySentAt'
  | 'passwordResetTokenHash'
  | 'passwordResetExpiresAt'
  | 'passwordResetSentAt'
  | 'passwordChangedAt'
> & {
  avatarUrl: string | null;
};

export interface AuthResult {
  accessToken: string;
  expiresIn: number;
  user: PublicUser;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly storage: StorageService,
    private readonly mail: MailService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    // The account stays closed until the emailed link is used.
    const verify = newVerifyToken();
    try {
      // Every account comes with its own (empty) boutique, filled by the onboarding.
      const user = await this.prisma.$transaction(async (tx) => {
        const boutique = await tx.boutique.create({ data: {} });
        return tx.user.create({
          data: {
            email: dto.email,
            name: dto.name,
            passwordHash,
            boutiqueId: boutique.id,
            accentColor: dto.accentColor ?? null,
            themeMode: dto.themeMode ?? 'system',
            ...verify.data,
          },
        });
      });
      // A failed send must not lose the account: the "check your inbox" page can resend.
      await this.sendVerifyEmail(user, verify.token).catch((err: Error) =>
        this.logger.error(
          `Could not send the verification email: ${err.message}`,
        ),
      );
      return this.issueToken(user);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(
          'An account with this email already exists',
        );
      }
      throw err;
    }
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    const valid = await bcrypt.compare(
      dto.password,
      user?.passwordHash ?? DUMMY_HASH,
    );
    if (!user || !valid) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return this.issueToken(user);
  }

  async me(userId: number): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException();
    }
    return this.publicUser(user);
  }

  async updateProfile(
    userId: number,
    dto: UpdateProfileDto,
  ): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException();
    }
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { name: dto.name },
    });
    return this.publicUser(updated);
  }

  /** Accent colour (null = the Ordely blue) and light/dark theme. */
  async updateAppearance(
    userId: number,
    dto: UpdateAppearanceDto,
  ): Promise<PublicUser> {
    await this.findUser(userId);
    const updated = await this.prisma.user.update({
      where: { id: userId },
      // undefined leaves a column as it is; null resets the accent.
      data: { accentColor: dto.accentColor, themeMode: dto.themeMode },
    });
    return this.publicUser(updated);
  }

  /** Confirms the address behind an emailed link. Each link works once. */
  async verifyEmail(token: string): Promise<{ email: string }> {
    const user = await this.prisma.user.findUnique({
      where: { emailVerifyTokenHash: hashToken(token) },
    });
    if (!user?.emailVerifyExpiresAt || user.emailVerifyExpiresAt < new Date()) {
      throw new BadRequestException('This link is invalid or has expired');
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        emailVerifyTokenHash: null,
        emailVerifyExpiresAt: null,
      },
    });
    return { email: user.email };
  }

  /** Emails a new link; the previous one stops working. */
  async resendVerification(userId: number): Promise<{ sent: true }> {
    const user = await this.findUser(userId);
    if (user.emailVerifiedAt) {
      throw new ConflictException('Email address already verified');
    }
    const last = user.emailVerifySentAt?.getTime() ?? 0;
    if (Date.now() - last < VERIFY_RESEND_COOLDOWN_MS) {
      throw new HttpException(
        'Please wait a minute before asking for another email',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const verify = newVerifyToken();
    await this.prisma.user.update({
      where: { id: userId },
      data: verify.data,
    });
    try {
      await this.sendVerifyEmail(user, verify.token);
    } catch (err) {
      this.logger.error(
        `Could not send the verification email: ${(err as Error).message}`,
      );
      throw new ServiceUnavailableException(
        'The email could not be sent. Try again in a few minutes.',
      );
    }
    return { sent: true };
  }

  private async sendVerifyEmail(user: User, token: string) {
    const appUrl = this.config
      .get<string>('APP_URL', 'http://localhost:3200')
      .replace(/\/+$/, '');
    await this.mail.send(
      verifyEmailMessage({
        to: user.email,
        name: user.name,
        link: `${appUrl}/verify-email?token=${token}`,
      }),
    );
  }

  /**
   * Emails a link to choose a new password. Answers the same whether or not the address has an
   * account, so the form can't be used to find out who is a customer; a second request within a
   * minute sends nothing. A new link replaces the previous one.
   */
  async requestPasswordReset(email: string): Promise<{ sent: true }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    const last = user?.passwordResetSentAt?.getTime() ?? 0;
    if (!user || Date.now() - last < RESET_RESEND_COOLDOWN_MS) {
      return { sent: true };
    }
    const token = randomBytes(32).toString('base64url');
    const now = Date.now();
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetTokenHash: hashToken(token),
        passwordResetExpiresAt: new Date(now + RESET_LINK_TTL_MS),
        passwordResetSentAt: new Date(now),
      },
    });
    const appUrl = this.config
      .get<string>('APP_URL', 'http://localhost:3200')
      .replace(/\/+$/, '');
    try {
      await this.mail.send(
        resetPasswordMessage({
          to: user.email,
          name: user.name,
          link: `${appUrl}/reset-password?token=${token}`,
        }),
      );
    } catch (err) {
      this.logger.error(
        `Could not send the password reset email: ${(err as Error).message}`,
      );
      throw new ServiceUnavailableException(
        'The email could not be sent. Try again in a few minutes.',
      );
    }
    return { sent: true };
  }

  /**
   * Sets the password chosen through an emailed link, once, and signs the user in. Sessions
   * opened before (on any device) stop working. The link also proves the address, so an
   * unverified account becomes verified.
   */
  async resetPassword(token: string, password: string): Promise<AuthResult> {
    const tokenHash = hashToken(token);
    const user = await this.prisma.user.findUnique({
      where: { passwordResetTokenHash: tokenHash },
    });
    if (
      !user?.passwordResetExpiresAt ||
      user.passwordResetExpiresAt < new Date()
    ) {
      throw new BadRequestException('This link is invalid or has expired');
    }
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    // Whole seconds, like a token's "iat": the session issued below must stay valid.
    const changedAt = new Date(Math.floor(Date.now() / 1000) * 1000);
    // Matching the hash again makes the link single-use even if it is opened twice at once.
    const { count } = await this.prisma.user.updateMany({
      where: { id: user.id, passwordResetTokenHash: tokenHash },
      data: {
        passwordHash,
        passwordChangedAt: changedAt,
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
        emailVerifiedAt: user.emailVerifiedAt ?? changedAt,
        emailVerifyTokenHash: null,
        emailVerifyExpiresAt: null,
      },
    });
    if (count === 0) {
      throw new BadRequestException('This link is invalid or has expired');
    }
    return this.issueToken(await this.findUser(user.id));
  }

  async changePassword(
    userId: number,
    dto: ChangePasswordDto,
  ): Promise<{ success: boolean }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException();
    }
    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) {
      throw new BadRequestException('Current password is incorrect');
    }
    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
    return { success: true };
  }

  /** Stores a new profile picture (JPEG, PNG or WebP, 2 MB max) and drops the old one. */
  async uploadAvatar(
    userId: number,
    file: { buffer: Buffer; size: number } | undefined,
  ): Promise<PublicUser> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Choose an image to upload.');
    }
    if (file.size > AVATAR_MAX_BYTES) {
      throw new BadRequestException('The image is larger than 2 MB.');
    }
    const type = detectImageType(file.buffer);
    if (!type) {
      throw new BadRequestException(
        'Unsupported format. Use a JPEG, PNG or WebP image.',
      );
    }

    const user = await this.findUser(userId);
    const key = `avatars/${userId}/${randomUUID()}.${type.ext}`;
    await this.storage.put(key, file.buffer, type.mime);
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarKey: key },
    });
    await this.removeObject(user.avatarKey);
    return this.publicUser(updated);
  }

  async removeAvatar(userId: number): Promise<PublicUser> {
    const user = await this.findUser(userId);
    if (!user.avatarKey) return this.publicUser(user);
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarKey: null },
    });
    await this.removeObject(user.avatarKey);
    return this.publicUser(updated);
  }

  private async findUser(userId: number): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    return user;
  }

  /** Deleting the old file is best effort: a leftover object never fails the request. */
  private async removeObject(key: string | null) {
    if (!key) return;
    try {
      await this.storage.remove(key);
    } catch (err) {
      this.logger.warn(`Could not delete ${key}: ${(err as Error).message}`);
    }
  }

  private async publicUser(user: User): Promise<PublicUser> {
    const {
      /* eslint-disable @typescript-eslint/no-unused-vars */
      passwordHash,
      avatarKey,
      emailVerifyTokenHash,
      emailVerifyExpiresAt,
      emailVerifySentAt,
      passwordResetTokenHash,
      passwordResetExpiresAt,
      passwordResetSentAt,
      passwordChangedAt,
      /* eslint-enable @typescript-eslint/no-unused-vars */
      ...rest
    } = user;
    return {
      ...rest,
      avatarUrl: avatarKey ? await this.storage.url(avatarKey) : null,
    };
  }

  private async issueToken(user: User): Promise<AuthResult> {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    return {
      accessToken: await this.jwt.signAsync(payload),
      expiresIn: Number(this.config.get('JWT_EXPIRES_IN', 86400)),
      user: await this.publicUser(user),
    };
  }
}
