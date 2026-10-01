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
import { CallsService } from './calls.service';
import { CallFiltersDto, ListCallsDto } from './dto/list-calls.dto';
import { QueueCallDto } from './dto/queue-call.dto';
import { UpdateCallDto } from './dto/update-call.dto';

@Controller('calls')
export class CallsController {
  constructor(private readonly callsService: CallsService) {}

  @Get()
  list(@Query() query: ListCallsDto) {
    return this.callsService.list(query);
  }

  @Get('export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="calls.csv"')
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

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCallDto,
  ) {
    return this.callsService.update(id, dto);
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
