import { getOrCreateDailyRecord, parseDateOnly, formatDateOnly } from "@/lib/stock";
import { num } from "@/lib/money";
import DateControls from "@/components/DateControls";
import DailyStockPanel from "@/components/DailyStockPanel";
import type { StockRow } from "@/components/StockTable";

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const dateStr = params.date ?? formatDateOnly(new Date());
  const date = parseDateOnly(dateStr);
  const day = await getOrCreateDailyRecord(date);

  const rows: StockRow[] = day.stockEntries
    .map((entry) => ({
      productId: entry.productId,
      name: entry.product.name,
      category: entry.product.category,
      price: entry.product.price === null ? null : num(entry.product.price),
      opening: entry.opening,
      received: entry.received,
      closing: entry.closing,
      transfer: entry.transfer,
      supply: entry.supply,
      bd: entry.bd,
    }))
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));

  const expenses = day.expenses.map((e) => ({ id: e.id, note: e.note, amount: num(e.amount) }));

  return (
    <section>
      <div className="toolbar">
        <div>
          <h2>Daily Stock</h2>
          <div className="label">
            Enter any date manually. Each new day carries forward the latest earlier closing stock
            automatically.
          </div>
        </div>
        <DateControls date={dateStr} />
      </div>

      <DailyStockPanel
        date={dateStr}
        initialRows={rows}
        initialPos={num(day.pos)}
        initialExpenses={expenses}
        loggedByName={day.loggedBy?.name ?? "—"}
      />
    </section>
  );
}
