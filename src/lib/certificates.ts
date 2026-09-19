import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { randomBytes } from "crypto";
import { sendWa, msgCertificate } from "@/lib/wa";
import { sendEmail, getCertEmailHtml } from "@/lib/email";
import { formatJadwal } from "@/lib/format";

const CERT_CLAIM_DELAY_MS = 24 * 60 * 60 * 1000; // 1×24 jam setelah sesi berakhir

/**
 * Sakelar global penerbitan sertifikat (`SystemSetting.certIssuanceEnabled`) — dipakai admin
 * utk menghentikan sementara penerbitan sertifikat BARU di seluruh situs (mis. lagi ada bug
 * yang perlu diuji). Gagal baca (mis. di unit test tanpa mock model ini) DIANGGAP AKTIF —
 * supaya kegagalan infra tidak diam-diam mengunci seluruh sistem sertifikat.
 */
export async function isCertIssuanceEnabled(): Promise<boolean> {
  try {
    const setting = await prisma.systemSetting.findUnique({ where: { id: "singleton" } });
    return setting?.certIssuanceEnabled ?? true;
  } catch {
    return true;
  }
}

function isUniqueConstraintError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

/** 4 karakter hex acak — menutup celah enumerasi nomor sertifikat sekuensial. */
function randomSuffix(): string {
  return randomBytes(2).toString("hex").toUpperCase();
}

/**
 * Terbitkan sertifikat, set status PASSED, lalu kirim notifikasi WA + email (best-effort).
 * Idempoten: jika sertifikat sudah ada, kembalikan yang lama. Aman dari race condition —
 * jika dua request paralel (mis. dua tab) memicu penerbitan bersamaan, salah satu akan
 * gagal karena unique constraint dan kita fallback membaca sertifikat yang sudah dibuat
 * request lainnya alih-alih melempar error ke peserta.
 */
export async function issueCertificate(registrationId: string): Promise<{ number: string; url: string }> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

  const reg = await prisma.registration.findUnique({
    where: { id: registrationId },
    include: { certificate: true, program: true, batch: true },
  });
  if (!reg) throw new Error("Registrasi tidak ditemukan.");

  // 🔒 GUARD (keputusan owner 8 Agu 2026): sertifikat TIDAK BOLEH terbit sebelum
  // sesi selesai. Berlaku untuk SEMUA jalur — auto member, webadmin manual,
  // toggle publish. Mencegah "batch belum mulai tapi sertifikat sudah muncul"
  // (kejadian 6 Agu: 8 sertifikat B002 terbit sebelum batch 8 Agu).
  const sessionAt = reg.batch?.scheduleAt ?? reg.program.scheduleAt;
  if (sessionAt && new Date() < new Date(sessionAt.getTime() + 3 * 60 * 60 * 1000)) {
    throw new Error("Sertifikat hanya bisa diterbitkan setelah sesi pelatihan selesai.");
  }

  if (reg.certificate) {
    return { number: reg.certificate.number, url: `${baseUrl}/sertifikat/${reg.certificate.number}` };
  }

  const program = reg.program;
  const year = (reg.batch?.scheduleAt ?? program.scheduleAt).getFullYear();

  let progCode = "GEN";
  if (program.slug.includes("guru") || program.slug.includes("teacher")) {
    progCode = "TCH";
  } else {
    progCode = program.slug.replace(/[^a-zA-Z]/g, "").substring(0, 3).toUpperCase() || "GEN";
  }

  let batchNumStr = "001";
  if (reg.batch) {
    const previousBatchesCount = await prisma.programBatch.count({
      where: {
        programId: reg.programId,
        scheduleAt: {
          lt: reg.batch.scheduleAt,
        },
      },
    });
    batchNumStr = String(previousBatchesCount + 1).padStart(3, "0");
  }

  const existingCount = await prisma.certificate.count({
    where: {
      registration: {
        programId: reg.programId,
        batchId: reg.batchId,
      },
    },
  });
  const baseSequence = existingCount + 1;

  // Percobaan berulang dengan tambahan acak — cegah race condition di nomor DAN di registrationId
  // (dua request paralel yang menyelesaikan materi terakhir bersamaan tidak akan saling melempar error).
  let cert: { number: string } | null = null;
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 10 && !cert; attempt++) {
    const number = `JS-${progCode}-${year}-B${batchNumStr}-${String(baseSequence + attempt).padStart(5, "0")}-${randomSuffix()}`;
    try {
      cert = await prisma.$transaction(async (tx) => {
        const created = await tx.certificate.create({
          data: { registrationId: reg.id, number },
        });
        await tx.registration.update({ where: { id: reg.id }, data: { status: "PASSED" } });
        return created;
      });
    } catch (err) {
      lastErr = err;
      if (!isUniqueConstraintError(err)) throw err;
      // number bentrok (sangat kecil kemungkinan) ATAU registrationId sudah terisi oleh
      // request paralel lain — cek yang mana sebelum retry.
      const already = await prisma.certificate.findUnique({ where: { registrationId: reg.id } });
      if (already) {
        return { number: already.number, url: `${baseUrl}/sertifikat/${already.number}` };
      }
      // bukan konflik registrationId → konflik nomor, coba lagi dengan suffix baru
    }
  }
  if (!cert) throw lastErr instanceof Error ? lastErr : new Error("Gagal menerbitkan sertifikat setelah beberapa percobaan.");

  const certUrl = `${baseUrl}/sertifikat/${cert.number}`;

  // notifikasi — best-effort, jangan gagalkan penerbitan
  await sendWa(reg.whatsapp, msgCertificate(reg.name, cert.number, certUrl)).catch((err) =>
    console.error("Gagal kirim WA sertifikat:", err)
  );
  await sendEmail({
    to: reg.email,
    subject: `Selamat! Sertifikat Resmi Anda Telah Terbit - ${reg.program.title}`,
    html: getCertEmailHtml(reg.name, reg.program.title, certUrl),
  }).catch((err) => console.error("Gagal mengirim email sertifikat:", err));

  return { number: cert.number, url: certUrl };
}

/** Filter modul sesuai batch peserta — modul tanpa tautan batch dianggap berlaku untuk semua batch.
 *  Sama persis dengan filter yang dipakai halaman LMS (member/lms/[registrationId]/page.tsx) —
 *  HARUS tetap disinkronkan, supaya progress yang ditampilkan ke peserta (100%) selalu konsisten
 *  dengan syarat yang dipakai untuk menerbitkan sertifikat.
 */
function batchModuleWhere(batchId?: string | null) {
  return batchId
    ? { batchLinks: { some: { batchId } } }
    : {};
}

/** Apakah seluruh materi LMS program (dalam lingkup batch peserta) sudah diselesaikan? */
export async function hasCompletedAllLessons(
  registrationId: string,
  programId: string,
  batchId?: string | null
): Promise<{ done: boolean; total: number; completed: number }> {
  const moduleWhere = { programId, ...batchModuleWhere(batchId) };
  const [total, completed] = await Promise.all([
    prisma.lesson.count({ where: { module: moduleWhere } }),
    prisma.completion.count({ where: { registrationId, lesson: { module: moduleWhere } } }),
  ]);
  return { done: total > 0 && completed >= total, total, completed };
}

/** Apakah seluruh kuis dalam kurikulum (lingkup batch peserta) sudah lulus? (kuis selesai = lulus) */
export async function hasPassedAllQuizzes(
  registrationId: string,
  programId: string,
  batchId?: string | null
): Promise<{ done: boolean; total: number; completed: number }> {
  const moduleWhere = { programId, ...batchModuleWhere(batchId) };
  const [total, completed] = await Promise.all([
    prisma.lesson.count({ where: { type: "QUIZ", module: moduleWhere } }),
    prisma.completion.count({ where: { registrationId, lesson: { type: "QUIZ", module: moduleWhere } } }),
  ]);
  return { done: total > 0 && completed >= total, total, completed };
}

/** Bandingkan `now` terhadap kapan sertifikat boleh mulai terbit — murni fungsi tanggal, tanpa
 *  DB. WEBINAR dapat jeda tambahan 1×24 jam (sesi harus selesai dulu, bukan cuma mulai); tipe
 *  lain (KELAS/WORKSHOP/BOOTCAMP) cukup begitu jadwal batch/programnya mulai. */
function scheduleGateStatus(programType: string, sessionAt: Date): { open: boolean; availableAt: Date; reason: string } {
  const availableAt = programType === "WEBINAR" ? new Date(sessionAt.getTime() + CERT_CLAIM_DELAY_MS) : sessionAt;
  const open = new Date() >= availableAt;
  const reason =
    programType === "WEBINAR"
      ? `Sertifikat baru bisa diklaim mulai ${formatJadwal(availableAt)} (1×24 jam setelah sesi berakhir).`
      : `Sertifikat baru bisa diklaim setelah batch Anda dimulai pada ${formatJadwal(availableAt)}.`;
  return { open, availableAt, reason };
}

/**
 * Gerbang jadwal MURNI (tanpa cek penyelesaian materi/kuis) — dipakai admin utk override manual
 * (mis. tandai registrasi "PASSED" langsung tanpa lewat LMS). Override manual boleh melewati
 * syarat penyelesaian materi, tapi TIDAK BOLEH melewati syarat jadwal batch — kalau tidak,
 * publish sertifikat program bisa langsung memblast sertifikat + WA ke peserta batch yang
 * belum mulai, hanya karena registrasi mereka sempat ditandai PASSED sebelum batch itu berjalan.
 */
export async function isScheduleGateOpen(
  registrationId: string,
  program: { type: string; scheduleAt: Date }
): Promise<{ open: boolean; availableAt: Date; reason: string }> {
  const reg = await prisma.registration.findUnique({
    where: { id: registrationId },
    select: { batch: { select: { scheduleAt: true } } },
  });
  return scheduleGateStatus(program.type, reg?.batch?.scheduleAt ?? program.scheduleAt);
}

/**
 * Cek kelayakan sertifikat sesuai kriteria program.
 * Gerbang publish: `program.certPublished` harus true — admin sengaja menahan penerbitan
 * sampai desain sertifikat diuji di /webadmin/program/[id]/cert, supaya tidak ada sertifikat
 * salah/belum final yang keburu terkirim ke peserta.
 * Program WEBINAR: klaim baru terbuka 1×24 jam setelah jadwal sesi (batch bila ada,
 * kalau tidak pakai jadwal program) — cegah klaim sebelum sesi selesai/dimulai.
 * Program tanpa materi sama sekali → layak setelah lewat jeda itu (kalau bukan webinar,
 * langsung layak). Program dengan materi/kuis tetap harus lulus itu di atasnya.
 * Perhitungan materi/kuis batch-aware: mengikuti modul yang benar-benar berlaku untuk
 * batch peserta (sama seperti yang ditampilkan di layar LMS-nya).
 */
export async function checkCertEligibility(
  registrationId: string,
  program: { id: string; type: string; scheduleAt: Date; completionCriteria: "ALL_LESSONS" | "ALL_QUIZZES"; certPublished: boolean }
): Promise<{ eligible: boolean; reason?: string; availableAt?: Date }> {
  if (!(await isCertIssuanceEnabled())) {
    return {
      eligible: false,
      reason: "Penerbitan sertifikat sedang dihentikan sementara untuk pemeliharaan. Coba lagi nanti atau hubungi admin.",
    };
  }

  if (!program.certPublished) {
    return {
      eligible: false,
      reason: "Sertifikat program ini belum dipublikasikan admin ke peserta. Hubungi admin jika ini seharusnya sudah aktif.",
    };
  }

  const reg = await prisma.registration.findUnique({
    where: { id: registrationId },
    select: { batchId: true, batch: { select: { scheduleAt: true } } },
  });

  const gate = scheduleGateStatus(program.type, reg?.batch?.scheduleAt ?? program.scheduleAt);
  if (!gate.open) {
    return { eligible: false, availableAt: gate.availableAt, reason: gate.reason };
  }

  const batchId = reg?.batchId ?? null;
  const totalLessons = await prisma.lesson.count({ where: { module: { programId: program.id, ...batchModuleWhere(batchId) } } });
  if (totalLessons === 0) return { eligible: true };

  if (program.completionCriteria === "ALL_QUIZZES") {
    const quiz = await hasPassedAllQuizzes(registrationId, program.id, batchId);
    if (quiz.total === 0) {
      // tidak ada kuis → jatuh ke penyelesaian materi
      const les = await hasCompletedAllLessons(registrationId, program.id, batchId);
      return les.done
        ? { eligible: true }
        : { eligible: false, reason: `Selesaikan semua materi dulu (${les.completed}/${les.total}).` };
    }
    return quiz.done
      ? { eligible: true }
      : { eligible: false, reason: `Lulusi semua tes dulu (${quiz.completed}/${quiz.total} tes lulus).` };
  }

  const les = await hasCompletedAllLessons(registrationId, program.id, batchId);
  return les.done
    ? { eligible: true }
    : { eligible: false, reason: `Selesaikan semua materi dulu (${les.completed}/${les.total}).` };
}
