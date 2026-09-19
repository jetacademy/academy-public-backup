import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeApiRequest } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

interface CustomerAggRaw {
  customer_key: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  total_spent: number | null;
  transaction_count: bigint;
}

/**
 * GET /api/v1/sales/customers — Analisa retensi pelanggan (Repeat vs New Customers & LTV)
 *
 * Mengidentifikasi pelanggan baru (1 kali pembelian) vs pelanggan berulang (>= 2 kali pembelian),
 * persentase repeat rate, pelanggan teratas (top customer), dan rata-rata Customer Lifetime Value (LTV).
 */
export async function GET(req: Request) {
  const auth = await authorizeApiRequest(req, {
    rateLimitKey: "api-v1-sales-customers",
    max: 60,
    windowMs: 60_000,
  });
  if (!auth.ok) return auth.response;

  try {
    // Agregasi pelanggan unik berdasarkan nomor WhatsApp / Email dari pembayaran lunas
    const customerRows = await prisma.$queryRaw<CustomerAggRaw[]>`
      SELECT 
        COALESCE(NULLIF(r.whatsapp, ''), r.email) as customer_key,
        MAX(r.name) as customer_name,
        MAX(r.whatsapp) as customer_phone,
        MAX(r.email) as customer_email,
        COALESCE(SUM(p.amount), 0) as total_spent,
        COUNT(p.id) as transaction_count
      FROM payment p
      JOIN registration r ON r.id = p.registrationId
      WHERE p.status = 'PAID'
      GROUP BY customer_key
      ORDER BY total_spent DESC
    `;

    let newCustomers = 0;
    let repeatCustomers = 0;
    let totalRevenue = 0;

    for (const c of customerRows) {
      const txCount = Number(c.transaction_count);
      const spent = Number(c.total_spent ?? 0);
      totalRevenue += spent;

      if (txCount > 1) {
        repeatCustomers += 1;
      } else {
        newCustomers += 1;
      }
    }

    const totalCustomers = newCustomers + repeatCustomers;
    const repeatRate =
      totalCustomers > 0 ? Math.round((repeatCustomers / totalCustomers) * 100) : 0;

    const top = customerRows[0];
    const topCustomer = top
      ? {
          name: top.customer_name || "Pelanggan",
          totalSpent: Number(top.total_spent ?? 0),
        }
      : {
          name: "Belum ada transaksi",
          totalSpent: 0,
        };

    const averageLtv =
      totalCustomers > 0 ? Math.round(totalRevenue / totalCustomers) : 0;

    // Top 5 pelanggan dengan pembelanjaan tertinggi
    const topCustomersList = customerRows.slice(0, 5).map((c) => ({
      name: c.customer_name,
      whatsapp: c.customer_phone,
      totalSpent: Number(c.total_spent ?? 0),
      transactionCount: Number(c.transaction_count),
    }));

    return NextResponse.json({
      ok: true,
      data: {
        newCustomers,
        repeatCustomers,
        repeatRate,
        topCustomer,
        summary: {
          totalCustomers,
          totalRevenue,
          averageLtv,
        },
        topCustomers: topCustomersList,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[api/v1/sales/customers]", err);
    return NextResponse.json(
      { error: "Gagal mengambil data retensi pelanggan." },
      { status: 503 }
    );
  }
}
