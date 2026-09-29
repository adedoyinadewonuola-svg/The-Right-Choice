"use client";

import { useEffect, useMemo, useState } from "react";
import { updateStockField, type StockField } from "@/actions/stock";
import { money, num } from "@/lib/money";
import Pagination from "@/components/Pagination";

const PAGE_SIZE = 25;

export type StockRow = {
  productId: string;
  name: string;
  category: string;
  price: number | null;
  opening: number;
  received: number;
  closing: number;
  transfer: number;
  supply: number;
  bd: number;
};

const FIELDS: StockField[] = ["opening", "received", "closing", "transfer", "supply", "bd"];

function rowTotals(row: StockRow) {
  const total = row.opening + row.received;
  const sold = Math.max(0, total - row.closing - row.transfer - row.supply - row.bd);
  const revenue = sold * num(row.price);
  return { total, sold, revenue };
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
  const [rows, setRows] = useState(initialRows);
  const [page, setPage] = useState(1);

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

  function handleChange(productId: string, field: StockField, value: string) {
    const n = num(value);
    setRows((prev) =>
      prev.map((r) => (r.productId === productId ? { ...r, [field]: n } : r))
    );
  }

  function handleBlur(productId: string, field: StockField, value: string) {
    void updateStockField(date, productId, field, num(value));
  }

  return (
    <div className="table-wrap section">
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
                      value={row[field]}
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
                    value={row.closing}
                    onChange={(e) => handleChange(row.productId, "closing", e.target.value)}
                    onBlur={(e) => handleBlur(row.productId, "closing", e.target.value)}
                  />
                </td>
                {(["transfer", "supply", "bd"] as StockField[]).map((field) => (
                  <td className="num" key={field}>
                    <input
                      type="number"
                      min={0}
                      value={row[field]}
                      onChange={(e) => handleChange(row.productId, field, e.target.value)}
                      onBlur={(e) => handleBlur(row.productId, field, e.target.value)}
                    />
                  </td>
                ))}
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
