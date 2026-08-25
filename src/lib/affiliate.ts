import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { Affiliate, AffiliateSettings, VoucherType } from "@prisma/client";
import { rupiah } from "@/lib/format";
import { sendWa, msgAffiliateWithdrawalCompleted, msgAffiliateWithdrawalRejected } from "@/lib/wa";
import { sendEmail, getAffiliateWithdrawalEmailHtml } from "@/lib/email";

export const AFFILIATE_REF_COOKIE = "jsa_aff_ref";

/** Baca cookie atribusi affiliate dengan aman — kembalikan null (bukan throw) di luar konteks
 *  request (mis. unit test yang memanggil route handler langsung tanpa server Next.js). */
export async function getAffiliateRefCookie(): Promise<string | null> {
  try {
    return (await cookies()).get(AFFILIATE_REF_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
}

// ---------- Pengaturan global (singleton) ----------

const SETTINGS_ID = "singleton";

/** Ambil pengaturan program affiliate, buat baris default jika belum ada. */
export async function getAffiliateSettings(): Promise<AffiliateSettings> {
  const existing = await prisma.affiliateSettings.findUnique({ where: { id: SETTINGS_ID } });
  if (existing) return existing;
  return prisma.affiliateSettings.create({ data: { id: SETTINGS_ID } });
}

// ---------- Kode referral ----------

/** Kode dari nama: huruf besar, alfanumerik saja, dipotong 10 karakter + akhiran acak jika perlu. */
function baseCodeFromName(name: string): string {
  const clean = name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
  return clean.length >= 3 ? clean : `AFF${clean}`;
}

/** Buat kode referral unik — dicoba dari nama dulu, lalu ditambah angka acak jika sudah dipakai. */
export async function generateUniqueAffiliateCode(name: string): Promise<string> {
  const base = baseCodeFromName(name);
  let candidate = base;
  for (let attempt = 0; attempt < 20; attempt++) {
    const clash = await prisma.affiliate.findUnique({ where: { code: candidate } });
    if (!clash) return candidate;
    candidate = `${base}${Math.floor(100 + Math.random() * 900)}`;
  }
  // fallback nyaris tidak mungkin tercapai — pakai suffix waktu agar pasti unik
  return `${base}${Date.now().toString().slice(-6)}`;
}

/** Validasi format kode custom yang diinput user (bukan hasil generate otomatis). */
export function normalizeCustomCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 20);
}

/** Cari affiliate AKTIF berdasarkan kode — dipakai saat checkout untuk menerapkan diskon. */
export async function findActiveAffiliateByCode(codeInput: string): Promise<Affiliate | null> {
  const code = codeInput.trim().toUpperCase();
  if (!code) return null;
  const affiliate = await prisma.affiliate.findUnique({ where: { code } });
  if (!affiliate || affiliate.status !== "ACTIVE") return null;
  return affiliate;
}

/**
 * Tentukan affiliate mana yang berlaku untuk sebuah transaksi checkout: kode yang diketik manual
 * di kolom "Kode Voucher/Afiliasi" diprioritaskan, baru fallback ke cookie atribusi dari link
 * referral (?ref=KODE) jika kolom itu kosong atau bukan kode affiliate yang valid.
 */
export async function resolveAffiliateForCheckout(
  manualCode: string,
  cookieCode: string | null
): Promise<Affiliate | null> {
  const manual = manualCode.trim();
  if (manual) {
    const byManual = await findActiveAffiliateByCode(manual);
    if (byManual) return byManual;
  }
  if (cookieCode) {
    return findActiveAffiliateByCode(cookieCode);
  }
  return null;
}

// ---------- Diskon customer & komisi affiliate ----------

export type AffiliateDiscountApplication = {
  affiliate: Affiliate;
  discountAmount: number;
  finalAmount: number;
};

/** Hitung potongan harga customer dari rate diskon affiliate — pola sama seperti validateVoucher. */
export function applyAffiliateDiscount(affiliate: Affiliate, baseAmount: number): AffiliateDiscountApplication {
  let discountAmount: number;
  if (affiliate.discountType === "PERCENT") {
    discountAmount = Math.floor((baseAmount * affiliate.discountValue) / 100);
  } else {
    discountAmount = affiliate.discountValue;
  }
  discountAmount = Math.max(0, Math.min(discountAmount, baseAmount));
  const finalAmount = Math.max(0, baseAmount - discountAmount);
  return { affiliate, discountAmount, finalAmount };
}

function calcCommission(type: VoucherType, value: number, saleAmount: number): number {
  const raw = type === "PERCENT" ? Math.floor((saleAmount * value) / 100) : value;
  return Math.max(0, Math.min(raw, saleAmount));
}

/**
 * Catat komisi setelah Payment BENAR-BENAR berstatus PAID. Idempoten (aman dipanggil berkali-kali
 * dari webhook yang mungkin terkirim ulang) — no-op jika payment tidak punya affiliate atau
 * konversi untuk payment ini sudah pernah dibuat.
 */
export async function recordAffiliateConversion(paymentId: string): Promise<void> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { affiliateConversion: true },
  });
  if (!payment || !payment.affiliateId || payment.status !== "PAID") return;
  if (payment.affiliateConversion) return; // sudah pernah dicatat

  const affiliate = await prisma.affiliate.findUnique({ where: { id: payment.affiliateId } });
  if (!affiliate) return;

  const settings = await getAffiliateSettings();
  const commissionAmount = calcCommission(affiliate.commissionType, affiliate.commissionValue, payment.amount);
  const now = new Date();
  const availableAt = new Date(now.getTime() + Math.max(0, settings.holdDays) * 24 * 60 * 60 * 1000);
  const immediatelyAvailable = settings.holdDays <= 0;

  await prisma.affiliateConversion.create({
    data: {
      affiliateId: affiliate.id,
      paymentId: payment.id,
      registrationId: payment.registrationId,
      saleAmount: payment.amount,
      discountGiven: payment.discountAmount,
      commissionAmount,
      commissionTypeSnapshot: affiliate.commissionType,
      commissionRateSnapshot: affiliate.commissionValue,
      status: immediatelyAvailable ? "AVAILABLE" : "PENDING",
      availableAt,
    },
  });
}

/** Batalkan komisi karena payment induk direfund. Tidak menyentuh komisi yang sudah WITHDRAWN
 *  (dana sudah keluar) — kembalikan flag itu agar admin tahu perlu rekonsiliasi manual. */
export async function voidAffiliateConversion(
  paymentId: string,
  reason: string
): Promise<{ voided: boolean; alreadyWithdrawn: boolean }> {
  const conversion = await prisma.affiliateConversion.findUnique({ where: { paymentId } });
  if (!conversion || conversion.status === "VOIDED") return { voided: false, alreadyWithdrawn: false };
  if (conversion.status === "WITHDRAWN") return { voided: false, alreadyWithdrawn: true };

  await prisma.affiliateConversion.update({
    where: { id: conversion.id },
    data: { status: "VOIDED", voidedAt: new Date(), voidReason: reason },
  });
  return { voided: true, alreadyWithdrawn: false };
}

/** Naikkan status komisi PENDING → AVAILABLE begitu masa tahan (holdDays) lewat. Dipanggil "lazy"
 *  (bukan cron) — setiap kali affiliate membuka dashboard atau mengajukan penarikan. */
export async function promoteDueConversions(affiliateId: string): Promise<void> {
  await prisma.affiliateConversion.updateMany({
    where: { affiliateId, status: "PENDING", availableAt: { lte: new Date() } },
    data: { status: "AVAILABLE" },
  });
}

export type AffiliateBalance = {
  availableTotal: number; // komisi AVAILABLE (sudah lewat masa tahan)
  pendingTotal: number; // komisi PENDING (masih dalam masa tahan)
  inFlightWithdrawal: number; // penarikan REQUESTED/PROCESSING yang belum kelar (mengurangi yang bisa ditarik lagi)
  withdrawableNow: number; // availableTotal - inFlightWithdrawal, tidak pernah negatif
  totalWithdrawn: number; // total komisi yang sudah selesai dicairkan (histori)
  totalEarned: number; // total komisi AVAILABLE + WITHDRAWN + PENDING (belum termasuk yang VOIDED)
};

/** Hitung saldo affiliate langsung dari ledger (bukan cache) — selalu akurat, tidak bisa drift. */
export async function getAffiliateBalance(affiliateId: string): Promise<AffiliateBalance> {
  await promoteDueConversions(affiliateId);

  const [availableAgg, pendingAgg, withdrawnAgg, inFlightAgg] = await Promise.all([
    prisma.affiliateConversion.aggregate({
      where: { affiliateId, status: "AVAILABLE" },
      _sum: { commissionAmount: true },
    }),
    prisma.affiliateConversion.aggregate({
      where: { affiliateId, status: "PENDING" },
      _sum: { commissionAmount: true },
    }),
    prisma.affiliateConversion.aggregate({
      where: { affiliateId, status: "WITHDRAWN" },
      _sum: { commissionAmount: true },
    }),
    prisma.affiliateWithdrawal.aggregate({
      where: { affiliateId, status: { in: ["REQUESTED", "PROCESSING"] } },
      _sum: { amount: true },
    }),
  ]);

  const availableTotal = availableAgg._sum.commissionAmount ?? 0;
  const pendingTotal = pendingAgg._sum.commissionAmount ?? 0;
  const totalWithdrawn = withdrawnAgg._sum.commissionAmount ?? 0;
  const inFlightWithdrawal = inFlightAgg._sum.amount ?? 0;
  const withdrawableNow = Math.max(0, availableTotal - inFlightWithdrawal);

  return {
    availableTotal,
    pendingTotal,
    inFlightWithdrawal,
    withdrawableNow,
    totalWithdrawn,
    totalEarned: availableTotal + pendingTotal + totalWithdrawn,
  };
}

/** Tandai sejumlah komisi AVAILABLE (FIFO, dari yang terlama) sebagai WITHDRAWN — dipanggil
 *  saat sebuah AffiliateWithdrawal selesai (COMPLETED). Transaksional + hanya menyentuh
 *  konversi yang masih AVAILABLE (guard status) agar idempoten & aman dari race
 *  antara webhook payout dan penandaan manual oleh admin. */
export async function settleWithdrawalConversions(affiliateId: string, amount: number): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const conversions = await tx.affiliateConversion.findMany({
      where: { affiliateId, status: "AVAILABLE" },
      orderBy: { createdAt: "asc" },
    });

    let remaining = amount;
    const ids: string[] = [];
    for (const c of conversions) {
      if (remaining <= 0) break;
      ids.push(c.id);
      remaining -= c.commissionAmount;
    }
    if (ids.length > 0) {
      // Guard status: hanya update yang masih AVAILABLE — konversi yang sudah
      // disettle oleh proses lain tidak akan tersentuh dua kali.
      await tx.affiliateConversion.updateMany({
        where: { id: { in: ids }, status: "AVAILABLE" },
        data: { status: "WITHDRAWN" },
      });
    }
  });
}

/** Kirim notifikasi WA + email ke affiliate soal hasil pengajuan penarikannya (selesai/ditolak). */
export async function notifyWithdrawalResult(
  withdrawalId: string,
  status: "completed" | "rejected",
  reason?: string
): Promise<void> {
  const withdrawal = await prisma.affiliateWithdrawal.findUnique({
    where: { id: withdrawalId },
    include: { affiliate: { include: { user: true } } },
  });
  if (!withdrawal) return;
  const user = withdrawal.affiliate.user;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const dashboardUrl = `${baseUrl}/member/affiliate`;
  const amountLabel = rupiah(withdrawal.amount);

  if (user.whatsapp) {
    await sendWa(
      user.whatsapp,
      status === "completed"
        ? msgAffiliateWithdrawalCompleted(user.name, amountLabel, dashboardUrl)
        : msgAffiliateWithdrawalRejected(user.name, amountLabel, reason ?? "-", dashboardUrl)
    );
  }
  await sendEmail({
    to: user.email,
    subject: status === "completed" ? "Penarikan Komisi Berhasil Dicairkan" : "Penarikan Komisi Ditolak",
    html: getAffiliateWithdrawalEmailHtml({ name: user.name, amountLabel, status, reason, dashboardUrl }),
  }).catch((err) => console.error("Gagal mengirim email hasil penarikan:", err));
}
