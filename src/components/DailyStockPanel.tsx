"use client";

import { useCallback, useState } from "react";
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
  const [pos, setPosValue] = useState(initialPos);

  const handleTotalsChange = useCallback(({ expected, units }: { expected: number; units: number }) => {
    setExpected(expected);
    setUnits(units);
  }, []);

  const cashCollected = expected - num(pos);

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
            defaultValue={initialPos || ""}
            onChange={(e) => setPosValue(num(e.target.value))}
            onBlur={(e) => void setPos(date, num(e.target.value))}
          />
        </div>
        <MetricCard label="Cash Collected" value={money(cashCollected)} hint="Expected Sales − POS" />
      </div>

      <ExpensePanel date={date} initialExpenses={initialExpenses} cashCollected={cashCollected} />
    </>
  );
}
