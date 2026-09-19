import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeApiRequest } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

interface ProductSalesRaw {
  program_id: string;
  program_title: string;
  revenue: number | null;
  transactions: bigint;
}

/**
 * GET /api/v1/sales/products — Analisa performa produk/program (Product Mix)
 *
 * Mengelompokkan total omzet, jumlah transaksi, dan rata-rata order (AOV) per program.
 * Program tanpa penjualan tetap dicantumkan dengan nominal 0 agar admin mengetahui
 * mana produk yang laku keras (best seller), mana yang perlu di-push, dan mana yang perlu dihentikan.
 *
 * Query params (opsional):
 *   days    — Jumlah hari ke belakang (mis. 7, 30, 90)
 *   since   — Tanggal awal (YYYY-MM-DD)
 *   until   — Tanggal akhir (YYYY-MM-DD)
 */
export async function GET(req: Request) {
  const auth = await authorizeApiRequest(req, {
    rateLimitKey: "api-v1-sales-products",
    max: 60,
    windowMs: 60_000,
  });
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const daysParam = searchParams.get("days");
  const sinceParam = searchParams.get("since");
  const untilParam = searchParams.get("until");

  let sinceDate: Date | null = null;
  let untilDate: Date | null = null;

  if (sinceParam) {
    const s = new Date(`${sinceParam}T00:00:00.000Z`);
    if (!Number.isNaN(s.getTime())) sinceDate = s;
  } else if (daysParam) {
    const days = Math.min(Math.max(parseInt(daysParam, 10) || 30, 1), 365);
    sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  }

  if (untilParam) {
    const u = new Date(`${untilParam}T23:59:59.999Z`);
    if (!Number.isNaN(u.getTime())) untilDate = u;
  }

  try {
    // Ambil semua program aktif agar produk dengan 0 penjualan tetap terdeteksi
    const allPrograms = await prisma.program.findMany({
      select: { id: true, title: true, type: true, isActive: true },
      orderBy: { createdAt: "desc" },
    });

    // Query agregat penjualan per program
    let salesRows: ProductSalesRaw[] = [];

    if (sinceDate && untilDate) {
      salesRows = await prisma.$queryRaw<ProductSalesRaw[]>`
        SELECT 
          pr.id as program_id,
          pr.title as program_title,
          COALESCE(SUM(p.amount), 0) as revenue,
          COUNT(p.id) as transactions
        FROM program pr
        JOIN registration r ON r.programId = pr.id
        JOIN payment p ON p.registrationId = r.id
        WHERE p.status = 'PAID' AND p.paidAt >= ${sinceDate} AND p.paidAt <= ${untilDate}
        GROUP BY pr.id, pr.title
      `;
    } else if (sinceDate) {
      salesRows = await prisma.$queryRaw<ProductSalesRaw[]>`
        SELECT 
          pr.id as program_id,
          pr.title as program_title,
          COALESCE(SUM(p.amount), 0) as revenue,
          COUNT(p.id) as transactions
        FROM program pr
        JOIN registration r ON r.programId = pr.id
        JOIN payment p ON p.registrationId = r.id
        WHERE p.status = 'PAID' AND p.paidAt >= ${sinceDate}
        GROUP BY pr.id, pr.title
      `;
    } else {
      salesRows = await prisma.$queryRaw<ProductSalesRaw[]>`
        SELECT 
          pr.id as program_id,
          pr.title as program_title,
          COALESCE(SUM(p.amount), 0) as revenue,
          COUNT(p.id) as transactions
        FROM program pr
        JOIN registration r ON r.programId = pr.id
        JOIN payment p ON p.registrationId = r.id
        WHERE p.status = 'PAID'
        GROUP BY pr.id, pr.title
      `;
    }

    const salesMap = new Map<string, { revenue: number; transactions: number }>();
    for (const r of salesRows) {
      salesMap.set(r.program_id, {
        revenue: Number(r.revenue ?? 0),
        transactions: Number(r.transactions ?? 0),
      });
    }

    // Bangun list lengkap: program yang ada transaksi + program aktif yang belum ada transaksi
    const data = allPrograms.map((pr) => {
      const stats = salesMap.get(pr.id) ?? { revenue: 0, transactions: 0 };
      const avgOrder =
        stats.transactions > 0 ? Math.round(stats.revenue / stats.transactions) : 0;

      return {
        program: pr.title,
        revenue: stats.revenue,
        transactions: stats.transactions,
        avgOrder,
      };
    });

    // Urutkan: pendapatan tertinggi di atas, transaksi tertinggi kedua
    data.sort((a, b) => b.revenue - a.revenue || b.transactions - a.transactions);

    const totalRevenue = data.reduce((sum, item) => sum + item.revenue, 0);
    const totalTransactions = data.reduce((sum, item) => sum + item.transactions, 0);
    const avgOrderValue =
      totalTransactions > 0 ? Math.round(totalRevenue / totalTransactions) : 0;

    return NextResponse.json({
      ok: true,
      data,
      summary: {
        totalRevenue,
        totalTransactions,
        avgOrderValue,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[api/v1/sales/products]", err);
    return NextResponse.json(
      { error: "Gagal mengambil data penjualan produk." },
      { status: 503 }
    );
  }
}
