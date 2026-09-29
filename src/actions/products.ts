"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { num } from "@/lib/money";

export async function createProduct(input: {
  name: string;
  category: string;
  cost: number | null;
  price: number | null;
}) {
  const name = input.name.trim();
  const category = input.category.trim();
  if (!name || !category) {
    return { error: "Name and category are required." };
  }

  const existing = await prisma.product.findUnique({ where: { name } });
  if (existing) {
    return { error: `A product named "${name}" already exists.` };
  }

  const product = await prisma.product.create({
    data: { name, category, cost: input.cost, price: input.price },
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
  await prisma.product.update({ where: { id: productId }, data: { price } });
  revalidatePath("/prices");
  revalidatePath("/today");
  revalidatePath("/overview");
}

export async function updateCost(productId: string, cost: number | null) {
  await prisma.product.update({ where: { id: productId }, data: { cost } });
  revalidatePath("/prices");
}

export async function updateProductInfo(productId: string, name: string, category: string) {
  const trimmedName = name.trim();
  const trimmedCategory = category.trim();
  if (!trimmedName || !trimmedCategory) {
    return { error: "Name and category are required." };
  }

  const existing = await prisma.product.findUnique({ where: { name: trimmedName } });
  if (existing && existing.id !== productId) {
    return { error: `A product named "${trimmedName}" already exists.` };
  }

  await prisma.product.update({
    where: { id: productId },
    data: { name: trimmedName, category: trimmedCategory },
  });
  revalidatePath("/prices");
  revalidatePath("/today");
  revalidatePath("/history");
  revalidatePath("/overview");
  return {};
}

export async function deleteProduct(productId: string) {
  await prisma.product.delete({ where: { id: productId } });
  revalidatePath("/prices");
  revalidatePath("/today");
  revalidatePath("/history");
  revalidatePath("/overview");
}
