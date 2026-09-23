import { Prisma, PrismaClient } from '@prisma/client';

export const DEFAULT_TIMEZONE = 'Africa/Tunis';

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Start of "today" (or of the current month) in the given IANA timezone. */
export async function startOf(
  prisma: Pick<PrismaClient, '$queryRaw'>,
  unit: 'day' | 'month',
  timezone: string,
): Promise<Date> {
  const [row] = await prisma.$queryRaw<{ start: Date }[]>(
    Prisma.sql`SELECT (date_trunc(${unit}, now() AT TIME ZONE ${timezone}) AT TIME ZONE ${timezone}) AS start`,
  );
  return row.start;
}
