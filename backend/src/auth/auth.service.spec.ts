import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash } from 'crypto';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let jwt: JwtService;

  const user = {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  };

  const boutique = { create: jest.fn() };
  const mail = { send: jest.fn() };
  const storage = {
    put: jest.fn(),
    remove: jest.fn(),
    url: jest.fn((key: string) =>
      Promise.resolve(`https://files.test/${key}?sig`),
    ),
  };

  // Registration runs in an interactive transaction: hand the callback the same mocks.
  const $transaction = jest.fn((fn: (tx: unknown) => unknown) =>
    fn({ user, boutique }),
  );
  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: { user, boutique, $transaction } },
        { provide: StorageService, useValue: storage },
        { provide: MailService, useValue: mail },
        {
          provide: JwtService,
          useValue: new JwtService({ secret: 'test-secret' }),
        },
        {
          // Env values are strings; the service must convert them.
          provide: ConfigService,
          useValue: {
            get: (key: string, fallback?: unknown) =>
              key === 'JWT_EXPIRES_IN' ? '3600' : fallback,
          },
        },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
    jwt = moduleRef.get(JwtService);
  });

  it('creates the boutique and links the new user to it, in one transaction', async () => {
    boutique.create.mockResolvedValue({ id: 42 });
    user.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 1, createdAt: new Date(), ...data }),
    );

    const result = await service.register({
      email: 'ada@example.com',
      name: 'Ada',
      password: 'correct horse',
      acceptedTerms: true,
    });

    expect($transaction).toHaveBeenCalledTimes(1);
    expect(boutique.create).toHaveBeenCalledTimes(1);
    expect(user.create.mock.calls[0][0].data).toMatchObject({
      boutiqueId: 42,
      // No look chosen: Ordely blue, following the device theme.
      accentColor: null,
      themeMode: 'system',
      termsVersion: '1.0',
      privacyVersion: '1.0',
    });
    expect(user.create.mock.calls[0][0].data.acceptedTermsAt).toBeInstanceOf(Date);
    expect(result.user).toMatchObject({ boutiqueId: 42 });
  });

  it('saves the accent colour and theme chosen at sign-up', async () => {
    boutique.create.mockResolvedValue({ id: 42 });
    user.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 1, createdAt: new Date(), ...data }),
    );

    const result = await service.register({
      email: 'ada@example.com',
      name: 'Ada',
      password: 'correct horse',
      accentColor: '#7c3aed',
      themeMode: 'dark',
      acceptedTerms: true,
    });

    expect(result.user).toMatchObject({
      accentColor: '#7c3aed',
      themeMode: 'dark',
    });
  });

  it('registers a user with a hashed password and never returns the hash', async () => {
    boutique.create.mockResolvedValue({ id: 42 });
    user.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 1, createdAt: new Date(), ...data }),
    );

    const result = await service.register({
      email: 'ada@example.com',
      name: 'Ada',
      password: 'correct horse',
      acceptedTerms: true,
    });

    const stored = user.create.mock.calls[0][0].data.passwordHash;
    expect(stored).not.toBe('correct horse');
    await expect(bcrypt.compare('correct horse', stored)).resolves.toBe(true);
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(result.expiresIn).toBe(3600);
    expect(jwt.verify(result.accessToken)).toMatchObject({
      sub: 1,
      email: 'ada@example.com',
    });
  });

  describe('email verification', () => {
    const sha256 = (value: string) =>
      createHash('sha256').update(value).digest('hex');

    it('stores only a hash of the token and emails the matching link', async () => {
      boutique.create.mockResolvedValue({ id: 42 });
      user.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 1, createdAt: new Date(), ...data }),
      );

      const result = await service.register({
        email: 'ada@example.com',
        name: 'Ada',
        password: 'Str0ng!pass',
        acceptedTerms: true,
      });

      const stored = user.create.mock.calls[0][0].data;
      const { to, text } = mail.send.mock.calls[0][0];
      const token = /verify-email\?token=([\w-]+)/.exec(text)?.[1] ?? '';
      expect(to).toBe('ada@example.com');
      expect(stored.emailVerifyTokenHash).toBe(sha256(token));
      expect(stored).not.toHaveProperty('emailVerifiedAt');
      // Neither the hash nor the token ever leaves the API.
      expect(result.user).not.toHaveProperty('emailVerifyTokenHash');
    });

    it('confirms the address once, then refuses the same link', async () => {
      user.findUnique.mockResolvedValueOnce({
        id: 1,
        email: 'ada@example.com',
        emailVerifyExpiresAt: new Date(Date.now() + 60_000),
      });
      await expect(service.verifyEmail('the-token')).resolves.toEqual({
        email: 'ada@example.com',
      });
      expect(user.findUnique).toHaveBeenCalledWith({
        where: { emailVerifyTokenHash: sha256('the-token') },
      });
      expect(user.update.mock.calls[0][0].data).toMatchObject({
        emailVerifiedAt: expect.any(Date),
        emailVerifyTokenHash: null,
      });

      // The hash is gone, so nothing matches the second time.
      user.findUnique.mockResolvedValueOnce(null);
      await expect(service.verifyEmail('the-token')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('refuses an expired link', async () => {
      user.findUnique.mockResolvedValue({
        id: 1,
        email: 'ada@example.com',
        emailVerifyExpiresAt: new Date(Date.now() - 1),
      });
      await expect(service.verifyEmail('old-token')).rejects.toThrow(
        'This link is invalid or has expired',
      );
      expect(user.update).not.toHaveBeenCalled();
    });

    it('refuses to resend within a minute of the last email', async () => {
      user.findUnique.mockResolvedValue({
        id: 1,
        email: 'ada@example.com',
        emailVerifiedAt: null,
        emailVerifySentAt: new Date(Date.now() - 10_000),
      });
      await expect(service.resendVerification(1)).rejects.toMatchObject({
        status: 429,
      });
      expect(mail.send).not.toHaveBeenCalled();
    });
  });

  describe('password reset', () => {
    const sha256 = (value: string) =>
      createHash('sha256').update(value).digest('hex');
    const ada = {
      id: 1,
      email: 'ada@example.com',
      name: 'Ada',
      passwordResetSentAt: null,
      emailVerifiedAt: null,
    };

    it('answers the same for an unknown address and sends nothing', async () => {
      user.findUnique.mockResolvedValue(null);
      await expect(
        service.requestPasswordReset('nobody@example.com'),
      ).resolves.toEqual({ sent: true });
      expect(mail.send).not.toHaveBeenCalled();
      expect(user.update).not.toHaveBeenCalled();
    });

    it('stores only a hash of the token and emails the matching link, once a minute', async () => {
      user.findUnique.mockResolvedValue(ada);
      await expect(
        service.requestPasswordReset('ada@example.com'),
      ).resolves.toEqual({ sent: true });
      const stored = user.update.mock.calls[0][0].data;
      const { to, text } = mail.send.mock.calls[0][0];
      const token = /reset-password\?token=([\w-]+)/.exec(text)?.[1] ?? '';
      expect(to).toBe('ada@example.com');
      expect(token).not.toBe('');
      expect(stored.passwordResetTokenHash).toBe(sha256(token));
      expect(stored.passwordResetExpiresAt.getTime()).toBeLessThanOrEqual(
        Date.now() + 60 * 60 * 1000,
      );

      // Asked again right away: same answer, no second email.
      jest.clearAllMocks();
      user.findUnique.mockResolvedValue({
        ...ada,
        passwordResetSentAt: new Date(Date.now() - 10_000),
      });
      await expect(
        service.requestPasswordReset('ada@example.com'),
      ).resolves.toEqual({ sent: true });
      expect(mail.send).not.toHaveBeenCalled();
    });

    it('sets the new password once, ends older sessions and signs the user in', async () => {
      user.findUnique
        .mockResolvedValueOnce({
          ...ada,
          passwordResetExpiresAt: new Date(Date.now() + 60_000),
        })
        .mockResolvedValueOnce({ ...ada, createdAt: new Date() });
      user.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.resetPassword('the-token', 'N3w!passw0rd');

      expect(user.findUnique.mock.calls[0][0]).toEqual({
        where: { passwordResetTokenHash: sha256('the-token') },
      });
      const { where, data } = user.updateMany.mock.calls[0][0];
      // The hash is matched again: two clicks at once can't both use the link.
      expect(where).toEqual({
        id: 1,
        passwordResetTokenHash: sha256('the-token'),
      });
      expect(await bcrypt.compare('N3w!passw0rd', data.passwordHash)).toBe(
        true,
      );
      expect(data).toMatchObject({
        passwordResetTokenHash: null,
        passwordChangedAt: expect.any(Date),
        emailVerifiedAt: expect.any(Date),
      });
      expect(result.accessToken).toEqual(expect.any(String));
      expect(result.user).not.toHaveProperty('passwordResetTokenHash');
    });

    it('refuses an expired, unknown or already used link', async () => {
      user.findUnique.mockResolvedValueOnce({
        ...ada,
        passwordResetExpiresAt: new Date(Date.now() - 1),
      });
      await expect(
        service.resetPassword('old-token', 'N3w!passw0rd'),
      ).rejects.toThrow('This link is invalid or has expired');
      user.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.resetPassword('unknown', 'N3w!passw0rd'),
      ).rejects.toThrow(BadRequestException);
      expect(user.updateMany).not.toHaveBeenCalled();

      // Used by a concurrent request between the lookup and the update.
      user.findUnique.mockResolvedValueOnce({
        ...ada,
        passwordResetExpiresAt: new Date(Date.now() + 60_000),
      });
      user.updateMany.mockResolvedValueOnce({ count: 0 });
      await expect(
        service.resetPassword('raced', 'N3w!passw0rd'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  it('rejects duplicate emails', async () => {
    boutique.create.mockResolvedValue({ id: 42 });
    user.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', {
        code: 'P2002',
        clientVersion: 'x',
      }),
    );
    await expect(
      service.register({
        email: 'ada@example.com',
        name: 'Ada',
        password: 'password1',
        acceptedTerms: true,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('logs in with the right password only', async () => {
    const passwordHash = await bcrypt.hash('password1', 4);
    user.findUnique.mockResolvedValue({
      id: 1,
      email: 'ada@example.com',
      name: 'Ada',
      passwordHash,
    });

    await expect(
      service.login({ email: 'ada@example.com', password: 'password1' }),
    ).resolves.toHaveProperty('accessToken');
    await expect(
      service.login({ email: 'ada@example.com', password: 'wrong' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects unknown emails with the same error', async () => {
    user.findUnique.mockResolvedValue(null);
    await expect(
      service.login({ email: 'nobody@example.com', password: 'x' }),
    ).rejects.toThrow('Invalid email or password');
  });

  it('updates user profile name and does not return passwordHash', async () => {
    user.findUnique.mockResolvedValue({
      id: 1,
      email: 'ada@example.com',
      name: 'Ada',
      passwordHash: 'hash',
    });
    user.update.mockResolvedValue({
      id: 1,
      email: 'ada@example.com',
      name: 'Ada Lovelace',
      passwordHash: 'hash',
    });

    const result = await service.updateProfile(1, { name: 'Ada Lovelace' });
    expect(result).toEqual({
      id: 1,
      email: 'ada@example.com',
      name: 'Ada Lovelace',
      avatarUrl: null,
    });
    expect(user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { name: 'Ada Lovelace' },
    });
  });

  it('changes the theme, resets the accent with null and leaves omitted fields alone', async () => {
    user.findUnique.mockResolvedValue({ id: 1 });
    user.update.mockImplementation(({ data }) =>
      Promise.resolve({
        id: 1,
        email: 'ada@example.com',
        name: 'Ada',
        ...data,
      }),
    );

    await service.updateAppearance(1, { themeMode: 'dark' });
    expect(user.update.mock.calls[0][0].data).toEqual({
      accentColor: undefined,
      themeMode: 'dark',
    });

    const result = await service.updateAppearance(1, { accentColor: null });
    expect(user.update.mock.calls[1][0].data).toEqual({
      accentColor: null,
      themeMode: undefined,
    });
    expect(result).toMatchObject({ accentColor: null, avatarUrl: null });
  });

  it('changes password when current password matches', async () => {
    const oldHash = await bcrypt.hash('old-password', 4);
    user.findUnique.mockResolvedValue({
      id: 1,
      email: 'ada@example.com',
      name: 'Ada',
      passwordHash: oldHash,
    });
    user.update.mockResolvedValue({ id: 1 });

    const result = await service.changePassword(1, {
      currentPassword: 'old-password',
      newPassword: 'new-password-123',
    });

    expect(result).toEqual({ success: true });
    expect(user.update).toHaveBeenCalled();
    const updatedData = user.update.mock.calls[0][0].data;
    await expect(
      bcrypt.compare('new-password-123', updatedData.passwordHash),
    ).resolves.toBe(true);
  });

  it('rejects password change if current password is wrong', async () => {
    const oldHash = await bcrypt.hash('old-password', 4);
    user.findUnique.mockResolvedValue({
      id: 1,
      email: 'ada@example.com',
      name: 'Ada',
      passwordHash: oldHash,
    });

    await expect(
      service.changePassword(1, {
        currentPassword: 'wrong-password',
        newPassword: 'new-password-123',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  describe('profile picture', () => {
    const PNG = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0,
    ]);
    const existing = {
      id: 1,
      email: 'ada@example.com',
      name: 'Ada',
      passwordHash: 'x',
      boutiqueId: 42,
      avatarKey: 'avatars/1/old.jpg',
      createdAt: new Date(),
    };

    it('stores a real image under the user, returns a signed URL and drops the old file', async () => {
      user.findUnique.mockResolvedValue(existing);
      user.update.mockImplementation(({ data }) =>
        Promise.resolve({ ...existing, ...data }),
      );

      const result = await service.uploadAvatar(1, {
        buffer: PNG,
        size: PNG.length,
      });

      const [key, body, mime] = storage.put.mock.calls[0];
      expect(key).toMatch(/^avatars\/1\/[0-9a-f-]{36}\.png$/);
      expect(body).toBe(PNG);
      expect(mime).toBe('image/png');
      expect(storage.remove).toHaveBeenCalledWith('avatars/1/old.jpg');
      expect(result.avatarUrl).toBe(`https://files.test/${key}?sig`);
      expect(result).not.toHaveProperty('avatarKey');
    });

    it('refuses a file that is not an image, whatever its name, and stores nothing', async () => {
      user.findUnique.mockResolvedValue(existing);
      const text = Buffer.from('<?php echo "hi"; ?>');
      await expect(
        service.uploadAvatar(1, { buffer: text, size: text.length }),
      ).rejects.toThrow('Unsupported format');
      expect(storage.put).not.toHaveBeenCalled();
    });

    it('refuses images over 2 MB', async () => {
      await expect(
        service.uploadAvatar(1, { buffer: PNG, size: 2 * 1024 * 1024 + 1 }),
      ).rejects.toThrow('2 MB');
      expect(storage.put).not.toHaveBeenCalled();
    });
  });
});
