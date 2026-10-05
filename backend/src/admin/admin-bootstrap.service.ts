import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PASSWORD_RULE } from '../auth/password';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Grants the back office to the account in ADMIN_EMAIL at startup (idempotent). If that account
 * doesn't exist yet and ADMIN_PASSWORD is set, it is created (verified, with an empty shop).
 * Nothing is hardcoded; with ADMIN_EMAIL unset, nothing happens. Admin rights are never removed
 * here: revoke them in the database (users."isPlatformAdmin").
 */
@Injectable()
export class AdminBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminBootstrapService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap() {
    const email = this.config.get<string>('ADMIN_EMAIL')?.trim().toLowerCase();
    if (!email) return;
    try {
      await this.ensureAdmin(email, this.config.get<string>('ADMIN_PASSWORD'));
    } catch (err) {
      // Never block the API from starting over this.
      this.logger.error(
        `Could not set up the admin account: ${(err as Error).message}`,
      );
    }
  }

  async ensureAdmin(email: string, password?: string) {
    const { count } = await this.prisma.user.updateMany({
      where: { email },
      data: { isPlatformAdmin: true },
    });
    if (count > 0) {
      this.logger.log(`Back office access granted to ${email}`);
      return;
    }
    if (!password) {
      this.logger.warn(
        `ADMIN_EMAIL ${email} has no account yet: sign up with it (or set ADMIN_PASSWORD) and restart.`,
      );
      return;
    }
    if (
      password.length < 8 ||
      password.length > 72 ||
      !PASSWORD_RULE.test(password)
    ) {
      this.logger.error(
        'ADMIN_PASSWORD is too weak (8–72 characters, upper and lower case, a number and a special character).',
      );
      return;
    }
    const passwordHash = await bcrypt.hash(password, 12);
    await this.prisma.$transaction(async (tx) => {
      const boutique = await tx.boutique.create({
        data: { name: 'Ordely team' },
      });
      await tx.user.create({
        data: {
          email,
          name: 'Ordely admin',
          passwordHash,
          boutiqueId: boutique.id,
          emailVerifiedAt: new Date(),
          isPlatformAdmin: true,
        },
      });
    });
    this.logger.log(`Admin account created for ${email}`);
  }
}
