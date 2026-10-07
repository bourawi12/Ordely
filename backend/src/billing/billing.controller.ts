import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { CurrentBoutique } from '../auth/current-user.decorator';
import { BillingService } from './billing.service';
import { SubscribeDto } from './dto/subscribe.dto';

/** The signed-in merchant's plan and its payment. */
@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('plans')
  plans(@CurrentBoutique() boutiqueId: number) {
    return this.billing.plans(boutiqueId);
  }

  @Post('subscribe')
  @HttpCode(200)
  // Payment attempts are limited (shared by all users: the Next.js server calls for everyone).
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  subscribe(@CurrentBoutique() boutiqueId: number, @Body() dto: SubscribeDto) {
    return this.billing.subscribe(boutiqueId, dto);
  }
}
