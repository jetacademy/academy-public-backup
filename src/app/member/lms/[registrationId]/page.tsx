import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getMemberSession } from "@/lib/member-auth";
import { checkCertEligibility } from "@/lib/certificates";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WaFloat from "@/components/WaFloat";
import { completeLesson } from "@/app/member/actions";
import LessonQuiz, { type LessonQuizQuestion } from "@/components/LessonQuiz";
import ClaimCertButton from "@/components/ClaimCertButton";
import MemberPayCertButton from "@/components/MemberPayCertButton";
import LessonVideoPlayer from "@/components/LessonVideoPlayer";
import LmsSidebar from "@/components/LmsSidebar";
import LmsMobileNav from "@/components/LmsMobileNav";
import LmsViewContainer from "@/components/LmsViewContainer";
import dynamicImport from "next/dynamic";

// PDF viewer (~1.5 MB react-pdf/pdfjs) di-lazy-load — hanya dimuat saat lesson bertipe PDF,
// peserta yang menonton video tidak lagi mendownload bundle-nya.
const LmsPdfViewer = dynamicImport(() => import("@/components/LmsPdfViewer"), {
  loading: () => (
    <div className="lms-pdf-loading">
      <div className="lms-pdf-spinner" />
      <span>Menyiapkan pembaca PDF…</span>
    </div>
  ),
});
import { getEmbedUrl } from "@/lib/video";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  VIDEO: "Video",
  TEXT: "Teks",
  PDF: "PDF",
  QUIZ: "Kuis",
};

export default async function LmsPage({
  params,
  searchParams,
}: {
  params: Promise<{ registrationId: string }>;
  searchParams: Promise<{ lessonId?: string; status?: string }>;
}) {
  const { registrationId } = await params;
  const { lessonId, status } = await searchParams;

  const sessionVal = await getMemberSession();
  if (!sessionVal) redirect("/member/login");

  const reg = await prisma.registration.findUnique({
    where: { id: registrationId },
    include: { program: true, completions: true, certificate: true, batch: true },
  });

  if (!reg) redirect("/member");

  // Validasi kepemilikan sesi
  if (reg.email !== sessionVal && reg.whatsapp !== sessionVal) redirect("/member");

  const program = reg.program;

  // Ambil certClaimOpen via raw SQL (bypass Prisma client cache)
  let certClaimOpen = false;
  try {
    const { Prisma } = await import("@prisma/client");
    type RawRow = { certClaimOpen: number };
    const rows = await prisma.$queryRaw<RawRow[]>(
      Prisma.sql`SELECT certClaimOpen FROM \`program\` WHERE id = ${program.id} LIMIT 1`
    );
    if (rows[0]) certClaimOpen = rows[0].certClaimOpen === 1;
  } catch { /* silent fallback */ }

  // Akses LMS terbuka jika admin sudah buka (certClaimOpen) atau jadwal batch/program sudah mulai.
  // Berlaku utk semua tipe program (dulu KELAS/WORKSHOP/BOOTCAMP dikecualikan dari cek ini —
  // itu yang bikin peserta bisa akses LMS & dapat sertifikat sebelum batch-nya mulai).
  const sessionAt = reg.batch?.scheduleAt ?? program.scheduleAt;
  const now = new Date();
  const isLmsOpen = certClaimOpen || now >= sessionAt;

  if (!isLmsOpen) {
    const formattedJadwal = new Intl.DateTimeFormat("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jakarta",
      timeZoneName: "short"
    }).format(sessionAt);

    return (
      <>
        <Navbar minimal ctaHref="/member" ctaLabel="Dashboard Saya" />
        <section className="section" style={{ minHeight: "85vh", display: "grid", placeItems: "center", background: "var(--bg-warm)" }}>
          <div className="bento" style={{
            textAlign: "center",
            maxWidth: "36rem",
            padding: "3.5rem 2rem",
            background: "var(--white)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md)",
            boxShadow: "var(--shadow-md)"
          }}>
            <span style={{ fontSize: "3.5rem" }}>📅</span>
            <span className="type-tag type-webinar" style={{ display: "inline-block", margin: "1.5rem 0 0.8rem" }}>{program.type === "WEBINAR" ? "Sesi Belum Dimulai" : "Batch Belum Dimulai"}</span>
            <h2 style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--ink)" }}>Akses LMS Belum Dibuka</h2>
            <p style={{ color: "var(--ink-soft)", fontSize: "1rem", lineHeight: 1.6, marginTop: "1rem" }}>
              Halo <strong>{reg.name}</strong>, akses pembelajaran mandiri &amp; klaim sertifikat untuk program <strong>{program.title}</strong> akan terbuka secara otomatis setelah {program.type === "WEBINAR" ? "sesi live webinar dimulai" : "batch Anda dimulai"} pada:
            </p>
            <div style={{
              background: "rgba(108, 92, 231, 0.05)",
              border: "1px solid rgba(108, 92, 231, 0.15)",
              borderRadius: "var(--r-sm)",
              padding: "1rem",
              margin: "1.5rem 0",
              fontWeight: 700,
              fontSize: "1.05rem",
              color: "var(--purple)"
            }}>
              {formattedJadwal}
            </div>
            {(() => {
              const batchWaLink = reg.batch ? (reg.batch.waGroupLink || null) : program.waGroupLink;
              return batchWaLink ? (
                <div style={{ marginBottom: "1.5rem" }}>
                  <a
                    href={batchWaLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-line"
                    style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}
                  >
                    💬 Gabung Grup WA Pelatihan
                  </a>
                </div>
              ) : null;
            })()}
            {program.type === "WEBINAR" && (
              <p style={{ color: "var(--ink-faint)", fontSize: "0.85rem", marginBottom: "2rem" }}>
                Silakan pantau grup WhatsApp peserta untuk mendapatkan tautan Zoom Meeting live.
              </p>
            )}
            <Link href="/member" className="btn btn-purple btn-lg" style={{ display: "inline-block" }}>Kembali ke Dashboard</Link>
          </div>
        </section>
        <Footer />
        <WaFloat />
      </>
    );
  }

  // Gerbang pembayaran:
  // - Program berbayar: REGISTERED = preview mode
  // - Webinar gratis + certPrice: harus bayar certPrice dulu untuk akses LMS penuh
  const hasCertPayment = reg.status === "PAID" || reg.status === "PASSED";
  const hasPendingCertPayment = !hasCertPayment && program.price === 0 && program.certPrice > 0;
  const isPreviewMode = reg.status === "REGISTERED" && program.price > 0;

  // Kurikulum berjenjang: kelompok → modul → materi (+ modul tanpa kelompok di akhir).
  // Soal kuis diambil TANPA kunci jawaban.
  const lessonInclude = {
    lessons: {
      orderBy: { order: "asc" as const },
      include: {
        questions: {
          orderBy: { order: "asc" as const },
          select: { id: true, text: true, optionA: true, optionB: true, optionC: true, optionD: true },
        },
      },
    },
  };
  const batchModuleFilter = reg.batchId
    ? {
        OR: [
          { batchLinks: { none: {} } },
          { batchLinks: { some: { batchId: reg.batchId } } },
        ],
      }
    : {};

  const [groups, ungrouped] = await Promise.all([
    prisma.lmsGroup.findMany({
      where: { programId: program.id },
      orderBy: { order: "asc" },
      include: {
        modules: {
          where: batchModuleFilter,
          orderBy: { order: "asc" },
          include: lessonInclude,
        },
      },
    }),
    prisma.lmsModule.findMany({
      where: {
        programId: program.id,
        groupId: null,
        ...batchModuleFilter,
      },
      orderBy: { order: "asc" },
      include: lessonInclude,
    }),
  ]);

  type ModuleWithLessons = (typeof ungrouped)[number];
  const sections: { title: string | null; modules: ModuleWithLessons[] }[] = [
    ...groups.map((g) => ({ title: g.title, modules: g.modules })),
    ...(ungrouped.length > 0 ? [{ title: groups.length > 0 ? "Lainnya" : null, modules: ungrouped }] : []),
  ];
  const orderedModules = sections.flatMap((s) => s.modules);
  let allLessons = orderedModules.flatMap((m) => m.lessons);
  // Mode preview: user non-bayar hanya lihat lesson dengan isPreview=true
  if (isPreviewMode) {
    allLessons = allLessons.filter((l) => l.isPreview);
  }
  const totalLessons = allLessons.length;

  if (totalLessons === 0) {
    return (
      <>
        <Navbar minimal ctaHref="/member" ctaLabel="Kembali ke Dashboard" />
        <section className="section" style={{ minHeight: "80vh", display: "grid", placeItems: "center" }}>
          <div style={{ textAlign: "center", maxWidth: "32rem" }}>
            <h3 style={{ marginTop: "1rem" }}>Materi Belum Tersedia</h3>
            <p style={{ color: "var(--ink-soft)" }}>LMS interaktif untuk program ini sedang disiapkan oleh tim mentor.</p>
            <Link href="/member" className="btn btn-purple btn-md" style={{ marginTop: "1.5rem" }}>Kembali ke Dashboard</Link>
          </div>
        </section>
        <Footer />
        <WaFloat />
      </>
    );
  }

  const completedLessonIds = new Set(reg.completions.map((c) => c.lessonId));
  const completedCount = allLessons.filter((l) => completedLessonIds.has(l.id)).length;
  const progressPercent = Math.round((completedCount / totalLessons) * 100);

  // Kelayakan sertifikat sesuai kriteria program (hasil tes / penyelesaian materi)
  const freeUntil = new Date(sessionAt.getTime() + 5 * 24 * 60 * 60 * 1000); // H+5
  const isWithinFreePeriod = now <= freeUntil;
  // isFreeClaim: webinar gratis + dalam masa tenggang + certClaimOpen + belum bayar
  const isFreeClaim = program.price === 0 && program.certPrice === 0 && certClaimOpen;

  const isAiForTeachers = program.slug === "ai-for-teachers";
  const webinarEndAt = new Date(sessionAt.getTime() + 2 * 60 * 60 * 1000);
  const hideCertUpsell = isAiForTeachers && now < webinarEndAt;

  // hasPaid: lunas certPrice (untuk webinar gratis) atau lunas program price
  const hasPaid = hasCertPayment || (program.price === 0 && program.certPrice === 0 && certClaimOpen);
  const eligibility = reg.certificate ? { eligible: true as const } : await checkCertEligibility(reg.id, program);
  const canClaim = !reg.certificate && hasPaid && eligibility.eligible && !hideCertUpsell;

  // Tentukan materi aktif
  let currentLesson = allLessons.find((l) => l.id === lessonId);
  if (!currentLesson) {
    currentLesson = allLessons.find((l) => !completedLessonIds.has(l.id)) || allLessons[0];
  }

  const embedUrl = getEmbedUrl(currentLesson.videoUrl);

  const currentIndex = allLessons.findIndex((l) => l.id === currentLesson.id);
  const nextLesson = currentIndex !== -1 && currentIndex < totalLessons - 1 ? allLessons[currentIndex + 1] : null;
  const isCompleted = completedLessonIds.has(currentLesson.id);
  const nextHref = nextLesson
    ? `/member/lms/${registrationId}?lessonId=${nextLesson.id}`
    : `/member/lms/${registrationId}?status=selesai`;

  const currentLessonId = currentLesson.id;

  // Server Action untuk menandai selesai (non-kuis)
  async function handleMarkComplete() {
    "use server";
    await completeLesson(registrationId, currentLessonId);
    redirect(nextHref);
  }

  const isAllDone = status === "selesai" || (completedCount === totalLessons && !lessonId);
  const quizPassingScore = currentLesson.passingScore ?? program.passingScore;

  let modNumber = 0; // penomoran modul global lintas kelompok

  // Early return: harus bayar certPrice dulu sebelum akses LMS
  if (hasPendingCertPayment) {
    return (
      <>
        <Navbar minimal ctaHref="/member" ctaLabel="Dashboard Saya" />
        <section className="section" style={{ minHeight: "85vh", display: "grid", placeItems: "center", background: "var(--bg-warm)" }}>
          <div className="bento" style={{
            textAlign: "center", maxWidth: "36rem", padding: "3.5rem 2rem",
            background: "var(--white)", border: "1px solid var(--border)",
            borderRadius: "var(--r-md)", boxShadow: "var(--shadow-md)"
          }}>
            <span style={{ fontSize: "3.5rem" }}>🎓</span>
            <span className="type-tag type-webinar" style={{ display: "inline-block", margin: "1.5rem 0 0.8rem" }}>Sertifikat &amp; Materi</span>
            <h2 style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--ink)" }}>Selesaikan Pembayaran Dulu</h2>
            <p style={{ color: "var(--ink-soft)", fontSize: "0.95rem", lineHeight: 1.65, marginTop: "1rem" }}>
              Halo <strong>{reg.name}</strong>, untuk mengakses video rekaman, modul PDF, post-test, dan e-Sertifikat
              program <strong>{program.title}</strong>, silakan selesaikan pembayaran paket sertifikat terlebih dahulu.
            </p>
            <div style={{ margin: "2rem auto", maxWidth: "22rem", display: "grid", gap: ".8rem" }}>
              <MemberPayCertButton registrationId={registrationId} certPrice={program.certPrice} className="btn btn-purple btn-lg btn-block" />
              <Link href="/member" className="btn btn-line btn-block" style={{ textAlign: "center" }}>Kembali ke Dashboard</Link>
            </div>
          </div>
        </section>
        <Footer />
        <WaFloat />
      </>
    );
  }

  // Serialisasi section untuk client component (hanya field yang diperlukan)
  const sidebarSections = sections.map((s) => ({
    title: s.title,
    modules: s.modules.map((m) => ({
      id: m.id,
      title: m.title,
      lessons: m.lessons.map((l) => ({
        id: l.id,
        title: l.title,
        type: l.type,
        duration: l.duration ?? null,
      })),
    })),
  }));
  const completedLessonIdsArr = Array.from(completedLessonIds);

  const prevLessonObj =
    currentIndex > 0 && allLessons[currentIndex - 1]
      ? { id: allLessons[currentIndex - 1].id, title: allLessons[currentIndex - 1].title }
      : null;

  const nextLessonObj = nextLesson
    ? { id: nextLesson.id, title: nextLesson.title }
    : null;

  return (
    <>
      {/* Banner klaim: syarat kelulusan sudah terpenuhi */}
      {canClaim && !isAllDone && (
        <div className="lms-claim-banner">
          <span style={{ fontSize: ".88rem", fontWeight: 700, color: "#1d8a4e" }}>
            Syarat kelulusan Anda sudah terpenuhi — sertifikat siap diklaim.
          </span>
          <ClaimCertButton registrationId={registrationId} />
        </div>
      )}

      <LmsViewContainer
        programTitle={program.title}
        currentLessonTitle={currentLesson.title}
        completedCount={completedCount}
        totalLessons={totalLessons}
        progressPercent={progressPercent}
        prevLesson={prevLessonObj}
        nextLesson={nextLessonObj}
        registrationId={registrationId}
        sidebarSections={sidebarSections}
        currentLessonId={currentLesson.id}
        completedLessonIdsArr={completedLessonIdsArr}
        isAllDone={isAllDone}
        currentIndex={currentIndex}
        allLessonsCount={allLessons.length}
      >
        {isAllDone ? (
          <div
            style={{
              background: "var(--white)",
              borderRadius: "var(--r-md)",
              boxShadow: "var(--shadow)",
              padding: "4rem 2rem",
              textAlign: "center",
              maxWidth: "36rem",
              margin: "2rem auto",
            }}
          >
            <span style={{ fontSize: "4rem" }}>🏆</span>
            <h2 style={{ marginTop: "1.5rem", fontWeight: 800 }}>
              Selamat, Anda Telah Menyelesaikan Semua Materi!
            </h2>

            {reg.certificate ? (
              <>
                <p
                  style={{
                    color: "var(--ink-soft)",
                    fontSize: "0.95rem",
                    lineHeight: 1.6,
                    margin: "1rem 0 2rem",
                  }}
                >
                  Sertifikat Anda sudah terbit dengan nomor resmi. Unduh dan bagikan pencapaian Anda!
                </p>
                <Link
                  href={`/sertifikat/${reg.certificate.number}`}
                  className="btn btn-purple btn-lg"
                >
                  Unduh e-Sertifikat
                </Link>
              </>
            ) : canClaim ? (
              <>
                {isFreeClaim ? (
                  <div
                    className="adm-alert ok"
                    style={{
                      marginBottom: "1.5rem",
                      textAlign: "left",
                      padding: "1rem",
                      borderRadius: "var(--r-sm)",
                      border: "1px solid rgba(46, 204, 113, 0.2)",
                      background: "rgba(46, 204, 113, 0.08)",
                      color: "#27ae60",
                    }}
                  >
                    <strong>Promo Terbatas:</strong> Anda berhak mengklaim e-sertifikat secara{" "}
                    <strong>GRATIS</strong> (Hemat{" "}
                    {new Intl.NumberFormat("id-ID", {
                      style: "currency",
                      currency: "IDR",
                      maximumFractionDigits: 0,
                    }).format(program.certPrice)}
                    ) karena menyelesaikan semua syarat sebelum batas waktu H+5 (
                    {new Intl.DateTimeFormat("id-ID", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                      timeZone: "Asia/Jakarta",
                    }).format(freeUntil)}
                    ).
                  </div>
                ) : null}
                <p
                  style={{
                    color: "var(--ink-soft)",
                    fontSize: "0.95rem",
                    lineHeight: 1.6,
                    margin: "1rem 0 2rem",
                  }}
                >
                  Seluruh syarat kelulusan {program.title} sudah terpenuhi. Klaim e-sertifikat resmi Anda sekarang.
                </p>
                <ClaimCertButton registrationId={registrationId} />
              </>
            ) : !hasPaid && !hideCertUpsell ? (
              <>
                <div
                  className="adm-alert warn"
                  style={{
                    marginBottom: "1.5rem",
                    textAlign: "left",
                    padding: "1rem",
                    borderRadius: "var(--r-sm)",
                    border: "1px solid rgba(230, 126, 34, 0.2)",
                    background: "rgba(230, 126, 34, 0.08)",
                    color: "#d35400",
                  }}
                >
                  <strong>Batas Klaim Gratis Berakhir:</strong> Masa tenggang klaim sertifikat gratis (H+5) telah berakhir pada{" "}
                  {new Intl.DateTimeFormat("id-ID", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    timeZone: "Asia/Jakarta",
                  }).format(freeUntil)}
                  . Anda kini dialihkan ke paket sertifikat berbayar.
                </div>
                <p
                  style={{
                    color: "var(--ink-soft)",
                    fontSize: "0.95rem",
                    lineHeight: 1.6,
                    margin: "1rem 0 2rem",
                  }}
                >
                  Selesaikan pembayaran paket sertifikat untuk menerbitkan e-sertifikat resmi Anda.
                </p>
                <div style={{ maxWidth: "24rem", margin: "0 auto" }}>
                  <MemberPayCertButton
                    registrationId={registrationId}
                    certPrice={program.certPrice}
                    className="btn btn-purple btn-lg btn-block"
                  />
                </div>
              </>
            ) : (
              <>
                <p
                  style={{
                    color: "var(--ink-soft)",
                    fontSize: "0.95rem",
                    lineHeight: 1.6,
                    margin: "1rem 0 2rem",
                  }}
                >
                  {"reason" in eligibility && eligibility.reason
                    ? eligibility.reason
                    : "Masih ada syarat kelulusan yang belum terpenuhi. Periksa kembali materi & tes Anda."}
                </p>
                {program.price === 0 && isWithinFreePeriod && !hideCertUpsell && (
                  <p
                    style={{
                      fontSize: "0.85rem",
                      color: "var(--purple)",
                      fontWeight: 700,
                      marginTop: "-1rem",
                      marginBottom: "2rem",
                    }}
                  >
                    ⚡ Selesaikan seluruh materi/tes sekarang untuk mengklaim sertifikat GRATIS (Masa tenggang H+5).
                  </p>
                )}
                <Link href="/member" className="btn btn-line btn-lg">
                  Kembali ke Dashboard
                </Link>
              </>
            )}
          </div>
        ) : (
          <div className="lms-inner-container">
            {/* Embed Video */}
            {currentLesson.type === "VIDEO" && embedUrl && (
              <LessonVideoPlayer src={embedUrl} title={currentLesson.title} />
            )}

            {/* Embed PDF — read-only canvas */}
            {currentLesson.type === "PDF" && currentLesson.fileUrl && (
              <LmsPdfViewer
                fileUrl={currentLesson.fileUrl}
                title={currentLesson.title}
                allowDownload={(currentLesson as unknown as { allowDownload?: boolean }).allowDownload ?? false}
              />
            )}

            {/* Info & Konten Materi */}
            <div className="lms-lesson-card">
              <div
                style={{
                  display: "flex",
                  gap: "0.6rem",
                  alignItems: "center",
                  marginBottom: "0.8rem",
                  flexWrap: "wrap",
                }}
              >
                <span
                  className="badge"
                  style={{ background: "rgba(108, 92, 231, 0.1)", color: "var(--purple)" }}
                >
                  {TYPE_LABEL[currentLesson.type] ?? currentLesson.type}
                </span>
                <span style={{ fontSize: "0.8rem", color: "var(--ink-faint)" }}>
                  Durasi: {currentLesson.duration}
                </span>
                {isCompleted && <span className="badge g">✓ Selesai</span>}
              </div>

              <h2 style={{ fontSize: "1.6rem", fontWeight: 800, marginBottom: "1rem" }}>
                {currentLesson.title}
              </h2>

              {currentLesson.type === "QUIZ" ? (
                <LessonQuiz
                  registrationId={registrationId}
                  lessonId={currentLesson.id}
                  passingScore={quizPassingScore}
                  alreadyPassed={isCompleted}
                  nextHref={nextHref}
                  questions={currentLesson.questions.map(
                    (q): LessonQuizQuestion => ({
                      id: q.id,
                      text: q.text,
                      options: [
                        { key: "A", label: q.optionA },
                        { key: "B", label: q.optionB },
                        { key: "C", label: q.optionC },
                        { key: "D", label: q.optionD },
                      ],
                    })
                  )}
                />
              ) : (
                <>
                  {currentLesson.content &&
                    (/<[a-z][\s\S]*>/i.test(currentLesson.content) ? (
                      <div
                        className="rt-content"
                        style={{
                          fontSize: "0.95rem",
                          color: "var(--ink-soft)",
                          marginBottom: "2.5rem",
                        }}
                        dangerouslySetInnerHTML={{ __html: currentLesson.content }}
                      />
                    ) : (
                      <div
                        style={{
                          fontSize: "0.95rem",
                          lineHeight: 1.7,
                          color: "var(--ink-soft)",
                          whiteSpace: "pre-wrap",
                          marginBottom: "2.5rem",
                        }}
                      >
                        {currentLesson.content}
                      </div>
                    ))}

                  {/* Tombol Selesai */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      borderTop: "1px solid var(--border)",
                      paddingTop: "1.5rem",
                    }}
                  >
                    <form action={handleMarkComplete}>
                      <button
                        type="submit"
                        className="btn btn-purple btn-lg"
                        style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
                      >
                        {isCompleted ? "Lanjut Materi Berikutnya →" : "Tandai Selesai & Lanjutkan →"}
                      </button>
                    </form>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </LmsViewContainer>

      <Footer />
      <WaFloat />
    </>
  );
}

