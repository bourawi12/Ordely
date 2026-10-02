import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { AuthUser, JwtPayload } from './jwt-payload';

/** The authenticated user's token payload, as set by AuthGuard. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload =>
    ctx.switchToHttp().getRequest<Request & { user: JwtPayload }>().user,
);

/** The signed-in user's shop id, as set by AuthGuard: scope every order and call query by it. */
export const CurrentBoutique = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): number =>
    ctx.switchToHttp().getRequest<Request & { user: AuthUser }>().user
      .boutiqueId,
);
