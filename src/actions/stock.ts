"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { carryForwardDay, getOrCreateDailyRecord, parseDateOnly } from "@/lib/stock";

const VIEWS = ["/today", "/history", "/overview"];

function revalidateViews() {
  for (const path of VIEWS) revalidatePath(path);
}

async function touchDay(date: Date) {
  const session = await auth();
  if (!session?.user?.id) return;
  await prisma.dailyRecord.update({
    where: { date },
    data: { loggedById: session.user.id },
  });
}

export type StockField = "opening" | "received" | "closing" | "transfer" | "supply" | "bd";

export async function updateStockField(
  dateStr: string,
  productId: string,
  field: StockField,
  value: number
) {
  const date = parseDateOnly(dateStr);
  const day = await getOrCreateDailyRecord(date);
  const entry = day.stockEntries.find((e) => e.productId === productId);
  if (!entry) return;

  await prisma.stockEntry.update({
    where: { id: entry.id },
    data: { [field]: value },
  });
  await touchDay(date);
  revalidateViews();
}

export async function setPos(dateStr: string, pos: number) {
  const date = parseDateOnly(dateStr);
  await getOrCreateDailyRecord(date);
  await prisma.dailyRecord.update({ where: { date }, data: { pos } });
  await touchDay(date);
  revalidateViews();
}

export async function carryForward(dateStr: string) {
  const date = parseDateOnly(dateStr);
  await getOrCreateDailyRecord(date);
  await carryForwardDay(date);
  revalidateViews();
}
