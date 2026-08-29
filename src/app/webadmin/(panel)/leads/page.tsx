import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isFollowUpDue } from "@/lib/leads";
import { quickSetLeadStatus } from "../../lead-actions";
import type { LeadStatus, LeadResult, LeadSource } from "@prisma/client";

const STATUS_BADGE: Record<string, { cls: string; label: string }> = {
  NEW: { cls: "dim", label: "Baru" },
  INTERESTED: { cls: "y", label: "Tertarik" },
  POTENTIAL: { cls: "g", label: "Potensial" },
  COLD: { cls: "dim", label: "Dingin" },
};
const HASIL_BADGE: Record<string, { cls: string; label: string }> = {
  ACTIVE: { cls: "dim", label: "Aktif" },
  REGISTERED: { cls: "g", label: "Daftar" },
  PAID: { cls: "y", label: "Bayar" },
  CANCELLED: { cls: "dim", label: "Batal" },
  NO_REPLY: { cls: "dim", label: "No-Reply" },
};
const SOURCE_LABEL: Record<string, string> = {
  INSTAGRAM: "IG", FACEBOOK: "FB", WHATSAPP: "WA", REFERRAL: "Rujukan", ORGANIC: "Organik", OTHER: "Lain",
};
const STATUSES: LeadStatus[] = ["NEW", "INTERESTED", "POTENTIAL", "COLD"];

export default async function AdminLeads({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; hasil?: string; source?: string; due?: string; page?: string; ok?: string }>;
}) {
  const { q, status, hasil, source, due, page, ok } = await searchParams;
  const currentPage = Number(page ?? "1") || 1;
  const limit = 50;
  const skip = (currentPage - 1) * limit;
  const now = new Date();

  const where: Record<string, unknown> = {};
  if (q) where.OR = [{ name: { contains: q } }, { whatsapp: { contains: q } }];
  if (status) where.status = status;
  if (hasil) where.hasil = hasil;
  if (source) where.source = source;
  if (due === "1") where.nextFollowUpAt = { lte: now };

  const [leads, total, totalAll, totalActive, dueToday, byStatus, byResult, bySource] = await Promise.all([
    prisma.lead.findMany({
      where,
      include: { program: { select: { title: true } } },
      orderBy: [{ nextFollowUpAt: "asc" }, { createdAt: "desc" }],
      skip,
      take: limit,
    }),
    prisma.lead.count({ where }),
    prisma.lead.count(),
    prisma.lead.count({ where: { hasil: { not: { in: ["REGISTERED", "PAID", "CANCELLED", "NO_REPLY"] } } } }),
    prisma.lead.count({ where: { nextFollowUpAt: { lte: now }, hasil: { not: { in: ["REGISTERED", "PAID", "CANCELLED", "NO_REPLY"] } } } }),
    Promise.all(STATUSES.map(async (s) => ({ status: s, count: await prisma.lead.count({ where: { status: s } }) }))),
    Promise.all((["ACTIVE", "REGISTERED", "PAID", "CANCELLED", "NO_REPLY"] as LeadResult[]).map(async (r) => ({ hasil: r, count: await prisma.lead.count({ where: { hasil: r } }) }))),
    Promise.all((["INSTAGRAM", "FACEBOOK", "WHATSAPP", "REFERRAL", "ORGANIC", "OTHER"] as LeadSource[]).map(async (s) => ({ source: s, count: await prisma.lead.count({ where: { source: s } }) }))),
  ]);

  const totalPages = Math.ceil(total / limit);
  const fmt = (d: Date) =>
    new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" }).format(d);
  const href = (p: Record<string, string>) =>
    `/webadmin/leads?${new URLSearchParams({ ...(q ? { q } : {}), ...(status ? { status } : {}), ...(hasil ? { hasil } : {}), ...(source ? { source } : {}), ...(due ? { due } : {}), page: p.page ?? String(currentPage) }).toString()}`;

  return (
    <>
      <div className="adm-head">
        <h1>Leads (Pipeline)</h1>
        <Link href="/webadmin/leads/new" className="btn btn-yellow btn-sm">+ Lead Baru</Link>
      </div>

      {ok === "deleted" && <div className="adm-alert ok">Lead dihapus.</div>}

      {/* Statistik funnel */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: ".7rem", marginBottom: "1.2rem" }}>
        {[
          { l: "Total Lead", v: totalAll, color: "var(--ink)" },
          { l: "Aktif (dikejar)", v: totalActive, color: "var(--purple)" },
          { l: "Follow-up hari ini", v: dueToday, color: dueToday > 0 ? "#c0392b" : "var(--ink)" },
          { l: "Daftar", v: byResult.find((r) => r.hasil === "REGISTERED")?.count ?? 0, color: "var(--ink)" },
          { l: "Bayar", v: byResult.find((r) => r.hasil === "PAID")?.count ?? 0, color: "#16a34a" },
          { l: "Batal", v: byResult.find((r) => r.hasil === "CANCELLED")?.count ?? 0, color: "var(--ink)" },
          { l: "No-Reply", v: byResult.find((r) => r.hasil === "NO_REPLY")?.count ?? 0, color: "var(--ink)" },
        ].map((s) => (
          <div key={s.l} className="adm-stat">
            <div className="adm-stat-val" style={{ color: s.color }}>{s.v}</div>
            <span>{s.l}</span>
          </div>
        ))}
      </div>

      {/* Distribusi status */}
      <div className="adm-note" style={{ marginBottom: "1rem", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        {byStatus.map((s) => (
          <span key={s.status}>
            <b>{STATUS_BADGE[s.status]?.label ?? s.status}:</b> {s.count}
          </span>
        ))}
        <span style={{ marginLeft: "auto" }}>
          <b>Sumber:</b> {bySource.filter((x) => x.count > 0).map((s) => `${SOURCE_LABEL[s.source] ?? s.source} ${s.count}`).join(" · ") || "—"}
        </span>
      </div>

      {/* Filter */}
      <form method="get" className="adm-filter-row">
        <input name="q" defaultValue={q} placeholder="Cari nama / nomor WA..." style={{ flexBasis: "14rem" }} />
        <select name="status" defaultValue={status ?? ""}>
          <option value="">Semua Status</option>
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_BADGE[s].label}</option>)}
        </select>
        <select name="hasil" defaultValue={hasil ?? ""}>
          <option value="">Semua Hasil</option>
          {(["ACTIVE", "REGISTERED", "PAID", "CANCELLED", "NO_REPLY"] as LeadResult[]).map((r) => <option key={r} value={r}>{HASIL_BADGE[r].label}</option>)}
        </select>
        <select name="due" defaultValue={due ?? ""}>
          <option value="">Semua Follow-up</option>
          <option value="1">Perlu follow-up hari ini</option>
        </select>
        <button type="submit" className="btn btn-sm">Filter</button>
      </form>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr><th>Nama</th><th>Kontak</th><th>Status</th><th>Hasil</th><th>Follow-up</th><th>Program</th><th>Aksi</th></tr>
          </thead>
          <tbody>
            {leads.map((l) => {
              const b = STATUS_BADGE[l.status] ?? { cls: "dim", label: l.status };
              const hb = HASIL_BADGE[l.hasil] ?? { cls: "dim", label: l.hasil };
              const due = isFollowUpDue(l.nextFollowUpAt, now) && l.hasil === "ACTIVE";
              return (
                <tr key={l.id}>
                  <td data-label="Nama" style={{ fontWeight: 600 }}>
                    {l.name}
                    <div className="muted">{fmt(l.createdAt)}</div>
                    {l.bidangUsaha && <div className="muted">{l.bidangUsaha.slice(0, 40)}</div>}
                  </td>
                  <td data-label="Kontak">{l.whatsapp}{l.email ? <div className="muted">{l.email}</div> : null}</td>
                  <td data-label="Status">
                    <span className={`badge ${b.cls}`}>{b.label}</span>
                    <form action={quickSetLeadStatus} style={{ marginTop: ".3rem" }}>
                      <input type="hidden" name="id" value={l.id} />
                      <select name="status" defaultValue={l.status} onChange={(e) => e.target.form?.requestSubmit()} style={{ fontSize: ".75rem", padding: ".15rem .3rem" }}>
                        {STATUSES.map((s) => <option key={s} value={s}>{STATUS_BADGE[s].label}</option>)}
                      </select>
                    </form>
                  </td>
                  <td data-label="Hasil"><span className={`badge ${hb.cls}`}>{hb.label}</span></td>
                  <td data-label="Follow-up" style={due ? { color: "#c0392b", fontWeight: 700 } : undefined}>
                    {l.nextFollowUpAt ? fmt(l.nextFollowUpAt) : <span className="muted">—</span>}
                    <div className="muted">{l.followUpCount}x follow-up</div>
                  </td>
                  <td data-label="Program" className="muted">{l.program?.title ?? "—"}</td>
                  <td data-label="Aksi">
                    <div style={{ display: "flex", gap: ".4rem", flexWrap: "wrap" }}>
                      <Link href={`/webadmin/leads/${l.id}`} className="btn btn-sm">Edit</Link>
                      {l.whatsapp && !l.whatsapp.includes("@") && (
                        <a href={`https://wa.me/${l.whatsapp.replace(/^0+/, "62")}`} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-line">WA</a>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {leads.length === 0 && <tr><td colSpan={7} className="muted">Tidak ada lead yang cocok.</td></tr>}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{ display: "flex", gap: ".8rem", alignItems: "center", marginTop: "1.4rem", justifyContent: "center" }}>
          {currentPage > 1 && <Link href={href({ page: String(currentPage - 1) })} className="btn btn-sm">← Sebelum</Link>}
          <span style={{ fontSize: ".85rem", fontWeight: 600, color: "var(--ink-soft)" }}>Halaman {currentPage} dari {totalPages}</span>
          {currentPage < totalPages && <Link href={href({ page: String(currentPage + 1) })} className="btn btn-sm">Sesudah →</Link>}
        </div>
      )}
    </>
  );
}