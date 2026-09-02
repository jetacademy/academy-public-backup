import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createLead } from "../../../lead-actions";

const STATUSES = ["NEW", "INTERESTED", "POTENTIAL", "COLD"] as const;
const SOURCES = ["INSTAGRAM", "FACEBOOK", "WHATSAPP", "REFERRAL", "ORGANIC", "OTHER"] as const;
const STATUS_LABEL: Record<string, string> = { NEW: "Baru", INTERESTED: "Tertarik", POTENTIAL: "Potensial", COLD: "Dingin" };

export default async function AdminLeadNew() {
  const programs = await prisma.program.findMany({ orderBy: { title: "asc" }, select: { id: true, title: true } });

  return (
    <>
      <div className="adm-head">
        <h1>Lead Baru</h1>
        <Link href="/webadmin/leads" className="btn btn-sm">← Kembali ke List</Link>
      </div>

      <form className="adm-form" action={createLead} style={{ maxWidth: 760 }}>
        <div className="field">
          <label>Nama <span style={{ color: "#c0392b" }}>*</span></label>
          <input name="name" required placeholder="Nama calon peserta" />
        </div>
        <div className="field">
          <label>Nomor WhatsApp <span style={{ color: "#c0392b" }}>*</span></label>
          <input name="whatsapp" required placeholder="08xxx..." />
        </div>
        <div className="field">
          <label>Email</label>
          <input name="email" type="email" placeholder="opsional" />
        </div>
        <div className="field">
          <label>Program diminati</label>
          <select name="programId">
            <option value="">— Pilih —</option>
            {programs.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Sumber</label>
          <select name="source" defaultValue="OTHER">
            {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Status</label>
          <select name="status" defaultValue="NEW">
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </div>
        <div className="field full">
          <label>Bidang usaha</label>
          <input name="bidangUsaha" placeholder="contoh: konsultan pajak, kafe, toko online..." />
        </div>
        <div className="field full">
          <label>Pesan pertama</label>
          <textarea name="pesanPertama" rows={2} placeholder="pesan awal dari lead / ringkas percakapan" />
        </div>
        <div className="field full">
          <label>Ringkasan percakapan (data training)</label>
          <textarea name="ringkasanConversation" rows={3} placeholder="apa yang dia tanya, objection, kenapa closing/tidak" />
        </div>
        <div className="field full">
          <label>Objection (satu per baris)</label>
          <textarea name="objections" rows={3} placeholder={"harga\ngaptek\nragu"} />
        </div>
        <div className="field full" style={{ gridColumn: "1 / -1" }}>
          <button type="submit" className="btn btn-yellow">Simpan Lead</button>
          <p className="adm-note" style={{ marginTop: ".8rem" }}>
            Jadwal follow-up otomatis dihitung dari status. Simpan lalu kelola detail di halaman lead.
          </p>
        </div>
      </form>
    </>
  );
}