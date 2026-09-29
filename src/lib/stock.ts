import { prisma } from "@/lib/prisma";
import { num } from "@/lib/money";

/**
 * "Today" in the shop's own timezone. `toISOString()` is UTC, so a Lagos shop opening at
 * 00:30 local would otherwise be handed the previous day's record for the first hour of the
 * day. Set APP_TIMEZONE to change it (e.g. "Africa/Lagos").
 */
const APP_TIMEZONE = process.env.APP_TIMEZONE || "Africa/Lagos";
const localDayKey = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function todayKey(): string {
  return localDayKey.format(new Date());
}

/** Normalizes a date-only string ("2026-09-16") to a UTC midnight Date, matching the @db.Date column. */
export function parseDateOnly(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

export function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Any value shape Prisma returns for Decimal columns. */
type Decimalish = unknown;

/**
 * The price a day's revenue is counted at: the price frozen on the StockEntry when the
 * day was created, or the product's live price while no price had been set that day.
 */
export function resolvedUnitPrice(
  entry: { unitPrice?: Decimalish | null },
  currentPrice?: Decimalish | null
): number {
  return entry.unitPrice === null || entry.unitPrice === undefined
    ? num(currentPrice)
    : num(entry.unitPrice);
}

/** Prisma's P2002, without importing its error classes into every caller. */
function isUniqueConstraintError(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "P2002";
}

async function findLatestPriorRecord(date: Date) {
  return prisma.dailyRecord.findFirst({
    where: { date: { lt: date } },
    orderBy: { date: "desc" },
    include: { stockEntries: true },
  });
}

const DAY_INCLUDE = {
  stockEntries: { include: { product: true } },
  expenses: true,
  loggedBy: true,
} as const;

/** Returns the DailyRecord for `date`, creating it (with carried-forward opening stock) if it doesn't exist yet. */
export async function getOrCreateDailyRecord(date: Date) {
  const existing = await prisma.dailyRecord.findUnique({
    where: { date },
    include: DAY_INCLUDE,
  });
  if (existing) {
    const addedEntries = await backfillMissingStockEntries(existing);
    if (!addedEntries) return existing;
    return prisma.dailyRecord.findUniqueOrThrow({
      where: { date },
      include: DAY_INCLUDE,
    });
  }

  const products = await prisma.product.findMany();
  const priorRecord = await findLatestPriorRecord(date);
  const priorClosingByProductId = new Map(
    priorRecord?.stockEntries.map((e) => [e.productId, e.closing]) ?? []
  );

  try {
    await prisma.dailyRecord.create({
      data: {
        date,
        stockEntries: {
          create: products.map((p) => {
            const opening = priorRecord
              ? priorClosingByProductId.get(p.id) ?? 0
              : p.initialStock;
            return {
              productId: p.id,
              opening,
              closing: opening,
              unitPrice: p.price,
            };
          }),
        },
      },
    });
  } catch (error) {
    // Two clerks opening the shop on the same morning used to race here: both missed the
    // findUnique above, both tried to create, and the loser surfaced P2002 (Unique constraint
    // failed on `DailyRecord_date_key`) as a 500. Whoever lost simply reads the winner's day —
    // Postgres blocks the losing insert until the winner commits, so the row is there by now.
    if (!isUniqueConstraintError(error)) throw error;
  }

  return prisma.dailyRecord.findUniqueOrThrow({
    where: { date },
    include: DAY_INCLUDE,
  });
}

/** Creates a StockEntry for any product that didn't exist yet when this day was first created (e.g. a product added later). Returns whether any were added. */
async function backfillMissingStockEntries(record: { id: string; date: Date; stockEntries: { productId: string }[] }) {
  const allProducts = await prisma.product.findMany();
  const existingProductIds = new Set(record.stockEntries.map((e) => e.productId));
  const missingProducts = allProducts.filter((p) => !existingProductIds.has(p.id));
  if (missingProducts.length === 0) return false;

  const priorRecord = await findLatestPriorRecord(record.date);
  const priorClosingByProductId = new Map(
    priorRecord?.stockEntries.map((e) => [e.productId, e.closing]) ?? []
  );

  await prisma.stockEntry.createMany({
    data: missingProducts.map((p) => {
      const opening = priorRecord ? priorClosingByProductId.get(p.id) ?? 0 : p.initialStock;
      return {
        dailyRecordId: record.id,
        productId: p.id,
        opening,
        closing: opening,
        unitPrice: p.price,
      };
    }),
    // Same race as day creation, one level down: two concurrent renders can both try to insert
    // the missing row. Skip the duplicate instead of throwing P2002.
    skipDuplicates: true,
  });

  return true;
}

export type CarryForwardOptions = {
  /**
   * Also set Closing to the carried Opening value. Destructive: it discards whatever was
   * already counted for that day, so the UI asks for confirmation before passing `true`.
   */
  overwriteClosing?: boolean;
};

/**
 * Re-reads an existing day and carries the latest earlier day's Closing stock into its
 * Opening stock. Closing is only touched when `overwriteClosing` is explicitly requested.
 * Returns `false` when there is no earlier recorded day to carry from.
 */
export async function carryForwardDay(date: Date, { overwriteClosing = false }: CarryForwardOptions = {}) {
  const priorRecord = await findLatestPriorRecord(date);
  if (!priorRecord) return false;

  const current = await prisma.dailyRecord.findUnique({
    where: { date },
    include: { stockEntries: true },
  });
  if (!current) return false;

  const priorClosingByProductId = new Map(
    priorRecord.stockEntries.map((e) => [e.productId, e.closing])
  );

  // One transaction: a half-carried day would leave Opening and Closing disagreeing.
  await prisma.$transaction(
    current.stockEntries.map((entry) => {
      const carried = priorClosingByProductId.get(entry.productId) ?? 0;
      return prisma.stockEntry.update({
        where: { id: entry.id },
        data: overwriteClosing ? { opening: carried, closing: carried } : { opening: carried },
      });
    })
  );

  return true;
}

export type RowTotals = { total: number; sold: number; revenue: number };

export function computeRowTotals(
  entry: { opening: number; received: number; closing: number; transfer: number; supply: number; bd: number },
  price: number | null | undefined
): RowTotals {
  const total = entry.opening + entry.received;
  const sold = Math.max(0, total - entry.closing - entry.transfer - entry.supply - entry.bd);
  const revenue = sold * num(price);
  return { total, sold, revenue };
}

export type DayEntry = {
  opening: number;
  received: number;
  closing: number;
  transfer: number;
  supply: number;
  bd: number;
  unitPrice?: Decimalish | null;
  product: { price: Decimalish | null };
};

export function computeDayTotals(stockEntries: DayEntry[], pos: unknown) {
  let expected = 0;
  let units = 0;
  for (const entry of stockEntries) {
    const { sold, revenue } = computeRowTotals(entry, resolvedUnitPrice(entry, entry.product.price));
    expected += revenue;
    units += sold;
  }
  const cashCollected = expected - num(pos);
  return { expected, units, cashCollected };
}

/** True once a day holds anything worth protecting, so destructive actions can ask first. */
export function dayHasCountedData(day: {
  pos: Decimalish;
  stockEntries: { opening: number; received: number; closing: number; transfer: number; supply: number; bd: number }[];
  expenses: unknown[];
}) {
  if (num(day.pos) !== 0 || day.expenses.length > 0) return true;
  return day.stockEntries.some(
    (e) =>
      e.received !== 0 ||
      e.transfer !== 0 ||
      e.supply !== 0 ||
      e.bd !== 0 ||
      e.closing !== e.opening
  );
}

export async function computeOverviewTotals() {
  const records = await prisma.dailyRecord.findMany({
    include: DAY_INCLUDE,
  });

  let sales = 0;
  let pos = 0;
  let expenses = 0;
  for (const record of records) {
    const { expected } = computeDayTotals(record.stockEntries, record.pos);
    sales += expected;
    pos += num(record.pos);
    expenses += record.expenses.reduce((sum, e) => sum + num(e.amount), 0);
  }

  return { daysRecorded: records.length, sales, pos, expenses };
}
