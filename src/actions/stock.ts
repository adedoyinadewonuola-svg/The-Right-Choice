"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { moneyValue, dateKey, recordId, stockQuantity, type Parsed } from "@/lib/validate";
import { carryForwardDay, getOrCreateDailyRecord, parseDateOnly } from "@/lib/stock";

const VIEWS = ["/today", "/history", "/overview"];

function revalidateViews() {
  for (const path of VIEWS) revalidatePath(path);
}

/** Notes who last edited the day. Safe because every caller has just created or loaded it. */
function stampDay(date: Date, userId: string) {
  return prisma.dailyRecord.update({ where: { date }, data: { loggedById: userId } });
}

/** Resolves the day + product a row-level edit belongs to, or returns the validation failure. */
async function resolveDayEntry(dateStr: string, productId: string): Promise<
  { date: Date; entryId: string } | { error: string }
> {
  const checkedDate = dateKey(dateStr);
  if (!checkedDate.ok) return { error: checkedDate.error };

  const checkedId = recordId(productId, "Product");
  if (!checkedId.ok) return { error: checkedId.error };

  const date = parseDateOnly(checkedDate.value);
  const day = await getOrCreateDailyRecord(date);
  const entry = day.stockEntries.find((e) => e.productId === checkedId.value);
  if (!entry) return { error: "That product is not on this day's sheet — reload the page." };

  return { date, entryId: entry.id };
}

export type StockField = "opening" | "received" | "closing" | "transfer" | "supply" | "bd";

/**
 * `field` arrives from the client, and it is interpolated into a Prisma `data` object, so it has
 * to be checked: the TypeScript union only exists at compile time. Without this a crafted (or
 * simply stale) call could write `unitPrice`, `dailyRecordId`, even `id`, and a typo'd name would
 * surface as a Prisma 500 instead of a message.
 */
const STOCK_FIELDS: readonly string[] = ["opening", "received", "closing", "transfer", "supply", "bd"];

function isStockField(value: unknown): value is StockField {
  return typeof value === "string" && STOCK_FIELDS.includes(value);
}
export type SaveResult = { error?: string } | void;

export async function updateStockField(
  dateStr: string,
  productId: string,
  field: StockField,
  value: number
): Promise<SaveResult> {
  const user = await requireUser();

  if (!isStockField(field)) {
    return { error: "That column cannot be edited from the stock sheet." };
  }

  const parsed: Parsed<number> = stockQuantity(value, "Stock quantity");
  if (!parsed.ok) return { error: parsed.error };

  const target = await resolveDayEntry(dateStr, productId);
  if ("error" in target) return { error: target.error };

  await prisma.stockEntry.update({
    where: { id: target.entryId },
    data: { [field]: parsed.value },
  });
  await stampDay(target.date, user.id);
  revalidateViews();
}

/**
 * Overrides the selling price used for one row of one day. Without this per-day snapshot,
 * editing a price on the Price List would silently re-date every past day's revenue.
 */
export async function setUnitPrice(
  dateStr: string,
  productId: string,
  price: number | null
): Promise<SaveResult> {
  const user = await requireUser();

  const parsed = moneyValue(price, "Price", { allowEmpty: true });
  if (!parsed.ok) return { error: parsed.error };

  const target = await resolveDayEntry(dateStr, productId);
  if ("error" in target) return { error: target.error };

  await prisma.stockEntry.update({
    where: { id: target.entryId },
    data: { unitPrice: parsed.value },
  });
  await stampDay(target.date, user.id);
  revalidateViews();
}

export async function setPos(dateStr: string, pos: number): Promise<SaveResult> {
  const user = await requireUser();

  const parsedDate = dateKey(dateStr);
  if (!parsedDate.ok) return { error: parsedDate.error };
  const parsed = moneyValue(pos, "POS amount");
  if (!parsed.ok) return { error: parsed.error };

  const date = parseDateOnly(parsedDate.value);
  await getOrCreateDailyRecord(date);
  await prisma.dailyRecord.update({ where: { date }, data: { pos: parsed.value ?? 0 } });
  await stampDay(date, user.id);
  revalidateViews();
}

/**
 * Re-carries the previous day's closing stock into this day's opening stock.
 * Returns false when there is no earlier recorded day. Overwriting counted Closing values
 * has to be asked for explicitly, and the UI confirms it first.
 */
export async function carryForward(dateStr: string, overwriteClosing = false) {
  await requireUser();
  const parsedDate = dateKey(dateStr);
  if (!parsedDate.ok) return false;

  const date = parseDateOnly(parsedDate.value);
  await getOrCreateDailyRecord(date);
  const carried = await carryForwardDay(date, { overwriteClosing });
  revalidateViews();
  return carried;
}

