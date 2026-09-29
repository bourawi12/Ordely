import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
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

/** A user as the API returns it: no password hash, and a signed URL instead of the storage key. */
export type PublicUser = Omit<User, 'passwordHash' | 'avatarKey'> & {
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
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
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
          },
        });
      });
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, avatarKey, ...rest } = user;
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
