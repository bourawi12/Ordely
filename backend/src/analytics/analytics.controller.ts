import { Controller, Get, Query } from '@nestjs/common';
import { CurrentBoutique } from '../auth/current-user.decorator';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get()
  get(
    @CurrentBoutique() boutiqueId: number,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.report(boutiqueId, query.range);
  }
}
