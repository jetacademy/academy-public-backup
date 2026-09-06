import { prisma } from "@/lib/prisma";
import { FALLBACK_PROGRAMS, type ProgramData, type ProgramType, type Deliverable } from "@/lib/fallback";
import type { ContentBlock } from "@/lib/content-blocks";

/**
 * Ambil program dari MySQL. Jika database belum terhubung / belum di-seed,
 * pakai data contoh supaya website tetap tampil (mode demo).
 */
const upcomingBatchesInclude = {
  where: { isActive: true, scheduleAt: { gte: new Date() } },
  orderBy: { scheduleAt: "asc" as const },
  select: {
    id: true,
    name: true,
    batchType: true,
    scheduleAt: true,
    seatsLeft: true,
    hasOffline: true,
    offlineVenue: true,
    offlineScheduleAt: true,
    offlineSeatsMax: true,
    priceOnline: true,
    priceOnlineEb: true,
    quotaOnlineEb: true,
    priceOffline: true,
    priceOfflineEb: true,
    quotaOfflineEb: true,
  },
};

export async function getPrograms(): Promise<{ programs: ProgramData[]; demo: boolean }> {
  try {
    const rows = await prisma.program.findMany({
      where: { isActive: true },
      include: {
        category: true,
        batches: {
          ...upcomingBatchesInclude,
          take: 1,
        },
      },
      orderBy: { scheduleAt: "asc" },
    });
    if (rows.length === 0) return { programs: [], demo: false };
    return { programs: rows.map(toData), demo: false };
  } catch {
    console.warn("[db] MySQL belum terhubung — menampilkan data contoh.");
    return { programs: FALLBACK_PROGRAMS, demo: true };
  }
}

export async function getProgramBySlug(slug: string): Promise<{ program: ProgramData | null; demo: boolean }> {
  try {
    const row = await prisma.program.findUnique({
      where: { slug },
      include: {
        category: true,
        batches: {
          ...upcomingBatchesInclude,
          take: 20,
        },
      },
    });
    if (row) return { program: toData(row), demo: false };
    // DB query sukses tapi tidak ditemukan — jangan pakai fallback
    return { program: null, demo: false };
  } catch {
    // DB error — coba pakai fallback
    return { program: FALLBACK_PROGRAMS.find((p) => p.slug === slug) ?? null, demo: true };
  }
}

function toData(row: {
  id: string; slug: string; type: string; title: string; tagline: string; description: string;
  emoji: string; imageUrl?: string | null; mentorName: string; mentorBio: string; materi: unknown; deliverables: unknown;
  guarantee: string | null; contentBlocks?: unknown; scheduleAt: Date; durationLabel: string;
  waGroupLink: string | null; lmsLink: string | null;
  price: number; priceOld: number | null; certPrice: number; certPriceOld: number | null;
  seatsLeft: number | null;
  isFeatured: boolean;
  categoryId?: string | null;
  category?: {
    id: string;
    name: string;
    slug: string;
    isFeatured: boolean;
  } | null;
  batches?: ProgramData["batches"];
}): ProgramData {
  const batches = row.batches ?? [];
  // Batch aktif terdekat menggantikan scheduleAt program sebagai "jadwal berikutnya"
  // yang ditampilkan di mana pun — program tanpa batch tetap pakai scheduleAt-nya sendiri.
  const nextScheduleAt = batches[0]?.scheduleAt ?? row.scheduleAt;

  return {
    id: row.id,
    slug: row.slug,
    type: row.type as ProgramType,
    title: row.title,
    tagline: row.tagline,
    description: row.description,
    emoji: row.emoji,
    imageUrl: row.imageUrl,
    mentorName: row.mentorName,
    mentorBio: row.mentorBio,
    materi: Array.isArray(row.materi) ? (row.materi as string[]) : [],
    deliverables: Array.isArray(row.deliverables) ? (row.deliverables as Deliverable[]) : [],
    guarantee: row.guarantee,
    contentBlocks: Array.isArray(row.contentBlocks) ? (row.contentBlocks as ContentBlock[]) : [],
    scheduleAt: nextScheduleAt,
    durationLabel: row.durationLabel,
    waGroupLink: row.waGroupLink,
    lmsLink: row.lmsLink,
    price: row.price,
    priceOld: row.priceOld,
    certPrice: row.certPrice,
    certPriceOld: row.certPriceOld,
    seatsLeft: row.seatsLeft,
    isFeatured: row.isFeatured,
    categoryId: row.categoryId,
    category: row.category ? {
      id: row.category.id,
      name: row.category.name,
      slug: row.category.slug,
      isFeatured: row.category.isFeatured,
    } : null,
    batches,
  };
}
