import { prisma } from "@/lib/prisma";
import { num } from "@/lib/money";
import PriceTable, { type PriceRow } from "@/components/PriceTable";

export default async function PricesPage() {
  const products = await prisma.product.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] });

  const rows: PriceRow[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    cost: p.cost === null ? null : num(p.cost),
    price: p.price === null ? null : num(p.price),
  }));

  return (
    <section>
      <PriceTable initialRows={rows} />
    </section>
  );
}
