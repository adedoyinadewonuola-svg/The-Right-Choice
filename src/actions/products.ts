"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { moneyValue, recordId, requiredText } from "@/lib/validate";
import { num } from "@/lib/money";

const MAX_NAME = 120;
const MAX_CATEGORY = 80;

function pricePair(cost: number | null, price: number | null) {
  const checkedCost = moneyValue(cost, "Cost price", { allowEmpty: true });
  if (!checkedCost.ok) return checkedCost;
  const checkedPrice = moneyValue(price, "Selling price", { allowEmpty: true });
  if (!checkedPrice.ok) return checkedPrice;
  return { ok: true as const, value: { cost: checkedCost.value, price: checkedPrice.value } };
}

export async function createProduct(input: {
  name: string;
  category: string;
  cost: number | null;
  price: number | null;
}) {
  await requireUser();

  const name = requiredText(input.name, "Product name", MAX_NAME);
  if (!name.ok) return { error: name.error };
  const category = requiredText(input.category, "Category", MAX_CATEGORY);
  if (!category.ok) return { error: category.error };

  const prices = pricePair(input.cost, input.price);
  if (!prices.ok) return { error: prices.error };

  const existing = await prisma.product.findUnique({ where: { name: name.value } });
  if (existing) {
    return { error: `A product named "${name.value}" already exists.` };
  }

  const product = await prisma.product.create({
    data: { name: name.value, category: category.value, ...prices.value },
  });

  revalidatePath("/prices");
  revalidatePath("/today");
  revalidatePath("/overview");

  return {
    product: {
      id: product.id,
      name: product.name,
      category: product.category,
      cost: product.cost === null ? null : num(product.cost),
      price: product.price === null ? null : num(product.price),
    },
  };
}

export async function updatePrice(productId: string, price: number | null) {
  await requireUser();

  const checkedId = recordId(productId, "Product");
  if (!checkedId.ok) return { error: checkedId.error };
  const checked = moneyValue(price, "Selling price", { allowEmpty: true });
  if (!checked.ok) return { error: checked.error };

  await prisma.product.update({ where: { id: checkedId.value }, data: { price: checked.value } });
  // Deliberately does not revalidate /today or /history: days already counted keep the price
  // frozen on their StockEntry row. Correct a specific day from the Daily Stock page instead.
  revalidatePath("/prices");
  return {};
}

export async function updateCost(productId: string, cost: number | null) {
  await requireUser();

  const checkedId = recordId(productId, "Product");
  if (!checkedId.ok) return { error: checkedId.error };
  const checked = moneyValue(cost, "Cost price", { allowEmpty: true });
  if (!checked.ok) return { error: checked.error };

  await prisma.product.update({ where: { id: checkedId.value }, data: { cost: checked.value } });
  revalidatePath("/prices");
  return {};
}

export async function updateProductInfo(productId: string, name: string, category: string) {
  await requireUser();

  const checkedId = recordId(productId, "Product");
  if (!checkedId.ok) return { error: checkedId.error };
  const checkedName = requiredText(name, "Product name", MAX_NAME);
  if (!checkedName.ok) return { error: checkedName.error };
  const checkedCategory = requiredText(category, "Category", MAX_CATEGORY);
  if (!checkedCategory.ok) return { error: checkedCategory.error };

  const existing = await prisma.product.findUnique({ where: { name: checkedName.value } });
  if (existing && existing.id !== checkedId.value) {
    return { error: `A product named "${checkedName.value}" already exists.` };
  }

  await prisma.product.update({
    where: { id: checkedId.value },
    data: { name: checkedName.value, category: checkedCategory.value },
  });
  revalidatePath("/prices");
  revalidatePath("/today");
  revalidatePath("/history");
  revalidatePath("/overview");
  return {};
}

export async function deleteProduct(productId: string) {
  await requireUser();

  const checkedId = recordId(productId, "Product");
  if (!checkedId.ok) return { error: checkedId.error };

  await prisma.product.delete({ where: { id: checkedId.value } });
  revalidatePath("/prices");
  revalidatePath("/today");
  revalidatePath("/history");
  revalidatePath("/overview");
  return {};
}
