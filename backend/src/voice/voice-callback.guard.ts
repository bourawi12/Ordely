import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'crypto';
import { Request } from 'express';

/** A secret shorter than this is treated as not configured. */
const MIN_SECRET_LENGTH = 16;

const digest = (value: string) => createHash('sha256').update(value).digest();

/**
 * The voice agent's callbacks have no user session: they carry the shared secret
 * VOICE_CALLBACK_SECRET (Ringio's ORDELY_CALLBACK_SECRET) as a Bearer token. Without a
 * configured secret every callback is refused, never accepted.
 */
@Injectable()
export class VoiceCallbackGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const secret = this.config.get<string>('VOICE_CALLBACK_SECRET') ?? '';
    if (secret.length < MIN_SECRET_LENGTH) {
      throw new ServiceUnavailableException(
        'Voice agent callbacks are not configured',
      );
    }
    const header =
      context.switchToHttp().getRequest<Request>().headers.authorization ?? '';
    const [type, token] = header.split(' ');
    // Compared as fixed-length digests, in constant time.
    if (
      type !== 'Bearer' ||
      !token ||
      !timingSafeEqual(digest(token), digest(secret))
    ) {
      throw new UnauthorizedException();
    }
    return true;
  }
}
