import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentBoutique } from '../auth/current-user.decorator';
import { CallsService } from './calls.service';
import { CallFiltersDto, ListCallsDto } from './dto/list-calls.dto';
import { QueueCallDto } from './dto/queue-call.dto';
import { UpdateCallDto } from './dto/update-call.dto';

@Controller('calls')
export class CallsController {
  constructor(private readonly callsService: CallsService) {}

  @Get()
  list(@CurrentBoutique() boutiqueId: number, @Query() query: ListCallsDto) {
    return this.callsService.list(boutiqueId, query);
  }

  @Get('export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  export(
    @CurrentBoutique() boutiqueId: number,
    @Query() filters: CallFiltersDto,
  ) {
    return this.callsService.exportCsv(boutiqueId, filters);
  }

  @Get('usage')
  usage(@CurrentBoutique() boutiqueId: number) {
    return this.callsService.usage(boutiqueId);
  }

  @Get(':id')
  findOne(
    @CurrentBoutique() boutiqueId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.callsService.findOne(boutiqueId, id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCallDto,
  ) {
    return this.callsService.update(id, dto);
  }

  @Post()
  queue(@CurrentBoutique() boutiqueId: number, @Body() dto: QueueCallDto) {
    return this.callsService.queue(boutiqueId, dto.orderId);
  }

  @Post('queue-pending')
  queueAllPending(@CurrentBoutique() boutiqueId: number) {
    return this.callsService.queueAllPending(boutiqueId);
  }
}
