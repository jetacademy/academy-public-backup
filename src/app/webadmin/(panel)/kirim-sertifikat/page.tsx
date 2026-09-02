import { prisma } from "@/lib/prisma";
import KirimCertClient from "./KirimCertClient";

export const dynamic = "force-dynamic";

export default async function AdminKirimSertifikat({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const step = params.step ?? "awal";
  const programId = params.programId ?? "";

  // Program terpilih (untuk step desain) — termasuk program offline tersembunyi
  let selectedProgram = null;
  if (programId) {
    selectedProgram = await prisma.program.findUnique({
      where: { id: programId },
      select: {
        id: true,
        slug: true,
        title: true,
        mentorName: true,
        materi: true,
        certBgUrl: true,
        certConfig: true,
        isActive: true,
      },
    });
  }

  // Daftar program offline (untuk lanjut desain/kirim)
  const offlinePrograms = await prisma.program.findMany({
    where: { isActive: false, slug: { startsWith: "offline-" } },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      slug: true,
      title: true,
      mentorName: true,
      materi: true,
      certBgUrl: true,
      certConfig: true,
    },
  });

  const [recentCerts] = await Promise.all([
    prisma.certificate.findMany({
      orderBy: { issuedAt: "desc" },
      take: 50,
      include: {
        registration: { include: { program: { select: { title: true } } } },
      },
    }),
  ]);

  const activeStep = step === "desain" && selectedProgram ? "desain" : step;

  return (
    <>
      <div className="adm-head">
        <h1>Kirim Sertifikat</h1>
      </div>

      {/* Wizard steps indicator */}
      <div style={{ display: "flex", gap: ".6rem", flexWrap: "wrap", marginBottom: "1.2rem" }}>
        {[
          { key: "awal", label: "1️⃣ Nama Acara" },
          { key: "desain", label: "2️⃣ Desain" },
          { key: "kontak", label: "3️⃣ Kontak" },
          { key: "kirim", label: "4️⃣ Kirim" },
        ].map((s) => (
          <span
            key={s.key}
            style={{
              padding: ".45rem 1rem",
              borderRadius: 999,
              fontSize: ".8rem",
              fontWeight: 700,
              background: activeStep === s.key ? "var(--purple)" : "var(--surface)",
              color: activeStep === s.key ? "#fff" : "var(--ink-soft)",
              border: "1px solid var(--line)",
            }}
          >
            {s.label}
          </span>
        ))}
      </div>

      {params.ok === "1" && (
        <div className="adm-alert ok">
          ✅ Selesai: <b>{params.imported ?? "0"}</b> sertifikat terbit,{" "}
          <b>{params.skipped ?? "0"}</b> sudah ada, <b>{params.failed ?? "0"}</b> gagal.
          {params.via && <> Sertifikat terkirim via <b>{params.via === "wa" ? "WhatsApp" : "Email"}</b>.</>}
        </div>
      )}
      {params.e && (
        <div className="adm-alert err">
          Gagal:{" "}
          {params.e === "title" && "Nama acara wajib diisi."}
          {params.e === "invalid" && "Data tidak valid. Pastikan kolom terisi benar."}
          {params.e === "empty" && "Tidak ada peserta."}
          {params.e === "program" && "Program tidak ditemukan."}
          {params.e === "hold" && "Penerbitan sertifikat sedang di-hold. Aktifkan dulu di menu Sertifikat."}
          {params.e === "notfound" && "Sertifikat tidak ditemukan."}
          {params.e === "wafail" && "Gagal kirim WA. Cek konfigurasi Evolution API / nomor tujuan."}
          {params.e === "sendfail" && "Gagal mengirim. Cek log server."}
        </div>
      )}

      <KirimCertClient
        activeStep={activeStep}
        selectedProgram={selectedProgram}
        offlinePrograms={offlinePrograms}
        recentCerts={recentCerts}
      />
    </>
  );
}
