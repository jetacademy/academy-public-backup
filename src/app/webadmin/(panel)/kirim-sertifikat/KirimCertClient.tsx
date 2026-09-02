"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  createOfflineProgram,
  importOfflineRecipients,
  sendOfflineCert,
} from "../../offline-cert-actions";

type ProgramOption = {
  id: string;
  slug: string;
  title: string;
  mentorName: string;
  materi: unknown;
  certBgUrl: string | null;
  certConfig: unknown;
  isActive?: boolean;
};

/** Props yang diterima komponen editor desain (CertCustomizer) via dynamic import. */
type CertCustomizerProps = {
  program: ProgramOption;
  templates?: unknown[];
};

type RecentCert = {
  id: string;
  number: string;
  issuedAt: Date;
  sentWaAt: Date | null;
  sentEmailAt: Date | null;
  registration: { name: string; whatsapp: string; email: string; program: { title: string } };
};

type Row = { name: string; whatsapp: string; email: string };

const fmtDate = (d: Date | null) =>
  d
    ? new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).format(d)
    : null;

export default function KirimCertClient({
  activeStep,
  selectedProgram,
  offlinePrograms,
  recentCerts,
}: {
  activeStep: string;
  selectedProgram: ProgramOption | null;
  offlinePrograms: ProgramOption[];
  recentCerts: RecentCert[];
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [fileName, setFileName] = useState("");
  const [pending, setPending] = useState(false);

  function handleFile(file: File) {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

        const parsed: Row[] = json.map((raw: Record<string, unknown>) => {
          const keys = Object.keys(raw);
          const nameKey = keys.find((k) => /nama|name/i.test(k)) ?? keys[0];
          const waKey = keys.find((k) => /wa|whatsapp|phone|no.?hp|telp/i.test(k)) ?? keys[1] ?? "";
          const emailKey = keys.find((k) => /email|e-?mail/i.test(k)) ?? keys[2] ?? "";
          return {
            name: String(raw[nameKey] ?? "").trim(),
            whatsapp: String(waKey ? raw[waKey] ?? "" : "").trim(),
            email: String(emailKey ? raw[emailKey] ?? "" : "").trim(),
          };
        });
        setRows(parsed.filter((r) => r.name));
      } catch (err) {
        alert("Gagal membaca file: " + (err instanceof Error ? err.message : "format tidak dikenal"));
      }
    };
    reader.readAsArrayBuffer(file);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.4rem" }}>
      {/* ── STEP AWAL — Buat program offline ── */}
      {activeStep === "awal" && (
        <div className="adm-card" style={{ padding: "1.4rem" }}>
          <h2 style={{ margin: "0 0 .6rem", fontSize: "1.15rem" }}>
            🏅 Buat Acara / Program Offline
          </h2>
          <p className="muted" style={{ margin: "0 0 1.2rem", fontSize: ".85rem" }}>
            Untuk acara yang tidak tercatat di aplikasi (pelatihan offline, seminar, dll) —
            sistem akan membuat program tersembunyi otomatis. Tidak muncul di katalog publik.
          </p>

          <form action={createOfflineProgram} style={{ display: "flex", gap: ".6rem", flexWrap: "wrap" }}>
            <input
              name="title"
              required
              placeholder="Nama acara — mis. Pelatihan Komunitas Desa Digital"
              className="input"
              style={{ flex: 1, minWidth: 260 }}
            />
            <button className="btn btn-purple">Buat &amp; Lanjut Desain →</button>
          </form>

          {offlinePrograms.length > 0 && (
            <div style={{ marginTop: "1.2rem" }}>
              <p style={{ fontSize: ".85rem", fontWeight: 600, margin: "0 0 .5rem" }}>
                Atau lanjutkan acara offline yang sudah dibuat:
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: ".4rem" }}>
                {offlinePrograms.map((p) => (
                  <Link
                    key={p.id}
                    href={`/webadmin/kirim-sertifikat?step=desain&programId=${p.id}`}
                    style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      border: "1px solid var(--line)", borderRadius: "var(--r-md)",
                      padding: ".6rem .9rem", fontSize: ".85rem", background: "var(--surface)",
                    }}
                  >
                    <span>
                      <b>{p.title}</b>{" "}
                      <span className="muted">({p.slug})</span>
                    </span>
                    <span style={{ color: "var(--purple)", fontWeight: 700 }}>Lanjut →</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── STEP DESAIN — CertCustomizer di-embed ── */}
      {activeStep === "desain" && selectedProgram && (
        <div className="adm-card" style={{ padding: "1.2rem 1.4rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: ".8rem", flexWrap: "wrap", gap: ".6rem" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.15rem" }}>🎨 Desain Sertifikat — {selectedProgram.title}</h2>
              <p className="muted" style={{ margin: ".3rem 0 0", fontSize: ".82rem" }}>
                Atur background, logo, teks, tanda tangan &amp; QR. Klik &quot;Simpan&quot; lalu lanjut ke kontak.
              </p>
            </div>
            <div style={{ display: "flex", gap: ".5rem" }}>
              <Link href="/webadmin/templates-sertifikat" target="_blank" className="btn btn-sm">
                Template Master
              </Link>
              <Link href={`/webadmin/kirim-sertifikat?step=kontak&programId=${selectedProgram.id}`} className="btn btn-sm btn-purple">
                Desain Selesai → Kontak
              </Link>
            </div>
          </div>

          <CertCustomizerEmbed program={selectedProgram} />
        </div>
      )}

      {/* ── STEP KONTAK — upload Excel / input manual ── */}
      {activeStep === "kontak" && selectedProgram && (
        <div className="adm-card" style={{ padding: "1.2rem 1.4rem" }}>
          <h2 style={{ margin: "0 0 .6rem", fontSize: "1.15rem" }}>
            📇 Kontak Penerima — {selectedProgram.title}
          </h2>
          <p className="muted" style={{ margin: "0 0 1rem", fontSize: ".85rem" }}>
            Upload Excel (kolom <b>Nama</b>, <b>WhatsApp</b>, <b>Email</b> dideteksi otomatis) atau
            isi manual di bawah.
          </p>

          <div style={{ display: "flex", gap: ".6rem", flexWrap: "wrap", marginBottom: "1rem" }}>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              style={{ display: "none" }}
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
              {fileName ? `📄 ${fileName}` : "⬆️ Upload Excel"}
            </button>
            <a
              href="/webadmin/kirim-sertifikat/template"
              className="btn btn-sm"
              style={{ alignSelf: "center" }}
            >
              ⬇️ Download Template
            </a>
          </div>

          {rows.length > 0 && (
            <div style={{ marginBottom: "1rem" }}>
              <p style={{ fontSize: ".85rem", margin: "0 0 .5rem" }}>
                <b>{rows.length}</b> kontak terdeteksi:
              </p>
              <div className="tbl-wrap" style={{ maxHeight: 240, overflowY: "auto" }}>
                <table className="tbl" style={{ fontSize: ".8rem" }}>
                  <thead>
                    <tr><th>#</th><th>Nama</th><th>WhatsApp</th><th>Email</th></tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 20).map((r, i) => (
                      <tr key={i}>
                        <td>{i + 1}</td>
                        <td>{r.name}</td>
                        <td>{r.whatsapp || "—"}</td>
                        <td>{r.email || "—"}</td>
                      </tr>
                    ))}
                    {rows.length > 20 && (
                      <tr><td colSpan={4} className="muted">… dan {rows.length - 20} lainnya</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <form
            action={importOfflineRecipients}
            onSubmit={() => setPending(true)}
            style={{ display: "flex", gap: ".6rem", flexWrap: "wrap", alignItems: "center" }}
          >
            <input type="hidden" name="programId" value={selectedProgram.id} />
            <input type="hidden" name="recipients" value={JSON.stringify(rows)} />
            <button className="btn btn-purple" disabled={pending || rows.length === 0}>
              {pending ? "Menerbitkan…" : `🚀 Terbitkan ${rows.length} Sertifikat`}
            </button>
            {rows.length === 0 && (
              <span className="muted" style={{ fontSize: ".8rem" }}>
                Upload Excel dulu di atas.
              </span>
            )}
          </form>
        </div>
      )}

      {/* ── STEP KIRIM — daftar + kirim manual (tampil juga di semua step) ── */}
      {activeStep !== "awal" && (
        <div className="adm-card" style={{ padding: "1.2rem 1.4rem" }}>
          <h2 style={{ margin: "0 0 .8rem", fontSize: "1.15rem" }}>
            ✉️ Sertifikat Terbaru — Kirim Manual
          </h2>
          <p className="muted" style={{ margin: "0 0 1rem", fontSize: ".85rem" }}>
            Kirim link + QR via WhatsApp atau email per penerima. Status <b>Terkirim</b> muncul setelah berhasil.
          </p>

          <div className="tbl-wrap">
            <table className="tbl" style={{ fontSize: ".82rem" }}>
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Program</th>
                  <th>Nomor</th>
                  <th>WA</th>
                  <th>Email</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {recentCerts.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <b>{c.registration.name}</b>
                      <div className="muted" style={{ fontSize: ".75rem" }}>
                        {c.registration.whatsapp} · {c.registration.email}
                      </div>
                    </td>
                    <td className="muted">{c.registration.program.title}</td>
                    <td>
                      <a href={`/sertifikat/${c.number}`} target="_blank" style={{ color: "var(--accent)" }}>
                        {c.number} ↗
                      </a>
                    </td>
                    <td>
                      {c.sentWaAt ? (
                        <span className="adm-alert ok" style={{ padding: ".2rem .6rem", fontSize: ".75rem", display: "inline-block" }}>
                          ✅ {fmtDate(c.sentWaAt)}
                        </span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      {c.sentEmailAt ? (
                        <span className="adm-alert ok" style={{ padding: ".2rem .6rem", fontSize: ".75rem", display: "inline-block" }}>
                          ✅ {fmtDate(c.sentEmailAt)}
                        </span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: ".4rem", flexWrap: "wrap" }}>
                        <form action={sendOfflineCert}>
                          <input type="hidden" name="id" value={c.id} />
                          <input type="hidden" name="via" value="wa" />
                          <input type="hidden" name="back" value="/webadmin/kirim-sertifikat?step=kirim" />
                          <button className="btn btn-sm" style={{ background: "#25D366", borderColor: "#25D366", color: "#fff" }}>
                            Kirim WA
                          </button>
                        </form>
                        <form action={sendOfflineCert}>
                          <input type="hidden" name="id" value={c.id} />
                          <input type="hidden" name="via" value="email" />
                          <input type="hidden" name="back" value="/webadmin/kirim-sertifikat?step=kirim" />
                          <button className="btn btn-sm" style={{ background: "#232176", borderColor: "#232176", color: "#fff" }}>
                            Kirim Email
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
                {recentCerts.length === 0 && (
                  <tr><td colSpan={6} className="muted">Belum ada sertifikat. Buat acara &amp; upload kontak dulu.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Embed CertCustomizer — dynamic import biar tidak bikin bundle besar ─── */
function CertCustomizerEmbed({ program }: { program: ProgramOption }) {
  const [Loaded, setLoaded] = useState<React.ComponentType<CertCustomizerProps> | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const programData = {
    id: program.id,
    slug: program.slug,
    title: program.title,
    mentorName: program.mentorName,
    materi: Array.isArray(program.materi) ? program.materi : [],
    certBgUrl: program.certBgUrl,
    certConfig: program.certConfig ?? {},
  };

  if (err) return <div className="adm-alert err">{err}</div>;
  if (!Loaded) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <button
          className="btn btn-purple"
          onClick={async () => {
            try {
              const mod = await import("@/components/CertCustomizer");
              setLoaded(() => mod.default);
            } catch (e) {
              setErr("Gagal memuat editor desain: " + (e instanceof Error ? e.message : "unknown"));
            }
          }}
        >
          🎨 Buka Editor Desain
        </button>
      </div>
    );
  }
  return <Loaded program={programData} templates={[]} />;
}
