"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setUnitPrice, updateStockField, type StockField } from "@/actions/stock";
import { money, num } from "@/lib/money";
import Pagination from "@/components/Pagination";

const PAGE_SIZE = 25;

export type StockRow = {
  productId: string;
  name: string;
  category: string;
  /** Live price from the Price List. */
  price: number | null;
  /** Price frozen for this day; null falls back to `price`. */
  unitPrice: number | null;
  opening: number;
  received: number;
  closing: number;
  transfer: number;
  supply: number;
  bd: number;
};

const FIELDS: StockField[] = ["opening", "received", "closing", "transfer", "supply", "bd"];

/** The price this day counts revenue at — the frozen one when there is one. */
export function effectivePrice(row: Pick<StockRow, "price" | "unitPrice">): number {
  return row.unitPrice ?? num(row.price);
}

function rowTotals(row: StockRow) {
  const total = row.opening + row.received;
  const sold = Math.max(0, total - row.closing - row.transfer - row.supply - row.bd);
  const revenue = sold * effectivePrice(row);
  return { total, sold, revenue };
}

function errorKey(productId: string, field: StockField | "unitPrice") {
  return `${productId}:${field}`;
}

export default function StockTable({
  date,
  initialRows,
  onTotalsChange,
}: {
  date: string;
  initialRows: StockRow[];
  onTotalsChange?: (totals: { expected: number; units: number }) => void;
}) {
  // Optimistic edits, per product. A cell is rendered as `override ?? stored`, so dropping the
  // override is all it takes to fall back to what the database actually holds — and a re-render
  // from the server (revalidatePath / refresh) replaces every value that has no pending edit.
  const [overrides, setOverrides] = useState<Record<string, Partial<StockRow>>>({});
  const [page, setPage] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const rows = useMemo<StockRow[]>(
    () => initialRows.map((row) => ({ ...row, ...overrides[row.productId] })),
    [initialRows, overrides]
  );

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = useMemo(
    () => rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [rows, page]
  );

  const totals = useMemo(() => {
    let expected = 0;
    let units = 0;
    for (const row of rows) {
      const { sold, revenue } = rowTotals(row);
      expected += revenue;
      units += sold;
    }
    return { expected, units };
  }, [rows]);

  useEffect(() => {
    onTotalsChange?.(totals);
  }, [totals, onTotalsChange]);

  function editCell(productId: string, patch: Partial<StockRow>) {
    setOverrides((prev) => ({ ...prev, [productId]: { ...prev[productId], ...patch } }));
  }

  /** Clears the optimistic value so the stored one shows again, and flags the message. */
  function settle(productId: string, field: StockField | "unitPrice", message?: string) {
    if (message) {
      setOverrides((prev) => {
        const forRow = { ...prev[productId] };
        delete forRow[field];
        return { ...prev, [productId]: forRow };
      });
      setErrors((prev) => ({ ...prev, [errorKey(productId, field)]: message }));
      router.refresh();
    } else {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[errorKey(productId, field)];
        return next;
      });
    }
  }

  function handleChange(productId: string, field: StockField, value: string) {
    editCell(productId, { [field]: num(value) } as Partial<StockRow>);
  }

  function handleBlur(productId: string, field: StockField, value: string) {
    startTransition(async () => {
      const result = await updateStockField(date, productId, field, num(value));
      settle(productId, field, result?.error);
    });
  }

  function handlePriceChange(productId: string, value: string) {
    editCell(productId, { unitPrice: value === "" ? null : num(value) });
  }

  function handlePriceBlur(productId: string, value: string) {
    const row = rows.find((r) => r.productId === productId);
    if (!row) return;
    const unitPrice = value === "" ? null : num(value);
    // Focusing a row and blurring it again must not pin the price it was already showing.
    if (unitPrice === effectivePrice(row) && row.unitPrice !== null) return;
    if (unitPrice === null && row.unitPrice === null) return;
    startTransition(async () => {
      const result = await setUnitPrice(date, productId, unitPrice);
      settle(productId, "unitPrice", result?.error);
    });
  }

  const firstError = Object.values(errors)[0];

  return (
    <div className="table-wrap section">
      {firstError && (
        <div className="notice danger section" role="alert">
          {firstError} — that cell still shows the saved value.
          {pending ? " (syncing…)" : ""}
        </div>
      )}
      <table>
        <thead>
          <tr>
            <th>Category</th>
            <th>Item</th>
            <th className="num">Opening Stock</th>
            <th className="num">Received</th>
            <th className="num">Total Stock</th>
            <th className="num">Closing Stock</th>
            <th className="num">Transfer</th>
            <th className="num">Supply</th>
            <th className="num">B/D</th>
            <th className="num">Price (₦)</th>
            <th className="num">Qty Sold</th>
            <th className="num">Revenue</th>
          </tr>
        </thead>
        <tbody>
          {pageRows.map((row) => {
            const { total, sold, revenue } = rowTotals(row);
            return (
              <tr key={row.productId}>
                <td>{row.category}</td>
                <td>{row.name}</td>
                {FIELDS.slice(0, 2).map((field) => (
                  <td className="num" key={field}>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={row[field]}
                      aria-invalid={Boolean(errors[errorKey(row.productId, field)])}
                      onChange={(e) => handleChange(row.productId, field, e.target.value)}
                      onBlur={(e) => handleBlur(row.productId, field, e.target.value)}
                    />
                  </td>
                ))}
                <td className="num">{total}</td>
                <td className="num">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={row.closing}
                    aria-invalid={Boolean(errors[errorKey(row.productId, "closing")])}
                    onChange={(e) => handleChange(row.productId, "closing", e.target.value)}
                    onBlur={(e) => handleBlur(row.productId, "closing", e.target.value)}
                  />
                </td>
                {(["transfer", "supply", "bd"] as const).map((field) => (
                  <td className="num" key={field}>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={row[field]}
                      aria-invalid={Boolean(errors[errorKey(row.productId, field)])}
                      onChange={(e) => handleChange(row.productId, field, e.target.value)}
                      onBlur={(e) => handleBlur(row.productId, field, e.target.value)}
                    />
                  </td>
                ))}
                <td className="num">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    // Controlled, so a rejected save (or another clerk's edit) snaps back to the
                    // stored value. Empty means "follow the price list", shown as the placeholder.
                    value={row.unitPrice ?? ""}
                    placeholder={row.price === null ? "no price set" : String(row.price)}
                    title={
                      row.unitPrice === null
                        ? "Blank: use the price list (shown as the placeholder). Set a value to freeze this day's price."
                        : "Frozen for this day. Clear it to follow the price list again."
                    }
                    aria-invalid={Boolean(errors[errorKey(row.productId, "unitPrice")])}
                    onChange={(e) => handlePriceChange(row.productId, e.target.value)}
                    onBlur={(e) => handlePriceBlur(row.productId, e.target.value)}
                  />
                </td>
                <td className="num">{sold}</td>
                <td className="num">{money(revenue)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
