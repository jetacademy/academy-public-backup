import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeApiRequest } from "@/lib/api-auth";
import { formatJadwal, formatDaysLeftLabel } from "@/lib/format";

/**
 * GET /api/v1/programs/[id]/batches — ambil semua batch untuk sebuah program.
 * Query params (opsional):
 *   type: "ONLINE" | "OFFLINE"
 *   activeOnly: "true" | "false" (default: true)
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeApiRequest(req, { rateLimitKey: "api-v1-batches-read", max: 60, windowMs: 60_000 });
  if (!auth.ok) return auth.response;

  const { id: programId } = await params;
  const program = await prisma.program.findFirst({
    where: { OR: [{ id: programId }, { slug: programId }] },
    select: { id: true, slug: true, title: true, price: true },
  });
  if (!program) return NextResponse.json({ error: "Program tidak ditemukan." }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const typeFilter = searchParams.get("type")?.toUpperCase();
  const activeOnly = searchParams.get("activeOnly") !== "false";

  const whereClause: Record<string, unknown> = {
    programId: program.id,
  };
  if (activeOnly) {
    whereClause.isActive = true;
  }
  if (typeFilter === "ONLINE" || typeFilter === "OFFLINE") {
    whereClause.batchType = typeFilter;
  }

  const batches = await prisma.programBatch.findMany({
    where: whereClause,
    orderBy: { scheduleAt: "asc" },
  });

  const batchIds = batches.map((b) => b.id);
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

  const isZhc = program.slug === "zero-human-company";

  const formattedBatches = batches.map((b: any) => {
    const isOffline = b.batchType === "OFFLINE" || Boolean(b.hasOffline);
    const bType: "ONLINE" | "OFFLINE" = isOffline ? "OFFLINE" : "ONLINE";
    const paidCount = countMap.get(b.id) ?? 0;

    const ebQuota = isOffline ? (b.quotaOfflineEb ?? 10) : (b.quotaOnlineEb ?? 20);
    const isEbActive = paidCount < ebQuota;

    const normalPrice = isOffline
      ? (b.priceOffline ?? (isZhc ? 1400000 : program.price))
      : (b.priceOnline ?? (isZhc ? 490000 : program.price));
    const ebPrice = isOffline
      ? (b.priceOfflineEb ?? (isZhc ? 750000 : null))
      : (b.priceOnlineEb ?? (isZhc ? 225000 : null));

    const currentPrice = isEbActive && ebPrice !== null ? ebPrice : normalPrice;
    const maxSeats = isOffline ? (b.offlineSeatsMax ?? 20) : b.seatsLeft;
    const seatsRemaining = maxSeats !== null && maxSeats !== undefined ? Math.max(0, maxSeats - paidCount) : null;
    const isSoldOut = maxSeats !== null && maxSeats !== undefined ? paidCount >= maxSeats : false;
    const sched = new Date(b.scheduleAt);

    return {
      id: b.id,
      programId: program.id,
      programSlug: program.slug,
      name: b.name || (isOffline ? `Batch Offline ${program.title}` : `Batch Online ${program.title}`),
      batchType: bType,
      formatLabel: isOffline ? "Offline" : "Online via Zoom",
      scheduleAt: sched.toISOString(),
      scheduleFormatted: formatJadwal(sched),
      daysLeft: formatDaysLeftLabel(sched),
      isActive: b.isActive,
      hasOffline: Boolean(b.hasOffline || (isZhc && isOffline)),
      offlineVenue: b.offlineVenue || (isOffline ? "Coworking Space Kota Bekasi" : null),
      offlineMapUrl: b.offlineMapUrl || null,
      offlineScheduleAt: b.offlineScheduleAt ? b.offlineScheduleAt.toISOString() : null,
      offlineSeatsMax: b.offlineSeatsMax ?? (isOffline ? 20 : null),
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

  const online = formattedBatches.filter((b) => b.batchType === "ONLINE");
  const offline = formattedBatches.filter((b) => b.batchType === "OFFLINE");

  return NextResponse.json({
    ok: true,
    programId: program.id,
    programSlug: program.slug,
    count: formattedBatches.length,
    batches: formattedBatches,
    summary: {
      onlineCount: online.length,
      offlineCount: offline.length,
      activeOnline: online[0] ?? null,
      activeOffline: offline[0] ?? null,
    },
  });
}

/**
 * POST /api/v1/programs/[id]/batches — buat batch jadwal baru untuk sebuah program.
 * Body JSON:
 *   - scheduleAt (wajib): ISO date string
 *   - name (opsional): label batch mis. "Batch 7" atau "Batch 2 Offline Bekasi"
 *   - batchType (opsional): "ONLINE" | "OFFLINE" (default: "ONLINE")
 *   - hasOffline (opsional): boolean
 *   - offlineVenue (opsional): alamat venue
 *   - offlineMapUrl (opsional): url gmaps
 *   - offlineScheduleAt (opsional): ISO date string
 *   - offlineSeatsMax (opsional): number (default: 20)
 *   - priceOnline / priceOnlineEb / quotaOnlineEb
 *   - priceOffline / priceOfflineEb / quotaOfflineEb
 *   - seatsLeft (opsional): number
 *   - isActive (opsional): boolean
 *   - zoomLink / waGroupLink / recordingLink (opsional)
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeApiRequest(req, { rateLimitKey: "api-v1-batches-write", max: 20, windowMs: 60_000 });
  if (!auth.ok) return auth.response;

  const { id: programId } = await params;
  const program = await prisma.program.findFirst({
    where: { OR: [{ id: programId }, { slug: programId }] },
    select: { id: true, slug: true, title: true },
  });
  if (!program) return NextResponse.json({ error: "Program tidak ditemukan." }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body harus berupa JSON valid." }, { status: 400 });
  }

  const scheduleAt = new Date(String(body.scheduleAt ?? ""));
  if (Number.isNaN(scheduleAt.getTime())) {
    return NextResponse.json({ error: "scheduleAt wajib diisi berupa tanggal ISO valid." }, { status: 400 });
  }

  const isOfflineType = body.batchType === "OFFLINE" || body.hasOffline === true;
  const batchType = isOfflineType ? "OFFLINE" : "ONLINE";
  const hasOffline = isOfflineType;

  const batch = await prisma.programBatch.create({
    data: {
      programId: program.id,
      name: typeof body.name === "string" ? body.name.trim() || null : null,
      batchType,
      scheduleAt,
      seatsLeft: body.seatsLeft !== undefined && body.seatsLeft !== null ? Number(body.seatsLeft) || null : null,
      isActive: body.isActive !== false,
      hasOffline,
      offlineVenue: typeof body.offlineVenue === "string" ? body.offlineVenue.trim() || null : null,
      offlineMapUrl: typeof body.offlineMapUrl === "string" ? body.offlineMapUrl.trim() || null : null,
      offlineScheduleAt: typeof body.offlineScheduleAt === "string" && !Number.isNaN(new Date(body.offlineScheduleAt).getTime()) ? new Date(body.offlineScheduleAt) : null,
      offlineSeatsMax: body.offlineSeatsMax !== undefined && body.offlineSeatsMax !== null ? Number(body.offlineSeatsMax) || 20 : 20,
      priceOffline: body.priceOffline !== undefined && body.priceOffline !== null ? Number(body.priceOffline) || 1400000 : 1400000,
      priceOfflineEb: body.priceOfflineEb !== undefined && body.priceOfflineEb !== null ? Number(body.priceOfflineEb) || 750000 : 750000,
      quotaOfflineEb: body.quotaOfflineEb !== undefined && body.quotaOfflineEb !== null ? Number(body.quotaOfflineEb) || 10 : 10,
      priceOnline: body.priceOnline !== undefined && body.priceOnline !== null ? Number(body.priceOnline) || 490000 : 490000,
      priceOnlineEb: body.priceOnlineEb !== undefined && body.priceOnlineEb !== null ? Number(body.priceOnlineEb) || 225000 : 225000,
      quotaOnlineEb: body.quotaOnlineEb !== undefined && body.quotaOnlineEb !== null ? Number(body.quotaOnlineEb) || 20 : 20,
      zoomLink: typeof body.zoomLink === "string" ? body.zoomLink.trim() || null : null,
      waGroupLink: typeof body.waGroupLink === "string" ? body.waGroupLink.trim() || null : null,
      recordingLink: typeof body.recordingLink === "string" ? body.recordingLink.trim() || null : null,
    } as any,
  });

  const b = batch as any;
  const sched = new Date(b.scheduleAt);

  return NextResponse.json(
    {
      ok: true,
      id: b.id,
      programId: b.programId,
      programSlug: program.slug,
      name: b.name || (hasOffline ? `Batch Offline ${program.title}` : `Batch Online ${program.title}`),
      batchType: b.batchType,
      formatLabel: hasOffline ? "Offline" : "Online via Zoom",
      scheduleAt: sched.toISOString(),
      scheduleFormatted: formatJadwal(sched),
      daysLeft: formatDaysLeftLabel(sched),
      offlineScheduleAt: b.offlineScheduleAt ? b.offlineScheduleAt.toISOString() : null,
      seatsLeft: b.seatsLeft,
      isActive: b.isActive,
      hasOffline: b.hasOffline,
      offlineVenue: b.offlineVenue,
      offlineMapUrl: b.offlineMapUrl,
      offlineSeatsMax: b.offlineSeatsMax,
      priceOfflineEb: b.priceOfflineEb,
      priceOffline: b.priceOffline,
      quotaOfflineEb: b.quotaOfflineEb,
      priceOnlineEb: b.priceOnlineEb,
      priceOnline: b.priceOnline,
      quotaOnlineEb: b.quotaOnlineEb,
      zoomLink: b.zoomLink,
      waGroupLink: b.waGroupLink,
      recordingLink: b.recordingLink,
    },
    { status: 201 }
  );
}
