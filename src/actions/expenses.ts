"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { dateKey, moneyValue, recordId, textOrEmpty } from "@/lib/validate";
import { getOrCreateDailyRecord, parseDateOnly } from "@/lib/stock";

export async function addExpense(dateStr: string, note: string, amount: number) {
  await requireUser();

  const checkedDate = dateKey(dateStr);
  if (!checkedDate.ok) return { error: checkedDate.error };

  // Blank notes stay legal — older days have them and the list shows "Expense" — but the length
  // is bounded so a paste can't bloat the row.
  const checkedNote = textOrEmpty(note, "Expense description", 200);
  if (!checkedNote.ok) return { error: checkedNote.error };

  const checkedAmount = moneyValue(amount, "Expense amount", { positive: true });
  if (!checkedAmount.ok) return { error: checkedAmount.error };

  const day = await getOrCreateDailyRecord(parseDateOnly(checkedDate.value));
  const expense = await prisma.expense.create({
    data: { dailyRecordId: day.id, note: checkedNote.value, amount: checkedAmount.value ?? 0 },
  });
  revalidatePath("/today");
  revalidatePath("/overview");
  return { id: expense.id };
}

export async function removeExpense(expenseId: string) {
  await requireUser();

  const checkedId = recordId(expenseId, "Expense");
  if (!checkedId.ok) return { error: checkedId.error };

  await prisma.expense.delete({ where: { id: checkedId.value } });
  revalidatePath("/today");
  revalidatePath("/overview");
  return {};
}
