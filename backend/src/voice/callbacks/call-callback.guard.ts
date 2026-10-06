import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CallCallbackGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Missing or invalid Authorization header',
      );
    }

    const token = authHeader.slice(7).trim();
    const expectedSecret =
      this.config.get<string>('ORDELY_CALLBACK_SECRET') ?? 'dev-test-token';

    if (token !== expectedSecret) {
      throw new UnauthorizedException('Invalid callback credentials');
    }

    return true;
  }
}
