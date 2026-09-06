import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeApiRequest } from "@/lib/api-auth";

import { formatJadwal, formatDaysLeftLabel } from "@/lib/format";

/**
 * GET /api/v1/batches/[id] — ambil detail lengkap sebuah batch.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeApiRequest(req, { rateLimitKey: "api-v1-batches-read", max: 60, windowMs: 60_000 });
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const rawBatch = await prisma.programBatch.findUnique({
    where: { id },
    include: {
      program: { select: { id: true, slug: true, title: true, price: true } },
    },
  });
  if (!rawBatch) return NextResponse.json({ error: "Batch tidak ditemukan." }, { status: 404 });
  const b = rawBatch as any;

  const paidCount = await prisma.registration.count({
    where: { batchId: b.id, status: { in: ["PAID", "PASSED"] } },
  });

  const isOffline = b.batchType === "OFFLINE" || Boolean(b.hasOffline);
  const isZhc = b.program.slug === "zero-human-company";
  const ebQuota = isOffline ? (b.quotaOfflineEb ?? 10) : (b.quotaOnlineEb ?? 20);
  const isEbActive = paidCount < ebQuota;

  const normalPrice = isOffline
    ? (b.priceOffline ?? (isZhc ? 1400000 : b.program.price))
    : (b.priceOnline ?? (isZhc ? 490000 : b.program.price));
  const ebPrice = isOffline
    ? (b.priceOfflineEb ?? (isZhc ? 750000 : null))
    : (b.priceOnlineEb ?? (isZhc ? 225000 : null));

  const currentPrice = isEbActive && ebPrice !== null ? ebPrice : normalPrice;
  const maxSeats = isOffline ? (b.offlineSeatsMax ?? 20) : b.seatsLeft;
  const seatsRemaining = maxSeats !== null && maxSeats !== undefined ? Math.max(0, maxSeats - paidCount) : null;
  const isSoldOut = maxSeats !== null && maxSeats !== undefined ? paidCount >= maxSeats : false;
  const sched = new Date(b.scheduleAt);

  return NextResponse.json({
    ok: true,
    id: b.id,
    programId: b.programId,
    programSlug: b.program.slug,
    programTitle: b.program.title,
    name: b.name || (isOffline ? `Batch Offline ${b.program.title}` : `Batch Online ${b.program.title}`),
    batchType: isOffline ? "OFFLINE" : "ONLINE",
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
  });
}

/**
 * PATCH /api/v1/batches/[id] — perbarui jadwal/kursi/status aktif sebuah batch.
 * Body JSON: field mana pun dari { scheduleAt, seatsLeft, isActive, name, batchType, ... } — semua opsional.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeApiRequest(req, { rateLimitKey: "api-v1-batches-write", max: 20, windowMs: 60_000 });
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const existing = await prisma.programBatch.findUnique({ where: { id }, include: { program: { select: { title: true, slug: true } } } });
  if (!existing) return NextResponse.json({ error: "Batch tidak ditemukan." }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body harus berupa JSON valid." }, { status: 400 });
  }

  const data: Record<string, unknown> = {};

  if (typeof body.name === "string") data.name = body.name.trim() || null;
  if (body.batchType === "ONLINE" || body.batchType === "OFFLINE") {
    data.batchType = body.batchType;
    if (body.batchType === "OFFLINE") data.hasOffline = true;
  }

  if (typeof body.scheduleAt === "string") {
    const scheduleAt = new Date(body.scheduleAt);
    if (Number.isNaN(scheduleAt.getTime())) {
      return NextResponse.json({ error: "scheduleAt tidak valid." }, { status: 400 });
    }
    data.scheduleAt = scheduleAt;
  }
  if (body.seatsLeft !== undefined) data.seatsLeft = body.seatsLeft === null ? null : Number(body.seatsLeft) || null;
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;

  if (typeof body.hasOffline === "boolean") data.hasOffline = body.hasOffline;
  if (body.offlineVenue !== undefined) data.offlineVenue = typeof body.offlineVenue === "string" ? body.offlineVenue.trim() || null : null;
  if (body.offlineMapUrl !== undefined) data.offlineMapUrl = typeof body.offlineMapUrl === "string" ? body.offlineMapUrl.trim() || null : null;
  if (body.offlineScheduleAt !== undefined) {
    if (body.offlineScheduleAt === null) {
      data.offlineScheduleAt = null;
    } else if (typeof body.offlineScheduleAt === "string") {
      const dt = new Date(body.offlineScheduleAt);
      if (Number.isNaN(dt.getTime())) {
        return NextResponse.json({ error: "offlineScheduleAt tidak valid." }, { status: 400 });
      }
      data.offlineScheduleAt = dt;
    }
  }
  if (body.offlineSeatsMax !== undefined) data.offlineSeatsMax = Number(body.offlineSeatsMax) || 20;
  if (body.priceOffline !== undefined) data.priceOffline = Number(body.priceOffline) || 1400000;
  if (body.priceOfflineEb !== undefined) data.priceOfflineEb = Number(body.priceOfflineEb) || 750000;
  if (body.quotaOfflineEb !== undefined) data.quotaOfflineEb = Number(body.quotaOfflineEb) || 10;
  if (body.priceOnline !== undefined) data.priceOnline = Number(body.priceOnline) || 490000;
  if (body.priceOnlineEb !== undefined) data.priceOnlineEb = Number(body.priceOnlineEb) || 225000;
  if (body.quotaOnlineEb !== undefined) data.quotaOnlineEb = Number(body.quotaOnlineEb) || 20;

  if (body.zoomLink !== undefined) data.zoomLink = typeof body.zoomLink === "string" ? body.zoomLink.trim() || null : null;
  if (body.waGroupLink !== undefined) data.waGroupLink = typeof body.waGroupLink === "string" ? body.waGroupLink.trim() || null : null;
  if (body.recordingLink !== undefined) data.recordingLink = typeof body.recordingLink === "string" ? body.recordingLink.trim() || null : null;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Tidak ada field valid untuk diperbarui." }, { status: 400 });
  }

  const updated = await prisma.programBatch.update({ where: { id }, data: data as any });
  const b = updated as any;
  const isOffline = b.batchType === "OFFLINE" || Boolean(b.hasOffline);
  const sched = new Date(b.scheduleAt);

  return NextResponse.json({
    ok: true,
    id: b.id,
    programId: b.programId,
    programSlug: existing.program.slug,
    name: b.name || (isOffline ? `Batch Offline ${existing.program.title}` : `Batch Online ${existing.program.title}`),
    batchType: b.batchType,
    formatLabel: isOffline ? "Offline" : "Online via Zoom",
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
  });
}

/**
 * DELETE /api/v1/batches/[id] — hapus batch. Registrasi yang sudah terkait
 * tidak ikut terhapus (Registration.batchId di-null-kan, histori tetap ada).
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeApiRequest(req, { rateLimitKey: "api-v1-batches-write", max: 20, windowMs: 60_000 });
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const existing = await prisma.programBatch.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Batch tidak ditemukan." }, { status: 404 });

  await prisma.programBatch.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
