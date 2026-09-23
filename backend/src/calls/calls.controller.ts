import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { CallsService } from './calls.service';
import { CallFiltersDto, ListCallsDto } from './dto/list-calls.dto';
import { QueueCallDto } from './dto/queue-call.dto';

@Controller('calls')
export class CallsController {
  constructor(private readonly callsService: CallsService) {}

  @Get()
  list(@Query() query: ListCallsDto) {
    return this.callsService.list(query);
  }

  @Get('export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  export(@Query() filters: CallFiltersDto) {
    return this.callsService.exportCsv(filters);
  }

  @Get('usage')
  usage() {
    return this.callsService.usage();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.callsService.findOne(id);
  }

  @Post()
  queue(@Body() dto: QueueCallDto) {
    return this.callsService.queue(dto.orderId);
  }

  @Post('queue-pending')
  queueAllPending() {
    return this.callsService.queueAllPending();
  }
}
