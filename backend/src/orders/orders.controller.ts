import {
  BadRequestException,
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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentBoutique } from '../auth/current-user.decorator';
import { CreateOrderDto } from './dto/create-order.dto';
import { ListOrdersDto } from './dto/list-orders.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrdersService } from './orders.service';

/** 5 MB – generous for a CSV file. */
const CSV_UPLOAD_LIMIT = 5 * 1024 * 1024;

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

  /** CSV import – must appear before `:id` routes so NestJS doesn't treat "import" as a param. */
  @Post('import')
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: CSV_UPLOAD_LIMIT, files: 1 },
    }),
  )
  importCsv(
    @CurrentBoutique() boutiqueId: number,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided. Use the "file" field.');
    }
    if (
      file.mimetype !== 'text/csv' &&
      file.mimetype !== 'application/vnd.ms-excel' &&
      !file.originalname.toLowerCase().endsWith('.csv')
    ) {
      throw new BadRequestException('Only CSV files are accepted.');
    }
    return this.ordersService.importCsv(boutiqueId, file.buffer);
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

