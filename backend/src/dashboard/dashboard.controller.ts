import { Controller, Get } from '@nestjs/common';
import { CurrentBoutique } from '../auth/current-user.decorator';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  summary(@CurrentBoutique() boutiqueId: number) {
    return this.dashboardService.summary(boutiqueId);
  }
}
