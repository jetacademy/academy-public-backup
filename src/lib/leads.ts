import type { LeadStatus } from "@prisma/client";

/**
 * Logika jadwal follow-up otomatis per kategori lead (keputusan owner 29 Agu 2026).
 *
 * Prinsip: begitu status lead berubah (NEW → INTERESTED / POTENTIAL / COLD),
 * sistem menghitung `nextFollowUpAt` secara otomatis — admin/tim tidak perlu
 * mengetik tanggal manual. Timing mengikuti SOP CS yang sudah terbukti (D+1/D+3/D+7).
 *
 * Skedul (hari sejak follow-up terakhir / sejak lead dibuat):
 * - NEW        : D+1  — sapa & kembangkan, konfirmasi bidang usaha.
 * - INTERESTED : D+1  — lead sudah tunjuk minat (tanya harga/jadwal/sign beli).
 *                 ... alur closing ketat; follow-up selanjutnya tetap D+1 s/d closed.
 * - POTENTIAL  : D+1 → D+3 → D+7 — lead tanya-tanya belum commit; naikkan nilai
 *                 tiap tahap (D+1 cek kejelasan → D+3 nilai tambah/testimoni → D+7 closing akhir).
 * - COLD       : D+7  — respon minim; follow-up ringan, jeda panjang.
 */
const SCHEDULE_DAYS: Record<LeadStatus, number[]> = {
  NEW: [1, 3, 7],
  INTERESTED: [1, 1, 1],
  POTENTIAL: [1, 3, 7],
  COLD: [7, 7, 14],
};

/**
 * Hitung jadwal follow-up berikutnya berdasarkan status & jumlah follow-up
 * yang sudah dilakukan.
 *
 * @param status       status lead saat ini
 * @param followUpCount jumlah follow-up yang sudah tercatat
 * @param from         titik acuan (biasanya lastFollowUpAt ?? createdAt)
 * @returns Date berikutnya, atau null jika tidak perlu follow-up
 */
export function computeNextFollowUp(
  status: LeadStatus,
  followUpCount: number,
  from: Date = new Date(),
): Date | null {
  const days = SCHEDULE_DAYS[status];
  if (!days || days.length === 0) return null;
  const idx = Math.min(Math.max(followUpCount, 0), days.length - 1);
  const next = new Date(from.getTime() + days[idx] * 86_400_000);
  return next;
}

/**
 * Normalisasi nomor WhatsApp untuk pencocokan & kirim:
 * - buang semua non-digit
 * - jika diawali `0`, ganti ke kode negara `62` (format internasional WA)
 * - jaga format LID (berisi karakter `@`) agar tidak diproses angka
 */
export function normalizeWhatsapp(raw: string): string {
  const trimmed = String(raw ?? "").trim();
  // Formatter LID (mis. "12345@lid") / email — biarkan utuh (bukan nomor WA biasa)
  if (trimmed.includes("@") || trimmed.includes("lid")) return trimmed;
  let digits = trimmed.replace(/[^0-9]/g, "");
  if (digits.length <= 15 && digits.startsWith("0")) {
    digits = "62" + digits.slice(1);
  }
  return digits;
}

/** Status follow-up yang dianggap "butuh tindakan hari ini atau sudah lewat". */
export function isFollowUpDue(nextFollowUpAt: Date | null, now: Date = new Date()): boolean {
  if (!nextFollowUpAt) return false;
  return nextFollowUpAt.getTime() <= now.getTime();
}

/** Status yang masih "berjalan" (belum terminal) — selain ACTIVE, hasil terminal menutup pipeline. */
export const TERMINAL_RESULTS = ["REGISTERED", "PAID", "CANCELLED", "NO_REPLY"] as const;

export type LeadResultValue = "ACTIVE" | "REGISTERED" | "PAID" | "CANCELLED" | "NO_REPLY";

export function isTerminalResult(result: string): boolean {
  return (TERMINAL_RESULTS as readonly string[]).includes(result);
}