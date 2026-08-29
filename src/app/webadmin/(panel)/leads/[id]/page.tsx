import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ConfirmButton from "@/components/ConfirmButton";
import { updateLead, recordLeadFollowUp, deleteLead } from "../../../lead-actions";

const STATUSES = ["NEW", "INTERESTED", "POTENTIAL", "COLD"] as const;
const RESULTS = ["ACTIVE", "REGISTERED", "PAID", "CANCELLED", "NO_REPLY"] as const;
const SOURCES = ["INSTAGRAM", "FACEBOOK", "WHATSAPP", "REFERRAL", "ORGANIC", "OTHER"] as const;
const S_LABEL: Record<string, string> = { NEW: "Baru", INTERESTED: "Tertarik", POTENTIAL: "Potensial", COLD: "Dingin" };
const R_LABEL: Record<string, string> = { ACTIVE: "Aktif", REGISTERED: "Daftar", PAID: "Bayar", CANCELLED: "Batal", NO_REPLY: "No-Reply" };
const SRC_LABEL: Record<string, string> = { INSTAGRAM: "Instagram", FACEBOOK: "Facebook", WHATSAPP: "WhatsApp", REFERRAL: "Rujukan", ORGANIC: "Organik", OTHER: "Lain" };

export default async function AdminLeadEdit({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string }>;
}) {
  const { id } = await params;
  const { ok } = await searchParams;
  const [lead, programs] = await Promise.all([
    prisma.lead.findUnique({
      where: { id },
      include: { program: { select: { title: true } }, registration: { select: { id: true, name: true, status: true } } },
    }),
    prisma.program.findMany({ orderBy: { title: "asc" }, select: { id: true, title: true } }),
  ]);
  if (!lead) notFound();

  const fmtD = (d?: Date | null) =>
    d ? new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).format(d) : "—";
  const objections = Array.isArray(lead.objections) ? (lead.objections as string[]).join("\n") : "";
  const history = Array.isArray(lead.followUpHistory) ? (lead.followUpHistory as { at: string; note?: string }[]) : [];

  return (
    <>
      <div className="adm-head">
        <h1>Lead: {lead.name}</h1>
        <Link href="/webadmin/leads" className="btn btn-sm">← Kembali ke List</Link>
      </div>

      {ok === "updated" && <div className="adm-alert ok">Perubahan disimpan.</div>}
      {ok === "followup" && <div className="adm-alert ok">Follow-up dicatat, jadwal berikutnya dihitung ulang.</div>}

      {/* Ringkasan */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: ".7rem", marginBottom: "1.2rem" }}>
        {[
          { l: "Status", v: S_LABEL[lead.status] ?? lead.status },
          { l: "Hasil", v: R_LABEL[lead.hasil] ?? lead.hasil },
          { l: "Sumber", v: SRC_LABEL[lead.source] ?? lead.source },
          { l: "Program", v: lead.program?.title ?? "—" },
          { l: "Follow-up berikut", v: lead.nextFollowUpAt ? fmtD(lead.nextFollowUpAt) : "—" },
          { l: "Total follow-up", v: `${lead.followUpCount}x` },
        ].map((s) => (
          <div key={s.l} className="adm-stat">
            <div className="adm-stat-val" style={{ fontSize: "1.1rem" }}>{s.v}</div>
            <span>{s.l}</span>
          </div>
        ))}
      </div>

      {lead.registration && (
        <div className="adm-alert ok" style={{ marginBottom: "1.2rem" }}>
          Lead ini sudah terhubung ke pendaftaran: {lead.registration.name} ({lead.registration.status}) —{" "}
          <a href={`/webadmin/pendaftar/${lead.registration.id}`} style={{ textDecoration: "underline" }}>lihat pendaftar ↗</a>
        </div>
      )}

      {/* Edit */}
      <form className="adm-form" action={updateLead} style={{ maxWidth: 760, marginBottom: "1.5rem" }}>
        <input type="hidden" name="id" value={lead.id} />
        <div className="field">
          <label>Nama</label>
          <input name="name" defaultValue={lead.name} required />
        </div>
        <div className="field">
          <label>Nomor WhatsApp</label>
          <input name="whatsapp" defaultValue={lead.whatsapp} />
        </div>
        <div className="field">
          <label>Email</label>
          <input name="email" type="email" defaultValue={lead.email ?? ""} />
        </div>
        <div className="field">
          <label>Program diminati</label>
          <select name="programId" defaultValue={lead.programId ?? ""}>
            <option value="">— Pilih —</option>
            {programs.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Sumber</label>
          <select name="source" defaultValue={lead.source}>
            {SOURCES.map((s) => <option key={s} value={s}>{SRC_LABEL[s] ?? s}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Status</label>
          <select name="status" defaultValue={lead.status}>
            {STATUSES.map((s) => <option key={s} value={s}>{S_LABEL[s]}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Hasil</label>
          <select name="hasil" defaultValue={lead.hasil}>
            {RESULTS.map((r) => <option key={r} value={r}>{R_LABEL[r]}</option>)}
          </select>
        </div>
        <div className="field full">
          <label>Bidang usaha</label>
          <input name="bidangUsaha" defaultValue={lead.bidangUsaha ?? ""} />
        </div>
        <div className="field full">
          <label>Pesan pertama</label>
          <textarea name="pesanPertama" rows={2} defaultValue={lead.pesanPertama ?? ""} />
        </div>
        <div className="field full">
          <label>Ringkasan percakapan (data training)</label>
          <textarea name="ringkasanConversation" rows={3} defaultValue={lead.ringkasanConversation ?? ""} />
        </div>
        <div className="field full">
          <label>Objection (satu per baris)</label>
          <textarea name="objections" rows={3} defaultValue={objections} />
        </div>
        <div className="field full">
          <button type="submit" className="btn btn-yellow">Simpan Perubahan</button>
        </div>
        <p className="adm-note" style={{ gridColumn: "1 / -1" }}>
          Ubah status → jadwal follow-up dihitung ulang otomatis. Ubah hasil ke terminal (Daftar/Bayar/Batal/No-Reply) → pipeline ditutup.
        </p>
      </form>

      {/* Rekam follow-up */}
      <div style={{ background: "#fff", padding: "1.4rem", borderRadius: 12, maxWidth: 760, marginBottom: "1.5rem" }}>
        <h3 style={{ marginTop: 0 }}>Rekam Follow-up</h3>
        <form action={recordLeadFollowUp} className="adm-form" style={{ boxShadow: "none", padding: 0 }}>
          <input type="hidden" name="id" value={lead.id} />
          <div className="field full">
            <label>Catatan follow-up (opsional)</label>
            <textarea name="note" rows={2} placeholder="apa yang dibahas / respons lead..." />
          </div>
          <div className="field full">
            <button type="submit" className="btn">Tandai Sudah Di-follow-up</button>
          </div>
        </form>
        {history.length > 0 && (
          <div style={{ marginTop: "1rem" }}>
            <b>Riwayat follow-up:</b>
            <ul style={{ margin: ".5rem 0 0", paddingLeft: "1.2rem" }}>
              {history.slice().reverse().map((h, i) => (
                <li key={i} className="muted" style={{ fontSize: ".8rem", marginBottom: ".25rem" }}>
                  {fmtD(new Date(h.at))}{h.note ? ` — ${h.note}` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Hapus */}
      <form action={deleteLead} style={{ display: "inline-block" }}>
        <input type="hidden" name="id" value={lead.id} />
        <ConfirmButton className="btn btn-danger btn-sm" message={`Hapus lead "${lead.name}"? Data tidak bisa dikembalikan.`}>
          Hapus Lead
        </ConfirmButton>
      </form>
    </>
  );
}