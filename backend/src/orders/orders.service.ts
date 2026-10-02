import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Order } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderStatus, UpdateOrderDto } from './dto/update-order.dto';

/** Accepted CSV column names (case-insensitive, trimmed). */
const COL_ALIASES: Record<string, string> = {
  customer: 'customer',
  client: 'customer',
  name: 'customer',
  phone: 'phone',
  telephone: 'phone',
  tel: 'phone',
  item: 'item',
  product: 'item',
  article: 'item',
  quantity: 'quantity',
  qty: 'quantity',
  total: 'total',
  price: 'total',
  amount: 'total',
  montant: 'total',
};

const PHONE_RE = /^\+?[0-9][0-9 ]{6,18}$/;
const MAX_IMPORT_ROWS = 5_000;

export interface ImportResult {
  imported: number;
  failed: number;
  errors: { row: number; message: string }[];
}

/** Every query is scoped by the signed-in user's shop: another shop's order is a 404. */
@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(boutiqueId: number, status?: OrderStatus): Promise<Order[]> {
    return this.prisma.order.findMany({
      where: status ? { boutiqueId, status } : { boutiqueId },
      orderBy: { id: 'desc' },
    });
  }

  async findOne(boutiqueId: number, id: number) {
    const order = await this.prisma.order.findFirst({
      where: { id, boutiqueId },
      include: { calls: { orderBy: { createdAt: 'desc' } } },
    });
    if (!order) {
      throw new NotFoundException(`Order ${id} not found`);
    }
    return order;
  }

  create(boutiqueId: number, dto: CreateOrderDto): Promise<Order> {
    return this.prisma.order.create({ data: { ...dto, boutiqueId } });
  }

  async update(
    boutiqueId: number,
    id: number,
    dto: UpdateOrderDto,
  ): Promise<Order> {
    await this.ensureExists(boutiqueId, id);
    return this.prisma.order.update({ where: { id }, data: dto });
  }

  private async ensureExists(boutiqueId: number, id: number) {
    const count = await this.prisma.order.count({ where: { id, boutiqueId } });
    if (count === 0) {
      throw new NotFoundException(`Order ${id} not found`);
    }
  }

  async remove(boutiqueId: number, id: number): Promise<void> {
    const { count } = await this.prisma.order.deleteMany({
      where: { id, boutiqueId },
    });
    if (count === 0) {
      throw new NotFoundException(`Order ${id} not found`);
    }
  }

  // ---------------------------------------------------------------------------
  // CSV import
  // ---------------------------------------------------------------------------

  async importCsv(
    boutiqueId: number,
    buffer: Buffer,
  ): Promise<ImportResult> {
    const text = buffer.toString('utf-8').replace(/\r\n?/g, '\n');
    const lines = text.split('\n').filter((l) => l.trim().length > 0);

    if (lines.length < 2) {
      throw new BadRequestException(
        'The CSV file must have a header row and at least one data row.',
      );
    }

    // --- Parse header ---
    const rawHeaders = parseCsvLine(lines[0]);
    const colMap = this.mapColumns(rawHeaders);

    // --- Parse and validate rows ---
    const valid: {
      customer: string;
      phone: string;
      item: string;
      quantity: number;
      total: number;
      boutiqueId: number;
    }[] = [];
    const errors: { row: number; message: string }[] = [];

    const dataLines = lines.slice(1);
    if (dataLines.length > MAX_IMPORT_ROWS) {
      throw new BadRequestException(
        `Too many rows (${dataLines.length}). Maximum is ${MAX_IMPORT_ROWS}.`,
      );
    }

    for (let i = 0; i < dataLines.length; i++) {
      const rowNum = i + 2; // 1-indexed, accounting for header
      const cells = parseCsvLine(dataLines[i]);
      const rowErrors: string[] = [];

      const customer = (cells[colMap.customer] ?? '').trim();
      const phone = (cells[colMap.phone] ?? '').trim();
      const item = (cells[colMap.item] ?? '').trim();
      const qtyRaw = (cells[colMap.quantity] ?? '').trim();
      const totalRaw = (cells[colMap.total] ?? '').trim();

      if (!customer) rowErrors.push('customer is empty');
      else if (customer.length > 100) rowErrors.push('customer exceeds 100 characters');

      if (!phone) rowErrors.push('phone is empty');
      else if (!PHONE_RE.test(phone)) rowErrors.push('invalid phone number');

      if (!item) rowErrors.push('item is empty');
      else if (item.length > 200) rowErrors.push('item exceeds 200 characters');

      const quantity = parseInt(qtyRaw, 10);
      if (!qtyRaw || isNaN(quantity)) rowErrors.push('quantity is not a number');
      else if (quantity < 1) rowErrors.push('quantity must be at least 1');
      else if (quantity > 1000) rowErrors.push('quantity exceeds 1000');

      const total = parseFloat(totalRaw);
      if (!totalRaw || isNaN(total)) rowErrors.push('total is not a number');
      else if (total < 0) rowErrors.push('total must be >= 0');
      else if (total > 1_000_000) rowErrors.push('total exceeds 1,000,000');

      if (rowErrors.length > 0) {
        errors.push({ row: rowNum, message: rowErrors.join('; ') });
      } else {
        valid.push({ customer, phone, item, quantity, total, boutiqueId });
      }
    }

    // --- Bulk insert valid rows ---
    if (valid.length > 0) {
      await this.prisma.order.createMany({ data: valid });
    }

    return {
      imported: valid.length,
      failed: errors.length,
      errors: errors.slice(0, 50), // cap reported errors to 50
    };
  }

  /** Maps CSV header names to column indices; throws if required columns are missing. */
  private mapColumns(
    headers: string[],
  ): Record<'customer' | 'phone' | 'item' | 'quantity' | 'total', number> {
    const result: Partial<
      Record<'customer' | 'phone' | 'item' | 'quantity' | 'total', number>
    > = {};

    for (let i = 0; i < headers.length; i++) {
      const key = headers[i].trim().toLowerCase().replace(/[^a-z]/g, '');
      const mapped = COL_ALIASES[key];
      if (mapped && result[mapped as keyof typeof result] === undefined) {
        result[mapped as keyof typeof result] = i;
      }
    }

    const missing = (
      ['customer', 'phone', 'item', 'quantity', 'total'] as const
    ).filter((k) => result[k] === undefined);

    if (missing.length > 0) {
      throw new BadRequestException(
        `Missing CSV columns: ${missing.join(', ')}. ` +
          `Expected headers (case-insensitive): customer, phone, item, quantity, total.`,
      );
    }

    return result as Record<
      'customer' | 'phone' | 'item' | 'quantity' | 'total',
      number
    >;
  }
}

// ---------------------------------------------------------------------------
// Lightweight CSV parser (RFC 4180: handles quoted fields)
// ---------------------------------------------------------------------------

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let i = 0;

  while (i <= line.length) {
    if (i === line.length) {
      cells.push('');
      break;
    }

    if (line[i] === '"') {
      // Quoted field
      let value = '';
      i++; // skip opening quote
      while (i < line.length) {
        if (line[i] === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            value += '"';
            i += 2;
          } else {
            i++; // skip closing quote
            break;
          }
        } else {
          value += line[i];
          i++;
        }
      }
      cells.push(value);
      // Skip the comma after the closing quote
      if (i < line.length && line[i] === ',') i++;
    } else {
      // Unquoted field
      const next = line.indexOf(',', i);
      if (next === -1) {
        cells.push(line.slice(i));
        break;
      } else {
        cells.push(line.slice(i, next));
        i = next + 1;
      }
    }
  }

  return cells;
}
