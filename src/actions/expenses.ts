"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getOrCreateDailyRecord, parseDateOnly } from "@/lib/stock";

export async function addExpense(dateStr: string, note: string, amount: number) {
  if (!amount) return;
  const date = parseDateOnly(dateStr);
  const day = await getOrCreateDailyRecord(date);
  const expense = await prisma.expense.create({
    data: { dailyRecordId: day.id, note, amount },
  });
  revalidatePath("/today");
  revalidatePath("/overview");
  return { id: expense.id };
}

export async function removeExpense(expenseId: string) {
  await prisma.expense.delete({ where: { id: expenseId } });
  revalidatePath("/today");
  revalidatePath("/overview");
}
