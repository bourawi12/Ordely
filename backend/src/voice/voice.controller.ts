import { Controller, Get, Query, ParseIntPipe } from '@nestjs/common';
import { CurrentBoutique } from '../auth/current-user.decorator';
import { VoiceSessionService } from './voice-session.service';

/** REST endpoint for the frontend order-picker — returns pending orders for this boutique. */
@Controller('voice')
export class VoiceController {
  constructor(private readonly voiceSession: VoiceSessionService) {}

  @Get('orders')
  listOrders(
    @CurrentBoutique() boutiqueId: number,
    @Query('status') status?: string,
  ) {
    // Default to pending (test scenario), but allow querying any status
    void status; // status filter handled inside service for now (always pending)
    return this.voiceSession.listTestOrders(boutiqueId);
  }
}
