import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeApiRequest } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

interface DailyRevenueRaw {
  day: Date | string;
  transactions: bigint;
  revenue: number | null;
  program_title: string;
}

/**
 * GET /api/v1/sales/daily — Laporan penjualan harian satu bulan penuh (atau rentang hari kustom)
 *
 * Mengembalikan data harian lengkap dari tanggal 1 sampai akhir bulan (atau N hari ke belakang).
 * Hari tanpa transaksi tetap dicantumkan dengan nominal 0 agar data grafik dan analisa tren
 * tidak terputus.
 *
 * Query params (opsional):
 *   month  — Format YYYY-MM (mis. 2026-09). Jika tidak diisi, otomatis bulan berjalan saat ini.
 *   days   — Alternatif jika ingin N hari terakhir (mis. 30, 60, 90).
 */
export async function GET(req: Request) {
  const auth = await authorizeApiRequest(req, {
    rateLimitKey: "api-v1-sales-daily",
    max: 60,
    windowMs: 60_000,
  });
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const monthParam = searchParams.get("month");
  const daysParam = searchParams.get("days");

  const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
  const nowWib = new Date(Date.now() + WIB_OFFSET_MS);

  let startDateWib: Date;
  let endDateWib: Date;
  let totalDaysCount: number;
  let periodLabel: string;

  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [yearStr, monthStr] = monthParam.split("-");
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10) - 1;
    startDateWib = new Date(Date.UTC(year, month, 1));
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    endDateWib = new Date(Date.UTC(year, month, lastDay));
    totalDaysCount = lastDay;
    periodLabel = monthParam;
  } else if (daysParam) {
    const days = Math.min(Math.max(parseInt(daysParam, 10) || 30, 1), 365);
    totalDaysCount = days;
    const todayWib = new Date(
      Date.UTC(nowWib.getUTCFullYear(), nowWib.getUTCMonth(), nowWib.getUTCDate())
    );
    startDateWib = new Date(todayWib.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
    endDateWib = todayWib;
    periodLabel = `${days}-hari-terakhir`;
  } else {
    // Default: Bulan berjalan saat ini (WIB) dari tanggal 1 sampai akhir bulan
    const curYear = nowWib.getUTCFullYear();
    const curMonth = nowWib.getUTCMonth();
    startDateWib = new Date(Date.UTC(curYear, curMonth, 1));
    const lastDay = new Date(Date.UTC(curYear, curMonth + 1, 0)).getUTCDate();
    endDateWib = new Date(Date.UTC(curYear, curMonth, lastDay));
    totalDaysCount = lastDay;
    periodLabel = `${curYear}-${String(curMonth + 1).padStart(2, "0")}`;
  }

  const startUtc = new Date(startDateWib.getTime() - WIB_OFFSET_MS);
  const endUtc = new Date(endDateWib.getTime() + 24 * 60 * 60 * 1000 - WIB_OFFSET_MS);

  try {
    const rows = await prisma.$queryRaw<DailyRevenueRaw[]>`
      SELECT 
        DATE(DATE_ADD(p.paidAt, INTERVAL 7 HOUR)) as day,
        COUNT(p.id) as transactions,
        SUM(p.amount) as revenue,
        COALESCE(pr.title, 'Lainnya') as program_title
      FROM payment p
      JOIN registration r ON r.id = p.registrationId
      JOIN program pr ON pr.id = r.programId
      WHERE p.status = 'PAID' AND p.paidAt >= ${startUtc} AND p.paidAt < ${endUtc}
      GROUP BY day, pr.title
      ORDER BY day ASC
    `;

    // Map per hari
    const dailyMap = new Map<
      string,
      {
        revenue: number;
        transactions: number;
        programSales: Map<string, number>;
      }
    >();

    for (const r of rows) {
      const dateKey = new Date(r.day).toISOString().slice(0, 10);
      const existing = dailyMap.get(dateKey) || {
        revenue: 0,
        transactions: 0,
        programSales: new Map<string, number>(),
      };

      const amt = Number(r.revenue ?? 0);
      existing.revenue += amt;
      existing.transactions += Number(r.transactions);
      existing.programSales.set(
        r.program_title,
        (existing.programSales.get(r.program_title) || 0) + amt
      );

      dailyMap.set(dateKey, existing);
    }

    const data = [];
    let grandRevenue = 0;
    let grandTransactions = 0;

    for (let i = 0; i < totalDaysCount; i++) {
      const curDateWib = new Date(startDateWib.getTime() + i * 24 * 60 * 60 * 1000);
      const dateStr = curDateWib.toISOString().slice(0, 10);
      const dayData = dailyMap.get(dateStr) ?? {
        revenue: 0,
        transactions: 0,
        programSales: new Map(),
      };

      // Cari program terlaris pada hari itu
      let topProgram: string | null = null;
      let topProgramRevenue = 0;
      for (const [prog, rev] of dayData.programSales.entries()) {
        if (rev > topProgramRevenue) {
          topProgram = prog;
          topProgramRevenue = rev;
        }
      }

      const avgOrder =
        dayData.transactions > 0
          ? Math.round(dayData.revenue / dayData.transactions)
          : 0;

      data.push({
        date: dateStr,
        revenue: dayData.revenue,
        transactions: dayData.transactions,
        avgOrder,
        topProgram,
        topProgramRevenue,
      });

      grandRevenue += dayData.revenue;
      grandTransactions += dayData.transactions;
    }

    // Urutkan dari tanggal terbaru ke tanggal awal
    data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json({
      ok: true,
      data,
      meta: {
        period: periodLabel,
        daysCount: data.length,
        totalRevenue: grandRevenue,
        totalTransactions: grandTransactions,
        avgOrderValue:
          grandTransactions > 0 ? Math.round(grandRevenue / grandTransactions) : 0,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[api/v1/sales/daily]", err);
    return NextResponse.json(
      { error: "Gagal mengambil laporan penjualan harian." },
      { status: 503 }
    );
  }
}
