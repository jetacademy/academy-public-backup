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
import ZeroHumanLandingSections, { ZeroHumanHero, type ZhcOffer } from "@/components/ZeroHumanLandingSections";
import { getProgramBySlug } from "@/lib/programs";
import { TYPE_LABEL, type ProgramType } from "@/lib/fallback";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { formatJadwal, formatHariTanggal, formatJam, rupiah, formatDaysLeftLabel } from "@/lib/format";

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

  let activeOnlineBatch: any = null;
  let activeOfflineBatch: any = null;
  let zhcOnlineCount = 0;
  let zhcOfflineCount = 0;
  const batchPaidMap = new Map<string, number>();

  try {
    const paidGroup = await prisma.registration.groupBy({
      by: ["batchId"],
      where: {
        programId: program.id,
        batchId: { not: null },
        status: { in: ["PAID", "PASSED"] },
      },
      _count: { id: true },
    });
    for (const item of paidGroup) {
      if (item.batchId) {
        batchPaidMap.set(item.batchId, item._count.id);
      }
    }
  } catch {
    // Abaikan jika prisma belum siap
  }

  if (isZeroHuman) {
    const now = new Date();
    try {
      [activeOnlineBatch, activeOfflineBatch] = await Promise.all([
        prisma.programBatch.findFirst({
          where: {
            programId: program.id,
            isActive: true,
            scheduleAt: { gte: now },
            ...({ batchType: "ONLINE" } as any),
          },
          orderBy: { scheduleAt: "asc" },
        }),
        prisma.programBatch.findFirst({
          where: {
            programId: program.id,
            isActive: true,
            scheduleAt: { gte: now },
            ...({ batchType: "OFFLINE" } as any),
          },
          orderBy: { scheduleAt: "asc" },
        }),
      ]);

      if (activeOnlineBatch) {
        zhcOnlineCount = batchPaidMap.get(activeOnlineBatch.id) ?? 0;
      }
      if (activeOfflineBatch) {
        zhcOfflineCount = batchPaidMap.get(activeOfflineBatch.id) ?? 0;
      }
    } catch {
      zhcOnlineCount = 0;
      zhcOfflineCount = 0;
    }
  }

  // Prioritaskan batch online terdekat untuk display utama
  const nextBatch = isZeroHuman ? (activeOnlineBatch ?? program.batches?.[0]) : program.batches?.[0];
  const targetBatchId = nextBatch?.id;
  const displayScheduleAt = nextBatch?.scheduleAt ?? program.scheduleAt;
  const displayHari = nextBatch ? formatHariTanggal(nextBatch.scheduleAt) : formatHariTanggal(program.scheduleAt);

  // Jadwal khusus Online vs Offline (masing-masing mandiri)
  const onlineScheduleDate = activeOnlineBatch?.scheduleAt ?? displayScheduleAt;
  const offlineScheduleDate = activeOfflineBatch?.scheduleAt ?? new Date(onlineScheduleDate.getTime() + 2 * 86400000);

  const scheduleOnlineFormatted = `${formatHariTanggal(onlineScheduleDate)}, ${formatJam(onlineScheduleDate)}`;
  const daysLeftOnline = formatDaysLeftLabel(onlineScheduleDate);

  const scheduleOfflineFormatted = `${formatHariTanggal(offlineScheduleDate)}, ${formatJam(offlineScheduleDate)}`;
  const daysLeftOffline = formatDaysLeftLabel(offlineScheduleDate);

  const EARLY_BIRD_ONLINE_QUOTA = activeOnlineBatch?.quotaOnlineEb ?? 20;
  const EARLY_BIRD_OFFLINE_QUOTA = activeOfflineBatch?.quotaOfflineEb ?? 10;
  const OFFLINE_MAX_SEATS = activeOfflineBatch?.offlineSeatsMax ?? 20;

  const onlineEbPrice = activeOnlineBatch?.priceOnlineEb ?? 225000;
  const onlineNormalPrice = activeOnlineBatch?.priceOnline ?? 490000;
  const offlineEbPrice = activeOfflineBatch?.priceOfflineEb ?? 750000;
  const offlineNormalPrice = activeOfflineBatch?.priceOffline ?? 1400000;

  const isOnlineEbActive = isZeroHuman ? zhcOnlineCount < EARLY_BIRD_ONLINE_QUOTA : false;
  const isOfflineEbActive = isZeroHuman ? zhcOfflineCount < EARLY_BIRD_OFFLINE_QUOTA : false;
  const isOfflineSoldOut = isZeroHuman ? (zhcOfflineCount >= OFFLINE_MAX_SEATS || !activeOfflineBatch) : false;

  const effectivePrice = isZeroHuman
    ? (isOnlineEbActive ? onlineEbPrice : onlineNormalPrice)
    : program.price;
  const effectivePriceOld = isZeroHuman
    ? (isOnlineEbActive ? onlineNormalPrice : null)
    : program.priceOld;

  // Kuota dan harga Early Bird dihitung spesifik per batch, bukan global
  const mappedBatches = (program.batches || []).map((b) => {
    const paidCount = batchPaidMap.get(b.id) ?? 0;
    const isOffline = b.batchType === "OFFLINE" || Boolean((b as any).hasOffline);
    const ebQuota = isOffline ? (b.quotaOfflineEb ?? 10) : (b.quotaOnlineEb ?? 20);
    const isEbActive = isZeroHuman ? paidCount < ebQuota : false;
    const priceEb = isOffline ? (b.priceOfflineEb ?? 750000) : (b.priceOnlineEb ?? 225000);
    const priceNormal = isOffline ? (b.priceOffline ?? 1400000) : (b.priceOnline ?? 490000);
    const bEffectivePrice = isZeroHuman ? (isEbActive ? priceEb : priceNormal) : (b.priceOnline ?? program.price);
    const bEffectivePriceOld = isZeroHuman ? (isEbActive ? priceNormal : null) : program.priceOld;
    const maxSeats = isOffline ? (b.seatsLeft ?? b.offlineSeatsMax ?? 20) : null;
    const isSoldOut = isOffline && maxSeats !== null ? paidCount >= maxSeats : false;

    return {
      id: b.id,
      name: b.name ?? null,
      batchType: b.batchType ?? "ONLINE",
      scheduleAt: b.scheduleAt.toISOString(),
      seatsLeft: b.seatsLeft,
      priceOnline: b.priceOnline,
      priceOffline: b.priceOffline,
      priceOnlineEb: b.priceOnlineEb,
      priceOfflineEb: b.priceOfflineEb,
      quotaOnlineEb: b.quotaOnlineEb,
      quotaOfflineEb: b.quotaOfflineEb,
      offlineSeatsMax: b.offlineSeatsMax,
      offlineVenue: b.offlineVenue,
      offlineScheduleAt: b.offlineScheduleAt ? b.offlineScheduleAt.toISOString() : undefined,
      paidCount,
      isEbActive,
      effectivePrice: bEffectivePrice,
      effectivePriceOld: bEffectivePriceOld,
      isSoldOut,
    };
  });

  const priceLabel = isFree ? "GRATIS" : rupiah(effectivePrice);

  const zhcOfflineVenue = activeOfflineBatch?.offlineVenue || "Coworking Space Kota Bekasi";
  const zhcOffer: ZhcOffer = {
    onlinePrice: isOnlineEbActive ? onlineEbPrice : onlineNormalPrice,
    onlinePriceOld: isOnlineEbActive ? onlineNormalPrice : null,
    isOnlineEb: isOnlineEbActive,
    offlinePrice: isOfflineEbActive ? offlineEbPrice : offlineNormalPrice,
    offlinePriceOld: isOfflineEbActive ? offlineNormalPrice : null,
    isOfflineEb: isOfflineEbActive,
    isOfflineSoldOut,
    scheduleOnline: scheduleOnlineFormatted,
    scheduleOffline: scheduleOfflineFormatted,
    offlineVenue: zhcOfflineVenue,
    sessionAt: onlineScheduleDate.toISOString(),
    mentorName: program.mentorName,
  };
  const ebCtaNavLabel = isFree ? "Daftar Gratis" : "Daftar";

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
          q: "Berapa biaya pendaftaran workshop ini?",
          a: `Kelas Online (Live Zoom) ${rupiah(isOnlineEbActive ? onlineEbPrice : onlineNormalPrice)}${isOnlineEbActive ? ` (Early Bird, normal ${rupiah(onlineNormalPrice)})` : ""}. Kelas Offline (tatap muka) ${rupiah(isOfflineEbActive ? offlineEbPrice : offlineNormalPrice)}${isOfflineEbActive ? ` (Early Bird, normal ${rupiah(offlineNormalPrice)})` : ""}.`,
        },
        {
          q: "Apakah harus bisa coding?",
          a: "Tidak sama sekali. Workshop dirancang untuk pemula dan pemilik bisnis. Anda dipandu step-by-step mengonfigurasi AI Agent dengan instruksi bahasa sehari-hari.",
        },
        {
          q: "Apakah enam AI Agent langsung bisa menjalankan tugas bisnis?",
          a: "Ya. Anda mempraktikkan konfigurasi 6 peran dan alur kerjanya langsung. Integrasi ke aplikasi seperti Instagram, Meta Ads, WhatsApp, dan Google Workspace diajarkan caranya menggunakan akun dan izin resmi masing-masing platform.",
        },
        {
          q: "Apakah Hermes bisa membuat gambar konten Instagram sampai mempostingnya?",
          a: "Bisa. Hermes menyusun ide, mendesain gambar feed sesuai brand, menulis caption & hashtag, lalu memposting otomatis sesuai jadwal ke akun Instagram yang terhubung.",
        },
        {
          q: "Apakah bisa menganalisis Meta Ads dan budget iklan?",
          a: "Bisa. Hermes membaca data analitik iklan, menemukan campaign yang kurang efisien, dan menyiapkan rekomendasi optimasi. Keputusan perubahan budget tetap di tangan Anda.",
        },
        {
          q: "Apakah AI bisa mencari prospek dan follow-up otomatis?",
          a: "Bisa. Hermes membantu meriset calon pelanggan yang relevan, mengirim penawaran personal, dan melakukan follow-up otomatis hingga prospek siap closing.",
        },
        {
          q: "Apakah membutuhkan laptop spek tinggi atau sewa VPS?",
          a: "Tidak wajib. Untuk workshop dan operasional awal, Hermes dapat dijalankan di laptop biasa tanpa sewa server. Tidak ada kewajiban berlangganan platform AI dari Jetschool.",
        },
        {
          q: "Apa yang saya bawa pulang setelah workshop?",
          a: "Konfigurasi 6 AI Agent siap pakai, rekaman video sesi, modul panduan langkah demi langkah, akses komunitas alumni, serta e-sertifikat resmi.",
        },
        {
          q: "Bagaimana proses pendaftaran dan pembayarannya?",
          a: "Pilih tiket Online atau Offline di halaman ini, isi data diri, lalu selesaikan pembayaran. Link dan panduan workshop langsung dikirim ke WhatsApp Anda.",
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
      price: effectivePrice,
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
      {isZeroHuman ? <ZeroHumanHero offer={zhcOffer} cover={program.imageUrl ? { src: program.imageUrl, alt: program.title } : null} /> : (
      <section className="hero">
        <div className="container">
          <div className="prg-hero-wrap">

            {/* Kolom kiri — teks */}
            <div className="prg-hero-content">
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
            </div>

            {/* Kolom kanan — Gambar Program (upload admin) atau ilustrasi bawaan */}
            <div className="prg-hero-visual">
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
            </div>

          </div>
        </div>
      </section>
      )}

      {/* ===== DESCRIPTION & CTA BAR ===== */}
      {!isZeroHuman && (
      <section className="section-sm" style={{ paddingTop: "2rem", paddingBottom: "2rem" }}>
        <div className="container">
          <div className={hasBlocks ? "prg-desc-cta-card no-desc" : "prg-desc-cta-card"}>
            {!hasBlocks && (
              <div className="prg-desc-col">
                <h3 className="prg-desc-title">Deskripsi Program</h3>
                <p className="prg-desc-text">
                  {program.description}
                </p>
              </div>
            )}
            <div className="prg-cta-col">
              <a href="#daftar" className="btn btn-purple btn-lg btn-block" style={{ width: "100%", textAlign: "center" }}>
                {isFree ? "Daftar Gratis Sekarang" : `Daftar — ${priceLabel}`}
              </a>
              {!isFree && effectivePriceOld && (
                <span className="prg-hero-strike" style={{ color: "var(--ink-soft)", textDecoration: "line-through", display: "block", textAlign: "center", marginTop: "0.2rem" }}>
                  {rupiah(effectivePriceOld)}
                </span>
              )}
              <div className="prg-cta-meta-list" style={{ marginTop: "0.5rem" }}>
                <div className="cta-meta-item">
                  <Icon name="calendar" size={14} />
                  <span>{displayHari}, {formatJam(displayScheduleAt)}</span>
                </div>
                <div className="cta-meta-item">
                  <Icon name="award" size={14} />
                  <span>{isAiForTeachers ? "Live Zoom 2 jam · 6 Demo Langsung" : isVibesCoding ? "Live Zoom 2,5 jam · 4 Produk Jadi" : "Komunitas + Rekaman + Sertifikat"}</span>
                </div>
              </div>
              <OfferTimer target={displayScheduleAt.toISOString()} note="Sesi dimulai dalam" />
            </div>
          </div>
        </div>
      </section>
      )}

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

      {/* ===== ZERO HUMAN COMPANY ===== */}
      {isZeroHuman && <ZeroHumanLandingSections offer={zhcOffer} />}

      {/* ===== VALUE STACK + MATERI ===== */}
      {!isZeroHuman && (
        <section className="section">
          <div className="container">
            <div className="hero-card">
              <div className="bento reveal">
                <h2 style={{ marginBottom: "1.2rem" }}>Yang Anda <span className="acc-p">terima</span></h2>
                <ValueStack
                  deliverables={program.deliverables}
                  price={isFree ? 0 : program.price}
                  priceOld={isFree ? null : program.priceOld}
                  ctaHref="#daftar"
                  ctaLabel={isFree ? "Ikuti Sesi Gratis" : "Daftar Sekarang"}
                  isFree={isFree}
                />
                {isFree && (
                  <p className="reg-note">* Seluruh fasilitas di atas dapat diakses secara gratis oleh peserta webinar.</p>
                )}
              </div>
              <div className="bento reveal">
                <h2 style={{ marginBottom: "1.2rem" }}>Yang Anda <span className="acc-o">pelajari</span></h2>
                <ul className="check-list">
                  {program.materi.slice(0, 5).map((m, i) => <li key={i}>{m}</li>)}
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
      )}

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
      <section className="section" id="daftar" style={{ paddingTop: "3rem", paddingBottom: "5rem", background: "rgba(241, 242, 246, 0.5)" }}>
        <div className="container">
          {isZeroHuman ? (
            <div>
              {/* CTA Header Terpusat di Atas */}
              <div style={{ textAlign: "center", maxWidth: "720px", margin: "0 auto 2.5rem" }}>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    padding: "0.35rem 0.95rem",
                    borderRadius: "999px",
                    background: "rgba(108, 92, 231, 0.1)",
                    border: "1px solid rgba(108, 92, 231, 0.25)",
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                    color: "#6c5ce7",
                    textTransform: "uppercase",
                    marginBottom: "0.85rem",
                  }}
                >
                  Langkah 2 · Isi data & bayar
                </div>

                <h2
                  style={{
                    fontSize: "clamp(2rem, 4.5vw, 2.9rem)",
                    fontWeight: 900,
                    color: "var(--ink)",
                    lineHeight: 1.2,
                    letterSpacing: "-0.03em",
                    marginBottom: "0.85rem",
                  }}
                >
                  Tinggal satu langkah lagi.
                </h2>

                <p
                  style={{
                    fontSize: "clamp(0.95rem, 1.8vw, 1.1rem)",
                    color: "var(--ink-soft)",
                    lineHeight: 1.55,
                    margin: "0 auto",
                    maxWidth: "580px",
                  }}
                >
                  Tiket pilihan Anda sudah terpasang di bawah. Lengkapi data, lalu lanjut ke pembayaran.
                </p>
              </div>

              {/* Form Card Terpusat Penuh */}
              <div style={{ maxWidth: "1020px", margin: "0 auto" }}>
                <RegisterForm
                  programId={program.id}
                  programSlug={program.slug}
                  programTitle={program.title}
                  jadwal={jadwal}
                  price={effectivePrice}
                  priceLabel={priceLabel}
                  batches={mappedBatches}
                  attendanceOptions={{
                    hasOffline: true,
                    venueOffline: zhcOfflineVenue,
                    durationOffline: "4 Jam Tatap Muka",
                    scheduleOnline: scheduleOnlineFormatted,
                    scheduleOffline: scheduleOfflineFormatted,
                    daysLeftOnline,
                    daysLeftOffline,
                    priceOnline: isOnlineEbActive ? onlineEbPrice : onlineNormalPrice,
                    priceOnlineOld: isOnlineEbActive ? onlineNormalPrice : null,
                    isOnlineEbActive,
                    priceOffline: isOfflineEbActive ? offlineEbPrice : offlineNormalPrice,
                    priceOfflineOld: isOfflineEbActive ? offlineNormalPrice : null,
                    isOfflineEbActive,
                    isOfflineSoldOut,
                    onlineBatchId: activeOnlineBatch?.id,
                    offlineBatchId: activeOfflineBatch?.id,
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="bento bento-purple reveal" style={{ padding: "clamp(1rem, 5vw, 3rem)" }}>
              <div className="hero-card" style={{ alignItems: "center" }}>
                <div>
                  <h2 style={{ fontSize: "clamp(1.9rem, 4.5vw, 3rem)", marginBottom: ".8rem" }}>
                    Daftar Sekarang
                  </h2>
                  <p style={{ fontWeight: 600, fontSize: "0.88rem", opacity: .8, marginTop: "0.6rem", marginBottom: "1.2rem" }}>
                    {isVibesCoding
                      ? "Harga spesial — ~~Rp 860.000~~. Isi data di bawah, konfirmasi melalui WhatsApp."
                      : "Pendaftaran satu menit. Akses instan di web & dikirim via WhatsApp."}
                  </p>
                </div>
                <RegisterForm
                  programId={program.id}
                  programSlug={program.slug}
                  programTitle={program.title}
                  jadwal={jadwal}
                  price={effectivePrice}
                  priceLabel={priceLabel}
                  batches={mappedBatches}
                />
              </div>
            </div>
          )}
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
        <a href="#daftar" className="btn btn-lime">{isFree ? "Daftar Gratis" : "Daftar"}</a>
      </div>

      <WaFloat text={`Halo, saya ingin bertanya mengenai program ${program.title}`} />
    </>
  );
}
