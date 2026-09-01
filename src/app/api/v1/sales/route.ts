import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeApiRequest } from "@/lib/api-auth";

/**
 * GET /api/v1/sales — laporan rekap penjualan harian untuk integrasi eksternal
 * (mis. Hermes agent marketing). Butuh header `X-API-Key` — key dikelola
 * di /webadmin/integrasi.
 *
 * Query params (opsional):
 *   date  — YYYY-MM-DD, ambil rekap tanggal itu saja
 *   days  — jumlah hari ke belakang dari hari ini (default 7, dipakai kalau `date` tidak diisi)
 */
export async function GET(req: Request) {
  const auth = await authorizeApiRequest(req, { rateLimitKey: "api-v1-sales", max: 60, windowMs: 60_000 });
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const targetDate = searchParams.get("date");
  const daysBack = Math.min(Math.max(parseInt(searchParams.get("days") || "7", 10) || 7, 1), 90);

  let paidAtFilter: { gte: Date; lt?: Date } | { gte: Date };
  if (targetDate) {
    const start = new Date(`${targetDate}T00:00:00.000Z`);
    if (Number.isNaN(start.getTime())) {
      return NextResponse.json({ error: "Parameter date harus berformat YYYY-MM-DD." }, { status: 400 });
    }
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    paidAtFilter = { gte: start, lt: end };
  } else {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() - (daysBack - 1));
    paidAtFilter = { gte: start };
  }

  try {
    const payments = await prisma.payment.findMany({
      where: { status: "PAID", paidAt: paidAtFilter },
      select: {
        amount: true,
        paidAt: true,
        registration: { select: { program: { select: { title: true } } } },
      },
      orderBy: { paidAt: "desc" },
    });

    const dailyData: Record<
      string,
      { date: string; totalRevenue: number; transactionCount: number; programRevenues: Record<string, number> }
    > = {};

    for (const p of payments) {
      const dateStr = (p.paidAt ?? new Date()).toISOString().split("T")[0];
      const program = p.registration?.program?.title || "Unknown";
      const amount = Number(p.amount) || 0;

      if (!dailyData[dateStr]) {
        dailyData[dateStr] = { date: dateStr, totalRevenue: 0, transactionCount: 0, programRevenues: {} };
      }
      dailyData[dateStr].totalRevenue += amount;
      dailyData[dateStr].transactionCount += 1;
      dailyData[dateStr].programRevenues[program] = (dailyData[dateStr].programRevenues[program] || 0) + amount;
    }

    const result = Object.values(dailyData)
      .map((d) => {
        const programs = Object.entries(d.programRevenues)
          .map(([program, revenue]) => ({ program, revenue }))
          .sort((a, b) => b.revenue - a.revenue);
        const top = programs[0] || null;

        return {
          date: d.date,
          totalRevenue: d.totalRevenue,
          transactionCount: d.transactionCount,
          averageOrder: d.transactionCount > 0 ? Math.round(d.totalRevenue / d.transactionCount) : 0,
          topProgram: top?.program ?? null,
          topProgramRevenue: top?.revenue ?? 0,
        };
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json({
      ok: true,
      data: result,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[api/v1/sales]", err);
    return NextResponse.json({ error: "Gagal mengambil laporan penjualan." }, { status: 503 });
  }
}
