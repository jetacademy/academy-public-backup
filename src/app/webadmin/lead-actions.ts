"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { computeNextFollowUp, normalizeWhatsapp, isTerminalResult } from "@/lib/leads";
import type { LeadSource, LeadStatus, LeadResult } from "@prisma/client";

const LEAD_SOURCES: LeadSource[] = ["INSTAGRAM", "FACEBOOK", "WHATSAPP", "REFERRAL", "ORGANIC", "OTHER"];
const LEAD_STATUSES: LeadStatus[] = ["NEW", "INTERESTED", "POTENTIAL", "COLD"];
const LEAD_RESULTS: LeadResult[] = ["ACTIVE", "REGISTERED", "PAID", "CANCELLED", "NO_REPLY"];

function toEnum<T extends string>(val: unknown, list: readonly T[], fallback: T): T {
  return list.includes(val as T) ? (val as T) : fallback;
}

/** Buat lead baru (manual dari webadmin). */
export async function createLead(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const whatsappRaw = String(formData.get("whatsapp") ?? "").trim();
  if (!name || !whatsappRaw) return;

  const status = toEnum<LeadStatus>(String(formData.get("status") || "NEW"), LEAD_STATUSES, "NEW");
  const source = toEnum<LeadSource>(String(formData.get("source") || "OTHER"), LEAD_SOURCES, "OTHER");
  const programId = formData.get("programId") ? String(formData.get("programId")) : null;
  const objections = formData.get("objections") ? String(formData.get("objections")).split("\n").map((s) => s.trim()).filter(Boolean) : null;

  const lead = await prisma.lead.create({
    data: {
      name,
      whatsapp: normalizeWhatsapp(whatsappRaw),
      email: formData.get("email") ? String(formData.get("email")).trim() : null,
      source,
      programId,
      bidangUsaha: formData.get("bidangUsaha") ? String(formData.get("bidangUsaha")).trim() : null,
      pesanPertama: formData.get("pesanPertama") ? String(formData.get("pesanPertama")).trim() : null,
      ringkasanConversation: formData.get("ringkasanConversation") ? String(formData.get("ringkasanConversation")).trim() : null,
      ...(objections ? { objections } : {}),
      status,
      nextFollowUpAt: computeNextFollowUp(status, 0, new Date()),
    },
  });
  revalidatePath("/webadmin/leads");
  redirect(`/webadmin/leads/${lead.id}?ok=created`);
}

/** Update detail lead. */
export async function updateLead(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) return;

  const data: Prisma.LeadUncheckedUpdateInput = {};
  const name = String(formData.get("name") ?? "").trim();
  if (name) data.name = name;
  const wa = String(formData.get("whatsapp") ?? "").trim();
  if (wa) data.whatsapp = normalizeWhatsapp(wa);
  data.email = formData.get("email") ? String(formData.get("email")).trim() : null;
  data.bidangUsaha = formData.get("bidangUsaha") ? String(formData.get("bidangUsaha")).trim() : null;
  data.pesanPertama = formData.get("pesanPertama") ? String(formData.get("pesanPertama")).trim() : null;
  data.ringkasanConversation = formData.get("ringkasanConversation") ? String(formData.get("ringkasanConversation")).trim() : null;
  const programId = formData.get("programId") ? String(formData.get("programId")) : null;
  data.programId = programId;

  const objections = formData.get("objections") ? String(formData.get("objections")).split("\n").map((s) => s.trim()).filter(Boolean) : null;
  if (objections) data.objections = objections;
  else data.objections = Prisma.JsonNull;

  const status = toEnum<LeadStatus>(String(formData.get("status") || lead.status), LEAD_STATUSES, lead.status);
  data.status = status;
  const base = lead.lastFollowUpAt ?? lead.createdAt;
  data.nextFollowUpAt = computeNextFollowUp(status, lead.followUpCount, base);

  const hasil = toEnum<LeadResult>(String(formData.get("hasil") || lead.hasil), LEAD_RESULTS, lead.hasil);
  data.hasil = hasil;
  data.closedAt = isTerminalResult(hasil) ? new Date() : null;
  if (isTerminalResult(hasil)) data.nextFollowUpAt = null;

  await prisma.lead.update({ where: { id }, data });
  revalidatePath("/webadmin/leads");
  revalidatePath(`/webadmin/leads/${id}`);
  redirect(`/webadmin/leads/${id}?ok=updated`);
}

/** Catat satu follow-up + catatan, mundurkan jadwal otomatis. */
export async function recordLeadFollowUp(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) return;

  const now = new Date();
  const note = formData.get("note") ? String(formData.get("note")).trim() : "";
  const history = Array.isArray(lead.followUpHistory) ? [...(lead.followUpHistory as unknown[])] : [];
  history.push({ at: now.toISOString(), note });
  const newCount = lead.followUpCount + 1;

  await prisma.lead.update({
    where: { id },
    data: {
      lastFollowUpAt: now,
      followUpCount: newCount,
      followUpHistory: history as Prisma.InputJsonValue,
      nextFollowUpAt: computeNextFollowUp(lead.status, newCount, now),
    },
  });
  revalidatePath("/webadmin/leads");
  revalidatePath(`/webadmin/leads/${id}`);
  redirect(`/webadmin/leads/${id}?ok=followup`);
}

/** Hapus lead. */
export async function deleteLead(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  await prisma.lead.delete({ where: { id } }).catch(() => {});
  revalidatePath("/webadmin/leads");
  redirect("/webadmin/leads?ok=deleted");
}

/** Ubah status cepat dari tabel (nyaman untuk dipakai saat list). */
export async function quickSetLeadStatus(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const statusRaw = String(formData.get("status"));
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead || !(LEAD_STATUSES as string[]).includes(statusRaw)) return;

  const status = statusRaw as LeadStatus;
  await prisma.lead.update({
    where: { id },
    data: {
      status,
      nextFollowUpAt: computeNextFollowUp(status, lead.followUpCount, lead.lastFollowUpAt ?? lead.createdAt),
    },
  });
  revalidatePath("/webadmin/leads");
}

/** Butuh jumlah dari daftar follow-up: fallback kecil untuk expose ke view. */
export async function listLeadPrograms() {
  await requireAdmin();
  return prisma.program.findMany({ orderBy: { title: "asc" }, select: { id: true, title: true } });
}