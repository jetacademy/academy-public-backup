"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { createMemberSession, destroyMemberSession, getMemberSession } from "@/lib/member-auth";
import { issueCertificate, checkCertEligibility } from "@/lib/certificates";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendOtp, verifyOtp } from "@/lib/otp";
import { normalizeWa, normalizeIdentifier } from "@/lib/wa";
import { sendEmail, getWelcomeMemberEmailHtml } from "@/lib/email";
import { createInvoice, isXenditConfigured } from "@/lib/xendit";
import { findActiveAffiliateByCode, applyAffiliateDiscount, recordAffiliateConversion, getAffiliateRefCookie } from "@/lib/affiliate";
import { linkLeadToRegistration } from "@/lib/lead-link";

async function loginByIdentifier(cleanVal: string): Promise<{ ok?: boolean; error?: string; isAdmin?: boolean }> {
  // 1. Cari User record terlebih dahulu — user yang baru daftar akun
  //    belum tentu sudah ikut program, dan itu valid.
  const user = await prisma.user.findFirst({
    where: { OR: [{ email: cleanVal }, { whatsapp: cleanVal }] },
    select: { id: true, name: true, email: true, whatsapp: true, role: true },
  });

  // 2. Cari registrasi program yang cocok (untuk backfill)
  const registrations = await prisma.registration.findMany({
    where: { OR: [{ email: cleanVal }, { whatsapp: cleanVal }] },
    select: { id: true, name: true, email: true, whatsapp: true, userId: true },
  }) as { id: string; name: string; email: string; whatsapp: string; userId: string | null }[];

  // Jika tidak ada user maupun registrasi → identifier tidak dikenal
  if (!user && registrations.length === 0) {
    return { error: "Nomor WhatsApp atau Email belum terdaftar. Silakan buat akun baru terlebih dahulu." };
  }

  let userId = user?.id ?? null;
  const email = user?.email ?? registrations[0]?.email ?? cleanVal;
  const whatsapp = user?.whatsapp ?? registrations[0]?.whatsapp ?? "";
  const name = user?.name ?? registrations[0]?.name ?? "";

  // Role HANYA dari DB — tidak ada auto-promote ADMIN berbasis hardcode email.
  const isAdminEmail = false;

  // 3. Jika login via registrasi (belum punya User) — buat User & backfill
  if (!userId && registrations.length > 0) {
    let newUser = await prisma.user.findFirst({
      where: { OR: [{ email }, { whatsapp }] },
      select: { id: true },
    });

    if (!newUser) {
      newUser = await prisma.user.create({
        data: { name, email, whatsapp, role: "STUDENT" },
        select: { id: true },
      });
    }

    userId = newUser.id;

    // Backfill: hubungkan SEMUA registrasi milik user ini yang belum terhubung
    await prisma.registration.updateMany({
      where: {
        userId: null,
        OR: [{ email }, { whatsapp }],
      },
      data: { userId },
    });
  }

  await createMemberSession(cleanVal);
  const updatedUser = await prisma.user.findFirst({
    where: { OR: [{ email }, { whatsapp }] },
    select: { role: true },
  });
  const isAdminRole = updatedUser?.role === "ADMIN" || updatedUser?.role === "TEACHER";
  return { ok: true, isAdmin: isAdminRole };
}

/**
 * Kirim kode OTP ke WhatsApp/Email member untuk login.
 */
export async function memberSendOtp(identifier: string, forceEmail: boolean = false): Promise<{ ok?: boolean; error?: string; channel?: "whatsapp" | "email" | "none" | null }> {
  try {
    const hdrs = await headers();
    const ip = hdrs.get("x-forwarded-for") ?? hdrs.get("x-real-ip") ?? "member-otp";
    const cleanVal = normalizeIdentifier(identifier);
    if (!cleanVal) return { error: "WhatsApp atau Email tidak boleh kosong." };

    // Rate limit ganda: per IP (cegah bot) + per identifier (cegah bypass VPN)
    const limitIp = checkRateLimit(`member-otp-ip:${ip}`, 5, 60_000);
    if (!limitIp.ok) return { error: "Terlalu banyak permintaan OTP. Coba lagi nanti." };
    const limitId = checkRateLimit(`member-otp-id:${cleanVal}`, 3, 60_000);
    if (!limitId.ok) return { error: "Terlalu banyak permintaan OTP untuk akun ini. Coba lagi nanti." };

    return await sendOtp(cleanVal, forceEmail);
  } catch (err) {
    console.error("[memberSendOtp] CRITICAL ERROR:", err);
    return { error: err instanceof Error ? err.message : "Gagal mengirim OTP karena kesalahan server." };
  }
}

/**
 * Verifikasi OTP dan login.
 */
export async function memberVerifyOtp(identifier: string, code: string): Promise<{ ok?: boolean; error?: string; isAdmin?: boolean }> {
  try {
    const hdrs = await headers();
    const ip = hdrs.get("x-forwarded-for") ?? hdrs.get("x-real-ip") ?? "member-verify";
    const limit = checkRateLimit(`member-verify:${ip}`, 5, 60_000);
    if (!limit.ok) return { error: "Terlalu banyak percobaan. Coba lagi nanti." };

    const cleanVal = normalizeIdentifier(identifier);
    const cleanCode = code.trim();
    if (!cleanVal || !cleanCode) return { error: "Data tidak lengkap." };

    const verified = await verifyOtp(cleanVal, cleanCode);
    if (!verified.ok) return verified;

    return await loginByIdentifier(cleanVal);
  } catch (err) {
    console.error("[memberVerifyOtp] CRITICAL ERROR:", err);
    return { error: err instanceof Error ? err.message : "Gagal memverifikasi OTP karena kesalahan server." };
  }
}

/**
 * Login fallback tanpa Google (mode dev / Google belum dikonfigurasi).
 * Di produksi dengan Google aktif, jalur ini ditolak — wajib lewat token terverifikasi.
 */
export async function memberLogin(identifier: string): Promise<{ ok?: boolean; error?: string; isAdmin?: boolean }> {
  try {
    const hdrs = await headers();
    const ip = hdrs.get("x-forwarded-for") ?? hdrs.get("x-real-ip") ?? "member-login";
    const limit = checkRateLimit(`member-login:${ip}`, 10, 60_000);
    if (!limit.ok) return { error: "Terlalu banyak percobaan login. Coba lagi nanti." };

    const cleanVal = normalizeIdentifier(identifier);
    if (!cleanVal) {
      return { error: "WhatsApp atau Email tidak boleh kosong." };
    }

    const googleConfigured = Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);
    if (googleConfigured && process.env.NODE_ENV === "production") {
      return { error: "Silakan masuk menggunakan tombol Google resmi." };
    }

    return await loginByIdentifier(cleanVal);
  } catch (err) {
    console.error("[memberLogin] CRITICAL ERROR:", err);
    return { error: err instanceof Error ? err.message : "Gagal melakukan login karena kesalahan server." };
  }
}

/** Login dengan Google — ID token diverifikasi ke server Google, bukan dipercaya dari client. */
export async function memberLoginWithGoogle(credential: string) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) return { error: "Login Google belum dikonfigurasi." };

  try {
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`,
      { cache: "no-store", signal: AbortSignal.timeout(15_000) }
    );

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[Google tokeninfo] HTTP error:", res.status, body);
      return { error: "Token Google tidak valid. Silakan coba login ulang." };
    }

    const payload = (await res.json()) as {
      aud?: string;
      email?: string;
      email_verified?: string;
      error_description?: string;
    };

    if (payload.error_description) {
      console.error("[Google tokeninfo] Error:", payload.error_description);
      return { error: "Sesi Google sudah kedaluwarsa. Silakan coba login ulang." };
    }

    if (payload.aud !== clientId) {
      console.error("[Google tokeninfo] AUD mismatch:", payload.aud, "!=", clientId);
      return { error: "Token tidak cocok dengan aplikasi ini." };
    }

    if (!payload.email) {
      return { error: "Akun Google tidak mengembalikan email." };
    }

    if (payload.email_verified !== "true") {
      return { error: "Email Google Anda belum diverifikasi." };
    }

    const email = payload.email.trim();
    let name = email.split("@")[0];
    const payloadObj = payload as Record<string, unknown>;
    if (typeof payloadObj.name === "string" && payloadObj.name) {
      name = payloadObj.name;
    }

    // Cari User record
    let user = await prisma.user.findFirst({
      where: { OR: [{ email }, { whatsapp: email }] }
    });

    // Role HANYA dari DB — tidak ada auto-promote ADMIN berbasis hardcode email.
    if (!user) {
      // Cari apakah ada registrasi dengan email ini (misal pendaftaran offline)
      const existingReg = await prisma.registration.findFirst({
        where: { email }
      });
      user = await prisma.user.create({
        data: {
          name: existingReg?.name ?? name,
          email,
          // NULL (bukan "") — kolom whatsapp @unique; string kosong bentrok antar user Google-only
          whatsapp: existingReg?.whatsapp ?? null,
          role: "STUDENT"
        }
      });
      
      // Hubungkan registrasi lama ke user baru jika ada
      await prisma.registration.updateMany({
        where: { email, userId: null },
        data: { userId: user.id }
      });
    }

    await createMemberSession(email);
    const isAdminRole = user.role === "ADMIN" || user.role === "TEACHER";
    return { ok: true, isAdmin: isAdminRole };
  } catch (err) {
    console.error("[memberLoginWithGoogle] Unexpected error:", err);
    return { error: "Terjadi kendala saat memproses akun. Silakan coba lagi, atau gunakan login via WhatsApp/Email di bawah." };
  }
}

export async function memberLogout() {
  await destroyMemberSession();
}

/**
 * Dipanggil dari client (RegisterForm) SETELAH halaman program dirender —
 * bukan lagi bagian dari SSR halaman itu sendiri. Halaman /program/[slug]
 * kini di-ISR (cache), jadi personalisasi (prefill profil + cek sudah
 * terdaftar) dipindah ke sini supaya trafik iklan yang mayoritas anonim
 * tidak menahan proses Node per kunjungan.
 */
export async function getProgramRegistrationStatusAction(programId: string): Promise<{
  isAlreadyRegistered: boolean;
  memberProfile: { name: string; email: string; whatsapp: string; institution: string | null } | null;
}> {
  const sessionVal = await getMemberSession();
  if (!sessionVal) return { isAlreadyRegistered: false, memberProfile: null };

  const [user, lastReg, existingReg, program] = await Promise.all([
    prisma.user.findFirst({
      where: { OR: [{ email: sessionVal }, { whatsapp: sessionVal }] },
      select: { name: true, email: true, whatsapp: true },
    }),
    prisma.registration.findFirst({
      where: { OR: [{ email: sessionVal }, { whatsapp: sessionVal }] },
      select: { name: true, email: true, whatsapp: true, institution: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.registration.findFirst({
      where: { programId, OR: [{ email: sessionVal }, { whatsapp: sessionVal }] },
    }),
    prisma.program.findUnique({ where: { id: programId }, select: { price: true } }),
  ]);

  let memberProfile = null;
  if (user) {
    memberProfile = {
      name: user.name || lastReg?.name || "",
      email: user.email || lastReg?.email || "",
      whatsapp: user.whatsapp || lastReg?.whatsapp || "",
      institution: lastReg?.institution || "",
    };
  } else if (lastReg) {
    memberProfile = { name: lastReg.name, email: lastReg.email, whatsapp: lastReg.whatsapp, institution: lastReg.institution };
  }

  // Samakan dengan gerbang "Kasus 3" di /api/register: webinar gratis (price 0)
  // selalu dianggap sudah terdaftar, program berbayar hanya kalau BENAR lunas.
  const isAlreadyRegistered = !!existingReg && (program?.price === 0 || existingReg.status === "PAID" || existingReg.status === "PASSED");

  return { isAlreadyRegistered, memberProfile };
}

/** Ambil registrasi + validasi bahwa sesi member saat ini adalah pemiliknya */
async function getOwnedRegistration(registrationId: string) {
  const sessionVal = await getMemberSession();
  if (!sessionVal) return null;
  const reg = await prisma.registration.findUnique({
    where: { id: registrationId },
    include: { program: true, batch: true },
  });
  if (!reg) return null;
  if (reg.email !== sessionVal && reg.whatsapp !== sessionVal) return null;
  return reg;
}

export async function completeLesson(registrationId: string, lessonId: string) {
  const reg = await getOwnedRegistration(registrationId);
  if (!reg) return { error: "Sesi tidak valid." };

  // Cek akses pembayaran untuk program berbayar
  if (reg.status === "REGISTERED" && reg.program.price > 0) {
    return { error: "Selesaikan pembayaran terlebih dahulu." };
  }

  // Pastikan lesson memang bagian dari program yang diikuti
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { module: true },
  });
  if (!lesson || lesson.module.programId !== reg.programId) {
    return { error: "Materi tidak ditemukan." };
  }

  // Materi kuis tidak bisa ditandai selesai manual — harus lulus kuisnya
  if (lesson.type === "QUIZ") {
    const passedAttempt = await prisma.testAttempt.findFirst({
      where: { registrationId, lessonId, passed: true },
    });
    if (!passedAttempt) return { error: "Selesaikan kuis dengan skor lulus terlebih dahulu." };
  }

  await prisma.completion.upsert({
    where: { registrationId_lessonId: { registrationId, lessonId } },
    create: { registrationId, lessonId },
    update: {},
  });

  // Auto-terbit sertifikat jika semua persyaratan sudah terpenuhi
  const eligibility = await checkCertEligibility(registrationId, reg.program);
  if (eligibility.eligible) {
    const cert = await issueCertificate(registrationId);
    revalidatePath(`/member/lms/${registrationId}`);
    return { ok: true, certUrl: cert.url };
  }

  revalidatePath(`/member/lms/${registrationId}`);
  return { ok: true };
}

/**
 * Nilai kuis materi (lesson type QUIZ). Kunci jawaban hanya di server.
 * Jika lulus → materi otomatis ditandai selesai.
 */
export async function submitLessonQuiz(
  registrationId: string,
  lessonId: string,
  answers: Record<string, string>
) {
  const reg = await getOwnedRegistration(registrationId);
  if (!reg) return { error: "Sesi tidak valid. Silakan login ulang." };

  // Cek akses pembayaran untuk program berbayar
  if (reg.status === "REGISTERED" && reg.program.price > 0) {
    return { error: "Selesaikan pembayaran terlebih dahulu." };
  }

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { module: true, questions: { orderBy: { order: "asc" } } },
  });
  if (!lesson || lesson.module.programId !== reg.programId || lesson.type !== "QUIZ") {
    return { error: "Kuis tidak ditemukan." };
  }
  if (lesson.questions.length === 0) {
    return { error: "Soal kuis belum tersedia. Hubungi admin." };
  }

  // batas percobaan per kuis (0 = tak terbatas); yang sudah lulus tidak dibatasi ulang
  if (reg.program.maxTestAttempts > 0) {
    const alreadyPassed = await prisma.testAttempt.findFirst({
      where: { registrationId, lessonId, passed: true },
    });
    if (!alreadyPassed) {
      const attemptCount = await prisma.testAttempt.count({ where: { registrationId, lessonId } });
      if (attemptCount >= reg.program.maxTestAttempts) {
        return { error: `Batas ${reg.program.maxTestAttempts}x percobaan untuk tes ini sudah habis. Silakan hubungi admin.` };
      }
    }
  }

  const correctCount = lesson.questions.filter((q: { id: string; correct: string }) => answers[q.id] === q.correct).length;
  const score = Math.round((correctCount / lesson.questions.length) * 100);
  const passingScore = lesson.passingScore ?? reg.program.passingScore;
  const passed = score >= passingScore;

  // Simpan dalam transaksi — atomic: attempt + completion
  await prisma.$transaction(async (tx) => {
    await tx.testAttempt.create({
      data: { registrationId, lessonId, score, passed },
    });
    if (passed) {
      await tx.completion.upsert({
        where: { registrationId_lessonId: { registrationId, lessonId } },
        create: { registrationId, lessonId },
        update: {},
      });
    }
  });

  revalidatePath(`/member/lms/${registrationId}`);

  // Auto-terbit sertifikat jika lulus kuis dan semua persyaratan terpenuhi
  if (passed) {
    const eligibility = await checkCertEligibility(registrationId, reg.program);
    if (eligibility.eligible) {
      const cert = await issueCertificate(registrationId);
      return { ok: true, passed, score, passingScore, certUrl: cert.url };
    }
  }

  return { ok: true, passed, score, passingScore };
}

/**
 * Klaim sertifikat — syarat mengikuti kriteria kelulusan program:
 * penyelesaian semua materi, atau lulus semua tes dalam kurikulum.
 */
export async function claimLessonsCertificate(registrationId: string) {
  const reg = await getOwnedRegistration(registrationId);
  if (!reg) return { error: "Sesi tidak valid. Silakan login ulang." };

  const sessionAt = reg.batch?.scheduleAt ?? reg.program.scheduleAt;
  const freeUntil = new Date(sessionAt.getTime() + 5 * 24 * 60 * 60 * 1000); // H+5
  const isWithinFreePeriod = new Date() <= freeUntil;
  const isFreeClaim = reg.program.price === 0 && isWithinFreePeriod;

  if (reg.status === "REGISTERED" && !isFreeClaim && (reg.program.price > 0 || reg.program.certPrice > 0)) {
    return { error: "Selesaikan pembayaran terlebih dahulu." };
  }

  const check = await checkCertEligibility(registrationId, reg.program);
  if (!check.eligible) {
    return { error: check.reason ?? "Syarat kelulusan belum terpenuhi." };
  }

  const cert = await issueCertificate(registrationId);
  revalidatePath(`/member/lms/${registrationId}`);
  revalidatePath("/member");
  return { ok: true, certUrl: cert.url };
}

/** Daftar akun baru (tanpa perlu program) — via OTP WhatsApp */
export async function registerUser(formData: FormData): Promise<{ ok?: boolean; error?: string; userId?: string }> {
  try {
    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const whatsappRaw = String(formData.get("whatsapp") ?? "").trim();

    if (name.length < 3) return { error: "Nama minimal 3 huruf." };
    if (!/^[a-zA-Z0-9\s'.,&-]+$/.test(name)) return { error: "Nama mengandung karakter tidak valid." };
    const whatsapp = normalizeWa(whatsappRaw);
    if (!/^628[0-9]{8,13}$/.test(whatsapp)) return { error: "Nomor WhatsApp tidak valid (contoh: 08xxx atau 62xxx)." };
    if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Email tidak valid." };

    const hdrs = await headers();
    const ip = hdrs.get("x-forwarded-for") ?? hdrs.get("x-real-ip") ?? "register";
    const limit = checkRateLimit(`register-user:${ip}`, 3, 300_000);
    if (!limit.ok) return { error: "Terlalu banyak permintaan. Coba 5 menit lagi." };

    // Cek apakah email/WA sudah terdaftar sebagai user
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { whatsapp }] },
    });
    if (existing) {
      return { error: "Email atau nomor WhatsApp sudah terdaftar. Silakan login." };
    }

    // Cek apakah sudah ada registrasi dengan data ini (backfill)
    const regs = await prisma.registration.findMany({
      where: { OR: [{ email }, { whatsapp }] },
    });

    // Buat user
    const user = await prisma.user.create({
      data: { name, email, whatsapp, role: "STUDENT" },
    });

    // Hubungkan registrasi yang ada ke user ini
    if (regs.length > 0) {
      await prisma.registration.updateMany({
        where: { id: { in: regs.map((r) => r.id) } },
        data: { userId: user.id },
      });
    }

    // Kirim OTP untuk verifikasi + langsung login
    const otpResult = await sendOtp(email);
    if (!otpResult.ok) {
      return { error: otpResult.error ?? "Gagal mengirim OTP." };
    }

    // Email selamat datang — best-effort
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
    await sendEmail({
      to: email,
      subject: "Selamat Datang di Jetschool Academy!",
      html: getWelcomeMemberEmailHtml(name, `${baseUrl}/member`),
    }).catch((err) => console.error("[registerUser] Gagal kirim email welcome:", err));

    return { ok: true, userId: user.id };
  } catch (err) {
    console.error("[registerUser] CRITICAL ERROR:", err);
    return { error: err instanceof Error ? err.message : "Gagal membuat akun karena kesalahan server." };
  }
}

/**
 * Server Action untuk memulai pembayaran sertifikat (1-Click Checkout).
 * Mengembalikan redirectUrl ke halaman pembayaran Xendit.
 */
export async function initiateCertificateCheckout(registrationId: string) {
  const reg = await getOwnedRegistration(registrationId);
  if (!reg) return { error: "Sesi tidak valid. Silakan login ulang." };

  const program = reg.program;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

  // Gerbang waktu: sertifikat (dan checkout-nya) hanya bisa diakses setelah acara selesai
  // Untuk WEBINAR, "selesai" = scheduleAt + 3 jam (durasi konservatif)
  if (program.type === "WEBINAR") {
    const eventEndTime = new Date(program.scheduleAt.getTime() + 3 * 60 * 60 * 1000);
    if (new Date() < eventEndTime) {
      const formattedEnd = new Intl.DateTimeFormat("id-ID", {
        day: "numeric", month: "long", year: "numeric",
        hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta"
      }).format(eventEndTime);
      return { error: `Klaim sertifikat baru tersedia setelah acara selesai (${formattedEnd} WIB).` };
    }
  }

  // Jika sudah terbit sertifikat, arahkan ke download
  const cert = await prisma.certificate.findUnique({
    where: { registrationId },
  });
  if (cert) {
    return { redirectUrl: `${baseUrl}/sertifikat/${cert.number}` };
  }

  // Jika sudah PAID / GRATIS total, klaim langsung
  if (reg.status === "PAID" || reg.status === "PASSED" || (program.price === 0 && program.certPrice === 0)) {
    return { redirectUrl: `${baseUrl}/member/lms/${registrationId}` };
  }

  // Jika ada invoice pending, gunakan kembali
  const payment = await prisma.payment.findUnique({
    where: { registrationId },
  });
  if (payment?.status === "PENDING" && payment.invoiceUrl) {
    return { redirectUrl: payment.invoiceUrl };
  }

  // Atribusi affiliate otomatis lewat cookie ?ref= (1-click checkout ini tidak punya kolom kode manual)
  const refCookie = await getAffiliateRefCookie();
  const affiliate = refCookie ? await findActiveAffiliateByCode(refCookie) : null;
  const affiliateResult = affiliate ? applyAffiliateDiscount(affiliate, program.certPrice) : null;
  const affiliateId = affiliateResult ? affiliateResult.affiliate.id : null;
  const chargeAmount = affiliateResult ? affiliateResult.finalAmount : program.certPrice;
  const originalAmount = affiliateResult ? program.certPrice : null;
  const discountAmount = affiliateResult ? affiliateResult.discountAmount : 0;

  // MODE DEV tanpa Xendit, ATAU diskon affiliate menutup seluruh harga: langsung tandai lunas
  const xenditReady = isXenditConfigured();
  if (!xenditReady || chargeAmount === 0) {
    if (!xenditReady && process.env.NODE_ENV === "production" && process.env.XENDIT_DEV_BYPASS !== "true") {
      return { error: "Pembayaran belum dikonfigurasi. Hubungi admin." };
    }
    const [payment] = await prisma.$transaction([
      prisma.payment.upsert({
        where: { registrationId: reg.id },
        create: { registrationId: reg.id, amount: chargeAmount, originalAmount, discountAmount, affiliateId, status: "PAID", paidAt: new Date() },
        update: { amount: chargeAmount, originalAmount, discountAmount, affiliateId, status: "PAID", paidAt: new Date() },
      }),
      prisma.registration.update({ where: { id: reg.id }, data: { status: "PAID" } }),
    ]);
    if (affiliateId) await recordAffiliateConversion(payment.id);
    await linkLeadToRegistration(reg.id, reg.whatsapp, reg.programId, true);
    return { redirectUrl: `${baseUrl}/member` };
  }

  // Buat invoice baru
  const invoice = await createInvoice({
    externalId: `ACADEMY-${reg.id}`,
    amount: chargeAmount,
    payerEmail: reg.email,
    description: affiliateResult
      ? `Paket Sertifikat — ${program.title} (${reg.name}) (Affiliate: ${affiliateResult.affiliate.code})`
      : `Paket Sertifikat — ${program.title} (${reg.name})`,
    successRedirectUrl: `${baseUrl}/member`,
  });

  await prisma.payment.upsert({
    where: { registrationId: reg.id },
    create: {
      registrationId: reg.id,
      amount: chargeAmount,
      originalAmount,
      discountAmount,
      affiliateId,
      xenditInvoiceId: invoice.id,
      invoiceUrl: invoice.invoice_url,
    },
    update: {
      amount: chargeAmount,
      originalAmount,
      discountAmount,
      affiliateId,
      xenditInvoiceId: invoice.id,
      invoiceUrl: invoice.invoice_url,
      status: "PENDING",
    },
  });

  return { redirectUrl: invoice.invoice_url };
}
