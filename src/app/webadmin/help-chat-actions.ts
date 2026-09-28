"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { getHelpSettings, syncHermesDocs } from "@/lib/hermes-help/docs-store";

const PAGE = "/webadmin/bantuan-ai";

export async function toggleHelpChat() {
  await requireAdmin();
  const s = await getHelpSettings();
  await prisma.helpChatSettings.update({ where: { id: s.id }, data: { enabled: !s.enabled } });
  revalidatePath(PAGE);
}

export async function saveHelpChatQuota(formData: FormData) {
  await requireAdmin();
  const quota = Math.round(Number(formData.get("dailyQuota")));
  if (!Number.isFinite(quota) || quota < 1 || quota > 500) redirect(`${PAGE}?e=quota`);
  const s = await getHelpSettings();
  await prisma.helpChatSettings.update({ where: { id: s.id }, data: { dailyQuota: quota } });
  revalidatePath(PAGE);
  redirect(`${PAGE}?ok=quota`);
}

/** Catatan instruktur yang selalu disertakan ke AI. Kosong = kembali ke teks bawaan. */
export async function saveInstructorNotes(formData: FormData) {
  await requireAdmin();
  const notes = String(formData.get("instructorNotes") ?? "").trim().slice(0, 3000);
  const s = await getHelpSettings();
  await prisma.helpChatSettings.update({ where: { id: s.id }, data: { instructorNotes: notes || null } });
  revalidatePath(PAGE);
  redirect(`${PAGE}?ok=notes`);
}

/** Sinkron manual — biasanya tidak perlu, sinkron otomatis tiap 7 hari. */
export async function syncHelpDocsNow() {
  await requireAdmin();
  const r = await syncHermesDocs(true);
  revalidatePath(PAGE);
  redirect(r.error ? `${PAGE}?e=sync` : `${PAGE}?ok=sync&n=${r.chunks}`);
}

/** Kosongkan cache jawaban — mis. setelah prompt diperbaiki. */
export async function clearHelpChatCache() {
  await requireAdmin();
  await prisma.helpChatCache.deleteMany({});
  revalidatePath(PAGE);
  redirect(`${PAGE}?ok=cache`);
}
