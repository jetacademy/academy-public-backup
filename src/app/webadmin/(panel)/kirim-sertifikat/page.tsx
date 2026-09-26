import Link from "next/link";
import { prisma } from "@/lib/prisma";
import CertCustomizer from "@/components/CertCustomizer";
import { createOfflineProgram, sendOfflineCert } from "../../offline-cert-actions";
import KontakUploader from "./KontakUploader";

export const dynamic = "force-dynamic";

type Step = "awal" | "desain" | "kontak" | "kirim";

const STEPS: { key: Step; label: string; desc: string }[] = [
  { key: "awal", label: "Pilih Acara", desc: "Buat baru atau lanjutkan" },
  { key: "desain", label: "Desain", desc: "Tampilan sertifikat" },
  { key: "kontak", label: "Penerima", desc: "Upload daftar peserta" },
  { key: "kirim", label: "Kirim", desc: "WhatsApp / email" },
];

const ERRORS: Record<string, string> = {
  title: "Nama acara wajib diisi.",
  invalid: "Data tidak valid. Pastikan kolom terisi benar.",
  empty: "Tidak ada peserta di file yang diupload.",
  program: "Acara tidak ditemukan.",
  hold: "Penerbitan sertifikat sedang di-hold. Aktifkan dulu di menu Sertifikat.",
  notfound: "Sertifikat tidak ditemukan.",
  wafail: "Gagal kirim WhatsApp. Cek konfigurasi Evolution API atau nomor tujuan.",
  sendfail: "Gagal mengirim. Cek log server.",
};

const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).format(d);

function stepHref(step: Step, programId?: string) {
  const qs = new URLSearchParams({ step, ...(programId ? { programId } : {}) });
  return `/webadmin/kirim-sertifikat?${qs.toString()}`;
}

export default async function AdminKirimSertifikat({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const programId = params.programId ?? "";

  // Program terpilih — termasuk program offline tersembunyi (isActive=false)
  const selectedProgram = programId
    ? await prisma.program.findUnique({
        where: { id: programId },
        select: {
          id: true, slug: true, title: true, mentorName: true, materi: true, certBgUrl: true, certConfig: true,
        },
      })
    : null;

  // Desain & Penerima butuh acara terpilih; Kirim boleh tanpa acara (tampilkan semua sertifikat terbaru).
  const requested = (["awal", "desain", "kontak", "kirim"] as Step[]).includes(params.step as Step)
    ? (params.step as Step)
    : "awal";
  const activeStep: Step = (requested === "desain" || requested === "kontak") && !selectedProgram ? "awal" : requested;
  const activeIndex = STEPS.findIndex((s) => s.key === activeStep);
  const pid = selectedProgram?.id;

  const [offlinePrograms, templates, certs] = await Promise.all([
    activeStep === "awal"
      ? prisma.program.findMany({
          where: { isActive: false, slug: { startsWith: "offline-" } },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: { id: true, title: true, createdAt: true, _count: { select: { registrations: true } } },
        })
      : [],
    activeStep === "desain" ? prisma.certificateTemplate.findMany({ orderBy: { createdAt: "desc" } }) : [],
    activeStep === "kirim"
      ? prisma.certificate.findMany({
          where: pid ? { registration: { programId: pid } } : {},
          orderBy: { issuedAt: "desc" },
          take: 100,
          select: {
            id: true, number: true, sentWaAt: true, sentEmailAt: true,
            registration: { select: { name: true, whatsapp: true, email: true, program: { select: { title: true } } } },
          },
        })
      : [],
  ]);

  const sentWa = certs.filter((c) => c.sentWaAt).length;
  const sentEmail = certs.filter((c) => c.sentEmailAt).length;
  const unsent = certs.filter((c) => !c.sentWaAt && !c.sentEmailAt).length;

  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Kirim Sertifikat</h1>
          <p className="muted" style={{ margin: ".3rem 0 0", fontSize: ".85rem" }}>
            Terbitkan &amp; kirim sertifikat untuk acara di luar aplikasi (pelatihan offline, seminar, dll).
          </p>
        </div>
        {selectedProgram && (
          <div className="kc-current">
            <span className="kc-current-label">Acara</span>
            <b>{selectedProgram.title}</b>
            <Link href={stepHref("awal")}>Ganti</Link>
          </div>
        )}
      </div>

      {/* Langkah wizard — bisa diklik; Desain & Penerima terkunci sampai acara dipilih */}
      <nav className="kc-steps" aria-label="Langkah kirim sertifikat">
        {STEPS.map((s, i) => {
          const locked = (s.key === "desain" || s.key === "kontak") && !pid;
          const state = i === activeIndex ? "on" : i < activeIndex ? "done" : "";
          const inner = (
            <>
              <span className="kc-step-num">{i < activeIndex ? "✓" : i + 1}</span>
              <span className="kc-step-text">
                <b>{s.label}</b>
                <small>{locked ? "Pilih acara dulu" : s.desc}</small>
              </span>
            </>
          );
          return locked ? (
            <span key={s.key} className="kc-step locked" aria-disabled="true">{inner}</span>
          ) : (
            <Link
              key={s.key}
              href={stepHref(s.key, pid)}
              className={`kc-step ${state}`}
              aria-current={state === "on" ? "step" : undefined}
            >
              {inner}
            </Link>
          );
        })}
      </nav>

      {params.ok === "import" && (
        <div className="adm-alert ok">
          Selesai: <b>{params.imported ?? "0"}</b> sertifikat terbit, <b>{params.skipped ?? "0"}</b> sudah ada sebelumnya,{" "}
          <b>{params.failed ?? "0"}</b> gagal. Kirim ke peserta lewat tabel di bawah.
        </div>
      )}
      {params.ok === "send" && (
        <div className="adm-alert ok">
          Sertifikat {params.name ? <b>{params.name}</b> : null} terkirim via {params.via === "wa" ? "WhatsApp" : "email"}.
        </div>
      )}
      {params.e && <div className="adm-alert err">{ERRORS[params.e] ?? "Terjadi kesalahan."}</div>}

      {/* ── 1. PILIH ACARA ── */}
      {activeStep === "awal" && (
        <div className="kc-grid">
          <section className="form-section">
            <header>
              <h3>Buat acara baru</h3>
              <p>Sistem membuat program tersembunyi — tidak muncul di katalog publik, tapi halaman verifikasi sertifikat tetap aktif.</p>
            </header>
            <form action={createOfflineProgram} className="kc-body kc-create">
              <input name="title" required placeholder="mis. Pelatihan Komunitas Desa Digital" />
              <button className="btn btn-purple">Buat &amp; Lanjut ke Desain</button>
            </form>
          </section>

          <section className="form-section">
            <header>
              <h3>Lanjutkan acara sebelumnya</h3>
              <p>{offlinePrograms.length > 0 ? "20 acara offline terbaru." : "Belum ada acara offline."}</p>
            </header>
            <div className="kc-body">
              {offlinePrograms.length > 0 ? (
                <ul className="kc-list">
                  {offlinePrograms.map((p) => (
                    <li key={p.id}>
                      <div className="kc-list-main">
                        <b>{p.title}</b>
                        <span className="muted">
                          {p._count.registrations} penerima · dibuat {fmtDate(p.createdAt)}
                        </span>
                      </div>
                      <div className="kc-list-actions">
                        <Link href={stepHref("desain", p.id)} className="btn btn-sm btn-line">Desain</Link>
                        <Link href={stepHref("kontak", p.id)} className="btn btn-sm btn-line">Penerima</Link>
                        <Link href={stepHref("kirim", p.id)} className="btn btn-sm btn-purple">Kirim</Link>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>Acara yang dibuat akan muncul di sini.</p>
              )}
            </div>
          </section>
        </div>
      )}

      {/* ── 2. DESAIN ── */}
      {activeStep === "desain" && selectedProgram && (
        <>
          <p className="muted" style={{ margin: "0 0 1rem", fontSize: ".85rem" }}>
            Atur background, logo, teks, tanda tangan &amp; QR, lalu klik <b>Simpan</b> di editor sebelum lanjut.
          </p>
          <CertCustomizer program={selectedProgram} templates={templates} backLink={null} />
        </>
      )}

      {/* ── 3. PENERIMA ── */}
      {activeStep === "kontak" && selectedProgram && (
        <section className="form-section">
          <header>
            <h3>Daftar penerima</h3>
            <p>Upload Excel/CSV — kolom Nama, WhatsApp, dan Email dideteksi otomatis. Peserta yang sudah punya sertifikat di acara ini dilewati.</p>
          </header>
          <div className="kc-body">
            <KontakUploader programId={selectedProgram.id} />
          </div>
        </section>
      )}

      {/* ── 4. KIRIM ── */}
      {activeStep === "kirim" && (
        <>
          {certs.length > 0 && (
            <div className="kc-summary">
              <div><span>Sertifikat</span><b>{certs.length}</b></div>
              <div><span>Terkirim WA</span><b>{sentWa}</b></div>
              <div><span>Terkirim email</span><b>{sentEmail}</b></div>
              <div><span>Belum dikirim</span><b className={unsent > 0 ? "warn" : ""}>{unsent}</b></div>
            </div>
          )}
          {!pid && (
            <p className="muted" style={{ margin: "0 0 1rem", fontSize: ".85rem" }}>
              Menampilkan 100 sertifikat terbaru dari semua program. <Link href={stepHref("awal")} style={{ color: "var(--purple)", fontWeight: 700 }}>Pilih acara</Link> untuk menyaring.
            </p>
          )}

          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Penerima</th>
                  {!pid && <th>Program</th>}
                  <th>Nomor</th>
                  <th>Status</th>
                  <th>Kirim</th>
                </tr>
              </thead>
              <tbody>
                {certs.map((c) => (
                  <tr key={c.id}>
                    <td data-label="Penerima">
                      <b>{c.registration.name}</b>
                      <div className="muted">{c.registration.whatsapp} · {c.registration.email}</div>
                    </td>
                    {!pid && <td data-label="Program" className="muted">{c.registration.program.title}</td>}
                    <td data-label="Nomor">
                      <a href={`/sertifikat/${c.number}`} target="_blank" rel="noopener noreferrer" className="kc-link">
                        {c.number} ↗
                      </a>
                    </td>
                    <td data-label="Status">
                      <div className="kc-status">
                        {c.sentWaAt && <span className="badge g">WA · {fmtDate(c.sentWaAt)}</span>}
                        {c.sentEmailAt && <span className="badge g">Email · {fmtDate(c.sentEmailAt)}</span>}
                        {!c.sentWaAt && !c.sentEmailAt && <span className="badge dim">Belum dikirim</span>}
                      </div>
                    </td>
                    <td data-label="Kirim">
                      <div className="kc-send">
                        <form action={sendOfflineCert}>
                          <input type="hidden" name="id" value={c.id} />
                          <input type="hidden" name="via" value="wa" />
                          {pid && <input type="hidden" name="programId" value={pid} />}
                          <button className="btn btn-sm kc-btn-wa">{c.sentWaAt ? "Kirim ulang WA" : "WhatsApp"}</button>
                        </form>
                        <form action={sendOfflineCert}>
                          <input type="hidden" name="id" value={c.id} />
                          <input type="hidden" name="via" value="email" />
                          {pid && <input type="hidden" name="programId" value={pid} />}
                          <button className="btn btn-sm btn-line">{c.sentEmailAt ? "Kirim ulang email" : "Email"}</button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
                {certs.length === 0 && (
                  <tr>
                    <td colSpan={pid ? 4 : 5} className="muted" style={{ textAlign: "center", padding: "1.5rem" }}>
                      Belum ada sertifikat{pid ? " untuk acara ini" : ""}.{" "}
                      {pid && <Link href={stepHref("kontak", pid)} style={{ color: "var(--purple)", fontWeight: 700 }}>Upload penerima dulu</Link>}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Navigasi bawah: kembali / lanjut */}
      {activeStep !== "awal" && (
        <div className="kc-footer">
          {/* Tanpa acara terpilih, langkah sebelum Kirim (Penerima) terkunci → kembali ke Pilih Acara */}
          <Link href={stepHref(pid ? STEPS[activeIndex - 1].key : "awal", pid)} className="btn btn-line">
            ← {pid ? STEPS[activeIndex - 1].label : STEPS[0].label}
          </Link>
          {activeIndex < STEPS.length - 1 && (
            <Link href={stepHref(STEPS[activeIndex + 1].key, pid)} className="btn btn-purple">
              Lanjut: {STEPS[activeIndex + 1].label} →
            </Link>
          )}
        </div>
      )}
    </>
  );
}
