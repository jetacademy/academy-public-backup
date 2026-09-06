import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeApiRequest } from "@/lib/api-auth";
import { sanitizeHtml } from "@/lib/sanitize";
import { slugify } from "@/lib/slug";
import { sanitizeContentBlocks } from "@/app/webadmin/actions";
import { parseMarkdownToBlocks } from "@/lib/content-blocks";

import { formatJadwal, formatDaysLeftLabel } from "@/lib/format";

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL?.includes("localhost")
  ? process.env.NEXT_PUBLIC_BASE_URL
  : "https://academy.jetschool.id";

const PROGRAM_TYPES = ["WEBINAR", "KELAS", "WORKSHOP", "BOOTCAMP"] as const;

/**
 * GET /api/v1/programs/[id] — ambil detail satu program beserta seluruh batch online & offline.
 * [id] dapat berupa ID program (cuid) atau slug.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeApiRequest(req, { rateLimitKey: "api-v1-programs", max: 60, windowMs: 60_000 });
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const p = await prisma.program.findFirst({
    where: { OR: [{ id }, { slug: id }] },
    include: {
      category: { select: { name: true, slug: true } },
      batches: {
        where: { isActive: true },
        orderBy: { scheduleAt: "asc" },
      },
    },
  });

  if (!p) return NextResponse.json({ error: "Program tidak ditemukan." }, { status: 404 });

  const batchIds = p.batches.map((b) => b.id);
  const regCounts = batchIds.length > 0
    ? await prisma.registration.groupBy({
        by: ["batchId"],
        where: {
          batchId: { in: batchIds },
          status: { in: ["PAID", "PASSED"] },
        },
        _count: { id: true },
      })
    : [];

  const countMap = new Map<string, number>();
  for (const r of regCounts) {
    if (r.batchId) countMap.set(r.batchId, r._count.id);
  }

  const isZhc = p.slug === "zero-human-company";

  const upcomingBatches = p.batches.map((b: any) => {
    const isOfflineBatch = b.batchType === "OFFLINE" || Boolean(b.hasOffline);
    const bType: "ONLINE" | "OFFLINE" = isOfflineBatch ? "OFFLINE" : "ONLINE";
    const paidCount = countMap.get(b.id) ?? 0;

    const ebQuota = isOfflineBatch ? (b.quotaOfflineEb ?? 10) : (b.quotaOnlineEb ?? 20);
    const isEbActive = paidCount < ebQuota;

    const normalPrice = isOfflineBatch
      ? (b.priceOffline ?? (isZhc ? 1400000 : p.price))
      : (b.priceOnline ?? (isZhc ? 490000 : p.price));
    const ebPrice = isOfflineBatch
      ? (b.priceOfflineEb ?? (isZhc ? 750000 : null))
      : (b.priceOnlineEb ?? (isZhc ? 225000 : null));

    const currentPrice = isEbActive && ebPrice !== null ? ebPrice : normalPrice;
    const maxSeats = isOfflineBatch ? (b.offlineSeatsMax ?? 20) : b.seatsLeft;
    const seatsRemaining = maxSeats !== null && maxSeats !== undefined ? Math.max(0, maxSeats - paidCount) : null;
    const isSoldOut = maxSeats !== null && maxSeats !== undefined ? paidCount >= maxSeats : false;
    const sched = new Date(b.scheduleAt);

    return {
      id: b.id,
      name: b.name || (isOfflineBatch ? `Batch Offline ${p.title}` : `Batch Online ${p.title}`),
      batchType: bType,
      formatLabel: isOfflineBatch ? "Offline" : "Online via Zoom",
      scheduleAt: sched.toISOString(),
      scheduleFormatted: formatJadwal(sched),
      daysLeft: formatDaysLeftLabel(sched),
      isActive: b.isActive,
      hasOffline: Boolean(b.hasOffline || (isZhc && isOfflineBatch)),
      offlineVenue: b.offlineVenue || (isOfflineBatch ? "Coworking Space Kota Bekasi" : null),
      offlineMapUrl: b.offlineMapUrl || null,
      offlineScheduleAt: b.offlineScheduleAt ? b.offlineScheduleAt.toISOString() : null,
      offlineSeatsMax: b.offlineSeatsMax ?? (isOfflineBatch ? 20 : null),
      seatsLeft: b.seatsLeft,
      paidCount,
      seatsRemaining,
      isSoldOut,
      pricing: {
        currentPrice,
        normalPrice,
        earlyBirdPrice: ebPrice,
        earlyBirdQuota: ebQuota,
        earlyBirdRemaining: Math.max(0, ebQuota - paidCount),
        isEarlyBirdActive: isEbActive,
      },
      zoomLink: b.zoomLink || null,
      waGroupLink: b.waGroupLink || null,
      recordingLink: b.recordingLink || null,
    };
  });

  const onlineBatches = upcomingBatches.filter((b) => b.batchType === "ONLINE");
  const offlineBatches = upcomingBatches.filter((b) => b.batchType === "OFFLINE");

  return NextResponse.json({
    ok: true,
    program: {
      id: p.id,
      slug: p.slug,
      url: `${SITE_URL}/program/${p.slug}`,
      type: p.type,
      title: p.title,
      tagline: p.tagline,
      description: p.description,
      mentorName: p.mentorName,
      mentorBio: p.mentorBio,
      materi: p.materi,
      deliverables: p.deliverables,
      durationLabel: p.durationLabel,
      isFree: p.price === 0,
      price: p.price,
      priceOld: p.priceOld,
      certPrice: p.certPrice,
      certPriceOld: p.certPriceOld,
      category: p.category?.name ?? null,
      nextSchedule: (p.batches[0]?.scheduleAt ?? p.scheduleAt).toISOString(),
      upcomingBatches,
      batchesSummary: {
        onlineCount: onlineBatches.length,
        offlineCount: offlineBatches.length,
        activeOnline: onlineBatches[0] ?? null,
        activeOffline: offlineBatches[0] ?? null,
        online: onlineBatches,
        offline: offlineBatches,
      },
      seatsLeft: p.seatsLeft,
      isFeatured: p.isFeatured,
      isActive: p.isActive,
    },
  });
}

/**
 * PATCH /api/v1/programs/[id] — perbarui sebagian field program.

 * Body JSON: field mana pun dari POST /api/v1/programs — semua opsional.
 *
 * contentMarkdown / contentBlocks: isi halaman program — kalau salah satu diisi
 * (contentBlocks diprioritaskan jika dua-duanya dikirim), MENGGANTIKAN tampilan
 * deskripsi/materi/deliverables/mentor/garansi bawaan di halaman publik.
 *
 *   contentMarkdown (string) — cara termudah, tulis seperti markdown biasa:
 *     # / ##  → heading   |   paragraf biasa → teks (dukung tebal dan miring)
 *     ![keterangan](url)  → gambar, atau video kalau url YouTube/Vimeo/Bunny
 *     - poin  → daftar poin   |   - Label | 150000 → value stack
 *     > isi kutipan  \n  > — Nama Sumber  → kutipan/testimoni/bio mentor
 *
 *   contentBlocks (array) — kontrol presisi, tiap item: { id?, type, ...field }:
 *     heading  { text }
 *     text     { html }                          (HTML disanitasi server-side)
 *     image    { url, caption? }
 *     video    { url, caption? }                  (YouTube/Vimeo/embed Bunny Stream)
 *     list     { title?, items: string[] }
 *     stack    { title?, items: {label,value}[] }
 *     quote    { text, author? }
 *     split    { leftTitle, leftItems: {label,value}[], rightTitle, rightItems: string[] } — 2 kolom berdampingan
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeApiRequest(req, { rateLimitKey: "api-v1-programs-write", max: 20, windowMs: 60_000 });
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const existing = await prisma.program.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Program tidak ditemukan." }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body harus berupa JSON valid." }, { status: 400 });
  }

  const data: Record<string, unknown> = {};

  if (typeof body.title === "string" && body.title.trim()) data.title = body.title.trim();
  if (typeof body.slug === "string" && body.slug.trim()) data.slug = slugify(body.slug);
  if (typeof body.type === "string" && PROGRAM_TYPES.includes(body.type as (typeof PROGRAM_TYPES)[number])) {
    data.type = body.type;
  }
  if (typeof body.mentorName === "string" && body.mentorName.trim()) data.mentorName = body.mentorName.trim();
  if (typeof body.emoji === "string" && body.emoji.trim()) data.emoji = body.emoji.trim();
  if (typeof body.imageUrl === "string") data.imageUrl = body.imageUrl.trim() || null;
  if (typeof body.durationLabel === "string" && body.durationLabel.trim()) data.durationLabel = body.durationLabel.trim();
  if (typeof body.zoomLink === "string") data.zoomLink = body.zoomLink.trim() || null;
  if (typeof body.waGroupLink === "string") data.waGroupLink = body.waGroupLink.trim() || null;
  if (typeof body.lmsLink === "string") data.lmsLink = body.lmsLink.trim() || null;
  if (body.price !== undefined) data.price = Number(body.price) || 0;
  if (body.priceOld !== undefined) data.priceOld = body.priceOld ? Number(body.priceOld) || null : null;
  if (body.certPrice !== undefined) data.certPrice = Number(body.certPrice) || 0;
  if (body.certPriceOld !== undefined) data.certPriceOld = body.certPriceOld ? Number(body.certPriceOld) || null : null;
  if (body.seatsLeft !== undefined) data.seatsLeft = body.seatsLeft === null ? null : Number(body.seatsLeft) || null;
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (typeof body.isFeatured === "boolean") data.isFeatured = body.isFeatured;

  if (typeof body.categoryId === "string") data.categoryId = body.categoryId.trim() || null;
  else if (typeof body.categorySlug === "string") {
    const category = await prisma.category.findUnique({ where: { slug: body.categorySlug.trim() } });
    if (!category) return NextResponse.json({ error: `categorySlug "${body.categorySlug}" tidak ditemukan.` }, { status: 400 });
    data.categoryId = category.id;
  }

  if (typeof body.scheduleAt === "string") {
    const scheduleAt = new Date(body.scheduleAt);
    if (Number.isNaN(scheduleAt.getTime())) {
      return NextResponse.json({ error: "scheduleAt tidak valid." }, { status: 400 });
    }
    data.scheduleAt = scheduleAt;
  }

  if (Array.isArray(body.materi)) {
    data.materi = body.materi.map((v) => String(v).trim()).filter(Boolean);
  }
  if (Array.isArray(body.deliverables)) {
    data.deliverables = body.deliverables.map((d) => {
      const item = d as { label?: unknown; value?: unknown };
      return { label: String(item.label ?? "").trim(), value: Number(item.value ?? 0) || 0 };
    });
  }

  if (typeof body.tagline === "string" && body.tagline.trim()) {
    const tagline = body.tagline.trim();
    data.tagline = (await sanitizeHtml(tagline)) ?? tagline;
  }
  if (typeof body.description === "string" && body.description.trim()) {
    const description = body.description.trim();
    data.description = (await sanitizeHtml(description)) ?? description;
  }
  if (typeof body.mentorBio === "string" && body.mentorBio.trim()) {
    const mentorBio = body.mentorBio.trim();
    data.mentorBio = (await sanitizeHtml(mentorBio)) ?? mentorBio;
  }
  if (typeof body.guarantee === "string") {
    const guarantee = body.guarantee.trim();
    data.guarantee = guarantee ? (await sanitizeHtml(guarantee)) ?? guarantee : null;
  }
  if (body.contentBlocks !== undefined) {
    data.contentBlocks = await sanitizeContentBlocks(body.contentBlocks);
  } else if (typeof body.contentMarkdown === "string" && body.contentMarkdown.trim()) {
    data.contentBlocks = await sanitizeContentBlocks(parseMarkdownToBlocks(body.contentMarkdown));
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Tidak ada field valid untuk diperbarui." }, { status: 400 });
  }

  try {
    const updated = await prisma.program.update({ where: { id }, data });
    return NextResponse.json({ ok: true, id: updated.id, slug: updated.slug, url: `${SITE_URL}/program/${updated.slug}` });
  } catch (err) {
    if (err instanceof Error && "code" in err && (err as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: `Slug "${data.slug}" sudah dipakai program lain.` }, { status: 409 });
    }
    console.error("[api/v1/programs PATCH]", err);
    return NextResponse.json({ error: "Gagal memperbarui program." }, { status: 500 });
  }
}
