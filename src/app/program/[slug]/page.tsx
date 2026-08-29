import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Script from "next/script";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import WaFloat from "@/components/WaFloat";
import Faq from "@/components/Faq";
import RegisterForm from "@/components/RegisterForm";
import ValueStack from "@/components/ValueStack";
import OfferTimer from "@/components/OfferTimer";
import Testimonials from "@/components/Testimonials";
import Icon from "@/components/Icon";
import ProgramContentBlocks from "@/components/ProgramContentBlocks";
import VibesLandingSections from "@/components/VibesLandingSections";
import RevealStagger from "@/components/RevealStagger";
import TransformArrow from "@/components/TransformArrow";
import { getProgramBySlug } from "@/lib/programs";
import { TYPE_LABEL, type ProgramType } from "@/lib/fallback";
import Image from "next/image";
import { formatJadwal, formatHari, formatJam, rupiah } from "@/lib/format";

// Halaman ini di-ISR (cache 5 menit) — personalisasi member (prefill profil,
// cek sudah terdaftar) TIDAK lagi dibaca di sini saat SSR, dipindah ke
// client-side (RegisterForm, lewat getProgramRegistrationStatusAction) supaya
// HTML yang di-cache tidak pernah memuat data pribadi member dan trafik iklan
// (mayoritas anonim) tidak menahan proses Node per kunjungan.
export const revalidate = 300;

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL?.includes("localhost")
  ? process.env.NEXT_PUBLIC_BASE_URL
  : "https://academy.jetschool.id";

const TYPE_CLASS: Record<ProgramType, string> = {
  WEBINAR: "type-webinar",
  KELAS: "type-kelas",
  WORKSHOP: "type-workshop",
  BOOTCAMP: "type-bootcamp",
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const { program } = await getProgramBySlug(slug);
  if (!program) return { title: "Program tidak ditemukan" };

  const title = `${program.title} — Kursus AI Bersertifikat`;
  return {
    title,
    description: program.tagline,
    alternates: { canonical: `/program/${program.slug}` },
    openGraph: {
      type: "website",
      title,
      description: program.tagline,
      images: program.imageUrl ? [{ url: program.imageUrl }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: program.tagline,
      images: program.imageUrl ? [program.imageUrl] : undefined,
    },
  };
}

export default async function ProgramPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { program } = await getProgramBySlug(slug);
  if (!program) notFound();

  const isFree = program.price === 0;
  const hasBlocks = !!(program.contentBlocks && program.contentBlocks.length > 0);
  const isTeacherProgram = program.slug === "modul-ajar-ai-untuk-guru";
  const isAiForTeachers = program.slug === "ai-for-teachers";
  const isZeroHuman = program.slug === "zero-human-company";
  const isVibesCoding = program.slug === "vibes-coding";
  const jadwal = formatJadwal(program.scheduleAt);

  // Prioritaskan batch aktif mendatang untuk jadwal display
  const nextBatch = program.batches?.[0];
  const displayScheduleAt = nextBatch?.scheduleAt ?? program.scheduleAt;
  const displayJadwal = nextBatch ? formatJadwal(nextBatch.scheduleAt) : jadwal;
  const displayHari = nextBatch ? formatHari(nextBatch.scheduleAt) : formatHari(program.scheduleAt);
  const displayJam = nextBatch ? formatJam(nextBatch.scheduleAt) : formatJam(program.scheduleAt);
  const priceLabel = isFree ? "GRATIS" : rupiah(program.price);
  const ebCtaNavLabel = isZeroHuman ? "Rp 225.000 — Sekali" : (isFree ? "Daftar Gratis" : "Daftar");

  const faqItems = isAiForTeachers
    ? [
        {
          q: "Apakah program ini benar-benar gratis?",
          a: "Ya, sesi webinar ini 100% gratis tanpa biaya pendaftaran. Anda bisa mengikuti seluruh sesi live dan mengakses materi LMS tanpa dipungut biaya.",
        },
        {
          q: "Apakah cocok untuk pemula yang tidak paham AI?",
          a: "Sangat cocok. Program ini dirancang khusus untuk guru tanpa latar belakang IT atau AI. Semua demo dipandu langkah demi langkah.",
        },
        {
          q: "Bagaimana jika berhalangan hadir pada sesi live?",
          a: "Rekaman sesi tersedia dan dapat diakses kapan saja melalui LMS. Anda tetap bisa mengikuti seluruh materi.",
        },
        {
          q: "Apa saja yang perlu disiapkan?",
          a: "Cukup HP atau laptop dengan koneksi internet. Tidak perlu install software khusus — semua tools berbasis web.",
        },
      ]
    : isVibesCoding
    ? [
        {
          q: "Saya gak bisa coding sama sekali, bisa ikut?",
          a: "Bisa — justru itu targetnya 😄 Kamu gak nulis kode manual. Kamu ngomong ke AI (Antigravity), AI yang bikin kodenya, kamu yang arahin. Tinggal bisa pakai laptop & internet, kamu sudah bisa ikut.",
        },
        {
          q: "2,5 jam doang, beneran langsung bisa bikin?",
          a: "Beneran. Bukan teori, bukan nonton demo doang — kamu praktik langsung bareng instruktur, step by step. Di akhir sesi kamu bawa pulang 4 produk jadi: 2 game 3D, aplikasi keuangan, dan website.",
        },
        {
          q: "Laptop biasa kuat gak?",
          a: "Kuat. Gak perlu spesifikasi tinggi — laptop standar yang bisa buka browser & internet stabil sudah cukup untuk ikut.",
        },
        {
          q: "Hasilnya beneran bisa dipakai atau cuma latihan?",
          a: "Beneran dipakai. Aplikasinya dibangun pakai Next.js — framework kelas enterprise yang dipakai Netflix, TikTok, Uber. Website bisa langsung diisi konten bisnismu, aplikasi keuangan bisa langsung buat catat pemasukan/pengeluaran.",
        },
        {
          q: "Aplikasinya bisa online / di-publish ke hosting?",
          a: "Bisa — dan itu bagian dari workshop. Dari 0 sampai online: siapin hosting, deploy/upload aplikasi, setting domain, aktifkan HTTPS, sampai aplikasi & game-mu kebuka lewat link. Semua dibimbing step by step, tanpa istilah rumit.",
        },
        {
          q: "Hosting & domain itu mahal gak?",
          a: "Gak wajib sewa hari itu juga — kamu bisa pakai hosting gratis dulu buat latihan. Kalau mau online permanen, hosting & domain terjangkau (mulai ratusan ribu per tahun) dan ditanggung peserta. Yang penting ilmunya kamu bawa pulang.",
        },
        {
          q: "Sertifikat dapat?",
          a: "Ya. Lunas = dapat. e-Sertifikat resmi dikirim manual oleh admin per batch setelah sesi selesai.",
        },
        {
          q: "Kapan grup WhatsApp & link Zoom dikirim?",
          a: "Paling lambat H-1 (satu hari sebelum workshop), grup WhatsApp dan link Zoom dikirim ke nomor yang kamu daftarkan. Pastikan nomormu aktif ya.",
        },
      ]
    : isZeroHuman
    ? [
        {
          q: "Apakah workshop ini benar-benar praktik?",
          a: "Ya. Fokus workshop adalah praktik membangun AI Agent, bukan hanya teori.",
        },
        {
          q: "Apakah harus bisa coding?",
          a: "Tidak harus.",
        },
        {
          q: "Apakah saya harus berlangganan platform AI Agent?",
          a: "Tidak. Workshop tidak mengharuskan Anda berlangganan platform AI Agent dari Jetschool.",
        },
        {
          q: "Apakah ada biaya langganan ke Jetschool?",
          a: "Tidak ada biaya langganan platform AI Agent dari Jetschool.",
        },
        {
          q: "Apakah membutuhkan server?",
          a: "Untuk setup dasar yang diajarkan, Agent berjalan di laptop Anda sehingga tidak membutuhkan server berbayar.",
        },
        {
          q: "Apakah AI modelnya gratis?",
          a: "Tersedia pilihan model lokal dan LLM gratis yang tersedia, tergantung kebutuhan dan kebijakan provider.",
        },
        {
          q: "Apakah Agent bisa bekerja 24/7?",
          a: "Agent dapat menjalankan pekerjaan selama environment tempat Agent berjalan tersedia dan aktif. Jika Agent dijalankan langsung di laptop, laptop perlu menyala agar Agent dapat menjalankan tugas.",
        },
        {
          q: "Setelah workshop apakah Agent menjadi milik saya?",
          a: "Anda membangun dan mengkonfigurasi Agent sendiri selama workshop sehingga dapat terus dikembangkan dan disesuaikan setelah workshop.",
        },
        {
          q: "Apakah saya mendapatkan rekaman?",
          a: "Ya.",
        },
        {
          q: "Apakah mendapatkan sertifikat?",
          a: "Ya, peserta mendapatkan e-sertifikat.",
        },
        {
          q: "Apakah workshop ini cocok untuk pemula?",
          a: "Ya. Materi dirancang untuk membawa peserta dari pengenalan hingga praktik membangun Agent.",
        },
      ]
    : [
        {
          q: isFree ? "Apakah program ini benar-benar gratis?" : "Apakah ada biaya tambahan?",
          a: isFree
            ? "Ya, sesi webinar ini 100% gratis tanpa biaya pendaftaran."
            : "Tidak ada. ${rupiah(program.price)} sudah mencakup seluruh materi, akses, dan e-sertifikat.",
        },
        {
          q: "Apakah cocok untuk pemula?",
          a: "Ya. Program ini dirancang untuk peserta tanpa latar belakang khusus, dengan penyampaian yang mudah diikuti.",
        },
        {
          q: "Bagaimana jika berhalangan hadir pada sesi live?",
          a: "Rekaman sesi tersedia dan dapat diakses kapan saja. Anda tetap dapat menyelesaikan evaluasi dan memperoleh sertifikat.",
        },
        {
          q: "Kapan sertifikat diterbitkan?",
          a: "Secara otomatis setelah Anda dinyatakan lulus evaluasi — dengan garansi penerbitan maksimal 1×24 jam.",
        },
      ];

  const courseJsonLd = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: program.title,
    description: program.description,
    provider: {
      "@type": "Organization",
      name: "Jetschool Academy",
      sameAs: SITE_URL,
    },
    offers: {
      "@type": "Offer",
      price: program.price,
      priceCurrency: "IDR",
      category: isFree ? "Free" : "Paid",
      availability: "https://schema.org/InStock",
      url: `${SITE_URL}/program/${program.slug}`,
    },
    hasCourseInstance: {
      "@type": "CourseInstance",
      courseMode: "Online",
      startDate: program.scheduleAt.toISOString(),
      instructor: { "@type": "Person", name: program.mentorName },
    },
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Beranda", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Program", item: `${SITE_URL}/program` },
      { "@type": "ListItem", position: 3, name: program.title, item: `${SITE_URL}/program/${program.slug}` },
    ],
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <>
      {/* Facebook Pixel — khusus halaman Vibes Coding */}
      {isVibesCoding && (
        <>
          <Script id="fb-pixel-init" strategy="afterInteractive">
            {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js'); fbq('init', '918646724014939'); fbq('track', 'PageView');`}
          </Script>
          <noscript>
            <img height="1" width="1" style={{ display: "none" }} src="https://www.facebook.com/tr?id=918646724014939&ev=PageView&noscript=1" />
          </noscript>
        </>
      )}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(courseJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      {/* Navigasi minimal: logo + satu tombol. */}
      {/* CTA statis (shell di-cache) — anggota yang sudah terdaftar akan diarahkan
          ke dashboard oleh RegisterForm sendiri setelah scroll ke #daftar. */}
      <Navbar minimal ctaHref="#daftar" ctaLabel={ebCtaNavLabel} />

      {/* ===== HERO ===== */}
      <section className="hero">
        <div className="container">
          <div className="prg-hero-wrap">

            {/* Kolom kiri — teks */}
            <div className="prg-hero-content">
              {isZeroHuman ? (
                <>
                  <span className="type-tag type-workshop" style={{ marginBottom: "1rem", display: "inline-block" }}>
                    Zero Human Company
                  </span>
                  <p style={{ fontWeight: 700, color: "rgba(255,255,255,0.75)", margin: "0 0 0.6rem" }}>
                    Workshop Membangun Perusahaan dengan AI Agent
                  </p>
                  <h1 className="prg-hero-h1">Bangun 6 Karyawan AI Pertama Anda dalam 3 Jam</h1>
                  <p className="prg-hero-lead">
                    Bangun AI Agent yang membantu menjalankan pekerjaan Customer Service, Sales, Marketing, Content, Developer, dan Reporting untuk bisnis Anda.
                  </p>
                  <p className="prg-hero-desc" style={{ marginBottom: 0, fontSize: "0.92rem" }}>
                    Tanpa coding. Tanpa langganan platform AI Agent. Tanpa server berbayar untuk setup dasar.
                  </p>
                  <div style={{ marginTop: "1.3rem", display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
                    <span style={{ background: "rgba(247,148,29,0.15)", border: "1px solid rgba(247,148,29,0.4)", color: "var(--orange)", fontWeight: 800, fontSize: "0.68rem", letterSpacing: "0.03em", padding: "0.25rem 0.65rem", borderRadius: "999px" }}>
                      🔥 PROMO HARI INI
                    </span>
                  </div>
                  <div style={{ marginTop: "0.5rem", display: "flex", alignItems: "baseline", gap: "0.7rem", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "clamp(1.8rem, 4vw, 2.4rem)", fontWeight: 900, color: "var(--orange)" }}>Rp225.000</span>
                    <span className="prg-hero-strike">Rp490.000</span>
                  </div>
                  <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.5)", marginTop: "0.1rem" }}>
                    Sekali bayar • Praktik langsung • 6 AI Agent
                  </p>
                  <a href="#daftar" className="btn btn-purple btn-lg" style={{ marginTop: "1rem", display: "inline-flex", maxWidth: "100%", whiteSpace: "normal", textAlign: "center", lineHeight: 1.25 }}>
                    🚀 Saya Mau Bangun 6 Karyawan AI
                  </a>
                  <p style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.45)", marginTop: "0.7rem" }}>
                    Cukup laptop + internet. Anda membangun dan menjalankannya sendiri.
                  </p>
                </>
              ) : (
              <>
              <span className={`type-tag ${TYPE_CLASS[program.type]}`} style={{ marginBottom: "1.2rem", display: "inline-block" }}>
                {TYPE_LABEL[program.type]}
              </span>
              <h1 className="prg-hero-h1">{program.title}</h1>
              <p className="prg-hero-lead">{program.tagline}</p>
              {isVibesCoding && (
                <div style={{ marginTop: "1.2rem", padding: "0.7rem 1.2rem", background: "rgba(46, 204, 113, 0.08)", borderLeft: "4px solid #27ae60", borderRadius: "0 12px 12px 0", display: "inline-block" }}>
                  <p style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "#27ae60" }}>
                    💤 Gak bisa coding? Justru itu alasan kamu ikut.
                  </p>
                </div>
              )}
              </>
              )}
            </div>

            {/* Kolom kanan — Gambar Program (upload admin) atau ilustrasi bawaan */}
            <div className="prg-hero-visual">
              {isZeroHuman && !program.imageUrl ? (
                <div className="ticket-card">
                  <div className="ticket-glow" />
                  <div className="ticket-header">
                    <div className="ticket-brand">🚀 JETSCHOOL ACADEMY</div>
                    <span className="ticket-badge">WORKSHOP</span>
                  </div>
                  <div className="ticket-body">
                    <div className="ticket-live-indicator">
                      <span className="live-dot" />
                      6 AI AGENT AKTIF
                    </div>
                    <p className="ticket-title">Zero Human Company<br />Workshop Pass</p>
                    <div className="ticket-mentor">
                      <div className="mentor-avatar">🤖</div>
                      <div>
                        <p className="mentor-name">{program.mentorName}</p>
                        <p className="mentor-label">Instruktur</p>
                      </div>
                    </div>
                  </div>
                  <div className="ticket-divider">
                    <span className="notch notch-left" style={{ background: "#171540" }} />
                    <span className="ticket-dashed-line" />
                    <span className="notch notch-right" style={{ background: "#171540" }} />
                  </div>
                  <div className="ticket-footer">
                    <div className="ticket-meta">
                      <div className="meta-item"><Icon name="calendar" size={14} /> {displayHari}, {formatJam(displayScheduleAt)}</div>
                      <div className="meta-item"><Icon name="clock" size={14} /> 3 Jam · Live Zoom</div>
                      <div className="meta-item"><Icon name="award" size={14} /> e-Sertifikat + Rekaman</div>
                    </div>
                    <OfferTimer target={displayScheduleAt.toISOString()} note="Sesi dimulai dalam" />
                  </div>
                </div>
              ) : (
              <div className={`prg-hero-image-panel ${program.imageUrl ? "prg-hero-image-panel-dynamic" : ""}`}>
                {program.imageUrl ? (
                  <Image
                    src={program.imageUrl}
                    alt={program.title}
                    width={600}
                    height={400}
                    className="prg-hero-image-dynamic"
                    priority
                  />
                ) : (
                  <Image
                    src="/hero2.webp"
                    alt={program.title}
                    fill
                    className="prg-hero-image"
                    style={{ objectFit: "cover" }}
                    priority
                  />
                )}
              </div>
              )}
            </div>

          </div>
        </div>
      </section>

      {/* ===== DESCRIPTION & CTA BAR ===== */}
      <section className="section-sm" style={{ paddingTop: "2rem", paddingBottom: "2rem" }}>
        <div className="container">
          <div className={hasBlocks ? "prg-desc-cta-card no-desc" : "prg-desc-cta-card"}>
            {!hasBlocks && (
              <div className="prg-desc-col">
                <h3 className="prg-desc-title">Deskripsi Program</h3>
                <p className="prg-desc-text">
                  {isZeroHuman
                    ? "Workshop intensif 3 jam: pelajari cara membangun dan mengoperasikan 6 AI Agent untuk membantu pekerjaan Customer Service, Sales, Marketing, Content, Developer, dan Reporting di bisnis Anda — tanpa coding, tanpa langganan platform AI Agent."
                    : program.description}
                </p>
              </div>
            )}
            <div className="prg-cta-col">
              <a href="#daftar" className="btn btn-purple btn-lg btn-block" style={{ width: "100%", textAlign: "center" }}>
                {isZeroHuman ? `Pulang Bawa 6 Karyawan AI` : (isFree ? "Daftar Gratis Sekarang" : `Daftar — ${priceLabel}`)}
              </a>
              {!isFree && program.priceOld && (
                <span className="prg-hero-strike" style={{ color: "var(--ink-soft)", textDecoration: "line-through", display: "block", textAlign: "center", marginTop: "0.2rem" }}>
                  {rupiah(program.priceOld)}
                </span>
              )}
              <div className="prg-cta-meta-list" style={{ marginTop: "0.5rem" }}>
                <div className="cta-meta-item">
                  <Icon name="calendar" size={14} />
                  <span>{displayHari}, {formatJam(displayScheduleAt)}</span>
                </div>
                <div className="cta-meta-item">
                  <Icon name="award" size={14} />
                  <span>{isAiForTeachers ? "Live Zoom 2 jam · 6 Demo Langsung" : isZeroHuman ? "Live Zoom 3 jam · 6 Karyawan AI" : isVibesCoding ? "Live Zoom 2,5 jam · 4 Produk Jadi" : "Komunitas + Rekaman + Sertifikat"}</span>
                </div>
              </div>
              <OfferTimer target={displayScheduleAt.toISOString()} note="Sesi dimulai dalam" />
            </div>
          </div>
        </div>
      </section>

      {/* ===== BODY: editor blok (jika ada) menggantikan seluruh section di bawah ini ===== */}
      {hasBlocks ? (
        <section className="section">
          <div className="container">
            <ProgramContentBlocks blocks={program.contentBlocks ?? []} />
          </div>
        </section>
      ) : (
      <>
      {/* ===== KHUSUS VIBES CODING: PERSUASIF & RELEVAN ===== */}
      {isVibesCoding && (
        <VibesLandingSections program={program} />
      )}
      {/* ===== KHUSUS GURU: PERSUASIF & RELEVAN ===== */}
      {isTeacherProgram && (
        <>
          {/* Section 1: Pain Points & Tantangan Guru */}
          <section className="section" style={{ background: "var(--chip)", paddingBottom: "3.5rem" }}>
            <div className="container">
              <div className="section-head center">
                <span className="type-tag type-kelas" style={{ marginBottom: "1.2rem", display: "inline-block" }}>Masalah &amp; Tantangan</span>
                <h2 style={{ fontSize: "clamp(1.8rem, 4vw, 2.6rem)" }}>Administrasi Mengajar Menyita Waktu Anda?</h2>
                <p style={{ maxWidth: "36rem", marginInline: "auto", color: "var(--ink-soft)" }}>
                  Sebagai pendidik, waktu berharga Anda seharusnya fokus mendampingi siswa, bukan habis di depan laptop untuk administrasi Kurikulum Merdeka.
                </p>
              </div>

              <div className="pain-points-grid" style={{ marginTop: "2.5rem" }}>
                <div className="pain-card problem-card">
                  <div className="pain-icon-wrapper">
                    <Icon name="alert-triangle" size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: "1.1rem", marginBottom: "0.4rem" }}>Beban Administrasi Modul Ajar</h3>
                    <p style={{ fontSize: "0.88rem", color: "var(--ink-soft)", lineHeight: 1.5 }}>
                      Menyusun CP, TP, ATP, Asesmen, hingga RPP Kurikulum Merdeka secara manual dari nol sangat menyita waktu istirahat guru.
                    </p>
                  </div>
                </div>

                <div className="pain-card solution-card">
                  <div className="pain-icon-wrapper">
                    <Icon name="check" size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: "1.1rem", marginBottom: "0.4rem" }}>Solusi Asisten AI Guru</h3>
                    <p style={{ fontSize: "0.88rem", color: "var(--ink-soft)", lineHeight: 1.5 }}>
                      Pangkas waktu penyusunan administrasi menjadi hanya 2 menit. Dapatkan draf utuh berformat Microsoft Word (.docx) siap pakai dan siap edit.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Section 2: Product Preview / Cara Kerja */}
          <section className="section">
            <div className="container">
              <div className="hero-card" style={{ alignItems: "center", gap: "3rem" }}>
                <div style={{ flex: 1 }}>
                  <span className="type-tag type-webinar" style={{ marginBottom: "1.2rem", display: "inline-block" }}>Demo Aplikasi</span>
                  <h2 style={{ fontSize: "clamp(1.8rem, 4vw, 2.6rem)", marginBottom: "1rem" }}>
                    Intip Kemudahan Membuat Modul Ajar RPP
                  </h2>
                  <p style={{ color: "var(--ink-soft)", marginBottom: "1.2rem", lineHeight: 1.6 }}>
                    Tidak perlu lagi bingung menulis perintah prompt AI yang rumit. Cukup pilih mata pelajaran, kelas, dan topik materi pokok. Sistem AI kami akan merancang modul ajar Kurikulum Merdeka yang terstruktur lengkap.
                  </p>
                  <ul className="check-list" style={{ gap: "0.8rem" }}>
                    <li>Menghasilkan Capaian &amp; Tujuan Pembelajaran secara runtun</li>
                    <li>Menyusun skenario aktivitas pembelajaran berbasis keaktifan siswa</li>
                    <li>Dilengkapi instrumen asesmen rubrik penilaian dan LKPD siswa</li>
                    <li>Unduh instan format Word (.docx) langsung ke laptop/ponsel Anda</li>
                  </ul>
                </div>
                <div style={{ flex: 1, position: "relative" }}>
                  <div className="mock-browser">
                    <div className="mock-browser-header">
                      <span className="mock-dot mock-dot-red"></span>
                      <span className="mock-dot mock-dot-yellow"></span>
                      <span className="mock-dot mock-dot-green"></span>
                      <div className="mock-browser-address">guru.jetschool.id/asisten-ai</div>
                    </div>
                    <div className="mock-browser-content">
                      <Image
                        src="/asisten_ai_guru_preview.png"
                        alt="Preview Asisten AI Guru"
                        width={600}
                        height={400}
                        style={{ width: "100%", height: "auto", display: "block" }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Section 3: PMM Bukti Dukung Validation */}
          <section className="section" style={{ background: "var(--chip)", paddingTop: "3rem", paddingBottom: "3rem" }}>
            <div className="container">
              <div className="bento pmm-validation-box" style={{ background: "var(--white)", border: "1px solid var(--border)", padding: "2.5rem" }}>
                <div className="section-head" style={{ marginBottom: "2rem" }}>
                  <span className="type-tag type-kelas" style={{ marginBottom: "1.2rem", display: "inline-block", background: "rgba(35, 33, 118, 0.08)", color: "var(--purple)" }}>Validasi PMM</span>
                  <h2 style={{ fontSize: "clamp(1.8rem, 4vw, 2.4rem)", marginBottom: "0.8rem" }}>
                    Sertifikat Pelatihan Nasional 32 JP Resmi &amp; Valid
                  </h2>
                  <p style={{ color: "var(--ink-soft)", maxWidth: "42rem", lineHeight: 1.6 }}>
                    Khawatir sertifikat Anda ditolak di PMM? Kami memastikan sertifikat yang Anda dapatkan memiliki kelayakan administrasi penuh untuk menunjang Sasaran Kinerja Pegawai (SKP) Anda.
                  </p>
                </div>

                <div className="pmm-grid">
                  <div className="pmm-card">
                    <span className="pmm-icon-check">✓</span>
                    <span className="pmm-text">Tanda Tangan &amp; Cap Resmi</span>
                  </div>
                  <div className="pmm-card">
                    <span className="pmm-icon-check">✓</span>
                    <span className="pmm-text">QR Code Verifikasi Online</span>
                  </div>
                  <div className="pmm-card">
                    <span className="pmm-icon-check">✓</span>
                    <span className="pmm-text">Rincian Struktur Materi Lengkap</span>
                  </div>
                  <div className="pmm-card">
                    <span className="pmm-icon-check">✓</span>
                    <span className="pmm-text">Bukti Dukung Valid PMM</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      {/* ===== AI FOR TEACHERS: PERSEMBAHAN 6 DEMO + FREE LMS ===== */}
      {isAiForTeachers && (
        <>
          {/* Section 1: 6 Demo — Apa yang Akan Anda Kuasai */}
          <section className="section" style={{ paddingBottom: "3.5rem" }}>
            <div className="container">
              <div className="section-head center">
                <span className="type-tag type-workshop" style={{ marginBottom: "1.2rem", display: "inline-block" }}>6 Demo Langsung</span>
                <h2 style={{ fontSize: "clamp(1.8rem, 4vw, 2.6rem)" }}>Dalam 2 Jam, Kuasai 6 Metode AI untuk Mengajar</h2>
                <p style={{ maxWidth: "36rem", marginInline: "auto", color: "var(--ink-soft)" }}>
                  Sesi live Zoom interaktif — lihat langsung, praktikkan sendiri, hasil instan.
                </p>
              </div>

              <div className="hero-card" style={{ marginTop: "2rem", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.2rem" }}>
                {[
                  { icon: "📝", title: "Modul Ajar RPP", desc: "Buat Modul Ajar Kurikulum Merdeka lengkap dengan 1 prompt sederhana. Hasil dalam 2 menit.", time: "20 menit" },
                  { icon: "🧠", title: "Soal HOTS", desc: "Hasilkan soal HOTS dengan stimulus studi kasus, kunci jawaban, dan indikator soal.", time: "15 menit" },
                  { icon: "🎬", title: "Video Pembelajaran", desc: "Dari script → gambar → video bergerak → siap tayang. Alur AI terstruktur.", time: "20 menit" },
                  { icon: "🎙️", title: "Audio Podcast", desc: "Ubah teks modul menjadi audio/podcast natural untuk siswa auditori.", time: "10 menit" },
                  { icon: "📊", title: "Presentasi AI", desc: "Generate slide dengan desain otomatis. Struktur lengkap: pembuka, isi, evaluasi.", time: "15 menit" },
                  { icon: "🎨", title: "Infografis", desc: "Visualisasikan materi abstrak jadi infografis, concept map, dan mind map.", time: "10 menit" },
                ].map((demo, i) => (
                  <div key={i} className="bento" style={{ padding: "1.5rem", border: "1px solid var(--border)", borderRadius: "var(--r-md)", background: "var(--white)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.8rem", marginBottom: "0.8rem" }}>
                      <span style={{ fontSize: "2rem" }}>{demo.icon}</span>
                      <div>
                        <h3 style={{ fontSize: "1.1rem", fontWeight: 800, margin: 0 }}>{demo.title}</h3>
                        <span style={{ fontSize: "0.75rem", color: "var(--purple)", fontWeight: 700 }}>⏱ {demo.time}</span>
                      </div>
                    </div>
                    <p style={{ fontSize: "0.88rem", color: "var(--ink-soft)", lineHeight: 1.5, margin: 0 }}>{demo.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </>
      )}

      {/* ===== ZERO HUMAN COMPANY: 6 AI AGENT ===== */}
      {isZeroHuman && (
        <>
          {/* Section 0: VIDEO — Lihat langsung Karyawan AI bekerja */}
          <section className="section" style={{ paddingTop: "3rem", paddingBottom: "2rem" }}>
            <div className="container">
              <div className="section-head center" style={{ marginBottom: "1.5rem" }}>
                <h2 style={{ fontSize: "clamp(1.6rem, 4vw, 2.4rem)" }}>Lihat Karyawan AI Bekerja Tanpa Henti</h2>
                <p style={{ maxWidth: "32rem", marginInline: "auto", color: "var(--ink-soft)" }}>
                  Owner tidur — bisnis tetap jalan. Ini yang Anda dapatkan dengan 6 Karyawan AI.
                </p>
              </div>
              <div
                style={{
                  position: "relative", width: "100%", maxWidth: "56rem", marginInline: "auto",
                  aspectRatio: "16 / 9", borderRadius: "var(--r-lg)", overflow: "hidden",
                  background: "#0a1226", boxShadow: "0 24px 60px rgba(25,25,25,.35)",
                }}
              >
                <iframe
                  src="https://iframe.mediadelivery.net/embed/707807/cce98f15-2759-416f-b495-ae04a6d65c12?autoplay=true&loop=true&muted=true&volume=0&preload=true&responsive=true"
                  title="Zero Human Company — Karyawan AI bekerja tanpa henti"
                  loading="lazy"
                  allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
                />
              </div>
            </div>
          </section>

          {/* Section 1: Selamat Datang — Dulu vs Sekarang (Redesigned & Harmonized) */}
          <section className="section" style={{ paddingTop: "3.5rem", paddingBottom: "3.5rem", background: "var(--chip)" }}>
            <div className="container">
              <div className="section-head center">
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "0.7rem", marginBottom: "1.2rem" }}>
                  <span style={{ color: "var(--orange)", fontSize: "1.2rem" }}>✦</span>
                  <span className="type-tag type-workshop" style={{ display: "inline-block" }}>Selamat Datang di Era</span>
                  <span style={{ color: "var(--orange)", fontSize: "1.2rem" }}>✦</span>
                </div>
                <div style={{ position: "relative", display: "inline-block" }}>
                  <div style={{ position: "absolute", inset: "-24px -50px", background: "radial-gradient(ellipse, rgba(35,33,118,0.18) 0%, rgba(247,148,29,0.12) 55%, transparent 75%)", filter: "blur(22px)", zIndex: 0, pointerEvents: "none" }} />
                  <h2 style={{ fontSize: "clamp(1.8rem, 4vw, 2.6rem)", position: "relative", zIndex: 1 }}>Zero <span className="hero-h1-accent">Human Company</span></h2>
                </div>
                <p style={{ maxWidth: "34rem", marginInline: "auto", color: "var(--ink-soft)" }}>
                  Dulu, menjalankan bisnis butuh tim besar dengan beban biaya tinggi. Sekarang, 6 AI Agent otonom siap bekerja bersama Anda.
                </p>
              </div>

              <div
                style={{
                  marginTop: "2.5rem",
                  display: "flex",
                  flexWrap: "wrap",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: "1.2rem",
                  maxWidth: "60rem",
                  marginInline: "auto",
                }}
              >
                {/* Dulu: Model Konvensional */}
                <div
                  className="bento"
                  style={{
                    flex: "1 1 320px",
                    maxWidth: "460px",
                    padding: "1.8rem 1.6rem",
                    background: "var(--white)",
                    border: "1px solid rgba(229, 72, 77, 0.2)",
                    borderRadius: "22px",
                    boxShadow: "0 10px 30px rgba(229, 72, 77, 0.04)",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
                    <span style={{ fontSize: "0.72rem", fontWeight: 800, color: "var(--red)", background: "rgba(229, 72, 77, 0.08)", padding: "0.3rem 0.75rem", borderRadius: "999px", letterSpacing: "0.03em" }}>
                      ⏳ MODEL KONVENSIONAL
                    </span>
                    <span style={{ width: "42px", height: "42px", borderRadius: "50%", background: "rgba(229, 72, 77, 0.08)", color: "var(--red)", display: "grid", placeItems: "center", fontSize: "1.25rem" }}>
                      👥
                    </span>
                  </div>

                  <h3 style={{ fontSize: "1.15rem", fontWeight: 800, margin: "0 0 0.35rem", color: "var(--ink)" }}>
                    Ketergantungan Tim 6 Orang
                  </h3>
                  <p style={{ fontSize: "0.84rem", color: "var(--ink-soft)", lineHeight: 1.5, margin: "0 0 1.2rem" }}>
                    Biaya operasional membengkak tiap bulan dan aktivitas terhenti di luar jam kantor.
                  </p>

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
                    {[
                      { icon: "💸", title: "6x Beban Gaji Bulanan", desc: "Gaji pokok, tunjangan, BPJS, & fasilitas kantor." },
                      { icon: "⏰", title: "Terbatas 8 Jam Kerja", desc: "Leads malam & akhir pekan lambat direspons." },
                      { icon: "📉", title: "Kapasitas Terbatas & Lelah", desc: "Mudah burnout, human error, & risiko resign." },
                      { icon: "🔄", title: "Supervisi & Follow-up Rutin", desc: "Waktu owner habis memantau pekerjaan harian." },
                    ].map((item, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "0.75rem",
                          background: "rgba(229, 72, 77, 0.03)",
                          border: "1px solid rgba(229, 72, 77, 0.08)",
                          borderRadius: "14px",
                          padding: "0.65rem 0.85rem",
                        }}
                      >
                        <span style={{ fontSize: "1.1rem", lineHeight: 1.2 }}>{item.icon}</span>
                        <div>
                          <b style={{ fontSize: "0.82rem", color: "var(--ink)", display: "block" }}>{item.title}</b>
                          <span style={{ fontSize: "0.76rem", color: "var(--ink-soft)", lineHeight: 1.4, display: "block" }}>{item.desc}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: "1.2rem", padding: "0.65rem 0.9rem", background: "rgba(229, 72, 77, 0.06)", borderRadius: "12px", borderLeft: "3px solid var(--red)" }}>
                    <span style={{ fontSize: "0.76rem", fontWeight: 700, color: "var(--red)" }}>
                      ⚠️ Biaya tinggi & pertumbuhan bisnis terhambat kapasitas jam kerja manusia.
                    </span>
                  </div>
                </div>

                {/* Transform Arrow */}
                <TransformArrow />

                {/* Sekarang: Zero Human Company */}
                <div
                  className="bento"
                  style={{
                    flex: "1 1 320px",
                    maxWidth: "460px",
                    padding: "1.8rem 1.6rem",
                    background: "linear-gradient(180deg, rgba(35,33,118,0.03) 0%, var(--white) 100%)",
                    border: "1.5px solid rgba(35, 33, 118, 0.22)",
                    borderRadius: "22px",
                    boxShadow: "0 14px 40px rgba(35,33,118,0.08)",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
                    <span style={{ fontSize: "0.72rem", fontWeight: 800, color: "#fff", background: "linear-gradient(135deg, var(--purple), var(--purple-deep))", padding: "0.3rem 0.8rem", borderRadius: "999px", letterSpacing: "0.03em", boxShadow: "0 3px 8px rgba(35,33,118,0.25)" }}>
                      ✨ ZERO HUMAN COMPANY
                    </span>
                    <span style={{ width: "42px", height: "42px", borderRadius: "50%", background: "var(--purple-soft)", color: "var(--purple)", display: "grid", placeItems: "center", fontSize: "1.25rem", border: "1px solid rgba(35,33,118,0.18)" }}>
                      🤖
                    </span>
                  </div>

                  <h3 style={{ fontSize: "1.15rem", fontWeight: 800, margin: "0 0 0.35rem", color: "var(--ink)" }}>
                    6 AI Agent Otonom Bekerja
                  </h3>
                  <p style={{ fontSize: "0.84rem", color: "var(--ink-soft)", lineHeight: 1.5, margin: "0 0 1.2rem" }}>
                    Manusia menentukan strategi & arah bisnis — AI Agent mengeksekusi secara otomatis 24/7.
                  </p>

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
                    {[
                      { icon: "💰", title: "0 Beban Gaji Bulanan", desc: "Cukup 1x setup di laptop Anda tanpa langganan mahal." },
                      { icon: "⚡", title: "Respon 24/7 Tanpa Jeda", desc: "Chat, closing, & follow-up leads aktif saat Anda tidur." },
                      { icon: "🎯", title: "Konsisten 100% Sesuai SOP", desc: "Eksekusi presisi tinggi tanpa lelah dan tanpa drama." },
                      { icon: "🚀", title: "Skalabilitas Tanpa Batas", desc: "Tangani ratusan prospek simultan tanpa rekrut staf." },
                    ].map((item, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "0.75rem",
                          background: "rgba(35, 33, 118, 0.03)",
                          border: "1px solid rgba(35, 33, 118, 0.08)",
                          borderRadius: "14px",
                          padding: "0.65rem 0.85rem",
                        }}
                      >
                        <span style={{ fontSize: "1.1rem", lineHeight: 1.2 }}>{item.icon}</span>
                        <div>
                          <b style={{ fontSize: "0.82rem", color: "var(--purple)", display: "block" }}>{item.title}</b>
                          <span style={{ fontSize: "0.76rem", color: "var(--ink-soft)", lineHeight: 1.4, display: "block" }}>{item.desc}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: "1.2rem", padding: "0.65rem 0.9rem", background: "rgba(23, 160, 94, 0.08)", borderRadius: "12px", borderLeft: "3px solid var(--green)" }}>
                    <span style={{ fontSize: "0.76rem", fontWeight: 700, color: "var(--green)" }}>
                      ✅ Operasional 100% mandiri & bisnis terus menghasilkan 24 jam.
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom Quote / Transformation Hook */}
              <div style={{
                marginTop: "2.2rem", display: "flex", alignItems: "center", gap: "1rem",
                maxWidth: "40rem", marginInline: "auto", padding: "1rem 1.4rem",
                background: "var(--white)", border: "1px solid var(--border)", borderRadius: "999px",
                boxShadow: "0 12px 30px rgba(35,33,118,0.08)",
              }}>
                <span style={{ width: "44px", height: "44px", borderRadius: "50%", background: "linear-gradient(135deg, var(--orange), var(--purple))", color: "#fff", display: "grid", placeItems: "center", fontSize: "1.2rem", flexShrink: 0 }}>💡</span>
                <p style={{ flex: 1, margin: 0, fontWeight: 700, color: "var(--ink)", fontSize: "0.95rem", lineHeight: 1.5 }}>
                  Zero Human Company memungkinkan kita membangun perusahaan{" "}
                  <span className="hero-h1-accent">bahkan tanpa manusia.</span>
                </p>
                <a href="#daftar" style={{ width: "40px", height: "40px", borderRadius: "50%", background: "var(--purple)", color: "#fff", display: "grid", placeItems: "center", flexShrink: 0 }} aria-label="Daftar sekarang">
                  <Icon name="arrowRight" size={18} />
                </a>
              </div>
            </div>
          </section>

          {/* Section 2: 6 Karyawan AI (Unified & Harmonized with Brand Palette) */}
          <section className="section" style={{ paddingBottom: "3.5rem" }}>
            <div className="container">
              <div className="section-head center">
                <span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", background: "linear-gradient(135deg, var(--purple), var(--purple-deep))", color: "#fff", fontWeight: 800, fontSize: "0.75rem", letterSpacing: "0.04em", padding: "0.4rem 1rem", borderRadius: "999px", marginBottom: "1.2rem", boxShadow: "0 3px 10px rgba(35,33,118,0.25)" }}>
                  ✨ 6 KARYAWAN AI
                </span>
                <h2 style={{ fontSize: "clamp(1.8rem, 4vw, 2.6rem)", lineHeight: 1.15 }}>
                  6 Karyawan yang<br />
                  <span className="hero-h1-accent">Tetap Bekerja Saat Anda Tidur</span>
                </h2>
                <p style={{ maxWidth: "32rem", marginInline: "auto", color: "var(--ink-soft)" }}>
                  Anda sedang istirahat. Bisnis tetap berjalan — 6 AI Agent yang siap Anda bangun dan jalankan untuk otomatisasi operasional.
                </p>
              </div>

              <div
                style={{
                  marginTop: "2.5rem",
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                  gap: "1.4rem",
                  maxWidth: "68rem",
                  marginInline: "auto",
                }}
              >
                {[
                  {
                    no: "01",
                    title: "Customer Service Agent",
                    accent: "💬",
                    color: "var(--purple)",
                    soft: "var(--purple-soft)",
                    border: "rgba(35, 33, 118, 0.15)",
                    desc: "Menjawab pertanyaan & bantu pelanggan 24/7 tanpa henti lebih cepat.",
                    tasks: ["Menjawab pertanyaan", "Info produk", "Ikuti instruksi bisnis"],
                  },
                  {
                    no: "02",
                    title: "Sales Agent",
                    accent: "🤝",
                    color: "var(--orange)",
                    soft: "var(--orange-soft)",
                    border: "rgba(247, 148, 29, 0.2)",
                    desc: "Menemukan prospek, follow-up, dan menutup penjualan secara otomatis.",
                    tasks: ["Kelola leads", "Follow-up otomatis", "Laporan closing"],
                  },
                  {
                    no: "03",
                    title: "Marketing Agent",
                    accent: "📣",
                    color: "var(--green)",
                    soft: "rgba(23, 160, 94, 0.08)",
                    border: "rgba(23, 160, 94, 0.2)",
                    desc: "Partner riset pasar, rancang strategi promosi, dan kelola campaign.",
                    tasks: ["Riset pasar", "Ide campaign", "Strategi promosi"],
                  },
                  {
                    no: "04",
                    title: "Content Agent",
                    accent: "✍️",
                    color: "var(--purple)",
                    soft: "var(--purple-soft)",
                    border: "rgba(35, 33, 118, 0.15)",
                    desc: "Mempercepat produksi artikel, caption, script, dan konten brand Anda.",
                    tasks: ["Copywriting", "Caption & script", "Content planning"],
                  },
                  {
                    no: "05",
                    title: "Developer Agent",
                    accent: "🔧",
                    color: "var(--orange)",
                    soft: "var(--orange-soft)",
                    border: "rgba(247, 148, 29, 0.2)",
                    desc: "Bantu coding, perbaiki bug, kembangkan fitur, dan kelola website.",
                    tasks: ["Coding & script", "Debugging", "Fitur & website"],
                  },
                  {
                    no: "06",
                    title: "Report Agent",
                    accent: "📊",
                    color: "var(--green)",
                    soft: "rgba(23, 160, 94, 0.08)",
                    border: "rgba(23, 160, 94, 0.2)",
                    desc: "Kumpulkan data, analisis, dan buat laporan akurat setiap hari.",
                    tasks: ["Rangkum aktivitas", "Buat laporan", "Insight bisnis"],
                  },
                ].map((agent, i) => (
                  <div
                    key={i}
                    className="bento"
                    style={{
                      position: "relative",
                      padding: 0,
                      background: "var(--white)",
                      border: "1px solid var(--border)",
                      borderRadius: "20px",
                      overflow: "hidden",
                      display: "flex",
                      flexDirection: "column",
                      boxShadow: "0 10px 30px rgba(35,33,118,0.05)",
                      transition: "transform 0.2s ease, box-shadow 0.2s ease",
                    }}
                  >
                    {/* Top colored accent bar */}
                    <div style={{ height: "4px", background: agent.color }} />

                    <div style={{ padding: "1.6rem 1.4rem", display: "flex", flexDirection: "column", flex: 1 }}>
                      {/* Top Row: Number badge + Robot Avatar */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.2rem" }}>
                        <span
                          style={{
                            width: "32px",
                            height: "32px",
                            borderRadius: "50%",
                            background: agent.color,
                            color: "#fff",
                            fontWeight: 800,
                            fontSize: "0.78rem",
                            display: "grid",
                            placeItems: "center",
                          }}
                        >
                          {agent.no}
                        </span>

                        <div style={{ position: "relative", width: "60px", height: "60px" }}>
                          <div
                            style={{
                              width: "100%",
                              height: "100%",
                              borderRadius: "50%",
                              background: agent.soft,
                              border: `1px solid ${agent.border}`,
                              display: "grid",
                              placeItems: "center",
                              fontSize: "1.8rem",
                            }}
                          >
                            🤖
                          </div>
                          <span
                            style={{
                              position: "absolute",
                              bottom: "-2px",
                              right: "-2px",
                              width: "24px",
                              height: "24px",
                              borderRadius: "50%",
                              background: agent.color,
                              color: "#fff",
                              display: "grid",
                              placeItems: "center",
                              fontSize: "0.75rem",
                              border: "2px solid var(--white)",
                              boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
                            }}
                          >
                            {agent.accent}
                          </span>
                        </div>
                      </div>

                      {/* Title & Desc */}
                      <h3 style={{ fontSize: "1.08rem", fontWeight: 800, margin: "0 0 0.45rem", color: "var(--ink)" }}>
                        {agent.title}
                      </h3>
                      <p style={{ fontSize: "0.86rem", color: "var(--ink-soft)", lineHeight: 1.55, margin: "0 0 1.2rem" }}>
                        {agent.desc}
                      </p>

                      {/* Capabilities / Task Chips */}
                      <div style={{ marginTop: "auto", display: "flex", flexWrap: "wrap", gap: "0.4rem", paddingTop: "0.75rem", borderTop: "1px dashed var(--border)" }}>
                        {agent.tasks.map((task, j) => (
                          <span
                            key={j}
                            style={{
                              fontSize: "0.74rem",
                              fontWeight: 600,
                              background: agent.soft,
                              color: agent.color,
                              border: `1px solid ${agent.border}`,
                              padding: "0.26rem 0.62rem",
                              borderRadius: "999px",
                              letterSpacing: "0.01em",
                            }}
                          >
                            {task}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Bottom workforce banner */}
              <div
                style={{
                  marginTop: "2.2rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                  maxWidth: "38rem",
                  marginInline: "auto",
                  padding: "0.9rem 1.4rem",
                  background: "var(--white)",
                  border: "1px solid var(--border)",
                  borderRadius: "999px",
                  boxShadow: "0 12px 30px rgba(35,33,118,0.08)",
                }}
              >
                <span
                  style={{
                    width: "42px",
                    height: "42px",
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, var(--orange), var(--purple))",
                    color: "#fff",
                    display: "grid",
                    placeItems: "center",
                    fontSize: "1.2rem",
                    flexShrink: 0,
                  }}
                >
                  ⚡
                </span>
                <p style={{ margin: 0, fontWeight: 700, color: "var(--ink)", fontSize: "0.95rem" }}>
                  Enam pekerjaan. Enam AI Agent. <span className="hero-h1-accent">Satu digital workforce.</span>
                </p>
              </div>
            </div>
          </section>

          {/* Section 3: Bukan Sekadar Chatbot */}
          <section className="section" style={{ background: "var(--chip)", paddingBottom: "3.5rem" }}>
            <div className="container">
              <div className="section-head center">
                <span className="type-tag" style={{ marginBottom: "1.2rem", display: "inline-block", background: "var(--purple-soft)", color: "var(--purple)" }}>Bukan Sekadar Chatbot</span>
                <h2 style={{ fontSize: "clamp(1.8rem, 4vw, 2.6rem)" }}>ChatGPT Bisa Menjawab. AI Agent Bisa Bekerja.</h2>
                <p style={{ maxWidth: "34rem", marginInline: "auto", color: "var(--ink-soft)" }}>
                  Chatbot menunggu pertanyaan. AI Agent diberi tujuan, tools, dan workflow untuk menyelesaikan pekerjaan.
                </p>
              </div>

              <div style={{ marginTop: "2.2rem", maxWidth: "300px", marginInline: "auto" }}>
                <Image
                  src="/zhc-whatsapp-demo.webp"
                  alt="Contoh percakapan Sales Agent di WhatsApp"
                  width={500}
                  height={880}
                  style={{ width: "100%", height: "auto", borderRadius: "24px", boxShadow: "0 30px 60px rgba(15,23,42,0.28)" }}
                />
              </div>

              <p style={{ textAlign: "center", marginTop: "2.2rem", color: "var(--ink)", maxWidth: "30rem", marginInline: "auto", fontWeight: 700 }}>
                Anda memberi pekerjaan. Agent yang mengerjakannya — inilah yang akan Anda praktikkan.
              </p>
            </div>
          </section>

          {/* Section 5: Dalam 3 Jam — Timeline */}
          <section className="section" style={{ background: "var(--chip)", paddingBottom: "3.5rem" }}>
            <div className="container">
              <div className="section-head center">
                <h2 style={{ fontSize: "clamp(1.8rem, 4vw, 2.6rem)" }}>Dalam 3 Jam, Anda Membangunnya Sendiri</h2>
                <p style={{ maxWidth: "30rem", marginInline: "auto", color: "var(--ink-soft)" }}>
                  Bukan seminar berisi presentasi — Anda praktik langsung.
                </p>
              </div>

              <div style={{ marginTop: "2.5rem", display: "flex", alignItems: "center", maxWidth: "34rem", marginInline: "auto" }}>
                {["1", "2", "3"].map((n, i) => (
                  <div key={i} style={{ display: "contents" }}>
                    <span style={{
                      width: "40px", height: "40px", borderRadius: "50%", flexShrink: 0,
                      background: [ "var(--purple)", "var(--orange)", "var(--green)" ][i], color: "#fff",
                      fontWeight: 900, fontSize: "1.05rem", display: "grid", placeItems: "center",
                    }}>{n}</span>
                    {i < 2 && <span style={{ flex: 1, height: "3px", background: "var(--border)" }} />}
                  </div>
                ))}
              </div>

              <div style={{ marginTop: "1.2rem", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1.4rem", maxWidth: "60rem", marginInline: "auto" }}>
                {[
                  { title: "Build", color: "var(--purple)", desc: "Bangun AI Agent pertama Anda: identitas, instruksi, tujuan, dan kemampuannya." },
                  { title: "Connect", color: "var(--orange)", desc: "Hubungkan Agent ke workflow dan tools yang dibutuhkan." },
                  { title: "Run", color: "var(--green)", desc: "Jalankan, uji, evaluasi — lalu bangun Agent berikutnya." },
                ].map((step, i) => (
                  <div key={i} className="bento" style={{ padding: "1.6rem", border: "1px solid var(--border)", borderTop: `4px solid ${step.color}`, borderRadius: "var(--r-md)", background: "var(--white)" }}>
                    <p style={{ fontSize: "0.72rem", fontWeight: 800, color: step.color, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.3rem" }}>Jam {i + 1}</p>
                    <h3 style={{ fontSize: "1.1rem", fontWeight: 800, marginBottom: "0.4rem" }}>{step.title}</h3>
                    <p style={{ fontSize: "0.86rem", color: "var(--ink-soft)", lineHeight: 1.55, margin: 0 }}>{step.desc}</p>
                  </div>
                ))}
              </div>
              <p style={{ textAlign: "center", marginTop: "2rem", fontWeight: 800, fontSize: "1.05rem", color: "var(--purple)" }}>
                🎯 Target: 6 AI Agent pertama Anda siap digunakan dan dikembangkan.
              </p>
            </div>
          </section>

          {/* Section 6: Dibangun di Laptop Anda + Trust Badges */}
          <section className="section" style={{ paddingBottom: "3.5rem" }}>
            <div className="container">
              <div className="section-head center">
                <h2 style={{ fontSize: "clamp(1.6rem, 4vw, 2.4rem)" }}>Dibangun di Laptop Anda</h2>
                <p style={{ maxWidth: "32rem", marginInline: "auto", color: "var(--ink-soft)" }}>
                  Anda belajar membangun dan menjalankan AI Agent langsung dari perangkat sendiri — tanpa platform bulanan.
                </p>
              </div>
              <div style={{ marginTop: "2rem", display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: "0.5rem" }}>
                {[
                  { label: "Laptop Anda", icon: "💻" },
                  { label: "AI Model", icon: "🧠" },
                  { label: "Tools", icon: "🛠️" },
                  { label: "Workflow", icon: "🔀" },
                  { label: "AI Agent", icon: "🤖" },
                ].map((step, i, arr) => (
                  <span key={i} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{
                      padding: "0.6rem 1.1rem", borderRadius: "999px", fontSize: "0.9rem", fontWeight: 700,
                      display: "flex", alignItems: "center", gap: "0.5rem",
                      ...(i === arr.length - 1
                        ? { background: "var(--purple)", color: "#fff" }
                        : { background: "var(--purple-soft)", color: "var(--purple)" }),
                    }}>
                      <span>{step.icon}</span>{step.label}
                    </span>
                    {i < arr.length - 1 && <span style={{ color: "var(--ink-faint)" }}>→</span>}
                  </span>
                ))}
              </div>

              <div style={{ marginTop: "2.2rem", display: "flex", justifyContent: "center", gap: "0.7rem", flexWrap: "wrap" }}>
                {[
                  { icon: "🚫", label: "Tanpa coding" },
                  { icon: "🚫", label: "Tanpa langganan bulanan" },
                  { icon: "🚫", label: "Tanpa server berbayar" },
                ].map((b, i) => (
                  <span key={i} style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.85rem", fontWeight: 700, color: "var(--ink)", background: "var(--white)", border: "1px solid var(--border)", padding: "0.5rem 1rem", borderRadius: "999px" }}>
                    <span>{b.icon}</span>{b.label}
                  </span>
                ))}
              </div>
              <p style={{ textAlign: "center", marginTop: "1rem", color: "var(--ink-faint)", fontSize: "0.76rem" }}>
                Model AI: pilihan lokal/gratis tersedia, tergantung kebutuhan & provider.
              </p>
            </div>
          </section>

          {/* Section 6.5: Terhubung ke Tools yang Sudah Anda Pakai (Redesigned with Real Logos) */}
          <section className="section" style={{ background: "var(--chip)", paddingBottom: "3.5rem" }}>
            <div className="container">
              <div className="section-head center">
                <span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", background: "var(--orange)", color: "#fff", fontWeight: 800, fontSize: "0.75rem", letterSpacing: "0.04em", padding: "0.4rem 1rem", borderRadius: "999px", marginBottom: "1.2rem", boxShadow: "0 3px 8px rgba(247,148,29,0.3)" }}>
                  🔗 TERHUBUNG KEMANA SAJA
                </span>
                <h2 style={{ fontSize: "clamp(1.6rem, 4vw, 2.4rem)" }}>
                  Agent Bisa Terhubung ke <span className="hero-h1-accent">Tools yang Sudah Anda Pakai</span>
                </h2>
                <p style={{ maxWidth: "34rem", marginInline: "auto", color: "var(--ink-soft)" }}>
                  Tanpa perlu ganti aplikasi — AI Agent Anda bekerja langsung di ekosistem software yang sudah biasa Anda gunakan setiap hari.
                </p>
              </div>

              <div
                style={{
                  marginTop: "2.5rem",
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "1rem",
                  maxWidth: "68rem",
                  marginInline: "auto",
                }}
              >
                {[
                  {
                    name: "WhatsApp",
                    desc: "Chat prospek, jawab FAQ, dan broadcast update otomatis.",
                    logo: (
                      <svg viewBox="0 0 24 24" width="28" height="28" fill="none">
                        <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.63C8.75 21.42 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.9C17.18 3.03 14.69 2 12.04 2Z" fill="#25D366"/>
                        <path d="M17.47 14.38C17.17 14.23 15.7 13.51 15.43 13.41C15.15 13.31 14.95 13.26 14.75 13.56C14.55 13.86 13.98 14.53 13.8 14.73C13.63 14.93 13.45 14.96 13.15 14.81C12.85 14.66 11.89 14.35 10.75 13.33C9.86 12.54 9.26 11.56 9.09 11.26C8.91 10.96 9.07 10.8 9.22 10.65C9.35 10.52 9.51 10.31 9.66 10.13C9.81 9.96 9.86 9.83 9.96 9.63C10.06 9.43 10.01 9.26 9.94 9.11C9.86 8.96 9.29 7.56 9.06 7C8.83 6.45 8.6 6.53 8.43 6.52C8.27 6.51 8.07 6.51 7.87 6.51C7.67 6.51 7.35 6.58 7.07 6.89C6.8 7.19 6.02 7.92 6.02 9.4C6.02 10.88 7.1 12.31 7.25 12.51C7.4 12.71 9.37 15.75 12.39 17.05C13.11 17.36 13.68 17.55 14.11 17.69C14.83 17.92 15.48 17.89 16 17.81C16.58 17.72 17.79 17.07 18.04 16.37C18.29 15.67 18.29 15.07 18.21 14.94C18.14 14.81 17.94 14.73 17.64 14.58L17.47 14.38Z" fill="white"/>
                      </svg>
                    ),
                  },
                  {
                    name: "Telegram",
                    desc: "Terima perintah, notifikasi instan, & pantau status agent.",
                    logo: (
                      <svg viewBox="0 0 24 24" width="28" height="28" fill="none">
                        <circle cx="12" cy="12" r="12" fill="#229ED9"/>
                        <path d="M5.4 11.9L17.6 7.2C18.2 6.95 18.7 7.32 18.5 8.15L16.4 18.05C16.25 18.75 15.8 18.92 15.2 18.58L12 16.22L10.45 17.71C10.28 17.88 10.13 18.03 9.8 18.03L10.03 14.73L16.03 9.31C16.29 9.08 15.97 8.95 15.63 9.18L8.21 13.85L5.02 12.85C4.33 12.63 4.31 12.16 5.4 11.9Z" fill="white"/>
                      </svg>
                    ),
                  },
                  {
                    name: "Slack",
                    desc: "Kirim laporan harian, insight bisnis, & alert ke channel tim.",
                    logo: (
                      <svg viewBox="0 0 24 24" width="28" height="28" fill="none">
                        <path d="M5.04 14.5a2.52 2.52 0 0 1-2.52-2.52c0-1.39 1.13-2.52 2.52-2.52h2.52v2.52c0 1.39-1.13 2.52-2.52 2.52z" fill="#E01E5A"/>
                        <path d="M8.82 14.5c1.39 0 2.52-1.13 2.52-2.52V5.04A2.52 2.52 0 0 0 8.82 2.52a2.52 2.52 0 0 0-2.52 2.52v6.94c0 1.39 1.13 2.52 2.52 2.52z" fill="#E01E5A"/>
                        <path d="M9.5 5.04a2.52 2.52 0 0 1 2.52-2.52c1.39 0 2.52 1.13 2.52 2.52v2.52h-2.52c-1.39 0-2.52-1.13-2.52-2.52z" fill="#36C5F0"/>
                        <path d="M9.5 8.82c0 1.39 1.13 2.52 2.52 2.52h6.94a2.52 2.52 0 0 0 2.52-2.52 2.52 2.52 0 0 0-2.52-2.52H12.02c-1.39 0-2.52 1.13-2.52 2.52z" fill="#36C5F0"/>
                        <path d="M18.96 9.5c1.39 0 2.52 1.13 2.52 2.52 0 1.39-1.13 2.52-2.52 2.52h-2.52V9.5h2.52z" fill="#2EB67D"/>
                        <path d="M15.18 9.5c-1.39 0-2.52 1.13-2.52 2.52v6.94a2.52 2.52 0 0 0 2.52 2.52 2.52 2.52 0 0 0 2.52-2.52V12.02c0-1.39-1.13-2.52-2.52-2.52z" fill="#2EB67D"/>
                        <path d="M14.5 18.96a2.52 2.52 0 0 1-2.52 2.52c-1.39 0-2.52-1.13-2.52-2.52v-2.52h2.52c1.39 0 2.52 1.13 2.52 2.52z" fill="#ECB22E"/>
                        <path d="M14.5 15.18c0-1.39-1.13-2.52-2.52-2.52H5.04A2.52 2.52 0 0 0 2.52 15.18a2.52 2.52 0 0 0 2.52 2.52h6.94c1.39 0 2.52-1.13 2.52-2.52z" fill="#ECB22E"/>
                      </svg>
                    ),
                  },
                  {
                    name: "Google Sheets",
                    desc: "Catat lead, rekap transaksi, & update spreadsheet otomatis.",
                    logo: (
                      <svg viewBox="0 0 24 24" width="28" height="28" fill="none">
                        <path d="M14.5 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V7.5L14.5 2Z" fill="#0F9D58"/>
                        <path d="M14 2V8H20" fill="#87CEAB"/>
                        <path d="M8 12H16V18H8V12Z" fill="white" opacity="0.95"/>
                        <path d="M8 14H16M8 16H16M12 12V18" stroke="#0F9D58" strokeWidth="1.2"/>
                      </svg>
                    ),
                  },
                  {
                    name: "Google Docs",
                    desc: "Tulis draft artikel, proposal, & dokumen bisnis instan.",
                    logo: (
                      <svg viewBox="0 0 24 24" width="28" height="28" fill="none">
                        <path d="M14.5 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V7.5L14.5 2Z" fill="#4285F4"/>
                        <path d="M14 2V8H20" fill="#A1C2FA"/>
                        <path d="M8 12H16M8 15H16M8 18H13" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    ),
                  },
                  {
                    name: "Google Drive",
                    desc: "Baca file SOP, simpan dokumen kerja, & kelola folder cloud.",
                    logo: (
                      <svg viewBox="0 0 24 24" width="28" height="28" fill="none">
                        <path d="M8.27 2L15.73 2L22 13L14.54 13L8.27 2Z" fill="#FFBA00"/>
                        <path d="M2 13L5.73 19.5L13.19 19.5L9.46 13L2 13Z" fill="#0066DA"/>
                        <path d="M15.73 2L9.46 13L13.19 19.5L19.46 8.5L15.73 2Z" fill="#00AC47"/>
                        <path d="M2 13L8.27 2L12 8.5L5.73 19.5L2 13Z" fill="#2684FC"/>
                      </svg>
                    ),
                  },
                  {
                    name: "Gmail & Email",
                    desc: "Kirim email konfirmasi, penawaran, & follow-up pelanggan.",
                    logo: (
                      <svg viewBox="0 0 24 24" width="28" height="28" fill="none">
                        <path d="M20 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6C22 4.9 21.1 4 20 4Z" fill="#EA4335"/>
                        <path d="M20 4L12 11.5L4 4H20Z" fill="#BB001B"/>
                        <path d="M2 6L12 13.5L22 6V18H2V6Z" fill="#F2F2F2"/>
                        <path d="M2 6L12 13.5L22 6" stroke="#D93025" strokeWidth="1.5"/>
                      </svg>
                    ),
                  },
                  {
                    name: "Google Calendar",
                    desc: "Atur jadwal meeting, booking sesi, & kirim reminder otomatis.",
                    logo: (
                      <svg viewBox="0 0 24 24" width="28" height="28" fill="none">
                        <rect x="3" y="4" width="18" height="17" rx="3" fill="white" stroke="#4285F4" strokeWidth="2"/>
                        <path d="M3 8H21" stroke="#4285F4" strokeWidth="2"/>
                        <rect x="7" y="2" width="2" height="4" rx="1" fill="#4285F4"/>
                        <rect x="15" y="2" width="2" height="4" rx="1" fill="#4285F4"/>
                        <text x="12" y="16.5" textAnchor="middle" fill="#4285F4" fontSize="8" fontWeight="bold" fontFamily="sans-serif">31</text>
                      </svg>
                    ),
                  },
                  {
                    name: "Notion",
                    desc: "Akses knowledge base, wiki SOP, & update task manajemen.",
                    logo: (
                      <svg viewBox="0 0 24 24" width="28" height="28" fill="none">
                        <rect width="24" height="24" rx="6" fill="#000000"/>
                        <path d="M6 6.5L8.5 6L17.5 6.5L18 8L16.5 8.5V17L13.5 17.5L9.5 11V16.5L11 17.5L6.5 17.5L6 16L7.5 15.5V8.5L6 8L6 6.5ZM13.5 8.5L9.5 14.5V8.5H13.5Z" fill="white"/>
                      </svg>
                    ),
                  },
                  {
                    name: "Database & API",
                    desc: "Sinkronisasi ke CRM, PostgreSQL, Airtable, & Webhook bisnis.",
                    logo: (
                      <svg viewBox="0 0 24 24" width="28" height="28" fill="none">
                        <path d="M12 2C6.5 2 2 3.8 2 6V18C2 20.2 6.5 22 12 22C17.5 22 22 20.2 22 18V6C22 3.8 17.5 2 12 2Z" fill="#232176" opacity="0.1"/>
                        <ellipse cx="12" cy="6" rx="9" ry="3.5" stroke="var(--purple)" strokeWidth="2" fill="none"/>
                        <path d="M3 6V12C3 13.93 7.03 15.5 12 15.5C16.97 15.5 21 13.93 21 12V6" stroke="var(--purple)" strokeWidth="2" fill="none"/>
                        <path d="M3 12V18C3 19.93 7.03 21.5 12 21.5C16.97 21.5 21 19.93 21 18V12" stroke="var(--purple)" strokeWidth="2" fill="none"/>
                      </svg>
                    ),
                  },
                ].map((tool, i) => (
                  <div
                    key={i}
                    className="bento"
                    style={{
                      background: "var(--white)",
                      border: "1px solid var(--border)",
                      borderRadius: "18px",
                      padding: "1.25rem 1.15rem",
                      display: "flex",
                      flexDirection: "column",
                      boxShadow: "0 6px 20px rgba(35,33,118,0.03)",
                      transition: "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.85rem" }}>
                      <div
                        style={{
                          width: "48px",
                          height: "48px",
                          borderRadius: "12px",
                          display: "grid",
                          placeItems: "center",
                          background: "#fff",
                          border: "1px solid var(--border)",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                        }}
                      >
                        {tool.logo}
                      </div>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.3rem",
                          fontSize: "0.68rem",
                          fontWeight: 700,
                          color: "var(--green)",
                          background: "rgba(23, 160, 94, 0.08)",
                          padding: "0.2rem 0.55rem",
                          borderRadius: "999px",
                        }}
                      >
                        <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--green)" }} />
                        Terhubung
                      </span>
                    </div>

                    <h3 style={{ fontSize: "0.98rem", fontWeight: 800, margin: "0 0 0.3rem", color: "var(--ink)" }}>
                      {tool.name}
                    </h3>
                    <p style={{ fontSize: "0.78rem", color: "var(--ink-soft)", lineHeight: 1.45, margin: 0 }}>
                      {tool.desc}
                    </p>
                  </div>
                ))}
              </div>

              {/* Bottom Summary Banner */}
              <div
                style={{
                  marginTop: "2.2rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                  maxWidth: "38rem",
                  marginInline: "auto",
                  padding: "0.9rem 1.4rem",
                  background: "var(--white)",
                  border: "1px solid var(--border)",
                  borderRadius: "999px",
                  boxShadow: "0 12px 30px rgba(35,33,118,0.08)",
                }}
              >
                <span
                  style={{
                    width: "42px",
                    height: "42px",
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, var(--orange), var(--purple))",
                    color: "#fff",
                    display: "grid",
                    placeItems: "center",
                    fontSize: "1.2rem",
                    flexShrink: 0,
                  }}
                >
                  ⚡
                </span>
                <p style={{ margin: 0, fontWeight: 700, color: "var(--ink)", fontSize: "0.92rem" }}>
                  Semua tools terhubung. Agent bekerja otomatis, <span className="hero-h1-accent">Anda fokus ke hal penting.</span>
                </p>
              </div>
            </div>
          </section>

          {/* Section 7: Anda Pulang Membawa Karyawan AI (Redesigned with Contextual Icons) */}
          <section className="section" style={{ background: "var(--chip)", paddingBottom: "3.5rem" }}>
            <div className="container">
              <div className="section-head center">
                <span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", background: "var(--purple-soft)", color: "var(--purple)", fontWeight: 800, fontSize: "0.75rem", letterSpacing: "0.04em", padding: "0.4rem 1rem", borderRadius: "999px", marginBottom: "1.2rem" }}>
                  🎁 FASILITAS LENGKAP WORKSHOP
                </span>
                <h2 style={{ fontSize: "clamp(1.6rem, 4vw, 2.4rem)" }}>
                  Anda Tidak Pulang Membawa Slide.<br />
                  <span className="hero-h1-accent">Anda Pulang Membawa Karyawan AI.</span>
                </h2>
                <p style={{ maxWidth: "32rem", marginInline: "auto", color: "var(--ink-soft)" }}>
                  Semua aset, tools, dan akses langsung siap pakai dan menjadi milik Anda seumur hidup.
                </p>
              </div>

              <div
                style={{
                  marginTop: "2.5rem",
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "1rem",
                  maxWidth: "68rem",
                  marginInline: "auto",
                }}
              >
                {[
                  {
                    title: "6 AI Agent Siap Pakai",
                    desc: "Langsung aktif & siap bekerja untuk operasional bisnis Anda.",
                    color: "var(--purple)",
                    soft: "var(--purple-soft)",
                    icon: (
                      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="10" rx="2"/>
                        <circle cx="12" cy="5" r="2"/>
                        <path d="M12 7v4"/>
                        <line x1="8" y1="16" x2="8.01" y2="16"/>
                        <line x1="16" y1="16" x2="16.01" y2="16"/>
                      </svg>
                    ),
                  },
                  {
                    title: "Rekaman Workshop",
                    desc: "Akses seumur hidup untuk dipelajari & dipraktikkan ulang kapan saja.",
                    color: "var(--orange)",
                    soft: "var(--orange-soft)",
                    icon: (
                      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="23 7 16 12 23 17 23 7"/>
                        <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                      </svg>
                    ),
                  },
                  {
                    title: "Buku Manual & Panduan",
                    desc: "Dokumentasi SOP lengkap langkah demi langkah untuk setiap agent.",
                    color: "var(--green)",
                    soft: "rgba(23, 160, 94, 0.1)",
                    icon: (
                      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                        <line x1="8" y1="7" x2="16" y2="7"/>
                        <line x1="8" y1="11" x2="14" y2="11"/>
                      </svg>
                    ),
                  },
                  {
                    title: "Komunitas Alumni Eksklusif",
                    desc: "Wadah diskusi, sharing update tools AI terbaru, & networking bisnis.",
                    color: "var(--purple)",
                    soft: "var(--purple-soft)",
                    icon: (
                      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                        <circle cx="9" cy="7" r="4"/>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                      </svg>
                    ),
                  },
                  {
                    title: "e-Sertifikat Resmi",
                    desc: "Bukti kelulusan dan penguasaan AI Agent bersertifikasi resmi.",
                    color: "var(--orange)",
                    soft: "var(--orange-soft)",
                    icon: (
                      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="8" r="6"/>
                        <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>
                      </svg>
                    ),
                  },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="bento"
                    style={{
                      background: "var(--white)",
                      border: "1px solid var(--border)",
                      borderRadius: "18px",
                      padding: "1.4rem 1.2rem",
                      display: "flex",
                      flexDirection: "column",
                      boxShadow: "0 6px 20px rgba(35,33,118,0.03)",
                      transition: "transform 0.2s ease, box-shadow 0.2s ease",
                    }}
                  >
                    <div
                      style={{
                        width: "46px",
                        height: "46px",
                        borderRadius: "12px",
                        background: item.soft,
                        color: item.color,
                        display: "grid",
                        placeItems: "center",
                        marginBottom: "1rem",
                      }}
                    >
                      {item.icon}
                    </div>
                    <h3 style={{ fontSize: "0.98rem", fontWeight: 800, margin: "0 0 0.35rem", color: "var(--ink)" }}>
                      {item.title}
                    </h3>
                    <p style={{ fontSize: "0.8rem", color: "var(--ink-soft)", lineHeight: 1.5, margin: 0 }}>
                      {item.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Section 8: Berapa Nilai 6 Karyawan AI */}
          <section className="section" style={{ paddingBottom: "3.5rem" }}>
            <div className="container">
              <div className="bento" style={{ padding: "clamp(1.8rem, 4vw, 2.6rem)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", background: "var(--white)", marginBottom: "1.6rem" }}>
                <div className="section-head center" style={{ marginBottom: "1.4rem" }}>
                  <h3 style={{ fontSize: "clamp(1.25rem, 2.8vw, 1.7rem)", lineHeight: 1.35 }}>
                    Hire 6 Karyawan? Siapkan <span style={{ color: "#e74c3c" }}>±Rp29 Juta/bulan</span>.
                    <br />
                    Bangun 6 AI Agent? <span style={{ color: "var(--green)" }}>Rp225.000 Sekali.</span> 🚀
                  </h3>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem", minWidth: "420px" }}>
                    <thead>
                      <tr style={{ borderBottom: "2px solid var(--border)" }}>
                        <th style={{ textAlign: "left", padding: "0.7rem 0.8rem", fontWeight: 700, color: "var(--ink)" }}>Posisi (kisaran UMR)</th>
                        <th style={{ textAlign: "center", padding: "0.7rem 0.8rem", fontWeight: 700, color: "#e74c3c" }}>Gaji/bulan</th>
                        <th style={{ textAlign: "center", padding: "0.7rem 0.8rem", fontWeight: 700, color: "var(--green)" }}>AI Agent (sekali bayar)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { posisi: "Customer Service", gaji: "4jt", agent: "CS Agent ✅" },
                        { posisi: "Sales", gaji: "5jt", agent: "Sales Agent ✅" },
                        { posisi: "Marketing", gaji: "5jt", agent: "Marketing Agent ✅" },
                        { posisi: "Content Writer", gaji: "4jt", agent: "Content Agent ✅" },
                        { posisi: "Programmer", gaji: "7jt", agent: "Developer Agent ✅" },
                        { posisi: "Admin & Laporan", gaji: "4jt", agent: "Report Agent ✅" },
                      ].map((row, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "transparent" : "var(--chip)" }}>
                          <td style={{ padding: "0.7rem 0.8rem", fontWeight: 600, color: "var(--ink)" }}>{row.posisi}</td>
                          <td style={{ textAlign: "center", padding: "0.7rem 0.8rem", fontWeight: 700, color: "#e74c3c" }}>Rp{row.gaji}</td>
                          <td style={{ textAlign: "center", padding: "0.7rem 0.8rem", color: "var(--green)", fontWeight: 600 }}>{row.agent}</td>
                        </tr>
                      ))}
                      <tr style={{ background: "rgba(23,160,94,0.06)", borderTop: "2px solid var(--green)" }}>
                        <td style={{ padding: "0.9rem 0.8rem", fontWeight: 800, fontSize: "1rem", color: "var(--ink)" }}>TOTAL/bulan</td>
                        <td style={{ textAlign: "center", padding: "0.9rem 0.8rem", fontWeight: 900, fontSize: "1.15rem", color: "#e74c3c" }}>±Rp29jt</td>
                        <td style={{ textAlign: "center", padding: "0.9rem 0.8rem", fontWeight: 800, fontSize: "1rem", color: "var(--green)" }}>
                          Rp225rb <span style={{ fontSize: "0.72rem", fontWeight: 500, color: "var(--ink-faint)" }}>SEKALI</span> 🚀
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p style={{ textAlign: "center", marginTop: "0.5rem", color: "var(--ink-faint)", fontSize: "0.72rem" }}>
                  ← Geser tabel untuk lihat semua kolom →
                </p>
                <p style={{ textAlign: "center", marginTop: "1rem", fontSize: "0.78rem", color: "var(--ink-faint)" }}>
                  *Estimasi berdasarkan kisaran UMR & standar upah posisi terkait di Indonesia — dapat berbeda tergantung wilayah dan pengalaman.
                </p>
              </div>

              <div className="bento" style={{ padding: "clamp(2rem, 5vw, 3rem)", textAlign: "center", background: "linear-gradient(150deg, #1e1b4b 0%, #0f172a 100%)", color: "#fff", borderRadius: "var(--r-lg)", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", width: "400px", height: "400px", borderRadius: "50%", background: "radial-gradient(circle, rgba(247,148,29,0.15) 0%, transparent 70%)", top: "-150px", right: "-100px", pointerEvents: "none" }} />
                <h2 style={{ fontSize: "clamp(1.6rem, 4vw, 2.4rem)", position: "relative", color: "#fff" }}>Berapa Nilai 6 Karyawan AI?</h2>
                <p style={{ maxWidth: "30rem", marginInline: "auto", color: "rgba(255,255,255,0.7)", position: "relative" }}>
                  Untuk keenam pekerjaan ini, Anda biasanya butuh banyak tenaga, waktu, dan biaya:
                </p>
                <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "0.5rem", marginTop: "1rem", position: "relative" }}>
                  {["💬 CS", "🤝 Sales", "📣 Marketing", "✍️ Content", "🔧 Developer", "📊 Report"].map((t, i) => (
                    <span key={i} style={{ fontSize: "0.78rem", fontWeight: 700, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)", padding: "0.3rem 0.7rem", borderRadius: "999px" }}>{t}</span>
                  ))}
                </div>
                <p style={{ fontWeight: 800, color: "#fff", fontSize: "1.05rem", position: "relative", marginTop: "1.2rem" }}>
                  Zero Human Company beda: Anda tidak merekrut 6 orang — Anda belajar membangun 6 AI Agent.
                </p>
                <span style={{ display: "inline-block", marginTop: "1.4rem", position: "relative", background: "rgba(247,148,29,0.15)", border: "1px solid rgba(247,148,29,0.4)", color: "var(--orange)", fontWeight: 800, fontSize: "0.78rem", letterSpacing: "0.04em", padding: "0.35rem 0.9rem", borderRadius: "999px" }}>
                  🔥 PROMO HARI INI — HARGA TERMURAH
                </span>
                <div style={{ display: "flex", justifyContent: "center", alignItems: "baseline", gap: "0.7rem", marginTop: "0.9rem", flexWrap: "wrap", position: "relative" }}>
                  <span style={{ fontSize: "clamp(2rem, 5vw, 2.6rem)", fontWeight: 900, color: "var(--orange)" }}>Rp225.000</span>
                  <span className="prg-hero-strike">Rp490.000</span>
                  <span className="eb-save">Hemat 54%</span>
                </div>
                <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.6)", position: "relative" }}>Sekali bayar. Tanpa langganan platform AI Agent dari Jetschool.</p>
                <a href="#daftar" className="btn btn-purple btn-lg" style={{ marginTop: "0.8rem", display: "inline-flex", maxWidth: "100%", position: "relative", background: "var(--orange)", whiteSpace: "normal", textAlign: "center", lineHeight: 1.25 }}>
                  🚀 Saya Mau Membangun 6 Karyawan AI
                </a>
                <p style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.35)", marginTop: "0.8rem", position: "relative" }}>
                  *Harga promo sewaktu-waktu dapat berubah.
                </p>
              </div>
            </div>
          </section>

          {/* Section 9: Apakah Zero Human Company Untuk Anda (Redesigned) */}
          <section className="section" style={{ background: "var(--chip)", paddingBottom: "3.5rem" }}>
            <div className="container">
              <div className="section-head center">
                <span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", background: "var(--purple-soft)", color: "var(--purple)", fontWeight: 800, fontSize: "0.75rem", letterSpacing: "0.04em", padding: "0.4rem 1rem", borderRadius: "999px", marginBottom: "1.2rem" }}>
                  🎯 TARGET AUDIENCE
                </span>
                <h2 style={{ fontSize: "clamp(1.6rem, 4vw, 2.4rem)" }}>
                  Apakah Zero Human Company <span className="hero-h1-accent">Cocok untuk Anda?</span>
                </h2>
                <p style={{ maxWidth: "34rem", marginInline: "auto", color: "var(--ink-soft)" }}>
                  Dirancang untuk siapapun yang ingin mengotomatiskan rutinitas dan melipatgandakan hasil bisnis tanpa beban operasional tim yang besar.
                </p>
              </div>

              <div
                style={{
                  marginTop: "2.5rem",
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                  gap: "1.2rem",
                  maxWidth: "68rem",
                  marginInline: "auto",
                }}
              >
                {[
                  {
                    title: "Owner Bisnis & Founder",
                    desc: "Miliki 6 karyawan digital otonom yang bekerja 24/7 tanpa menambah beban gaji bulanan, tunjangan & BPJS.",
                    tag: "⚡ Efisiensi Biaya Operasional",
                    color: "var(--purple)",
                    soft: "var(--purple-soft)",
                    icon: (
                      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                        <polyline points="16 11 18 13 22 9"/>
                      </svg>
                    ),
                  },
                  {
                    title: "Pelaku UMKM",
                    desc: "Kapasitas kerja setara tim korporasi besar tanpa perlu rekrut banyak staf dan bayar sewa kantor mahal.",
                    tag: "🏪 Skala Bisnis Instan",
                    color: "var(--orange)",
                    soft: "var(--orange-soft)",
                    icon: (
                      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                        <polyline points="9 22 9 12 15 12 15 22"/>
                      </svg>
                    ),
                  },
                  {
                    title: "Startup & Tech Business",
                    desc: "Operasional super lean — tim inti bisa 100% fokus ke inovasi produk & pertumbuhan market, bukan urus administrasi.",
                    tag: "🚀 Lean & Fast Execution",
                    color: "var(--green)",
                    soft: "rgba(23, 160, 94, 0.1)",
                    icon: (
                      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>
                        <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>
                        <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/>
                        <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
                      </svg>
                    ),
                  },
                  {
                    title: "Profesional & Freelancer",
                    desc: "Kerja solo terasa ringan karena ada asisten digital yang mengurus chat klien, riset, proposal, dan follow-up.",
                    tag: "💼 Hemat 15+ Jam/Minggu",
                    color: "var(--purple)",
                    soft: "var(--purple-soft)",
                    icon: (
                      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                      </svg>
                    ),
                  },
                  {
                    title: "Marketer & Tim Sales",
                    desc: "Riset tren pasar, pembuatan copywriting promosi, hingga follow-up prospek berjalan otomatis tanpa jeda.",
                    tag: "📈 Otomasi Funnel & Closing",
                    color: "var(--orange)",
                    soft: "var(--orange-soft)",
                    icon: (
                      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
                        <polyline points="16 7 22 7 22 13"/>
                      </svg>
                    ),
                  },
                  {
                    title: "Pelajar & Tech Enthusiast",
                    desc: "Belajar langsung cara membangun arsitektur AI Agent masa depan secara hands-on dan aplikatif, bukan cuma teori.",
                    tag: "🎓 Skill Masa Depan",
                    color: "var(--green)",
                    soft: "rgba(23, 160, 94, 0.1)",
                    icon: (
                      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
                        <path d="M6 12v5c3 3 9 3 12 0v-5"/>
                      </svg>
                    ),
                  },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="bento"
                    style={{
                      background: "var(--white)",
                      border: "1px solid var(--border)",
                      borderRadius: "20px",
                      padding: "1.6rem 1.4rem",
                      display: "flex",
                      flexDirection: "column",
                      boxShadow: "0 8px 24px rgba(35,33,118,0.04)",
                      transition: "transform 0.2s ease, box-shadow 0.2s ease",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
                      <div
                        style={{
                          width: "46px",
                          height: "46px",
                          borderRadius: "14px",
                          background: item.soft,
                          color: item.color,
                          display: "grid",
                          placeItems: "center",
                        }}
                      >
                        {item.icon}
                      </div>
                      <span
                        style={{
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          color: item.color,
                          background: item.soft,
                          padding: "0.28rem 0.65rem",
                          borderRadius: "999px",
                        }}
                      >
                        {item.tag}
                      </span>
                    </div>

                    <h3 style={{ fontSize: "1.08rem", fontWeight: 800, margin: "0 0 0.45rem", color: "var(--ink)" }}>
                      {item.title}
                    </h3>
                    <p style={{ fontSize: "0.84rem", color: "var(--ink-soft)", lineHeight: 1.55, margin: 0 }}>
                      {item.desc}
                    </p>
                  </div>
                ))}
              </div>

              {/* Bottom Reassurance Banner */}
              <div
                style={{
                  marginTop: "2.2rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                  maxWidth: "42rem",
                  marginInline: "auto",
                  padding: "0.9rem 1.4rem",
                  background: "var(--white)",
                  border: "1px solid var(--border)",
                  borderRadius: "999px",
                  boxShadow: "0 12px 30px rgba(35,33,118,0.08)",
                }}
              >
                <span
                  style={{
                    width: "42px",
                    height: "42px",
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, var(--orange), var(--purple))",
                    color: "#fff",
                    display: "grid",
                    placeItems: "center",
                    fontSize: "1.2rem",
                    flexShrink: 0,
                  }}
                >
                  💡
                </span>
                <p style={{ margin: 0, fontWeight: 700, color: "var(--ink)", fontSize: "0.92rem", lineHeight: 1.45 }}>
                  Tidak perlu latar belakang coding. <span className="hero-h1-accent">Yang penting kemauan untuk membangun dan bertumbuh.</span>
                </p>
              </div>
            </div>
          </section>

          {/* Section 10: Mengapa Sekarang */}
          <section className="section" style={{ paddingBottom: "3.5rem" }}>
            <div className="container">
              <div className="section-head center" style={{ maxWidth: "34rem", marginInline: "auto" }}>
                <h2 style={{ fontSize: "clamp(1.6rem, 4vw, 2.4rem)" }}>Mengapa Sekarang?</h2>
                <p style={{ color: "var(--ink-soft)", lineHeight: 1.7 }}>
                  AI berkembang dari sekadar menjawab menjadi Agent yang bisa mengerjakan pekerjaan — dan mulai membentuk cara bisnis bekerja.
                </p>
              </div>
              <div className="bento" style={{ maxWidth: "34rem", marginInline: "auto", marginTop: "1.8rem", padding: "2rem", background: "var(--chip)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", textAlign: "center" }}>
                <p style={{ fontSize: "0.8rem", fontWeight: 800, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.4rem" }}>Pertanyaannya bukan lagi</p>
                <p style={{ fontStyle: "italic", color: "var(--ink-faint)", textDecoration: "line-through", fontSize: "1rem", marginBottom: "1.2rem" }}>&ldquo;Apakah saya perlu menggunakan AI?&rdquo;</p>
                <p style={{ fontSize: "0.8rem", fontWeight: 800, color: "var(--purple)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.4rem" }}>Tetapi</p>
                <p style={{ fontWeight: 900, fontSize: "1.3rem", color: "var(--ink)", margin: 0 }}>
                  &ldquo;Berapa banyak pekerjaan yang masih saya kerjakan sendiri?&rdquo;
                </p>
              </div>
            </div>
          </section>

          {/* Section 11: Philosophy Closing */}
          <section className="section" style={{ paddingBottom: "3.5rem" }}>
            <div className="container">
              <div className="bento" style={{ padding: "clamp(2rem, 5vw, 3rem)", textAlign: "center", background: "linear-gradient(150deg, #1e1b4b 0%, #0f172a 100%)", color: "#fff", borderRadius: "var(--r-lg)", position: "relative", overflow: "hidden", boxShadow: "0 30px 60px rgba(15, 23, 42, 0.25)" }}>
                <div style={{ position: "absolute", width: "500px", height: "500px", borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 70%)", top: "-200px", right: "-150px", pointerEvents: "none" }} />
                {/* dot-grid decoration, pojok kiri & kanan atas */}
                <div style={{ position: "absolute", top: "1.6rem", left: "1.6rem", width: "70px", height: "46px", backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.18) 1.5px, transparent 1.5px)", backgroundSize: "12px 12px", pointerEvents: "none" }} />
                <div style={{ position: "absolute", top: "1.6rem", right: "1.6rem", width: "70px", height: "46px", backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.18) 1.5px, transparent 1.5px)", backgroundSize: "12px 12px", pointerEvents: "none" }} />

                <h2 style={{ fontSize: "clamp(1.5rem, 3.5vw, 2.2rem)", lineHeight: 1.4, color: "#fff", position: "relative" }}>
                  Bukan tentang <span style={{ color: "#f472b6" }}>menghilangkan</span> manusia.<br />
                  Tentang <span style={{ color: "#38bdf8" }}>membebaskan manusia</span> dari pekerjaan yang tidak perlu dikerjakan manusia.
                </h2>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", marginTop: "1.6rem", position: "relative" }}>
                  <span style={{ width: "56px", height: "2px", background: "linear-gradient(90deg, transparent, #f472b6)" }} />
                  <span style={{ display: "flex", gap: "5px" }}>
                    <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#f472b6" }} />
                    <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#a78bfa" }} />
                    <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#38bdf8" }} />
                  </span>
                  <span style={{ width: "56px", height: "2px", background: "linear-gradient(90deg, #38bdf8, transparent)" }} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1.2rem", marginTop: "2rem", textAlign: "left", maxWidth: "38rem", marginInline: "auto", position: "relative" }}>
                  <div style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.3)", borderRadius: "var(--r-md)", padding: "1.3rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.9rem" }}>
                      <span style={{ width: "34px", height: "34px", borderRadius: "50%", background: "linear-gradient(135deg, #a855f7, #7c3aed)", display: "grid", placeItems: "center", fontSize: "1rem", flexShrink: 0 }}>🧑</span>
                      <b style={{ color: "#fff", fontSize: "1rem" }}>Manusia:</b>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      {[
                        { icon: "🧠", text: "Berpikir. Memimpin." },
                        { icon: "❤️", text: "Memutuskan. Membangun hubungan." },
                        { icon: "⭐", text: "Mencipta." },
                      ].map((item, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.6rem", background: "rgba(255,255,255,0.05)", borderRadius: "var(--r-sm)", padding: "0.6rem 0.8rem" }}>
                          <span style={{ fontSize: "0.9rem" }}>{item.icon}</span>
                          <span style={{ color: "rgba(255,255,255,0.75)", fontSize: "0.86rem" }}>{item.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.3)", borderRadius: "var(--r-md)", padding: "1.3rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.9rem" }}>
                      <span style={{ width: "34px", height: "34px", borderRadius: "50%", background: "linear-gradient(135deg, #38bdf8, #2563eb)", display: "grid", placeItems: "center", fontSize: "1rem", flexShrink: 0 }}>🤖</span>
                      <b style={{ color: "#fff", fontSize: "1rem" }}>AI:</b>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      {[
                        { icon: "📊", text: "Mencari. Menganalisis." },
                        { icon: "📄", text: "Menulis. Mengikuti workflow." },
                        { icon: "🔄", text: "Mengerjakan yang repetitif." },
                      ].map((item, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.6rem", background: "rgba(255,255,255,0.05)", borderRadius: "var(--r-sm)", padding: "0.6rem 0.8rem" }}>
                          <span style={{ fontSize: "0.9rem" }}>{item.icon}</span>
                          <span style={{ color: "rgba(255,255,255,0.75)", fontSize: "0.86rem" }}>{item.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.8rem", marginTop: "2.2rem", position: "relative", flexWrap: "wrap" }}>
                  <span style={{ display: "flex", gap: "6px" }}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <span key={i} style={{ width: "4px", height: "4px", borderRadius: "50%", background: "rgba(247,148,29,0.5)" }} />
                    ))}
                  </span>
                  <span style={{ width: "40px", height: "40px", borderRadius: "50%", background: "var(--orange)", display: "grid", placeItems: "center", fontSize: "1.1rem", flexShrink: 0, boxShadow: "0 0 20px rgba(247,148,29,0.5)" }}>⚡</span>
                  <p style={{ fontWeight: 900, fontSize: "1.15rem", color: "var(--orange)", margin: 0 }}>
                    MANUSIA MEMIMPIN. AI BEKERJA.
                  </p>
                  <span style={{ display: "flex", gap: "6px" }}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <span key={i} style={{ width: "4px", height: "4px", borderRadius: "50%", background: "rgba(247,148,29,0.5)" }} />
                    ))}
                  </span>
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      {/* ===== VALUE STACK + MATERI ===== */}
      <section className="section">
        <div className="container">
          <div className="hero-card">
            <div className="bento reveal">
              <h2 style={{ marginBottom: "1.2rem" }}>Yang Anda <span className="acc-p">terima</span></h2>
              <ValueStack
                deliverables={isZeroHuman ? [
                  { label: "Praktik langsung bangun 6 AI Agent (CS, Sales, Marketing, Content, Developer, Report)", value: 299000 },
                  { label: "AI Agent Environment, Tools & Workflow Dasar", value: 199000 },
                  { label: "Rekaman Workshop + Panduan Pengembangan", value: 149000 },
                  { label: "e-Sertifikat Resmi + Komunitas Alumni", value: 0 },
                ] : program.deliverables}
                price={isFree ? 0 : program.price}
                priceOld={isFree ? null : program.priceOld}
                ctaHref="#daftar"
                ctaLabel={isZeroHuman ? "Pulang Bawa 6 Karyawan AI" : (isFree ? "Ikuti Sesi Gratis" : "Daftar Sekarang")}
                isFree={isFree}
              />
              {isFree && (
                <p className="reg-note">* Seluruh fasilitas di atas dapat diakses secara gratis oleh peserta webinar.</p>
              )}
              {isZeroHuman && (
                <div style={{ marginTop: "1rem", padding: "0.8rem 1rem", background: "rgba(46, 204, 113, 0.06)", borderLeft: "3px solid #27ae60", borderRadius: "0 10px 10px 0" }}>
                  <p style={{ margin: 0, fontSize: "0.88rem", fontWeight: 700, color: "#27ae60" }}>
                    🎓 Plus akses grup alumni — diskusi, tanya jawab, & update AI Agent bersama peserta lain setelah workshop selesai.
                  </p>
                </div>
              )}
            </div>
            <div className="bento reveal">
              <h2 style={{ marginBottom: "1.2rem" }}>Yang Anda <span className="acc-o">pelajari</span></h2>
              <ul className="check-list">
                {(isZeroHuman ? [
                  "Customer Service Agent — jawab pertanyaan & bantu pelanggan",
                  "Sales Agent — kelola leads & follow-up",
                  "Marketing Agent — riset, strategi, dan campaign",
                  "Content Agent — ide & produksi konten",
                  "Developer Agent — coding, debugging, website",
                ] : program.materi.slice(0, 5)).map((m, i) => <li key={i}>{m}</li>)}
              </ul>
              <div className="chip-box" style={{ marginTop: ".8rem", display: "flex", gap: "1rem", alignItems: "center" }}>
                <span className="dot-btn dot-p"><Icon name="user" /></span>
                <div>
                  <h3>{program.mentorName}</h3>
                  <p>{program.mentorBio}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== JAMINAN PENERBITAN ===== */}
      {program.guarantee && !isFree && (
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="container reveal">
            <div className="guarantee" style={{ background: "rgba(108, 92, 231, 0.05)", border: "1px solid rgba(108, 92, 231, 0.1)" }}>
              <div className="seal" style={{ background: "var(--purple)" }}>INFO<br />RESMI</div>
              <div>
                <h3>Penerbitan e-Sertifikat</h3>
                <p>{program.guarantee}</p>
              </div>
            </div>
          </div>
        </section>
      )}

      </>
      )}

      {/* ===== ALASAN IKUT (khusus guru) ===== */}
      {isAiForTeachers ? (
        <section className="section" id="kenapa-pilih">
          <div className="container">
            <div className="bento reveal">
              <div className="section-head">
                <h2>Kenapa Ikut <span className="acc-o">Program Ini</span>?</h2>
                <p className="lead" style={{ color: "var(--ink-soft)" }}>
                  Dirancang khusus untuk guru — tanpa jargon teknis, langsung praktik.
                </p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem", marginTop: "1.5rem" }}>
                {[
                  { icon: "⚡", title: "Praktik Langsung, Bukan Teori", desc: "Setiap sesi demo langsung — lihat, tiru, praktikkan sendiri. Pulang-pulang sudah bisa bikin modul ajar." },
                  { icon: "🎓", title: "Dirancang untuk Guru", desc: "Materi disesuaikan dengan kebutuhan guru Indonesia. Dari modul ajar, soal HOTS, hingga media pembelajaran." },
                  { icon: "🤖", title: "Gratis Akses AI Tools", desc: "Dapatkan akses ke platform AI yang sudah dioptimalkan untuk kebutuhan pembelajaran Kurikulum Merdeka." },
                  { icon: "💬", title: "Bimbingan Komunitas", desc: "Bergabung dengan grup WhatsApp alumni. Tanya jawab, sharing, dan dukungan dari sesama guru." },
                  { icon: "📱", title: "Bisa dari HP", desc: "Tidak perlu laptop canggih. Cukup HP dan koneksi internet — semua demo bisa diikuti dari ponsel." },
                  { icon: "🔁", title: "Rekaman Bisa Ditonton Ulang", desc: "Tidak sempat ikut live? Rekaman webinar tersedia. Belajar kapan saja, di mana saja." },
                ].map((r, i) => (
                  <div key={i} style={{ background: "var(--chip)", borderRadius: "16px", padding: "1.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <span style={{ fontSize: "2rem" }}>{r.icon}</span>
                    <b style={{ fontSize: "1rem", marginTop: "0.3rem" }}>{r.title}</b>
                    <p style={{ fontSize: "0.88rem", lineHeight: 1.6, color: "var(--ink-soft)", margin: 0 }}>{r.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : isVibesCoding || isZeroHuman ? (
        <section className="section" id="kenapa-pilih" style={{ paddingBottom: 0 }} />
      ) : (
        <Testimonials limit={3} />
      )}

      {/* ===== FORM DAFTAR ===== */}
      <section className="section" id="daftar">
        <div className="container">
          <div className="bento bento-purple reveal" style={{ padding: "clamp(1rem, 5vw, 3rem)" }}>
            <div className="hero-card" style={{ alignItems: "center" }}>
              <div>
                <h2 style={{ fontSize: "clamp(1.9rem, 4.5vw, 3rem)", marginBottom: ".8rem" }}>
                  {isZeroHuman ? "Siap Membangun Perusahaan Anda dengan AI?" : "Daftar Sekarang"}
                </h2>
                <p style={{ fontWeight: 700, opacity: .85 }}>
                  {isZeroHuman
                    ? "Mulai dari satu Agent. Bangun enam. Rp225.000 — diskon dari Rp490.000, sekali bayar. Isi data di bawah, konfirmasi melalui WhatsApp."
                    : isVibesCoding
                      ? "Harga spesial — ~~Rp 860.000~~. Isi data di bawah, konfirmasi melalui WhatsApp."
                      : "Pendaftaran satu menit. Akses instan di web &amp; dikirim via WhatsApp."}
                </p>
              </div>
              <RegisterForm
                programId={program.id}
                programSlug={program.slug}
                programTitle={program.title}
                jadwal={jadwal}
                price={program.price}
                priceLabel={priceLabel}
                batches={program.batches?.map((b) => ({ id: b.id, scheduleAt: b.scheduleAt.toISOString(), seatsLeft: b.seatsLeft }))}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section className="section">
        <div className="container">
          <div className="bento reveal">
            <div className="section-head center">
              <h2>Pertanyaan umum.</h2>
            </div>
            <Faq items={faqItems} />
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="container">
          <div className="footer-card-premium">
            {/* Column 1: Brand Info */}
            <div className="footer-brand-sec">
              <div className="brand">
                <Image
                  src="/iconjetschool academy.png"
                  alt="Jetschool Academy"
                  width={40}
                  height={40}
                  style={{ objectFit: "contain" }}
                />
                <span className="brand-title">Jetschool Academy</span>
              </div>
              <p className="footer-company-name">PT Jetschool Academy Indonesia</p>
              <p className="footer-ahu">AHU-0056382.AH.01.01.TAHUN 2020</p>
            </div>

            {/* Column 2: Navigation Links */}
            <div className="footer-nav-group">
              <h4 className="footer-nav-title">Aksi</h4>
              <nav className="footer-nav-links">
                <Link href="/">Kembali ke Beranda</Link>
              </nav>
            </div>

            {/* Column 3: Legal Links */}
            <div className="footer-nav-group">
              <h4 className="footer-nav-title">Hukum & Kebijakan</h4>
              <nav className="footer-nav-links">
                <Link href="/terms">Syarat & Ketentuan</Link>
                <Link href="/privacy-policy">Kebijakan Privasi</Link>
              </nav>
            </div>
          </div>

          {/* Bottom Copyright */}
          <div className="footer-bottom">
            <span>© {new Date().getFullYear()} Jetschool Academy. Semua hak dilindungi.</span>
          </div>
        </div>
      </footer>

      <div className="sticky-spacer" />

      {/* Bar CTA lengket di mobile */}
      <div className="sticky-cta">
        <div><b>{priceLabel}</b><small>{displayHari}, {formatJam(displayScheduleAt)}</small></div>
        <a href="#daftar" className="btn btn-lime">{isZeroHuman ? "Pulang Bawa 6 Karyawan AI" : (isFree ? "Daftar Gratis" : "Daftar")}</a>
      </div>

      <WaFloat text={`Halo, saya ingin bertanya mengenai program ${program.title}`} />
    </>
  );
}
