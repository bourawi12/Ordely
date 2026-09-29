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
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let jwt: JwtService;

const user = {
  findUnique: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
};

const boutique = { create: jest.fn() };

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
    });

    expect($transaction).toHaveBeenCalledTimes(1);
    expect(boutique.create).toHaveBeenCalledTimes(1);
    expect(user.create.mock.calls[0][0].data.boutiqueId).toBe(42);
    expect(result.user).toMatchObject({ boutiqueId: 42 });
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
    });
    expect(user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { name: 'Ada Lovelace' },
    });
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
});
