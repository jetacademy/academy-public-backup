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
 * GET /api/v1/programs — katalog program lengkap untuk integrasi eksternal
 * (mis. Hermes agent marketing). Butuh header `X-API-Key` — key dikelola
 * di /webadmin/integrasi.
 */
export async function GET(req: Request) {
  const auth = await authorizeApiRequest(req, { rateLimitKey: "api-v1-programs", max: 60, windowMs: 60_000 });
  if (!auth.ok) return auth.response;

  const baseUrl = SITE_URL;

  try {
    const programs = await prisma.program.findMany({
      where: { isActive: true },
      include: {
        category: { select: { name: true, slug: true } },
        batches: {
          where: { isActive: true, scheduleAt: { gte: new Date() } },
          orderBy: { scheduleAt: "asc" },
        },
      },
      orderBy: { scheduleAt: "asc" },
    });

    // Ambil registrasi terbayar sekaligus untuk semua batch (hindari N+1)
    const allBatchIds = programs.flatMap((p) => p.batches.map((b) => b.id));
    const regCounts = allBatchIds.length > 0
      ? await prisma.registration.groupBy({
          by: ["batchId"],
          where: {
            batchId: { in: allBatchIds },
            status: { in: ["PAID", "PASSED"] },
          },
          _count: { id: true },
        })
      : [];
    const countMap = new Map<string, number>();
    for (const r of regCounts) {
      if (r.batchId) countMap.set(r.batchId, r._count.id);
    }

    // Hitung live quota untuk program zero-human-company jika ada
    const zhcProgram = programs.find((p) => p.slug === "zero-human-company");
    let zhcHybridStats: any = null;

    if (zhcProgram) {
      const activeOnlineBatch = (zhcProgram.batches as any[]).find((b) => b.batchType === "ONLINE" || (!b.batchType && !b.hasOffline)) || (zhcProgram.batches[0] as any);
      const activeOfflineBatch = (zhcProgram.batches as any[]).find((b) => b.batchType === "OFFLINE" || b.hasOffline);

      const onlineCount = activeOnlineBatch?.id ? (countMap.get(activeOnlineBatch.id) ?? 0) : 0;
      const offlineCount = activeOfflineBatch?.id ? (countMap.get(activeOfflineBatch.id) ?? 0) : 0;

      const onlineDate = activeOnlineBatch?.scheduleAt ?? zhcProgram.scheduleAt;
      const offlineDate = activeOfflineBatch?.scheduleAt
        ? new Date(activeOfflineBatch.scheduleAt)
        : new Date(onlineDate.getTime() + 2 * 86400000);

      const onlineEbQuota = activeOnlineBatch?.quotaOnlineEb ?? 20;
      const offlineEbQuota = activeOfflineBatch?.quotaOfflineEb ?? 10;
      const offlineSeatsMax = activeOfflineBatch?.seatsLeft ?? activeOfflineBatch?.offlineSeatsMax ?? 20;

      zhcHybridStats = {
        online: {
          batchId: activeOnlineBatch?.id,
          batchName: activeOnlineBatch?.name || "Batch Online",
          label: "Online via Zoom",
          schedule: onlineDate.toISOString(),
          scheduleFormatted: formatJadwal(onlineDate),
          daysLeft: formatDaysLeftLabel(onlineDate),
          earlyBirdPrice: activeOnlineBatch?.priceOnlineEb ?? 225000,
          normalPrice: activeOnlineBatch?.priceOnline ?? 490000,
          earlyBirdQuota: onlineEbQuota,
          paidCount: onlineCount,
          earlyBirdRemaining: Math.max(0, onlineEbQuota - onlineCount),
          isEarlyBirdActive: onlineCount < onlineEbQuota,
        },
        offline: {
          batchId: activeOfflineBatch?.id,
          batchName: activeOfflineBatch?.name || "Batch Offline Bekasi",
          label: "Offline",
          venue: activeOfflineBatch?.offlineVenue || "Coworking Space Kota Bekasi",
          duration: "4 Jam Tatap Muka",
          schedule: offlineDate.toISOString(),
          scheduleFormatted: formatJadwal(offlineDate),
          daysLeft: formatDaysLeftLabel(offlineDate),
          earlyBirdPrice: activeOfflineBatch?.priceOfflineEb ?? 750000,
          normalPrice: activeOfflineBatch?.priceOffline ?? 1400000,
          earlyBirdQuota: offlineEbQuota,
          seatsMax: offlineSeatsMax,
          paidCount: offlineCount,
          earlyBirdRemaining: Math.max(0, offlineEbQuota - offlineCount),
          seatsRemaining: Math.max(0, offlineSeatsMax - offlineCount),
          isEarlyBirdActive: offlineCount < offlineEbQuota,
          isSoldOut: offlineCount >= offlineSeatsMax || !activeOfflineBatch,
        },
      };
    }

    const payload = programs.map((p) => {
      const isZhc = p.slug === "zero-human-company";

      const upcomingBatches = p.batches.map((b: any) => {
        const isOfflineBatch = b.batchType === "OFFLINE" || Boolean(b.hasOffline);
        const bType: "ONLINE" | "OFFLINE" = isOfflineBatch ? "OFFLINE" : "ONLINE";
        const paidCount = countMap.get(b.id) ?? 0;

        const ebQuota = isOfflineBatch
          ? (b.quotaOfflineEb ?? 10)
          : (b.quotaOnlineEb ?? 20);
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
          // Properti legacy untuk kompatibilitas ke belakang
          priceOnlineEb: b.priceOnlineEb ?? (isZhc ? 225000 : null),
          priceOnline: b.priceOnline ?? (isZhc ? 490000 : null),
          quotaOnlineEb: b.quotaOnlineEb ?? (isZhc ? 20 : null),
          priceOfflineEb: b.priceOfflineEb ?? (isZhc ? 750000 : null),
          priceOffline: b.priceOffline ?? (isZhc ? 1400000 : null),
          quotaOfflineEb: b.quotaOfflineEb ?? (isZhc ? 10 : null),
        };
      });

      const onlineBatches = upcomingBatches.filter((b) => b.batchType === "ONLINE");
      const offlineBatches = upcomingBatches.filter((b) => b.batchType === "OFFLINE");

      return {
        slug: p.slug,
        url: `${baseUrl}/program/${p.slug}`,
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
        hybridPricing: isZhc ? zhcHybridStats : null,
        seatsLeft: p.seatsLeft,
        isFeatured: p.isFeatured,
      };
    });

    return NextResponse.json({ ok: true, count: payload.length, programs: payload });
  } catch (err) {
    console.error("[api/v1/programs]", err);
    return NextResponse.json({ error: "Gagal mengambil data program." }, { status: 503 });
  }
}

/**
 * POST /api/v1/programs — buat program baru.
 * Body JSON wajib: { title, type, tagline, description, mentorName, mentorBio, scheduleAt }
 * Opsional: slug, emoji, imageUrl, materi (string[]), deliverables ({label,value}[]), guarantee,
 * durationLabel, zoomLink, waGroupLink, lmsLink, price, priceOld, certPrice, certPriceOld,
 * seatsLeft, isActive, isFeatured, categoryId, categorySlug.
 *
 * Isi halaman program (opsional, jika diisi MENGGANTIKAN tampilan deskripsi/materi/mentor bawaan
 * di halaman publik) — pilih SALAH SATU cara, contentBlocks diprioritaskan kalau dua-duanya dikirim:
 *
 *   contentMarkdown (string) — CARA TERMUDAH, tulis seperti markdown biasa:
 *     # / ##            → judul bagian
 *     paragraf biasa    → teks (dukung **tebal** / *miring*)
 *     ![keterangan](url) → gambar, atau video kalau url YouTube/Vimeo/Bunny
 *     - poin satu
 *     - poin dua        → daftar poin
 *     - Label | 150000  → value stack (baris berisi "|" jadi label & nilai)
 *     > isi kutipan
 *     > — Nama Sumber   → kutipan/testimoni/bio mentor
 *
 *   contentBlocks (array) — kontrol presisi, tiap item: { id?, type, ...field }, type salah satu dari:
 *     heading { text } | text { html } | image { url, caption? } | video { url, caption? }
 *     list { title?, items: string[] } | stack { title?, items: {label,value}[] } | quote { text, author? }
 *     split { leftTitle, leftItems: {label,value}[], rightTitle, rightItems: string[] } — 2 kolom berdampingan
 *       (value stack kiri + daftar poin kanan, persis layout bawaan "Yang Anda Terima/Pelajari")
 */
export async function POST(req: Request) {
  const auth = await authorizeApiRequest(req, { rateLimitKey: "api-v1-programs-write", max: 20, windowMs: 60_000 });
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body harus berupa JSON valid." }, { status: 400 });
  }

  const title = String(body.title ?? "").trim();
  const tagline = String(body.tagline ?? "").trim();
  const description = String(body.description ?? "").trim();
  const mentorName = String(body.mentorName ?? "").trim();
  const mentorBio = String(body.mentorBio ?? "").trim();
  const scheduleAt = new Date(String(body.scheduleAt ?? ""));

  if (!title || !tagline || !description || !mentorName || !mentorBio) {
    return NextResponse.json(
      { error: "Field title, tagline, description, mentorName, dan mentorBio wajib diisi." },
      { status: 400 }
    );
  }
  if (Number.isNaN(scheduleAt.getTime())) {
    return NextResponse.json({ error: "scheduleAt wajib diisi berupa tanggal ISO valid." }, { status: 400 });
  }

  const type = PROGRAM_TYPES.includes(String(body.type) as (typeof PROGRAM_TYPES)[number])
    ? (String(body.type) as (typeof PROGRAM_TYPES)[number])
    : "WEBINAR";

  const slug = body.slug ? slugify(String(body.slug)) : slugify(title);
  if (!slug) {
    return NextResponse.json({ error: "Gagal membuat slug dari title. Sertakan slug manual." }, { status: 400 });
  }

  let categoryId: string | null = body.categoryId ? String(body.categoryId).trim() : null;
  if (!categoryId && body.categorySlug) {
    const category = await prisma.category.findUnique({ where: { slug: String(body.categorySlug).trim() } });
    if (!category) return NextResponse.json({ error: `categorySlug "${body.categorySlug}" tidak ditemukan.` }, { status: 400 });
    categoryId = category.id;
  }

  const materi = Array.isArray(body.materi) ? body.materi.map((v) => String(v).trim()).filter(Boolean) : [];
  const deliverables = Array.isArray(body.deliverables)
    ? body.deliverables.map((d) => {
        const item = d as { label?: unknown; value?: unknown };
        return { label: String(item.label ?? "").trim(), value: Number(item.value ?? 0) || 0 };
      })
    : [];

  const guaranteeRaw = body.guarantee ? String(body.guarantee).trim() : "";
  const contentBlocks =
    body.contentBlocks !== undefined
      ? await sanitizeContentBlocks(body.contentBlocks)
      : typeof body.contentMarkdown === "string" && body.contentMarkdown.trim()
        ? await sanitizeContentBlocks(parseMarkdownToBlocks(body.contentMarkdown))
        : [];

  try {
    const program = await prisma.program.create({
      data: {
        slug,
        type,
        title,
        tagline: (await sanitizeHtml(tagline)) ?? tagline,
        description: (await sanitizeHtml(description)) ?? description,
        emoji: body.emoji ? String(body.emoji).trim() || "🎓" : "🎓",
        imageUrl: body.imageUrl ? String(body.imageUrl).trim() : null,
        mentorName,
        mentorBio: (await sanitizeHtml(mentorBio)) ?? mentorBio,
        materi,
        deliverables,
        guarantee: guaranteeRaw ? (await sanitizeHtml(guaranteeRaw)) ?? guaranteeRaw : null,
        contentBlocks,
        scheduleAt,
        durationLabel: body.durationLabel ? String(body.durationLabel).trim() : "2 jam",
        zoomLink: body.zoomLink ? String(body.zoomLink).trim() : null,
        waGroupLink: body.waGroupLink ? String(body.waGroupLink).trim() : null,
        lmsLink: body.lmsLink ? String(body.lmsLink).trim() : null,
        price: Number(body.price ?? 0) || 0,
        priceOld: body.priceOld ? Number(body.priceOld) || null : null,
        certPrice: body.certPrice !== undefined ? Number(body.certPrice) || 0 : 49000,
        certPriceOld: body.certPriceOld ? Number(body.certPriceOld) || null : null,
        seatsLeft: body.seatsLeft !== undefined && body.seatsLeft !== null ? Number(body.seatsLeft) || null : null,
        isActive: body.isActive !== false,
        isFeatured: body.isFeatured === true,
        categoryId,
      },
    });
    return NextResponse.json(
      { ok: true, id: program.id, slug: program.slug, url: `${SITE_URL}/program/${program.slug}` },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof Error && "code" in err && (err as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: `Slug "${slug}" sudah dipakai program lain.` }, { status: 409 });
    }
    console.error("[api/v1/programs POST]", err);
    return NextResponse.json({ error: "Gagal membuat program." }, { status: 500 });
  }
}
