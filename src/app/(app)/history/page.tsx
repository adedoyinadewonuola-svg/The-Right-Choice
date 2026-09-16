import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { computeDayTotals, formatDateOnly } from "@/lib/stock";
import { money, num } from "@/lib/money";

const PAGE_SIZE = 20;

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);

  const [records, totalCount] = await Promise.all([
    prisma.dailyRecord.findMany({
      orderBy: { date: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        stockEntries: { include: { product: true } },
        expenses: true,
        loggedBy: true,
      },
    }),
    prisma.dailyRecord.count(),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <section>
      <div className="toolbar">
        <div>
          <h2>Daily History</h2>
          <div className="label">Your records stay separated by date.</div>
        </div>
        <a className="btn light" href="/api/export">
          Export Backup
        </a>
      </div>
      <div className="card">
        {records.length === 0 && <p className="label">No saved days yet.</p>}
        {records.map((record) => {
          const { expected } = computeDayTotals(record.stockEntries, record.pos);
          const expensesTotal = record.expenses.reduce((sum, e) => sum + num(e.amount), 0);
          const dateStr = formatDateOnly(record.date);
          return (
            <div className="history-row" key={record.id}>
              <span>
                <strong>{dateStr}</strong>
                <br />
                <small className="label">Logged by {record.loggedBy?.name ?? "—"}</small>
              </span>
              <span>
                {money(expected)} sales · {money(record.pos)} POS · {money(expensesTotal)} expenses
              </span>
              <Link className="btn light" href={`/today?date=${dateStr}`}>
                Open
              </Link>
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="controls section" style={{ justifyContent: "center" }}>
          <Link
            className={`btn light${page <= 1 ? " disabled" : ""}`}
            aria-disabled={page <= 1}
            href={page <= 1 ? "#" : `/history?page=${page - 1}`}
          >
            ← Previous
          </Link>
          <span className="label">
            Page {page} of {totalPages}
          </span>
          <Link
            className={`btn light${page >= totalPages ? " disabled" : ""}`}
            aria-disabled={page >= totalPages}
            href={page >= totalPages ? "#" : `/history?page=${page + 1}`}
          >
            Next →
          </Link>
        </div>
      )}
    </section>
  );
}
