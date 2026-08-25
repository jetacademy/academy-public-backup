import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { rupiah } from "@/lib/format";
import { TYPE_LABEL, type ProgramType } from "@/lib/fallback";
import DailyRevenueChart from "@/components/DailyRevenueChart";
import AdminStats from "@/components/AdminStats";

export const dynamic = "force-dynamic";

const DAY_RANGES = [7, 14, 30, 90] as const;
type DayRange = (typeof DAY_RANGES)[number];

interface DailyRevenueRaw {
  day: Date | string;
  total: number | null;
}

/** Rekap pendapatan lunas per hari (kalender WIB), N hari terakhir termasuk hari ini —
 *  hari tanpa transaksi tetap muncul dengan nilai 0 supaya grafik tidak bolong. */
async function getDailyRevenue(days: DayRange) {
  const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
  const nowWib = new Date(Date.now() + WIB_OFFSET_MS);
  const todayWib = new Date(Date.UTC(nowWib.getUTCFullYear(), nowWib.getUTCMonth(), nowWib.getUTCDate()));
  const sinceWib = new Date(todayWib.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  const sinceUtc = new Date(sinceWib.getTime() - WIB_OFFSET_MS);

  const rows = await prisma.$queryRaw<DailyRevenueRaw[]>`
    SELECT DATE(DATE_ADD(paidAt, INTERVAL 7 HOUR)) as day, SUM(amount) as total
    FROM payment
    WHERE status = 'PAID' AND paidAt >= ${sinceUtc}
    GROUP BY day
    ORDER BY day ASC
  `;

  const byDate = new Map<string, number>();
  for (const r of rows) {
    const key = new Date(r.day).toISOString().slice(0, 10);
    byDate.set(key, Number(r.total ?? 0));
  }

  const points: { date: string; label: string; amount: number }[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(sinceWib.getTime() + i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    const label = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "UTC" }).format(d);
    points.push({ date: key, label, amount: byDate.get(key) ?? 0 });
  }
  return points;
}

const STATUS_BADGE: Record<string, { cls: string; label: string }> = {
  REGISTERED: { cls: "dim", label: "Terdaftar" },
  PAID: { cls: "y", label: "Lunas" },
  PASSED: { cls: "g", label: "Lulus" },
  FAILED: { cls: "dim", label: "Gagal" },
  EXPIRED: { cls: "dim", label: "Kadaluwarsa" },
  CANCELLED: { cls: "dim", label: "Dibatalkan" },
  REFUNDED: { cls: "dim", label: "Direfund" },
};

interface ProgramStatsRaw {
  programId: string;
  total_regs: bigint;
  paid_regs: bigint;
  total_income: number | null;
}

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ hari?: string }>;
}) {
  const { hari } = await searchParams;
  const selectedRange: DayRange = (DAY_RANGES as readonly number[]).includes(Number(hari))
    ? (Number(hari) as DayRange)
    : 30;

  const [regCount, revenue, programs, latest, statsRaw, dailyRevenue] = await Promise.all([
    prisma.registration.count(),
    prisma.payment.aggregate({ _sum: { amount: true }, where: { status: "PAID" } }),
    prisma.program.findMany({
      orderBy: { scheduleAt: "asc" },
      take: 200, // batas aman — tidak ada platform dengan >200 program aktif
      select: {
        id: true, title: true, type: true, price: true,
        isActive: true, isFeatured: true, scheduleAt: true,
      },
    }),
    prisma.registration.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { program: true, payment: true },
    }),
    prisma.$queryRaw<ProgramStatsRaw[]>`
      SELECT 
        r.programId, 
        COUNT(r.id) as total_regs,
        SUM(CASE WHEN r.status IN ('PAID', 'PASSED') THEN 1 ELSE 0 END) as paid_regs,
        SUM(CASE WHEN p.status = 'PAID' THEN p.amount ELSE 0 END) as total_income
      FROM registration r
      LEFT JOIN payment p ON p.registrationId = r.id
      GROUP BY r.programId
    `,
    getDailyRevenue(selectedRange),
  ]);

  const statsMap = new Map<string, { total: number; paid: number; income: number }>();
  for (const s of statsRaw) {
    statsMap.set(s.programId, {
      total: Number(s.total_regs),
      paid: Number(s.paid_regs),
      income: Number(s.total_income ?? 0),
    });
  }

  const perProgram = programs.map((p) => {
    const stats = statsMap.get(p.id) ?? { total: 0, paid: 0, income: 0 };
    return {
      ...p,
      totalRegs: stats.total,
      paid: stats.paid,
      income: stats.income,
    };
  });

  const todayRevenue = dailyRevenue.length > 0 ? dailyRevenue[dailyRevenue.length - 1].amount : 0;

  return (
    <>
      <div className="adm-head">
        <h1>Dashboard</h1>
        <Link href="/webadmin/program/new" className="btn btn-yellow btn-sm">+ Program Baru</Link>
      </div>

      <AdminStats
        stats={[
          { label: "Total Pendaftar", value: regCount.toLocaleString("id-ID") },
          { label: "Pendapatan Lunas", value: rupiah(revenue._sum.amount ?? 0) },
          { label: "Pendapatan Hari Ini", value: rupiah(todayRevenue) },
          { label: "Program Aktif", value: programs.filter((p) => p.isActive).length },
        ]}
      />

      <div className="adm-head" style={{ marginTop: "2.4rem" }}>
        <h2 style={{ fontSize: "1.25rem" }}>Pendapatan Harian</h2>
        <div style={{ display: "flex", gap: "0.4rem" }}>
          {DAY_RANGES.map((d) => (
            <Link
              key={d}
              href={`/webadmin?hari=${d}`}
              className={`btn btn-sm ${selectedRange === d ? "btn-purple" : ""}`}
            >
              {d} Hari
            </Link>
          ))}
        </div>
      </div>
      <div className="tbl-wrap" style={{ padding: "1.4rem" }}>
        <DailyRevenueChart data={dailyRevenue} />
      </div>

      <div className="adm-head" style={{ marginTop: "2.4rem" }}>
        <h2 style={{ fontSize: "1.25rem" }}>Rekap per Program</h2>
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr><th>Program</th><th>Tipe</th><th>Pendaftar</th><th>Lunas</th><th>Pendapatan</th><th>Status</th></tr>
          </thead>
          <tbody>
            {perProgram.map((p) => (
              <tr key={p.id}>
                <td data-label="Program"><Link href={`/webadmin/program/${p.id}`} style={{ fontWeight: 600 }}>{p.title}</Link></td>
                <td data-label="Tipe"><span className={`badge${p.price === 0 ? " y" : ""}`}>{TYPE_LABEL[p.type as ProgramType]}</span></td>
                <td data-label="Pendaftar">{p.totalRegs}</td>
                <td data-label="Lunas">{p.paid}</td>
                <td data-label="Pendapatan">{rupiah(p.income)}</td>
                <td data-label="Status">{p.isActive ? <span className="badge g">Aktif</span> : <span className="badge dim">Nonaktif</span>}</td>
              </tr>
            ))}
            {perProgram.length === 0 && (
              <tr><td colSpan={6} className="muted">Belum ada program. Jalankan `npm run db:seed` atau buat baru.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="adm-head" style={{ marginTop: "2.4rem" }}>
        <h2 style={{ fontSize: "1.25rem" }}>Pendaftar Terbaru</h2>
        <Link href="/webadmin/pendaftar" className="btn btn-sm">Lihat Semua →</Link>
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr><th>Nama</th><th>WhatsApp</th><th>Program</th><th>Status</th><th>Waktu</th></tr>
          </thead>
          <tbody>
            {latest.map((r) => {
              const b = STATUS_BADGE[r.status] ?? { cls: "dim", label: r.status };
              return (
                <tr key={r.id}>
                  <td data-label="Nama" style={{ fontWeight: 600 }}>{r.name}</td>
                  <td data-label="WhatsApp">{r.whatsapp}</td>
                  <td data-label="Program" className="muted">{r.program.title}</td>
                  <td data-label="Status"><span className={`badge ${b.cls}`}>{b.label}</span></td>
                  <td data-label="Waktu" className="muted">{new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).format(r.createdAt)}</td>
                </tr>
              );
            })}
            {latest.length === 0 && <tr><td colSpan={5} className="muted">Belum ada pendaftar.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
