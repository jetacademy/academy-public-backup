import { prisma } from "@/lib/prisma";

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Awal hari ini menurut kalender WIB (UTC+7), sebagai Date UTC. */
export function startOfTodayWib(now = new Date()): Date {
  const wib = new Date(now.getTime() + WIB_OFFSET_MS);
  wib.setUTCHours(0, 0, 0, 0);
  return new Date(wib.getTime() - WIB_OFFSET_MS);
}

/** Pertanyaan yang memakai token hari ini — jawaban dari cache & yang gagal tidak dihitung. */
export async function usedToday(identifier: string): Promise<number> {
  return prisma.helpChatLog.count({
    where: { identifier, cached: false, error: null, createdAt: { gte: startOfTodayWib() } },
  });
}
