import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { authorizeApiRequest } from "@/lib/api-auth";
import { computeNextFollowUp, normalizeWhatsapp, isTerminalResult } from "@/lib/leads";
import type { LeadSource, LeadStatus, LeadResult } from "@prisma/client";

const LEAD_SOURCES: LeadSource[] = ["INSTAGRAM", "FACEBOOK", "WHATSAPP", "REFERRAL", "ORGANIC", "OTHER"];
const LEAD_STATUSES: LeadStatus[] = ["NEW", "INTERESTED", "POTENTIAL", "COLD"];
const LEAD_RESULTS: LeadResult[] = ["ACTIVE", "REGISTERED", "PAID", "CANCELLED", "NO_REPLY"];

/** Dapatkan lead + program, 404 kalau tidak ada. */
async function getLeadOr404(id: string) {
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: { program: { select: { title: true, slug: true } } },
  });
  if (!lead) return null;
  return lead;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await getLeadOr404(id);
  if (!lead) return NextResponse.json({ error: "Lead tidak ditemukan." }, { status: 404 });
  return NextResponse.json({ ok: true, lead });
}

/**
 * PATCH /api/v1/leads/[id] — update lead.
 * Logika utama:
 * - `status` berubah → hitung ulang nextFollowUpAt otomatis (dari lastFollowUpAt ?? createdAt).
 * - `recordFollowUp: true` → catat satu follow-up (increment count, set lastFollowUpAt,
 *   append history, hitung ulang nextFollowUpAt).
 * - `hasil` jadi terminal (REGISTERED/PAID/CANCELLED/NO_REPLY) → set closedAt, kosongkan nextFollowUpAt.
 * - `hasil` kembali ACTIVE → bersihkan closedAt, hitung ulang.
 * - `registrationId` diisi → taut ke Registration (pipeline menutup).
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeApiRequest(req, { rateLimitKey: "api-v1-leads-write", max: 60, windowMs: 60_000 });
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const lead = await getLeadOr404(id);
  if (!lead) return NextResponse.json({ error: "Lead tidak ditemukan." }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body harus berupa JSON valid." }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  const now = new Date();

  if ("name" in body && body.name !== null) data.name = String(body.name).trim();
  if ("email" in body) data.email = body.email ? String(body.email).trim() : null;
  if ("whatsapp" in body && body.whatsapp) data.whatsapp = normalizeWhatsapp(String(body.whatsapp));
  if ("source" in body) data.source = (LEAD_SOURCES as string[]).includes(String(body.source)) ? body.source : undefined;
  if ("programId" in body) data.programId = body.programId ? String(body.programId) : null;
  if ("bidangUsaha" in body) data.bidangUsaha = body.bidangUsaha ? String(body.bidangUsaha).trim() : null;
  if ("pesanPertama" in body) data.pesanPertama = body.pesanPertama ? String(body.pesanPertama).trim() : null;
  if ("ringkasanConversation" in body)
    data.ringkasanConversation = body.ringkasanConversation ? String(body.ringkasanConversation).trim() : null;
  if ("objections" in body)
    {
      const arr = Array.isArray(body.objections) ? body.objections.map((v) => String(v).trim()).filter(Boolean) : null;
      if (arr) data.objections = arr;
      else data.objections = Prisma.JsonNull;
    }

  // Status berubah → hitung ulang jadwal follow-up
  if ("status" in body && (LEAD_STATUSES as string[]).includes(String(body.status))) {
    const nextStatus = body.status as LeadStatus;
    data.status = nextStatus;
    const base = lead.lastFollowUpAt ?? lead.createdAt;
    data.nextFollowUpAt = computeNextFollowUp(nextStatus, lead.followUpCount, base);
  }

  // Catat satu follow-up
  if (body.recordFollowUp === true) {
    const note = body.note ? String(body.note).trim() : "";
    const history = Array.isArray(lead.followUpHistory) ? [...(lead.followUpHistory as unknown[])] : [];
    history.push({ at: now.toISOString(), note });
    data.lastFollowUpAt = now;
    data.followUpCount = lead.followUpCount + 1;
    data.followUpHistory = history;
    const base = now;
    data.nextFollowUpAt = computeNextFollowUp(lead.status, lead.followUpCount + 1, base);
  }

  // Hasil berubah → kelola closedAt & pipeline
  if ("hasil" in body && (LEAD_RESULTS as string[]).includes(String(body.hasil))) {
    const hasil = body.hasil as LeadResult;
    data.hasil = hasil;
    if (isTerminalResult(hasil)) {
      data.closedAt = now;
      data.nextFollowUpAt = null;
    } else {
      data.closedAt = null;
      const base = lead.lastFollowUpAt ?? lead.createdAt;
      data.nextFollowUpAt = computeNextFollowUp(lead.status, lead.followUpCount, base);
    }
  }

  // Tautkan ke Registration (lead jadi peserta) — otomatis tutup pipeline
  if ("registrationId" in body) {
    data.registrationId = body.registrationId ? String(body.registrationId) : null;
    if (body.registrationId && !("hasil" in body)) {
      data.hasil = "REGISTERED";
      data.closedAt = now;
      data.nextFollowUpAt = null;
    } else if (!body.registrationId && !body.hasil) {
      data.hasil = "ACTIVE";
      data.closedAt = null;
    }
  }

  // Buang undefined
  Object.keys(data).forEach((k) => data[k] === undefined && delete data[k]);
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Tidak ada field yang diupdate." }, { status: 400 });
  }

  try {
    const updated = await prisma.lead.update({ where: { id }, data });
    return NextResponse.json({ ok: true, lead: updated });
  } catch (err) {
    console.error("[api/v1/leads PATCH]", err);
    return NextResponse.json({ error: "Gagal mengupdate lead." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeApiRequest(_req, { rateLimitKey: "api-v1-leads-write", max: 30, windowMs: 60_000 });
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const lead = await getLeadOr404(id);
  if (!lead) return NextResponse.json({ error: "Lead tidak ditemukan." }, { status: 404 });

  try {
    await prisma.lead.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/v1/leads DELETE]", err);
    return NextResponse.json({ error: "Gagal menghapus lead." }, { status: 500 });
  }
}