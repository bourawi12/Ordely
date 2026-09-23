import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Rate-limits auth attempts per email rather than per IP: the Next.js server
 * calls the API on behalf of every visitor, so they all share one IP.
 */
@Injectable()
export class AuthThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const email = req.body?.email;
    return typeof email === 'string' && email
      ? `email:${email.trim().toLowerCase()}`
      : `ip:${req.ip}`;
  }
}
