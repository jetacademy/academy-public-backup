import { prisma } from "@/lib/prisma";
import { rupiah, formatHariTanggal } from "@/lib/format";
import { TYPE_LABEL, type ProgramType } from "@/lib/fallback";
import AdminStats from "@/components/AdminStats";

export const dynamic = "force-dynamic";

/* ──────────── Tipe data ──────────── */

interface ProgramStatsRaw {
  programId: string;
  total_regs: bigint;
  paid_regs: bigint;
  voucher_regs: bigint;
  total_income: number | null;
  total_discount: number | null;
}

interface BatchStatsRaw {
  batchId: string;
  batchSchedule: Date | null;
  programId: string;
  programTitle: string;
  total_paid: bigint;
  total_revenue: number | null;
}

interface ProgramWithStats {
  id: string;
  title: string;
  type: string;
  price: number;
  isActive: boolean;
  totalRegs: number;
  paid: number;
  voucher: number;
  income: number;
  discount: number;
  avgIncome: number;
}

/* ──────────── Server component ──────────── */

export default async function AdminStatistik() {
  const [revenueAgg, discountAgg, paidRegCount, programs, statsRaw, batchStatsRaw] =
    await Promise.all([
      // Total pendapatan lunas
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: "PAID" },
      }),
      // Total diskon voucher terpakai (transaksi lunas)
      prisma.$queryRaw<{ total: number | null }[]>`
        SELECT SUM(CAST(p.discountAmount AS SIGNED)) AS total
        FROM payment p
        WHERE p.status = 'PAID' AND p.discountAmount > 0
      `,
      // Jumlah pendaftar lunas
      prisma.registration.count({
        where: { status: { in: ["PAID", "PASSED"] } },
      }),
      // Semua program
      prisma.program.findMany({
        orderBy: { scheduleAt: "desc" },
        select: {
          id: true,
          title: true,
          type: true,
          price: true,
          isActive: true,
        },
      }),
      // Statistik per program (raw)
      prisma.$queryRaw<ProgramStatsRaw[]>`
        SELECT
          r.programId,
          COUNT(r.id)                                           AS total_regs,
          SUM(CASE WHEN r.status IN ('PAID','PASSED') THEN 1 ELSE 0 END)
                                                                AS paid_regs,
          SUM(CASE WHEN p.status = 'PAID' AND p.discountAmount > 0 THEN 1 ELSE 0 END)
                                                                AS voucher_regs,
          SUM(CASE WHEN p.status = 'PAID' THEN p.amount ELSE 0 END)
                                                                AS total_income,
          SUM(CASE WHEN p.status = 'PAID' THEN p.discountAmount ELSE 0 END)
                                                                AS total_discount
        FROM registration r
        LEFT JOIN payment p ON p.registrationId = r.id
        GROUP BY r.programId
      `,
      // Statistik per batch (hanya program yang punya batch)
      prisma.$queryRaw<BatchStatsRaw[]>`
        SELECT
          r.batchId                                           AS batchId,
          pb.scheduleAt                                       AS batchSchedule,
          pr.id                                               AS programId,
          pr.title                                            AS programTitle,
          COUNT(DISTINCT r.id)                                AS total_paid,
          SUM(p.amount)                                       AS total_revenue
        FROM registration r
        JOIN payment p           ON p.registrationId = r.id
        JOIN program pr          ON pr.id          = r.programId
        JOIN programbatch pb     ON pb.id          = r.batchId
        WHERE p.status = 'PAID'
        GROUP BY r.batchId, pb.scheduleAt, pr.id, pr.title
        ORDER BY pb.scheduleAt DESC
      `,
    ]);

  const revenueTotal = revenueAgg._sum.amount ?? 0;
  const discountTotal = Number(discountAgg[0]?.total ?? 0);
  const nonVoucherTotal = revenueTotal - discountTotal;
  const discountPct =
    revenueTotal > 0
      ? ((discountTotal / revenueTotal) * 100).toFixed(1)
      : "0.0";

  // Build per-program map
  const statsMap = new Map<
    string,
    { total: number; paid: number; voucher: number; income: number; discount: number }
  >();
  for (const s of statsRaw) {
    statsMap.set(s.programId, {
      total: Number(s.total_regs),
      paid: Number(s.paid_regs),
      voucher: Number(s.voucher_regs),
      income: Number(s.total_income ?? 0),
      discount: Number(s.total_discount ?? 0),
    });
  }

  const perProgram: ProgramWithStats[] = programs.map((p) => {
    const s = statsMap.get(p.id) ?? {
      total: 0,
      paid: 0,
      voucher: 0,
      income: 0,
      discount: 0,
    };
    return {
      ...p,
      totalRegs: s.total,
      paid: s.paid,
      voucher: s.voucher,
      income: s.income,
      discount: s.discount,
      avgIncome: s.paid > 0 ? Math.round(s.income / s.paid) : 0,
    };
  });

  /* — Sorted for bar chart: highest income first — */
  const chartData = [...perProgram]
    .filter((p) => p.income > 0)
    .sort((a, b) => b.income - a.income);

  const chartMax = chartData.length > 0 ? Math.max(...chartData.map((p) => p.income)) : 1;

  return (
    <>
      <div className="adm-head">
        <h1>Statistik Keuangan</h1>
      </div>

      {/* ═══════ Ringkasan (big numbers) ═══════ */}
      <AdminStats
        stats={[
          { label: "💰 Total Penghasilan", value: rupiah(revenueTotal) },
          {
            label: "🏷️ Diskon Voucher",
            value: rupiah(discountTotal),
            sublabel: (
              <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--ink-faint)", marginLeft: "0.4rem" }}>
                ({discountPct}%)
              </span>
            ),
          },
          { label: "📦 Non-Voucher", value: rupiah(nonVoucherTotal) },
          { label: "👥 Pendaftar Lunas", value: paidRegCount.toLocaleString("id-ID") },
        ]}
      />

      {/* ═══════ Grafik Bar (CSS) — perbandingan penghasilan ═══════ */}
      <div className="adm-head" style={{ marginTop: "2.4rem" }}>
        <h2 style={{ fontSize: "1.25rem" }}>Perbandingan Penghasilan per Program</h2>
      </div>

      {chartData.length > 0 ? (
        <div
          className="tbl-wrap"
          style={{ padding: "1.6rem 1.4rem 0.8rem", marginBottom: "2rem" }}
        >
          {/* Container sumbu horizontal — bar vertikal naik ke atas */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: "0.6rem",
              height: "14rem",
              paddingBottom: "2.5rem",
              borderBottom: "1px solid var(--line)",
              position: "relative",
              overflowX: "auto",
            }}
          >
            {/* Garis bantu (panduan visual) */}
            {[0.25, 0.5, 0.75].map((f) => (
              <div
                key={f}
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: `${(1 - f) * 100}%`,
                  height: "1px",
                  background: "var(--chip)",
                  pointerEvents: "none",
                  zIndex: 0,
                }}
              />
            ))}

            {chartData.map((p) => {
              const heightPct = Math.max(3, Math.round((p.income / chartMax) * 100));
              return (
                <div
                  key={p.id}
                  style={{
                    flex: "1 1 0",
                    minWidth: "4rem",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    height: "100%",
                    justifyContent: "flex-end",
                    position: "relative",
                    zIndex: 1,
                  }}
                  title={`${p.title}: ${rupiah(p.income)}`}
                >
                  {/* Label nominal di atas bar */}
                  <span
                    style={{
                      fontSize: "0.6rem",
                      fontWeight: 700,
                      color: "var(--ink-soft)",
                      marginBottom: "0.25rem",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {rupiah(p.income)}
                  </span>

                  {/* Bar itu sendiri */}
                  <div
                    style={{
                      width: "100%",
                      maxWidth: "3.2rem",
                      height: `${heightPct}%`,
                      minHeight: "4px",
                      borderRadius: "5px 5px 0 0",
                      background: `linear-gradient(180deg, var(--purple), #7c5cfc)`,
                      opacity: p.income > 0 ? 1 : 0.15,
                      transition: "opacity 0.15s ease",
                    }}
                  />

                  {/* Label nama program di bawah */}
                  <span
                    style={{
                      position: "absolute",
                      bottom: "-2rem",
                      fontSize: "0.62rem",
                      fontWeight: 700,
                      color: "var(--ink-soft)",
                      textAlign: "center",
                      lineHeight: 1.2,
                      maxWidth: "6rem",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {p.title.length > 22 ? p.title.slice(0, 20) + "…" : p.title}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="tbl-wrap" style={{ padding: "2rem", textAlign: "center", marginBottom: "2rem" }}>
          <span className="muted">Belum ada data penghasilan untuk ditampilkan.</span>
        </div>
      )}

      {/* ═══════ Tabel per Program ═══════ */}
      <div className="adm-head" style={{ marginTop: "2.4rem" }}>
        <h2 style={{ fontSize: "1.25rem" }}>Rekap per Program</h2>
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Program</th>
              <th>Tipe</th>
              <th>Pendaftar</th>
              <th>Penghasilan</th>
              <th>Diskon</th>
              <th>Voucher</th>
              <th>Rata-rata</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {perProgram.map((p) => (
              <tr key={p.id}>
                <td data-label="Program" style={{ fontWeight: 600 }}>
                  <a href={`/webadmin/program/${p.id}`} style={{ color: "inherit", textDecoration: "none" }}>
                    {p.title}
                  </a>
                </td>
                <td data-label="Tipe">
                  <span className={`badge${p.price === 0 ? " y" : ""}`}>
                    {TYPE_LABEL[p.type as ProgramType]}
                  </span>
                </td>
                <td data-label="Pendaftar">
                  {p.totalRegs}
                  <span className="muted" style={{ marginLeft: "0.3rem" }}>
                    ({p.paid} lunas)
                  </span>
                </td>
                <td data-label="Penghasilan" style={{ fontWeight: 700 }}>
                  {rupiah(p.income)}
                </td>
                <td data-label="Diskon">
                  {p.discount > 0 ? (
                    <span style={{ color: "var(--red)" }}>−{rupiah(p.discount)}</span>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td data-label="Voucher">
                  {p.voucher > 0 ? (
                    <span>{p.voucher} orang</span>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td data-label="Rata-rata" className="muted">
                  {p.paid > 0 ? rupiah(p.avgIncome) : "—"}
                </td>
                <td data-label="Status">
                  {p.isActive ? (
                    <span className="badge g">Aktif</span>
                  ) : (
                    <span className="badge dim">Nonaktif</span>
                  )}
                </td>
              </tr>
            ))}
            {perProgram.length === 0 && (
              <tr>
                <td colSpan={7} className="muted" style={{ textAlign: "center", padding: "1.5rem" }}>
                  Belum ada program. Jalankan <code>npm run db:seed</code> atau buat program baru.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ═══════ Tabel per Batch ═══════ */}
      <div className="adm-head" style={{ marginTop: "2.4rem" }}>
        <h2 style={{ fontSize: "1.25rem" }}>Rekap per Batch</h2>
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Program</th>
              <th>Batch</th>
              <th>Tanggal</th>
              <th>Pendaftar Lunas</th>
              <th>Penghasilan</th>
            </tr>
          </thead>
          <tbody>
            {batchStatsRaw.length > 0 ? (
              batchStatsRaw.map((b) => (
                <tr key={b.batchId}>
                  <td data-label="Program" style={{ fontWeight: 600 }}>
                    <a href={`/webadmin/program/${b.programId}`} style={{ color: "inherit", textDecoration: "none" }}>
                      {b.programTitle}
                    </a>
                  </td>
                  <td data-label="Batch">
                    <span className="badge" style={{ background: (b.batchSchedule ? new Date(b.batchSchedule) : new Date(0)) > new Date() ? "rgba(46, 204, 113, 0.15)" : "var(--chip)", color: (b.batchSchedule ? new Date(b.batchSchedule) : new Date(0)) > new Date() ? "#27ae60" : "var(--ink-soft)", fontWeight: 700 }}>
                      {(b.batchSchedule ? new Date(b.batchSchedule) : new Date(0)) > new Date() ? "🟢 Aktif" : "✅ Selesai"}
                    </span>
                    <span style={{ fontSize: "0.78rem", color: "var(--ink-faint)", marginLeft: "0.4rem" }}>
                      {(() => {
                        const sorted = [...batchStatsRaw].sort((a, b) => (a.batchSchedule?.getTime() ?? 0) - (b.batchSchedule?.getTime() ?? 0));
                        const idx = sorted.findIndex(x => x.batchId === b.batchId);
                        return idx >= 0 ? `Batch ${idx + 1}` : '';
                      })()}
                    </span>
                  </td>
                  <td data-label="Tanggal">
                    {b.batchSchedule ? formatHariTanggal(new Date(b.batchSchedule)) : "—"}
                  </td>
                  <td data-label="Pendaftar Lunas">
                    {Number(b.total_paid)}
                  </td>
                  <td data-label="Penghasilan" style={{ fontWeight: 700 }}>
                    {rupiah(Number(b.total_revenue ?? 0))}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="muted" style={{ textAlign: "center", padding: "1.5rem" }}>
                  Belum ada data batch dengan pembayaran lunas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
