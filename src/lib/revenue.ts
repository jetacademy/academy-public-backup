import { prisma } from "@/lib/prisma";

export interface DailyRevenueItem {
  date: string;       // YYYY-MM-DD
  label: string;      // "19 Sep"
  dayName: string;    // "Sabtu"
  fullDate: string;   // "19 September 2026"
  paidCount: number;
  amount: number;
}

export interface MonthlyRevenueItem {
  monthKey: string;   // YYYY-MM
  label: string;      // "September 2026"
  paidCount: number;
  amount: number;
  avgAmount: number;
}

export interface BatchRevenueItem {
  batchId: string;
  batchName: string;
  programId: string;
  programTitle: string;
  batchType: string;      // "ONLINE" | "OFFLINE"
  scheduleAt: string;     // ISO string
  scheduleFormatted: string; // "Sabtu, 20 Sep 2026 · 09:00 WIB"
  isPast: boolean;
  isActive: boolean;
  totalRegs: number;
  paidRegs: number;
  totalRevenue: number;
  conversionRate: number; // 0 - 100
  daysLeft?: number;
  daysLeftLabel?: string;
  daysLeftShort?: string;
  isNearest?: boolean;
}

interface DailyRowRaw {
  day: Date | string;
  paid_count: bigint;
  total: number | null;
}

interface MonthlyRowRaw {
  ym: string;
  paid_count: bigint;
  total: number | null;
}

interface BatchRowRaw {
  batch_id: string;
  batch_name: string | null;
  batch_type: string;
  schedule_at: Date;
  is_active: boolean;
  program_id: string;
  program_title: string;
  total_regs: bigint;
  paid_regs: bigint;
  total_revenue: number | null;
}

const INDO_DAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const INDO_MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

/**
 * Menghitung selisih hari batch secara akurat berdasarkan kalender WIB (Asia/Jakarta).
 */
export function getDaysLeftDetail(targetDateInput: Date | string, nowInput: Date = new Date()): {
  daysLeft: number;
  label: string;
  shortLabel: string;
  isPast: boolean;
  isToday: boolean;
} {
  const target = typeof targetDateInput === "string" ? new Date(targetDateInput) : targetDateInput;
  if (Number.isNaN(target.getTime())) {
    return { daysLeft: 0, label: "—", shortLabel: "—", isPast: false, isToday: false };
  }

  const WIB_OFFSET = 7 * 60 * 60 * 1000;
  const targetWib = new Date(target.getTime() + WIB_OFFSET);
  const nowWib = new Date(nowInput.getTime() + WIB_OFFSET);

  const targetDayUtc = Date.UTC(targetWib.getUTCFullYear(), targetWib.getUTCMonth(), targetWib.getUTCDate());
  const nowDayUtc = Date.UTC(nowWib.getUTCFullYear(), nowWib.getUTCMonth(), nowWib.getUTCDate());

  const diffDays = Math.round((targetDayUtc - nowDayUtc) / (24 * 60 * 60 * 1000));

  if (diffDays < 0) {
    return { daysLeft: diffDays, label: "Selesai", shortLabel: "Selesai", isPast: true, isToday: false };
  }
  if (diffDays === 0) {
    return { daysLeft: 0, label: "Hari ini", shortLabel: "Hari ini", isPast: false, isToday: true };
  }
  if (diffDays === 1) {
    return { daysLeft: 1, label: "Besok (1 hari lagi)", shortLabel: "Besok", isPast: false, isToday: false };
  }
  return { daysLeft: diffDays, label: `${diffDays} hari lagi`, shortLabel: `${diffDays} hari lagi`, isPast: false, isToday: false };
}

/**
 * Mengambil rekap harian 90 hari terakhir (WIB) langsung via SQL aggregate.
 * Ringan & cepat: hanya mengembalikan 90 row, dieksekusi dalam beberapa milidetik.
 */
export async function getDailyRevenueData(days: number = 90): Promise<DailyRevenueItem[]> {
  try {
    const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
    const nowWib = new Date(Date.now() + WIB_OFFSET_MS);
    const todayWib = new Date(Date.UTC(nowWib.getUTCFullYear(), nowWib.getUTCMonth(), nowWib.getUTCDate()));
    const sinceWib = new Date(todayWib.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
    const sinceUtc = new Date(sinceWib.getTime() - WIB_OFFSET_MS);

    const rows = await prisma.$queryRaw<DailyRowRaw[]>`
      SELECT 
        DATE(DATE_ADD(paidAt, INTERVAL 7 HOUR)) as day,
        COUNT(id) as paid_count,
        SUM(amount) as total
      FROM payment
      WHERE status = 'PAID' AND paidAt >= ${sinceUtc}
      GROUP BY day
      ORDER BY day ASC
    `;

    const byDate = new Map<string, { count: number; amount: number }>();
    for (const r of rows) {
      const key = new Date(r.day).toISOString().slice(0, 10);
      byDate.set(key, {
        count: Number(r.paid_count),
        amount: Number(r.total ?? 0),
      });
    }

    const result: DailyRevenueItem[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(sinceWib.getTime() + i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      const dayOfWeek = d.getUTCDay();
      const dayNum = d.getUTCDate();
      const monthIdx = d.getUTCMonth();
      const year = d.getUTCFullYear();

      const itemData = byDate.get(key) ?? { count: 0, amount: 0 };
      result.push({
        date: key,
        label: `${dayNum} ${INDO_MONTHS[monthIdx].slice(0, 3)}`,
        dayName: INDO_DAYS[dayOfWeek],
        fullDate: `${dayNum} ${INDO_MONTHS[monthIdx]} ${year}`,
        paidCount: itemData.count,
        amount: itemData.amount,
      });
    }

    return result;
  } catch (err) {
    console.error("[getDailyRevenueData] Database error:", err);
    return [];
  }
}

/**
 * Mengambil rekap bulanan 24 bulan terakhir via SQL aggregate.
 * Sangat efisien (maksimal 24 row).
 */
export async function getMonthlyRevenueData(limit: number = 24): Promise<MonthlyRevenueItem[]> {
  try {
    const rows = await prisma.$queryRaw<MonthlyRowRaw[]>`
      SELECT 
        DATE_FORMAT(DATE_ADD(paidAt, INTERVAL 7 HOUR), '%Y-%m') as ym,
        COUNT(id) as paid_count,
        SUM(amount) as total
      FROM payment
      WHERE status = 'PAID'
      GROUP BY ym
      ORDER BY ym DESC
      LIMIT ${limit}
    `;

    return rows.map((r) => {
      const ym = String(r.ym);
      const [yearStr, monthStr] = ym.split("-");
      const monthIdx = parseInt(monthStr, 10) - 1;
      const monthName = INDO_MONTHS[monthIdx] || ym;
      const label = `${monthName} ${yearStr}`;
      const paidCount = Number(r.paid_count);
      const amount = Number(r.total ?? 0);
      const avgAmount = paidCount > 0 ? Math.round(amount / paidCount) : 0;

      return {
        monthKey: ym,
        label,
        paidCount,
        amount,
        avgAmount,
      };
    });
  } catch (err) {
    console.error("[getMonthlyRevenueData] Database error:", err);
    return [];
  }
}

/**
 * Mengambil rekap per batch dan program non-batch via SQL aggregate berindeks.
 * Dibatasi 50 batch terbaru agar loading tetap instan.
 */
export async function getBatchRevenueData(limit: number = 50): Promise<BatchRevenueItem[]> {
  try {
    const now = new Date();

    const [batchRows, noBatchRows] = await Promise.all([
      prisma.$queryRaw<BatchRowRaw[]>`
        SELECT 
          pb.id as batch_id,
          pb.name as batch_name,
          pb.batchType as batch_type,
          pb.scheduleAt as schedule_at,
          pb.isActive as is_active,
          pr.id as program_id,
          pr.title as program_title,
          COUNT(DISTINCT r.id) as total_regs,
          COUNT(DISTINCT CASE WHEN r.status IN ('PAID', 'PASSED') THEN r.id END) as paid_regs,
          COALESCE(SUM(CASE WHEN p.status = 'PAID' THEN p.amount ELSE 0 END), 0) as total_revenue
        FROM programbatch pb
        JOIN program pr ON pr.id = pb.programId
        LEFT JOIN registration r ON r.batchId = pb.id
        LEFT JOIN payment p ON p.registrationId = r.id
        GROUP BY pb.id, pb.name, pb.batchType, pb.scheduleAt, pb.isActive, pr.id, pr.title
        ORDER BY pb.scheduleAt DESC
        LIMIT ${limit}
      `,
      prisma.$queryRaw<BatchRowRaw[]>`
        SELECT 
          CONCAT('nobatch_', pr.id) as batch_id,
          'Non-Batch (Reguler)' as batch_name,
          'ONLINE' as batch_type,
          pr.scheduleAt as schedule_at,
          pr.isActive as is_active,
          pr.id as program_id,
          pr.title as program_title,
          COUNT(DISTINCT r.id) as total_regs,
          COUNT(DISTINCT CASE WHEN r.status IN ('PAID', 'PASSED') THEN r.id END) as paid_regs,
          COALESCE(SUM(CASE WHEN p.status = 'PAID' THEN p.amount ELSE 0 END), 0) as total_revenue
        FROM program pr
        JOIN registration r ON r.programId = pr.id AND r.batchId IS NULL
        LEFT JOIN payment p ON p.registrationId = r.id
        GROUP BY pr.id, pr.title, pr.scheduleAt, pr.isActive
        HAVING total_regs > 0
        ORDER BY pr.scheduleAt DESC
        LIMIT 20
      `,
    ]);

    const formatJadwalWIB = (d: Date): string => {
      try {
        return new Intl.DateTimeFormat("id-ID", {
          weekday: "long",
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Asia/Jakarta",
        }).format(new Date(d)).replace(/\./g, ":") + " WIB";
      } catch {
        return "—";
      }
    };

    const combined: BatchRevenueItem[] = [];

    for (const b of batchRows) {
      const scheduleDate = new Date(b.schedule_at);
      const totalRegs = Number(b.total_regs);
      const paidRegs = Number(b.paid_regs);
      const totalRevenue = Number(b.total_revenue ?? 0);
      const conversionRate = totalRegs > 0 ? Math.round((paidRegs / totalRegs) * 100) : 0;
      const diff = getDaysLeftDetail(scheduleDate, now);

      combined.push({
        batchId: b.batch_id,
        batchName: b.batch_name || "Batch",
        programId: b.program_id,
        programTitle: b.program_title,
        batchType: b.batch_type || "ONLINE",
        scheduleAt: scheduleDate.toISOString(),
        scheduleFormatted: formatJadwalWIB(scheduleDate),
        isPast: diff.isPast,
        isActive: Boolean(b.is_active),
        totalRegs,
        paidRegs,
        totalRevenue,
        conversionRate,
        daysLeft: diff.daysLeft,
        daysLeftLabel: diff.label,
        daysLeftShort: diff.shortLabel,
      });
    }

    for (const nb of noBatchRows) {
      const scheduleDate = new Date(nb.schedule_at);
      const totalRegs = Number(nb.total_regs);
      const paidRegs = Number(nb.paid_regs);
      const totalRevenue = Number(nb.total_revenue ?? 0);
      const conversionRate = totalRegs > 0 ? Math.round((paidRegs / totalRegs) * 100) : 0;

      combined.push({
        batchId: nb.batch_id,
        batchName: "Non-Batch / Mandiri",
        programId: nb.program_id,
        programTitle: nb.program_title,
        batchType: "ONLINE",
        scheduleAt: scheduleDate.toISOString(),
        scheduleFormatted: "Reguler / Self-Paced",
        isPast: false,
        isActive: Boolean(nb.is_active),
        totalRegs,
        paidRegs,
        totalRevenue,
        conversionRate,
        daysLeft: 99999,
        daysLeftLabel: "Reguler",
        daysLeftShort: "Reguler",
      });
    }

    // Urutan default (Gambar 2): Batch terdekat ditaruh di paling atas!
    // 1. Batch terjadwal mendatang (scheduleAt terdekat ke sekarang berada di index 0)
    // 2. Program Non-Batch (self-paced)
    // 3. Batch yang sudah selesai (diurutkan dari yang paling baru selesai ke yang lama)
    combined.sort((a, b) => {
      const isNoBatchA = a.batchId.startsWith("nobatch_");
      const isNoBatchB = b.batchId.startsWith("nobatch_");

      // Batch terjadwal mendatang selalu di posisi teratas
      if (!a.isPast && !isNoBatchA && (b.isPast || isNoBatchB)) return -1;
      if (!b.isPast && !isNoBatchB && (a.isPast || isNoBatchA)) return 1;

      // Antar batch mendatang: yang jadwalnya paling dekat ke hari ini ditaruh paling atas
      if (!a.isPast && !isNoBatchA && !b.isPast && !isNoBatchB) {
        return new Date(a.scheduleAt).getTime() - new Date(b.scheduleAt).getTime();
      }

      // Non-batch sebelum batch selesai
      if (!a.isPast && isNoBatchA && b.isPast) return -1;
      if (!b.isPast && isNoBatchB && a.isPast) return 1;

      // Antar batch yang sudah selesai: yang baru saja selesai di atas
      return new Date(b.scheduleAt).getTime() - new Date(a.scheduleAt).getTime();
    });

    // Tandai batch terdekat pertama
    const firstUpcoming = combined.find((b) => !b.isPast && !b.batchId.startsWith("nobatch_"));
    if (firstUpcoming) {
      firstUpcoming.isNearest = true;
    }

    return combined;
  } catch (err) {
    console.error("[getBatchRevenueData] Database error:", err);
    return [];
  }
}
