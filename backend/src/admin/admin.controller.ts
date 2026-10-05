import {
  Controller,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';
import {
  CohortsQueryDto,
  ExportQueryDto,
  MerchantsQueryDto,
  PeriodQueryDto,
} from './dto/admin-query.dto';

/**
 * Internal back office, Ordely team only: the global AuthGuard answers 401 without a session,
 * AdminGuard 403 for merchants. Aggregates and merchant account info only.
 */
@UseGuards(AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('overview')
  overview(@Query() q: PeriodQueryDto) {
    return this.admin.overview(q);
  }

  @Get('usage')
  usage(@Query() q: PeriodQueryDto) {
    return this.admin.usage(q);
  }

  @Get('quality')
  quality(@Query() q: PeriodQueryDto) {
    return this.admin.quality(q);
  }

  @Get('revenue')
  revenue(@Query() q: PeriodQueryDto) {
    return this.admin.revenue(q);
  }

  @Get('merchants')
  merchants(@Query() q: MerchantsQueryDto) {
    return this.admin.merchants(q);
  }

  @Get('merchants/:id')
  merchant(@Param('id', ParseIntPipe) id: number, @Query() q: PeriodQueryDto) {
    return this.admin.merchant(id, q);
  }

  @Get('cohorts')
  cohorts(@Query() q: CohortsQueryDto) {
    return this.admin.cohorts(q);
  }

  /** merchants | overview | usage | quality | revenue | cohorts, with that page's filters. */
  @Get('export/:dataset')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  export(@Param('dataset') dataset: string, @Query() q: ExportQueryDto) {
    return this.admin.exportCsv(dataset, q);
  }
}
