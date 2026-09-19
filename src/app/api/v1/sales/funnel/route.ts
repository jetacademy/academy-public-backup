import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeApiRequest } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

interface DailySalesRaw {
  day: Date | string;
  transactions: bigint;
  revenue: number | null;
}

interface DailyLeadsRaw {
  day: Date | string;
  leads_count: bigint;
}

/**
 * GET /api/v1/sales/funnel — Analisa corong pemasaran (Funnel Efficiency & ROI Iklan)
 *
 * Menghubungkan metrik Impresi → Klik → Leads → Transaksi → Pendapatan
 * berdasarkan anggaran iklan (default Rp 6.000.000 / bulan atau parameter kustom).
 * Membantu menghitung Cost Per Acquisition (CPA) & Return on Ad Spend (ROAS / ROI).
 *
 * Query params (opsional):
 *   days     — Jumlah hari ke belakang (default 30, maks 90)
 *   month    — Bulan tertentu (format YYYY-MM, mis. 2026-09)
 *   adSpend  — Estimasi biaya iklan bulanan (default 6000000)
 */
export async function GET(req: Request) {
  const auth = await authorizeApiRequest(req, {
    rateLimitKey: "api-v1-sales-funnel",
    max: 60,
    windowMs: 60_000,
  });
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const daysParam = searchParams.get("days");
  const monthParam = searchParams.get("month");
  const monthlyAdSpend = Math.max(
    parseInt(searchParams.get("adSpend") || "6000000", 10) || 6000000,
    0
  );

  const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
  const nowWib = new Date(Date.now() + WIB_OFFSET_MS);

  let startDateWib: Date;
  let endDateWib: Date;
  let totalDaysCount: number;

  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [yearStr, monthStr] = monthParam.split("-");
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10) - 1;
    startDateWib = new Date(Date.UTC(year, month, 1));
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    endDateWib = new Date(Date.UTC(year, month, lastDay));
    totalDaysCount = lastDay;
  } else {
    const days = Math.min(Math.max(parseInt(daysParam || "30", 10) || 30, 1), 90);
    totalDaysCount = days;
    const todayWib = new Date(
      Date.UTC(nowWib.getUTCFullYear(), nowWib.getUTCMonth(), nowWib.getUTCDate())
    );
    startDateWib = new Date(todayWib.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
    endDateWib = todayWib;
  }

  const startUtc = new Date(startDateWib.getTime() - WIB_OFFSET_MS);
  const endUtc = new Date(endDateWib.getTime() + 24 * 60 * 60 * 1000 - WIB_OFFSET_MS);

  try {
    // 1. Ambil transaksi & omzet lunas per hari (WIB)
    const salesRows = await prisma.$queryRaw<DailySalesRaw[]>`
      SELECT 
        DATE(DATE_ADD(paidAt, INTERVAL 7 HOUR)) as day,
        COUNT(id) as transactions,
        SUM(amount) as revenue
      FROM payment
      WHERE status = 'PAID' AND paidAt >= ${startUtc} AND paidAt < ${endUtc}
      GROUP BY day
      ORDER BY day ASC
    `;

    // 2. Ambil leads pendaftaran per hari (WIB)
    const leadRows = await prisma.$queryRaw<DailyLeadsRaw[]>`
      SELECT 
        DATE(DATE_ADD(createdAt, INTERVAL 7 HOUR)) as day,
        COUNT(id) as leads_count
      FROM registration
      WHERE createdAt >= ${startUtc} AND createdAt < ${endUtc}
      GROUP BY day
      ORDER BY day ASC
    `;

    const salesByDay = new Map<string, { transactions: number; revenue: number }>();
    for (const r of salesRows) {
      const key = new Date(r.day).toISOString().slice(0, 10);
      salesByDay.set(key, {
        transactions: Number(r.transactions),
        revenue: Number(r.revenue ?? 0),
      });
    }

    const leadsByDay = new Map<string, number>();
    for (const r of leadRows) {
      const key = new Date(r.day).toISOString().slice(0, 10);
      leadsByDay.set(key, Number(r.leads_count));
    }

    // Biaya iklan harian rata-rata
    const dailySpend = Math.round(monthlyAdSpend / 30);

    const funnelData = [];
    let sumImpressions = 0;
    let sumClicks = 0;
    let sumLeads = 0;
    let sumTransactions = 0;
    let sumRevenue = 0;

    for (let i = 0; i < totalDaysCount; i++) {
      const curDateWib = new Date(startDateWib.getTime() + i * 24 * 60 * 60 * 1000);
      if (curDateWib > nowWib) break; // Jangan buat data hari depan

      const dateStr = curDateWib.toISOString().slice(0, 10);
      const sales = salesByDay.get(dateStr) ?? { transactions: 0, revenue: 0 };
      const leads = leadsByDay.get(dateStr) ?? 0;

      // Model funnel:
      // Berdasarkan traffic rata-rata iklan Meta (CTR ~5%, Opt-in ~6%)
      const calculatedClicks = leads > 0
        ? Math.round(leads * 16.7)
        : Math.round(dailySpend / 150); // ~Rp 150/klik benchmark
      const calculatedImpressions = Math.max(calculatedClicks * 20, 5000);

      const conversionRate = leads > 0
        ? Number(((sales.transactions / leads) * 100).toFixed(2))
        : 0;

      funnelData.push({
        date: dateStr,
        impressions: calculatedImpressions,
        clicks: calculatedClicks,
        leads,
        transactions: sales.transactions,
        revenue: sales.revenue,
        conversionRate,
      });

      sumImpressions += calculatedImpressions;
      sumClicks += calculatedClicks;
      sumLeads += leads;
      sumTransactions += sales.transactions;
      sumRevenue += sales.revenue;
    }

    // Urutkan dari tanggal terbaru ke terlama
    funnelData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const periodSpend = Math.round(dailySpend * funnelData.length);
    const overallRoi = periodSpend > 0 ? Number((sumRevenue / periodSpend).toFixed(2)) : 0;
    const overallCpa = sumTransactions > 0 ? Math.round(periodSpend / sumTransactions) : 0;

    return NextResponse.json({
      ok: true,
      data: funnelData,
      totals: {
        impressions: sumImpressions,
        clicks: sumClicks,
        leads: sumLeads,
        transactions: sumTransactions,
        revenue: sumRevenue,
        estimatedSpend: periodSpend,
        overallRoi,
        cpa: overallCpa,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[api/v1/sales/funnel]", err);
    return NextResponse.json(
      { error: "Gagal menghitung data sales funnel." },
      { status: 503 }
    );
  }
}
