import { computeOverviewTotals } from "@/lib/stock";
import { money } from "@/lib/money";
import MetricCard from "@/components/MetricCard";

export default async function OverviewPage() {
  const { daysRecorded, sales, pos, expenses } = await computeOverviewTotals();

  return (
    <section>
      <div className="toolbar">
        <div>
          <h2>Dashboard</h2>
          <div className="label">A running view of your business, not a single-day snapshot.</div>
        </div>
      </div>
      <div className="grid">
        <MetricCard label="Days Recorded" value={daysRecorded} />
        <MetricCard label="Total Sales" value={money(sales)} />
        <MetricCard label="Total POS" value={money(pos)} />
        <MetricCard label="Total Expenses" value={money(expenses)} />
      </div>
      <div className="card section">
        <h3>Continuity</h3>
        <p className="label">
          {daysRecorded
            ? `The app currently contains ${daysRecorded} recorded day(s). For each new date, Opening Stock is taken from the latest earlier day's Closing Stock. Received, Transfer, Supply and B/D are day-specific.`
            : "Start by opening Daily Stock for today — the opening stock will be seeded from your imported product list."}
        </p>
      </div>
    </section>
  );
}
