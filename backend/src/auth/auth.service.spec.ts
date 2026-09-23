import { ConflictException, UnauthorizedException } from '@nestjs/common';
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
  const user = { findUnique: jest.fn(), create: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: { user } },
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

  it('registers a user with a hashed password and never returns the hash', async () => {
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
});
