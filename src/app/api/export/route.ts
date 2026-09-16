import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [products, dailyRecords] = await Promise.all([
    prisma.product.findMany(),
    prisma.dailyRecord.findMany({
      include: { stockEntries: true, expenses: true, loggedBy: { select: { name: true, email: true } } },
      orderBy: { date: "asc" },
    }),
  ]);

  const body = JSON.stringify({ exportedAt: new Date().toISOString(), products, dailyRecords }, null, 2);

  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": 'attachment; filename="the-right-choice-backup.json"',
    },
  });
}
