import { Body, Controller, Get, Param, ParseIntPipe, Patch, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../admin/admin.guard';
import { ListReclamationsDto } from './dto/list-reclamations.dto';
import { UpdateReclamationDto } from './dto/update-reclamation.dto';
import { ReclamationsService } from './reclamations.service';

@UseGuards(AdminGuard)
@Controller('admin/reclamations')
export class ReclamationsAdminController {
  constructor(private readonly service: ReclamationsService) {}

  @Get()
  list(@Query() query: ListReclamationsDto) {
    return this.service.listForAdmin(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findForAdmin(id);
  }

  @Patch(':id/status')
  updateStatus(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateReclamationDto) {
    return this.service.updateStatus(id, dto);
  }
}