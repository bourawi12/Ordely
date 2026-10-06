import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthUser } from '../auth/jwt-payload';

/**
 * Ordely team only. Runs after the global AuthGuard, which has already answered 401 without a
 * valid session and loaded the role from the database: a merchant gets 403.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>().user;
    if (!user?.isPlatformAdmin) {
      throw new ForbiddenException('Ordely team only');
    }
    return true;
  }
}
