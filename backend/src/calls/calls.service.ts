import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { DAY_MS, DEFAULT_TIMEZONE, startOf } from '../common/time';
import { PrismaService } from '../prisma/prisma.service';
import { CALL_STATUSES, CallRange, CallStatus } from './call-status';
import { CallFiltersDto, ListCallsDto } from './dto/list-calls.dto';

const EXPORT_LIMIT = 10_000;
const DEFAULT_PLAN_CALL_LIMIT = 500;

const withOrder = {
  order: { select: { id: true, customer: true, phone: true, total: true } },
} satisfies Prisma.CallInclude;

@Injectable()
export class CallsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private get timezone() {
    return this.config.get<string>('APP_TIMEZONE', DEFAULT_TIMEZONE);
  }

  async list(query: ListCallsDto) {
    const base = await this.baseWhere(query);
    const where: Prisma.CallWhereInput = query.status
      ? { ...base, status: query.status }
      : base;

    const [items, total, grouped] = await Promise.all([
      this.prisma.call.findMany({
        where,
        include: withOrder,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.call.count({ where }),
      // Chip counts ignore the status filter so every chip stays accurate.
      this.prisma.call.groupBy({ by: ['status'], where: base, _count: true }),
    ]);

    const counts = Object.fromEntries(
      CALL_STATUSES.map((s) => [s, 0]),
    ) as Record<CallStatus, number>;
    for (const row of grouped) {
      counts[row.status as CallStatus] = row._count;
    }

    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
      counts: {
        all: Object.values(counts).reduce((a, b) => a + b, 0),
        ...counts,
      },
    };
  }

  async exportCsv(filters: CallFiltersDto): Promise<string> {
    const base = await this.baseWhere(filters);
    const where = filters.status ? { ...base, status: filters.status } : base;
    const calls = await this.prisma.call.findMany({
      where,
      include: withOrder,
      orderBy: { createdAt: 'desc' },
      take: EXPORT_LIMIT,
    });

    const header = [
      'call_id',
      'order',
      'customer',
      'phone',
      'time',
      'status',
      'duration_seconds',
      'attempt',
      'language',
      'amount_tnd',
    ];
    const rows = calls.map((c) => [
      c.id,
      c.order.id,
      c.order.customer,
      c.order.phone,
      c.createdAt.toISOString(),
      c.status,
      c.durationSeconds ?? '',
      c.attempt,
      c.language ?? '',
      c.order.total.toString(),
    ]);
    return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n');
  }

  async findOne(id: number) {
    const call = await this.prisma.call.findUnique({
      where: { id },
      include: withOrder,
    });
    if (!call) {
      throw new NotFoundException(`Call ${id} not found`);
    }
    const attempts = await this.prisma.call.count({
      where: { orderId: call.orderId },
    });
    return { ...call, attempts };
  }

  /** Queues a confirmation call for a pending order. */
  async queue(orderId: number) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { calls: { select: { status: true } } },
    });
    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }
    if (order.status !== 'pending') {
      throw new ConflictException(
        `Order ${orderId} is already ${order.status}`,
      );
    }
    if (order.calls.some((c) => c.status === 'pending')) {
      throw new ConflictException(
        `A call is already queued for order ${orderId}`,
      );
    }
    return this.prisma.call.create({
      data: { orderId, attempt: order.calls.length + 1 },
      include: withOrder,
    });
  }

  /** Queues a call for every pending order that doesn't already have one queued. */
  async queueAllPending() {
    const orders = await this.prisma.order.findMany({
      where: { status: 'pending', calls: { none: { status: 'pending' } } },
      select: { id: true, _count: { select: { calls: true } } },
    });
    await this.prisma.call.createMany({
      data: orders.map((o) => ({ orderId: o.id, attempt: o._count.calls + 1 })),
    });
    return { queued: orders.length };
  }

  async usage() {
    const since = await startOf(this.prisma, 'month', this.timezone);
    const used = await this.prisma.call.count({
      where: { createdAt: { gte: since } },
    });
    return {
      plan: this.config.get<string>('PLAN_NAME', 'Free plan'),
      used,
      limit: Number(
        this.config.get('PLAN_CALL_LIMIT', DEFAULT_PLAN_CALL_LIMIT),
      ),
    };
  }

  private async baseWhere(
    filters: CallFiltersDto,
  ): Promise<Prisma.CallWhereInput> {
    const where: Prisma.CallWhereInput = {};
    const since = await this.rangeStart(filters.range);
    if (since) {
      where.createdAt = { gte: since };
    }
    if (filters.search) {
      where.order = searchOrders(filters.search);
    }
    return where;
  }

  private async rangeStart(range: CallRange): Promise<Date | null> {
    switch (range) {
      case 'today':
        return startOf(this.prisma, 'day', this.timezone);
      case '7d':
        return new Date(Date.now() - 7 * DAY_MS);
      case '30d':
        return new Date(Date.now() - 30 * DAY_MS);
      default:
        return null;
    }
  }
}

function searchOrders(search: string): Prisma.OrderWhereInput {
  const or: Prisma.OrderWhereInput[] = [
    { customer: { contains: search, mode: 'insensitive' } },
  ];
  const digits = search.replace(/[^0-9]/g, '');
  if (digits) {
    // Phone numbers are stored with spaces; match on digits in order.
    or.push({ phone: { contains: search.replace(/\s+/g, ' ') } });
    const id = Number(search.replace(/^#/, ''));
    if (Number.isInteger(id) && id > 0 && id < 2 ** 31) {
      or.push({ id });
    }
  }
  return { OR: or };
}

function csvCell(value: unknown): string {
  let s = String(value);
  // Neutralise spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
