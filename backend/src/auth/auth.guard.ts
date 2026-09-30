import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import {
  ALLOW_UNVERIFIED_KEY,
  EMAIL_NOT_VERIFIED,
} from './allow-unverified.decorator';
import { JwtPayload } from './jwt-payload';
import { IS_PUBLIC_KEY } from './public.decorator';

/**
 * Global guard: every route needs a valid Bearer token unless marked @Public(), and an account
 * whose email is verified unless marked @AllowUnverified().
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: JwtPayload }>();
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException();
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException();
    }

    // Read from the database, not the token: verifying must take effect without a new login.
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { emailVerifiedAt: true },
    });
    if (!user) {
      throw new UnauthorizedException();
    }
    if (
      !user.emailVerifiedAt &&
      !this.reflector.getAllAndOverride<boolean>(ALLOW_UNVERIFIED_KEY, targets)
    ) {
      throw new ForbiddenException(EMAIL_NOT_VERIFIED);
    }

    request.user = payload;
    return true;
  }
}
