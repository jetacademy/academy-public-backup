import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WaFloat from "@/components/WaFloat";
import DownloadCertButton from "@/components/DownloadCertButton";
import CertificateSheet from "@/components/CertificateSheet";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import QRCode from "qrcode";
import type { CertConfig, CertMateriJp } from "@/lib/types";

export const revalidate = 86400; // ISR: re-generate every 24 hours

// Nomor sertifikat tak valid → 404 sungguhan (bukan soft-404) agar tidak
// memakan crawl budget & tidak berisiko terindeks sebagai halaman kosong.
export async function generateMetadata({ params }: { params: Promise<{ number: string }> }): Promise<Metadata> {
  const { number } = await params;
  try {
    const cert = await prisma.certificate.findUnique({
      where: { number: decodeURIComponent(number) },
      select: { number: true, registration: { select: { name: true }, include: { program: { select: { title: true } } } } },
    });
    if (!cert) return { title: "Sertifikat Tidak Ditemukan", robots: { index: false } };
    const name = cert.registration.name;
    const programTitle = cert.registration.program.title;
    return {
      title: `e-Sertifikat ${name} — ${programTitle}`,
      description: `Verifikasi resmi e-sertifikat ${name} untuk pelatihan "${programTitle}" dari Jetschool Academy. Nomor: ${cert.number}.`,
    };
  } catch {
    return { title: "e-Sertifikat — Jetschool Academy" };
  }
}

function toRoman(num: number): string {
  const roman = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
  return roman[num - 1] || String(num);
}

/** Halaman sertifikat sekaligus verifikasi publik: /sertifikat/[number] */
export default async function CertPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;

  let cert = null;
  try {
    cert = await prisma.certificate.findUnique({
      where: { number: decodeURIComponent(number) },
      include: { registration: { include: { program: true, batch: true } } },
    });
  } catch {
    notFound();
  }
  if (!cert) notFound();

  const program = cert.registration.program;
  const batch = cert.registration.batch;
  const rawCertConfig = batch?.certConfig ?? program.certConfig;
  const certConfig: CertConfig = rawCertConfig ? (rawCertConfig as CertConfig) : {};
  const certBgUrl = batch?.certBgUrl ?? program.certBgUrl;

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const verifyUrl = `${baseUrl}/sertifikat/${cert.number}`;
  
  // QR code pointing to this verification page
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
    margin: 1,
    width: 140,
    color: { dark: "#1B1710", light: "#FFFFFF" },
  });

  // Tanggal yang tampil di sertifikat mengikuti jadwal batch yang diikuti peserta (bukan tanggal cert diterbitkan)
  const batchDate = cert.registration.batch?.scheduleAt ?? program.scheduleAt;
  const batchDateFormatted = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(batchDate);
  const monthRoman = toRoman(cert.issuedAt.getMonth() + 1);
  const yearStr = String(cert.issuedAt.getFullYear());

  // Format cert number — fallback ke cert.number (JSA-YYYY-XXXXXXXX)
  const numFormatted = certConfig.numberFormat
    ? certConfig.numberFormat
        .replace(/\[serial\]/g, cert.number)
        .replace(/\[month\]/g, monthRoman)
        .replace(/\[year\]/g, yearStr)
    : cert.number;

  // Description text
  const descTemplate = certConfig.description || "Sebagai peserta dalam pelatihan nasional yang diadakan oleh PT Jetschool Academy Indonesia dengan tema: \"{title}\" yang dilaksanakan pada {date}.";
  const descResolved = descTemplate
    .replace(/{title}/g, program.title)
    .replace(/{name}/g, cert.registration.name)
    .replace(/{date}/g, batchDateFormatted)
    .replace(/{institution}/g, cert.registration.institution || "");

  // Syllabus / JP breakdown
  const materiList = Array.isArray(program.materi) ? (program.materi as string[]) : [];
  const configMateriJp: CertMateriJp[] = Array.isArray(certConfig.materiJp) ? certConfig.materiJp : [];

  const materiJp: CertMateriJp[] =
    configMateriJp.length > 0 && configMateriJp.every((r) => typeof r?.materi === "string")
      ? configMateriJp.map((r) => ({
          materi: r.materi,
          teori: Number(r.teori) || 0,
          tugas: Number(r.tugas) || 0,
        }))
      : materiList.map((m, idx) => {
          const match = configMateriJp[idx];
          return {
            materi: m,
            teori: match?.teori != null ? Number(match.teori) : 5,
            tugas: match?.tugas != null ? Number(match.tugas) : 3,
          };
        });

  const totalJp = materiJp.reduce((acc, curr) => acc + curr.teori + curr.tugas, 0);

  // Tanda tangan — hanya Direktur (satu tanda tangan resmi)
  const s2Name = certConfig.sign2Name || "Najib";
  const s2Role = certConfig.sign2Role || "Direktur PT Jetschool Academy Indonesia";
  const s2Img = certConfig.sign2Img || "";
  const stImg = certConfig.stampImg || "";

  const accentColor = certConfig.accentColor || "#232176";

  // Sub-judul default mengikuti jenis sertifikat program
  const KIND_SUBTITLE: Record<string, string> = {
    PARTICIPATION: "KETERANGAN KEIKUTSERTAAN PELATIHAN",
    COMPLETION: "KETERANGAN SELESAI TOPIK PELATIHAN",
    ACHIEVEMENT: "KETERANGAN KELULUSAN PELATIHAN",
  };
  const defaultSubtitle = KIND_SUBTITLE[String(program.certKind)] ?? "KETERANGAN SELESAI TOPIK PELATIHAN";

  return (
    <>
      <Navbar minimal ctaHref="/program" ctaLabel="Ikut Kelas Lain" />

      <section className="section" style={{ minHeight: "80vh", background: "var(--bg-warm)", padding: "2rem 0 4rem" }}>
        <div className="container cert-premium-container">
          
          <div className="section-head center no-print" style={{ marginBottom: "2rem" }}>
            <span className="kicker center">✓ Terverifikasi Resmi</span>
            <h1 style={{ fontSize: "clamp(1.8rem, 4vw, 2.6rem)" }}>e-Sertifikat Resmi</h1>
            <p className="lead" style={{ margin: ".8rem auto 0" }}>
              Tercatat resmi di sistem verifikasi Jetschool Academy dengan nomor <b>{cert.number}</b>.
            </p>
          </div>

          {/* MAIN CERTIFICATE SHEET (A4 Portrait aspect ratio, padding 0 for complete absolute control) */}
          <div className="cert-scroll-wrapper">
            <CertificateSheet
              certBgUrl={certBgUrl}
              certConfig={certConfig}
              accentColor={accentColor}
              title={certConfig.title || "SERTIFIKAT"}
              subtitle={certConfig.subtitle || defaultSubtitle}
              numFormatted={numFormatted}
              recipientName={cert.registration.name}
              recipientInstitution={cert.registration.institution || undefined}
              descResolved={descResolved}
              materiJp={materiJp}
              totalJp={totalJp}
              placeDateResolved={certConfig.placeDate ? certConfig.placeDate.replace(/\[date\]/g, batchDateFormatted) : `Bekasi, ${batchDateFormatted}`}
              qrDataUrl={qrDataUrl}
              qrIdLabel={cert.number}
              s2Name={s2Name}
              s2Role={s2Role}
              s2Img={s2Img || undefined}
              stampImg={stImg || undefined}
            />
          </div>

          {/* Action Buttons */}
          <div className="no-print" style={{ display: "flex", gap: "1rem", justifyContent: "center", marginTop: "2.5rem", flexWrap: "wrap" }}>
            <DownloadCertButton fileName={`sertifikat-${cert.number}`} />
            <Link className="btn" href="/program">Ikut Kelas Berikutnya</Link>
          </div>
          <p className="reg-note no-print" style={{ textAlign: "center", marginTop: "1rem" }}>
            Klik &ldquo;Download Sertifikat (PNG)&rdquo; untuk menyimpan gambar sertifikat ini ke perangkat Anda.
          </p>

        </div>
      </section>

      <Footer />
      <WaFloat />
    </>
  );
}
