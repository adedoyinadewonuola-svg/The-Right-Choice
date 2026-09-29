"use client";

import { useState, useTransition } from "react";
import { addExpense, removeExpense } from "@/actions/expenses";
import { money, num } from "@/lib/money";

export type ExpenseRow = { id: string; note: string; amount: number };

export default function ExpensePanel({
  date,
  initialExpenses,
  cashCollected,
}: {
  date: string;
  initialExpenses: ExpenseRow[];
  cashCollected: number;
}) {
  const [expenses, setExpenses] = useState(initialExpenses);
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState("");
  const [pending, startTransition] = useTransition();

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  const cashAfterExpenses = cashCollected - total;

  function handleAdd() {
    const value = num(amount);
    if (!value) return;
    startTransition(async () => {
      const created = await addExpense(date, note, value);
      if (created) setExpenses((prev) => [...prev, { id: created.id, note, amount: value }]);
      setNote("");
      setAmount("");
    });
  }

  function handleRemove(id: string) {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    startTransition(async () => {
      await removeExpense(id);
    });
  }

  return (
    <div className="card section">
      <h3>Expenses</h3>
      <div className="form-grid">
        <div className="field">
          <label>Expense description</label>
          <input
            className="input"
            placeholder="e.g. transport"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Amount (₦)</label>
          <input
            className="input"
            type="number"
            min={0}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Total expenses</label>
          <input className="input" readOnly value={money(total)} />
        </div>
        <div className="field">
          <label>Cash after expenses</label>
          <input className="input" readOnly value={money(cashAfterExpenses)} />
        </div>
      </div>
      <button className="btn" style={{ marginTop: 12 }} disabled={pending} onClick={handleAdd}>
        Add Expense
      </button>
      <div className="section">
        {expenses.map((e) => (
          <div className="history-row" key={e.id}>
            <span>{e.note || "Expense"}</span>
            <strong>
              {money(e.amount)}{" "}
              <button className="btn light" onClick={() => handleRemove(e.id)}>
                Remove
              </button>
            </strong>
          </div>
        ))}
      </div>
    </div>
  );
}
