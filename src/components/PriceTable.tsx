"use client";

import { useMemo, useState, useTransition } from "react";
import { createProduct, deleteProduct, updateCost, updatePrice, updateProductInfo } from "@/actions/products";
import { money, num } from "@/lib/money";
import Pagination from "@/components/Pagination";

const PAGE_SIZE = 25;

export type PriceRow = { id: string; name: string; category: string; cost: number | null; price: number | null };

export default function PriceTable({ initialRows }: { initialRows: PriceRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [, startRowUpdate] = useTransition();

  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newCost, setNewCost] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, startAdding] = useTransition();

  const categories = useMemo(
    () => Array.from(new Set(rows.map((r) => r.category))).sort(),
    [rows]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((r) => `${r.name} ${r.category}`.toLowerCase().includes(q));
  }, [rows, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function handleCostChange(id: string, value: string) {
    const cost = value === "" ? null : num(value);
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, cost } : r)));
    void updateCost(id, cost);
  }

  function handlePriceChange(id: string, value: string) {
    const price = value === "" ? null : num(value);
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, price } : r)));
    void updatePrice(id, price);
  }

  function handleInfoChange(id: string, field: "name" | "category", value: string) {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    const nextName = field === "name" ? value : row.name;
    const nextCategory = field === "category" ? value : row.category;

    startRowUpdate(async () => {
      const result = await updateProductInfo(id, nextName, nextCategory);
      if (result.error) {
        setRowErrors((prev) => ({ ...prev, [id]: result.error! }));
        return;
      }
      setRowErrors((prev) => {
        const rest = { ...prev };
        delete rest[id];
        return rest;
      });
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, name: nextName, category: nextCategory } : r)));
    });
  }

  function handleDelete(id: string, name: string) {
    if (!window.confirm(`Delete "${name}"? This also removes its stock history from every recorded day.`)) {
      return;
    }
    setDeletingId(id);
    startRowUpdate(async () => {
      await deleteProduct(id);
      setRows((prev) => prev.filter((r) => r.id !== id));
      setDeletingId(null);
    });
  }

  function handleAddProduct() {
    setAddError(null);
    const name = newName.trim();
    const category = newCategory.trim();
    if (!name || !category) {
      setAddError("Name and category are required.");
      return;
    }
    startAdding(async () => {
      const result = await createProduct({
        name,
        category,
        cost: newCost === "" ? null : num(newCost),
        price: newPrice === "" ? null : num(newPrice),
      });
      if (result.error) {
        setAddError(result.error);
        return;
      }
      if (result.product) {
        setRows((prev) => [...prev, result.product!]);
      }
      setNewName("");
      setNewCategory("");
      setNewCost("");
      setNewPrice("");
    });
  }

  return (
    <>
      <div className="toolbar">
        <div>
          <h2>Price List</h2>
          <div className="label">Edit selling prices here; daily revenue uses these prices.</div>
        </div>
        <input
          className="input"
          placeholder="Search products..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

      <div className="card section">
        <h3>Add Product</h3>
        <div className="form-grid">
          <div className="field">
            <label>Name</label>
            <input
              className="input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Choice Jumbo"
            />
          </div>
          <div className="field">
            <label>Category</label>
            <input
              className="input"
              list="product-categories"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="e.g. Breads & Snacks"
            />
            <datalist id="product-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div className="field">
            <label>Cost Price (₦)</label>
            <input
              className="input"
              type="number"
              min={0}
              step="0.01"
              value={newCost}
              onChange={(e) => setNewCost(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Selling Price (₦)</label>
            <input
              className="input"
              type="number"
              min={0}
              step="0.01"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
            />
          </div>
        </div>
        {addError && <div className="notice danger">{addError}</div>}
        <button className="btn gold" style={{ marginTop: 12 }} disabled={adding} onClick={handleAddProduct}>
          {adding ? "Adding…" : "Add Product"}
        </button>
      </div>

      <div className="table-wrap section">
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th>Item</th>
              <th className="num">Cost Price</th>
              <th className="num">Selling Price</th>
              <th className="num">Margin</th>
              <th className="num">Margin %</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => {
              const hasMargin = row.price != null && row.cost != null;
              const margin = num(row.price) - num(row.cost);
              const pct = row.price ? (margin / num(row.price)) * 100 : 0;
              return (
                <tr key={row.id}>
                  <td>
                    <input
                      defaultValue={row.category}
                      onBlur={(e) => handleInfoChange(row.id, "category", e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      defaultValue={row.name}
                      onBlur={(e) => handleInfoChange(row.id, "name", e.target.value)}
                    />
                    {rowErrors[row.id] && <div className="notice danger">{rowErrors[row.id]}</div>}
                  </td>
                  <td className="num">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      defaultValue={row.cost ?? ""}
                      placeholder="Cost"
                      onBlur={(e) => handleCostChange(row.id, e.target.value)}
                    />
                  </td>
                  <td className="num">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      defaultValue={row.price ?? ""}
                      placeholder="Selling"
                      onBlur={(e) => handlePriceChange(row.id, e.target.value)}
                    />
                  </td>
                  <td className="num">{hasMargin ? money(margin) : "—"}</td>
                  <td className="num">{hasMargin ? `${pct.toFixed(1)}%` : "—"}</td>
                  <td>
                    <button
                      className="btn light"
                      disabled={deletingId === row.id}
                      onClick={() => handleDelete(row.id, row.name)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <Pagination page={currentPage} totalPages={totalPages} onPageChange={setPage} />
      </div>
    </>
  );
}
