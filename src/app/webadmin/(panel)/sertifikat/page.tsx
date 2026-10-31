import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { isCertIssuanceEnabled } from "@/lib/certificates";
import { deleteCertificate, toggleCertIssuance, sendSingleCertWaAction } from "../../actions";
import ConfirmButton from "@/components/ConfirmButton";

export const dynamic = "force-dynamic";

export default async function AdminSertifikat({ searchParams }: {
  searchParams: Promise<{ page?: string; ok?: string; e?: string; msg?: string; name?: string }>;
}) {
  const { page, ok, e, msg, name } = await searchParams;
  const currentPage = Number(page ?? "1") || 1;
  const limit = 50;
  const skip = (currentPage - 1) * limit;

  const [certs, totalCount, issuanceEnabled] = await Promise.all([
    prisma.certificate.findMany({
      orderBy: { issuedAt: "desc" },
      skip,
      take: limit,
      include: { registration: { include: { program: true } } },
    }),
    prisma.certificate.count(),
    isCertIssuanceEnabled(),
  ]);

  const totalPages = Math.ceil(totalCount / limit);

  return (
    <>
      <div className="adm-head">
        <h1>Sertifikat Terbit <span style={{ color: "var(--ink-faint)", fontSize: "1rem" }}>({totalCount} total)</span></h1>
      </div>

      {ok === "dihapus" && <div className="adm-alert ok">Sertifikat berhasil dihapus. Status pendaftaran dikembalikan.</div>}
      {ok === "wa_sent" && <div className="adm-alert ok">Pesan WhatsApp rilis sertifikat berhasil dikirim ke {name || "peserta"}.</div>}
      {e === "notfound" && <div className="adm-alert err">Sertifikat tidak ditemukan.</div>}
      {e === "wa_failed" && <div className="adm-alert err">Gagal mengirim WhatsApp rilis sertifikat: {msg || "Terjadi kesalahan"}</div>}

      <div
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.8rem",
          background: issuanceEnabled ? "var(--white)" : "#FDECEC",
          border: `1px solid ${issuanceEnabled ? "var(--line)" : "var(--red)"}`,
          borderRadius: "var(--r-md)", padding: "1rem 1.2rem", marginBottom: "1.2rem",
        }}
      >
        <div>
          <strong>Penerbitan Sertifikat Baru: {issuanceEnabled ? "Aktif" : "Dihentikan Sementara (Hold)"}</strong>
          <p className="muted" style={{ margin: ".3rem 0 0", fontSize: "0.82rem" }}>
            {issuanceEnabled
              ? "Peserta yang memenuhi syarat bisa mendapat sertifikat baru seperti biasa."
              : "Tidak ada sertifikat baru yang bisa terbit di seluruh situs sampai ini diaktifkan lagi — sertifikat yang sudah terbit sebelumnya tidak terpengaruh."}
          </p>
        </div>
        <form action={toggleCertIssuance}>
          <ConfirmButton
            className={`btn btn-sm ${issuanceEnabled ? "btn-danger" : "btn-purple"}`}
            message={
              issuanceEnabled
                ? "Hentikan sementara penerbitan sertifikat baru di seluruh situs? Peserta yang baru memenuhi syarat tidak akan bisa klaim sampai diaktifkan lagi."
                : "Aktifkan kembali penerbitan sertifikat? Pastikan penyebab sertifikat terbit sebelum acara selesai sudah diperbaiki/diuji."
            }
          >
            {issuanceEnabled ? "Hold / Hentikan Sementara" : "Aktifkan Kembali"}
          </ConfirmButton>
        </form>
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr><th>Nomor</th><th>Nama</th><th>Program</th><th>Terbit</th><th>Status WA</th><th>Aksi</th></tr>
          </thead>
          <tbody>
            {certs.map((c) => (
              <tr key={c.id}>
                <td data-label="Nomor" style={{ fontWeight: 600 }}>{c.number}</td>
                <td data-label="Nama">{c.registration.name}</td>
                <td data-label="Program" className="muted">{c.registration.program.title}</td>
                <td data-label="Terbit" className="muted">{new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(c.issuedAt)}</td>
                <td data-label="Status WA">
                  {c.sentWaAt ? (
                    <span
                      className="badge g"
                      style={{ fontSize: "0.78rem" }}
                      title={`Terkirim pada: ${new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(c.sentWaAt)}`}
                    >
                      ✓ Terkirim
                    </span>
                  ) : (
                    <span className="badge dim" style={{ fontSize: "0.78rem" }}>
                      Belum Dikirim
                    </span>
                  )}
                </td>
                <td data-label="Aksi">
                  <div style={{ display: "flex", gap: ".4rem", flexWrap: "wrap" }}>
                    <a href={`/sertifikat/${c.number}`} target="_blank" className="btn btn-sm">Lihat ↗</a>
                    <form action={sendSingleCertWaAction}>
                      <input type="hidden" name="certId" value={c.id} />
                      <input type="hidden" name="redirectTo" value={`/webadmin/sertifikat?page=${currentPage}`} />
                      <ConfirmButton
                        className={`btn btn-sm ${c.sentWaAt ? "btn-line" : "btn-purple"}`}
                        message={`${c.sentWaAt ? "Kirim ulang" : "Kirim"} notifikasi WhatsApp sertifikat ke ${c.registration.name} (${c.registration.whatsapp})?`}
                      >
                        {c.sentWaAt ? "Kirim Ulang WA" : "Kirim WA"}
                      </ConfirmButton>
                    </form>
                    <form action={deleteCertificate}>
                      <input type="hidden" name="id" value={c.id} />
                      <ConfirmButton
                        className="btn btn-sm btn-danger"
                        message={`Hapus sertifikat "${c.number}" milik ${c.registration.name}? Status pendaftaran akan dikembalikan ke sebelum lulus, dan peserta perlu diproses ulang.`}
                      >
                        Hapus
                      </ConfirmButton>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {certs.length === 0 && <tr><td colSpan={6} className="muted">Belum ada sertifikat terbit.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div style={{ display: "flex", gap: ".8rem", alignItems: "center", marginTop: "1.4rem", justifyContent: "center" }}>
          {currentPage > 1 && (
            <Link
              href={`/webadmin/sertifikat?page=${currentPage - 1}`}
              className="btn btn-sm"
            >
              ← Sebelum
            </Link>
          )}
          <span style={{ fontSize: ".85rem", fontWeight: 600, color: "var(--ink-soft)" }}>
            Halaman {currentPage} dari {totalPages}
          </span>
          {currentPage < totalPages && (
            <Link
              href={`/webadmin/sertifikat?page=${currentPage + 1}`}
              className="btn btn-sm"
            >
              Sesudah →
            </Link>
          )}
        </div>
      )}
    </>
  );
}
