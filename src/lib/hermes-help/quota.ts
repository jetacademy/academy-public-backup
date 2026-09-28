import { prisma } from "@/lib/prisma";

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Awal hari ini menurut kalender WIB (UTC+7), sebagai Date UTC. */
export function startOfTodayWib(now = new Date()): Date {
  const wib = new Date(now.getTime() + WIB_OFFSET_MS);
  wib.setUTCHours(0, 0, 0, 0);
  return new Date(wib.getTime() - WIB_OFFSET_MS);
}

/** Penanda log untuk request yang dibatalkan peserta — token sudah terpakai, jadi tetap dihitung kuota. */
export const ABORTED = "aborted";

/**
 * Pertanyaan yang memakai token hari ini. Jawaban dari cache tidak dihitung; gangguan dari sisi
 * server/provider juga tidak (bukan salah peserta) — TETAPI request yang dibatalkan peserta
 * dihitung, supaya "kirim lalu batalkan" tidak bisa dipakai untuk memakai token tanpa batas.
 */
export async function usedToday(identifier: string): Promise<number> {
  return prisma.helpChatLog.count({
    where: {
      identifier,
      cached: false,
      OR: [{ error: null }, { error: ABORTED }],
      createdAt: { gte: startOfTodayWib() },
    },
  });
}

/**
 * Plafon biaya harian SELURUH peserta (USD). Pengaman terakhir bila banyak akun dipakai bersamaan
 * (kuota per peserta tidak cukup kalau pendaftaran program gratis terbuka untuk siapa saja).
 */
export function dailyBudgetUsd(): number {
  const v = Number(process.env.HERMES_HELP_DAILY_BUDGET_USD);
  return Number.isFinite(v) && v > 0 ? v : 3;
}

export async function spentTodayUsd(): Promise<number> {
  const r = await prisma.helpChatLog.aggregate({
    where: { createdAt: { gte: startOfTodayWib() } },
    _sum: { costUsd: true },
  });
  return r._sum.costUsd ?? 0;
}

/**
 * Hak memakai Raka = hak akses penuh materi LMS: sudah bayar/lulus, atau program yang benar-benar
 * gratis (tanpa biaya sertifikat). Sama dengan gerbang halaman LMS — peserta mode preview atau
 * yang belum melunasi sertifikat webinar tidak mendapat asisten (menutup celah akun gratisan massal).
 */
export function hasHelpChatAccess(reg: { status: string }, program: { price: number; certPrice: number }): boolean {
  if (reg.status === "PAID" || reg.status === "PASSED") return true;
  return program.price === 0 && program.certPrice === 0;
}
