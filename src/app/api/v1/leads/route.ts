import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeApiRequest } from "@/lib/api-auth";
import { computeNextFollowUp, normalizeWhatsapp, isFollowUpDue } from "@/lib/leads";
import type { LeadSource, LeadStatus, LeadResult } from "@prisma/client";

const LEAD_SOURCES: LeadSource[] = ["INSTAGRAM", "FACEBOOK", "WHATSAPP", "REFERRAL", "ORGANIC", "OTHER"];
const LEAD_STATUSES: LeadStatus[] = ["NEW", "INTERESTED", "POTENTIAL", "COLD"];
const LEAD_RESULTS: LeadResult[] = ["ACTIVE", "REGISTERED", "PAID", "CANCELLED", "NO_REPLY"];

/**
 * GET /api/v1/leads — daftar lead + statistik funnel.
 * Filter query: q (nama/WA), status, hasil, source, programId, due (1=butuh follow-up), page.
 */
export async function GET(req: Request) {
  const auth = await authorizeApiRequest(req, { rateLimitKey: "api-v1-leads-read", max: 60, windowMs: 60_000 });
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const q = url.searchParams.get("q") || "";
  const status = url.searchParams.get("status") || "";
  const hasil = url.searchParams.get("hasil") || "";
  const source = url.searchParams.get("source") || "";
  const programId = url.searchParams.get("programId") || "";
  const due = url.searchParams.get("due") === "1";
  const page = Number(url.searchParams.get("page") ?? "1") || 1;
  const limit = 50;
  const skip = (page - 1) * limit;
  const now = new Date();

  const where: Record<string, unknown> = {};
  if (q) where.OR = [{ name: { contains: q } }, { whatsapp: { contains: q } }];
  if (status) where.status = status;
  if (hasil) where.hasil = hasil;
  if (source) where.source = source;
  if (programId) where.programId = programId;
  if (due) where.nextFollowUpAt = { lte: now };

  try {
    const [leads, total, funnel] = await Promise.all([
      prisma.lead.findMany({
        where,
        include: { program: { select: { title: true, slug: true } } },
        orderBy: [{ nextFollowUpAt: "asc" }, { createdAt: "desc" }],
        skip,
        take: limit,
      }),
      prisma.lead.count({ where }),
      // Statistik funnel (semua, tidak terpengaruh filter)
      {
        total: await prisma.lead.count(),
        byStatus: await Promise.all(
          LEAD_STATUSES.map(async (s) => ({ status: s, count: await prisma.lead.count({ where: { status: s } }) }))
        ),
        byResult: await Promise.all(
          LEAD_RESULTS.map(async (r) => ({ hasil: r, count: await prisma.lead.count({ where: { hasil: r } }) }))
        ),
        dueToday: await prisma.lead.count({ where: { nextFollowUpAt: { lte: now }, hasil: "ACTIVE" } }),
        perDay: await prisma.lead.groupBy({ by: ["createdAt"], _count: { _all: true } }),
      },
    ]);

    return NextResponse.json({
      ok: true,
      count: total,
      totalPages: Math.ceil(total / limit),
      page,
      leads: leads.map((l) => ({
        id: l.id,
        name: l.name,
        whatsapp: l.whatsapp,
        email: l.email,
        source: l.source,
        program: l.program,
        bidangUsaha: l.bidangUsaha,
        status: l.status,
        hasil: l.hasil,
        nextFollowUpAt: l.nextFollowUpAt?.toISOString() ?? null,
        lastFollowUpAt: l.lastFollowUpAt?.toISOString() ?? null,
        followUpCount: l.followUpCount,
        followUpDue: isFollowUpDue(l.nextFollowUpAt),
        registrationId: l.registrationId,
        createdAt: l.createdAt.toISOString(),
      })),
      stats: funnel,
    });
  } catch (err) {
    console.error("[api/v1/leads GET]", err);
    return NextResponse.json({ error: "Gagal mengambil data lead." }, { status: 503 });
  }
}

/**
 * POST /api/v1/leads — buat lead baru.
 * Body: { name, whatsapp, email?, source?, programSlug?, bidangUsaha?,
 *         pesanPertama?, ringkasanConversation?, objections?: string[], status? }
 * `programSlug` dipakai untuk menghubungkan ke program. `nextFollowUpAt` dihitung otomatis.
 */
export async function POST(req: Request) {
  const auth = await authorizeApiRequest(req, { rateLimitKey: "api-v1-leads-write", max: 30, windowMs: 60_000 });
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body harus berupa JSON valid." }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  const whatsappRaw = String(body.whatsapp ?? "").trim();
  if (!name || !whatsappRaw) {
    return NextResponse.json({ error: "Field name dan whatsapp wajib diisi." }, { status: 400 });
  }

  const whatsapp = normalizeWhatsapp(whatsappRaw);
  const status = (LEAD_STATUSES as string[]).includes(String(body.status)) ? (body.status as LeadStatus) : "NEW";
  const source = (LEAD_SOURCES as string[]).includes(String(body.source)) ? (body.source as LeadSource) : "OTHER";

  // Program opsional via slug
  let programId: string | null = null;
  if (body.programSlug) {
    const program = await prisma.program.findUnique({ where: { slug: String(body.programSlug).trim() } });
    if (program) programId = program.id;
  } else if (body.programId) {
    programId = String(body.programId);
  }

  const objectionsArr = Array.isArray(body.objections)
    ? body.objections.map((v) => String(v).trim()).filter(Boolean)
    : null;

  try {
    const lead = await prisma.lead.create({
      data: {
        name,
        whatsapp,
        email: body.email ? String(body.email).trim() : null,
        source,
        programId,
        bidangUsaha: body.bidangUsaha ? String(body.bidangUsaha).trim() : null,
        pesanPertama: body.pesanPertama ? String(body.pesanPertama).trim() : null,
        ringkasanConversation: body.ringkasanConversation ? String(body.ringkasanConversation).trim() : null,
        ...(objectionsArr ? { objections: objectionsArr } : {}),
        status,
        nextFollowUpAt: computeNextFollowUp(status, 0, new Date()),
      },
    });
    return NextResponse.json({ ok: true, id: lead.id, lead }, { status: 201 });
  } catch (err) {
    console.error("[api/v1/leads POST]", err);
    return NextResponse.json({ error: "Gagal membuat lead." }, { status: 500 });
  }
}