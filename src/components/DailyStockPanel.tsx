"use client";

import { useCallback, useState, useTransition } from "react";
import StockTable, { type StockRow } from "@/components/StockTable";
import ExpensePanel, { type ExpenseRow } from "@/components/ExpensePanel";
import MetricCard from "@/components/MetricCard";
import { setPos } from "@/actions/stock";
import { money, num } from "@/lib/money";

export default function DailyStockPanel({
  date,
  initialRows,
  initialPos,
  initialExpenses,
  loggedByName,
}: {
  date: string;
  initialRows: StockRow[];
  initialPos: number;
  initialExpenses: ExpenseRow[];
  loggedByName: string;
}) {
  const [expected, setExpected] = useState(0);
  const [units, setUnits] = useState(0);
  // Same shape as StockTable: the optimistic value is an override, and a rejected save drops it so
  // the field falls back to what the server holds. `void setPos(...)` used to swallow failures.
  const [posOverride, setPosOverride] = useState<number | null>(null);
  const [posError, setPosError] = useState<string | null>(null);
  const [posPending, startPosUpdate] = useTransition();
  const pos = posOverride ?? num(initialPos);

  const handleTotalsChange = useCallback(({ expected, units }: { expected: number; units: number }) => {
    setExpected(expected);
    setUnits(units);
  }, []);

  const cashCollected = expected - pos;

  return (
    <>
      <div className="card">
        <div className="form-grid">
          <div className="field">
            <label>Logged by</label>
            <input className="input" value={loggedByName} readOnly />
          </div>
          <div className="field">
            <label>Opening stock source</label>
            <input className="input" value="Previous day's closing stock" readOnly />
          </div>
          <div className="field">
            <label>Expected sales (₦)</label>
            <input className="input" value={money(expected)} readOnly />
          </div>
          <div className="field">
            <label>Actual cash collected (₦)</label>
            <input className="input" value={money(cashCollected)} readOnly />
          </div>
        </div>
      </div>

      <StockTable date={date} initialRows={initialRows} onTotalsChange={handleTotalsChange} />

      <div className="grid section">
        <MetricCard label="Total Units Sold" value={units} />
        <MetricCard label="Expected Sales" value={money(expected)} />
        <div className="card">
          <div className="label">POS</div>
          <input
            className="input"
            type="number"
            min={0}
            step="0.01"
            placeholder="POS amount"
            value={posOverride ?? (initialPos ? initialPos : "")}
            aria-invalid={Boolean(posError)}
            disabled={posPending}
            onChange={(e) => setPosOverride(num(e.target.value))}
            onBlur={(e) => {
              const value = num(e.target.value);
              if (value === num(initialPos)) {
                setPosOverride(null);
                setPosError(null);
                return;
              }
              startPosUpdate(async () => {
                const result = await setPos(date, value);
                if (result?.error) {
                  setPosOverride(null);
                  setPosError(result.error);
                } else {
                  setPosError(null);
                }
              });
            }}
          />
          {posError && (
            <div className="notice danger" role="alert">
              {posError} — the saved figure is shown instead.
            </div>
          )}
        </div>
        <MetricCard label="Cash Collected" value={money(cashCollected)} hint="Expected Sales − POS" />
      </div>

      <ExpensePanel date={date} initialExpenses={initialExpenses} cashCollected={cashCollected} />
    </>
  );
}
