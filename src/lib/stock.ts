import { prisma } from "@/lib/prisma";
import { num } from "@/lib/money";

/** Normalizes a date-only string ("2026-09-16") to a UTC midnight Date, matching the @db.Date column. */
export function parseDateOnly(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

export function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function findLatestPriorRecord(date: Date) {
  return prisma.dailyRecord.findFirst({
    where: { date: { lt: date } },
    orderBy: { date: "desc" },
    include: { stockEntries: true },
  });
}

/** Returns the DailyRecord for `date`, creating it (with carried-forward opening stock) if it doesn't exist yet. */
export async function getOrCreateDailyRecord(date: Date) {
  const existing = await prisma.dailyRecord.findUnique({
    where: { date },
    include: {
      stockEntries: { include: { product: true } },
      expenses: true,
      loggedBy: true,
    },
  });
  if (existing) {
    const addedEntries = await backfillMissingStockEntries(existing);
    if (!addedEntries) return existing;
    return prisma.dailyRecord.findUniqueOrThrow({
      where: { date },
      include: {
        stockEntries: { include: { product: true } },
        expenses: true,
        loggedBy: true,
      },
    });
  }

  const products = await prisma.product.findMany();
  const priorRecord = await findLatestPriorRecord(date);
  const priorClosingByProductId = new Map(
    priorRecord?.stockEntries.map((e) => [e.productId, e.closing]) ?? []
  );

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
          };
        }),
      },
    },
  });

  return prisma.dailyRecord.findUniqueOrThrow({
    where: { date },
    include: {
      stockEntries: { include: { product: true } },
      expenses: true,
      loggedBy: true,
    },
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
      return { dailyRecordId: record.id, productId: p.id, opening, closing: opening };
    }),
  });

  return true;
}

/** Re-fetches an existing day carrying forward opening stock from the latest earlier day's closing stock. */
export async function carryForwardDay(date: Date) {
  const priorRecord = await findLatestPriorRecord(date);
  if (!priorRecord) return null;

  const current = await prisma.dailyRecord.findUnique({
    where: { date },
    include: { stockEntries: true },
  });
  if (!current) return null;

  const priorClosingByProductId = new Map(
    priorRecord.stockEntries.map((e) => [e.productId, e.closing])
  );

  await Promise.all(
    current.stockEntries.map((entry) => {
      const closing = priorClosingByProductId.get(entry.productId) ?? 0;
      return prisma.stockEntry.update({
        where: { id: entry.id },
        data: { opening: closing, closing },
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

export function computeDayTotals(
  stockEntries: { opening: number; received: number; closing: number; transfer: number; supply: number; bd: number; product: { price: unknown } }[],
  pos: unknown
) {
  let expected = 0;
  let units = 0;
  for (const entry of stockEntries) {
    const { sold, revenue } = computeRowTotals(entry, num(entry.product.price));
    expected += revenue;
    units += sold;
  }
  const cashCollected = expected - num(pos);
  return { expected, units, cashCollected };
}

export async function computeOverviewTotals() {
  const records = await prisma.dailyRecord.findMany({
    include: { stockEntries: { include: { product: true } }, expenses: true },
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
