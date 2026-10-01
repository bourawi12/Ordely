import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentBoutique } from '../auth/current-user.decorator';
import { CreateOrderDto } from './dto/create-order.dto';
import { ListOrdersDto } from './dto/list-orders.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  findAll(
    @CurrentBoutique() boutiqueId: number,
    @Query() query: ListOrdersDto,
  ) {
    return this.ordersService.findAll(boutiqueId, query.status);
  }

  @Get(':id')
  findOne(
    @CurrentBoutique() boutiqueId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.ordersService.findOne(boutiqueId, id);
  }

  @Post()
  create(@CurrentBoutique() boutiqueId: number, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(boutiqueId, dto);
  }

  @Patch(':id')
  update(
    @CurrentBoutique() boutiqueId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrderDto,
  ) {
    return this.ordersService.update(boutiqueId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentBoutique() boutiqueId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.ordersService.remove(boutiqueId, id);
  }
}
