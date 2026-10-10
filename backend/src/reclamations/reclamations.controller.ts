import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { CurrentBoutique, CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/jwt-payload';
import { CreateReclamationDto } from './dto/create-reclamation.dto';
import { ListReclamationsDto } from './dto/list-reclamations.dto';
import { ReclamationsService } from './reclamations.service';

@Controller('reclamations')
export class ReclamationsController {
  constructor(private readonly service: ReclamationsService) {}

  @Get()
  list(@CurrentBoutique() boutiqueId: number, @Query() query: ListReclamationsDto) {
    return this.service.listForBoutique(boutiqueId, query);
  }

  @Get(':id')
  findOne(@CurrentBoutique() boutiqueId: number, @Param('id', ParseIntPipe) id: number) {
    return this.service.findForBoutique(boutiqueId, id);
  }

  @Post()
  create(
    @CurrentBoutique() boutiqueId: number,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateReclamationDto,
  ) {
    return this.service.create(boutiqueId, user.sub, dto);
  }
}