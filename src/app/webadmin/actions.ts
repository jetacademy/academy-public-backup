"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin, createAdminSession, destroyAdminSession } from "@/lib/admin-auth";
import { hashPassword, generateApiKey } from "@/lib/crypto";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendWa, msgAccess, msgPaid, normalizeWa } from "@/lib/wa";
import { formatJadwal, parseWIB } from "@/lib/format";
import { sendEmail, getPaidEmailHtml } from "@/lib/email";
import { recordAffiliateConversion, voidAffiliateConversion } from "@/lib/affiliate";
import { linkLeadToRegistration } from "@/lib/lead-link";
import { isCertIssuanceEnabled, issueCertificate, checkCertEligibility, isScheduleGateOpen } from "@/lib/certificates";
import { createBunnyVideo, getBunnyUploadAuth, deleteBunnyVideo } from "@/lib/bunny";
import { sanitizeHtml } from "@/lib/sanitize";
import { slugify } from "@/lib/slug";
import { isValidVideoUrl } from "@/lib/video";
import { compressToWebP } from "@/lib/image-compress";
import { join } from "path";

// ─── Auth ────────────────────────────────────────────────────────

export async function adminLogin(formData: FormData) {
  const { headers } = await import("next/headers");
  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for") ?? hdrs.get("x-real-ip") ?? "admin-login";
  const limit = checkRateLimit(`admin-login:${ip}`, 5, 60_000);
  if (!limit.ok) redirect("/webadmin/login?e=ratelimit");

  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const ok = await createAdminSession(email, password);
  if (!ok) redirect("/webadmin/login?e=1");
  redirect("/webadmin");
}

export async function adminLogout() {
  await destroyAdminSession();
  try {
    const { cookies } = await import("next/headers");
    const jar = await cookies();
    jar.delete("jsa_member");
    jar.delete("jsa_member_ui");
  } catch {}
  redirect("/webadmin/login");
}

// ─── Helpers ─────────────────────────────────────────────────────

/** textarea "satu per baris" → array string */
function parseLines(v: string): string[] {
  return v.split("\n").map((s) => s.trim()).filter(Boolean);
}

/** textarea "Label | 99000" per baris → array { label, value } */
function parseDeliverables(v: string): { label: string; value: number }[] {
  return parseLines(v).map((line) => {
    const [label, val] = line.split("|").map((s) => s.trim());
    return { label, value: Number(val ?? 0) || 0 };
  });
}

function num(formData: FormData, key: string): number {
  return Number(String(formData.get(key) ?? "0").replace(/[^\d]/g, "")) || 0;
}

function optStr(formData: FormData, key: string): string | null {
  const v = String(formData.get(key) ?? "").trim();
  return v.length > 0 ? v : null;
}

function isUniqueError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

// ─── Program ─────────────────────────────────────────────────────

export async function saveProgram(formData: FormData) {
  await requireAdmin();

  const id = optStr(formData, "id");
  const rawTagline = String(formData.get("tagline") ?? "").trim();
  const rawDescription = String(formData.get("description") ?? "").trim();
  const rawMentorBio = String(formData.get("mentorBio") ?? "").trim();
  const rawGuarantee = String(formData.get("guarantee") ?? "").trim();
  const data = {
    slug: String(formData.get("slug") ?? "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-"),
    type: String(formData.get("type") ?? "WEBINAR") as "WEBINAR" | "KELAS" | "WORKSHOP" | "BOOTCAMP",
    title: String(formData.get("title") ?? "").trim(),
    tagline: await sanitizeHtml(rawTagline) ?? rawTagline,
    description: await sanitizeHtml(rawDescription) ?? rawDescription,
    emoji: String(formData.get("emoji") ?? "🎓").trim() || "🎓",
    imageUrl: optStr(formData, "imageUrl"),
    mentorName: String(formData.get("mentorName") ?? "").trim(),
    mentorBio: await sanitizeHtml(rawMentorBio) ?? rawMentorBio,
    materi: parseLines(String(formData.get("materi") ?? "")),
    deliverables: parseDeliverables(String(formData.get("deliverables") ?? "")),
    guarantee: rawGuarantee ? (await sanitizeHtml(rawGuarantee) ?? rawGuarantee) : null,
    scheduleAt: parseWIB(String(formData.get("scheduleAt"))),
    durationLabel: String(formData.get("durationLabel") ?? "2 jam").trim(),
    zoomLink: optStr(formData, "zoomLink"),
    waGroupLink: optStr(formData, "waGroupLink"),
    lmsLink: optStr(formData, "lmsLink"),
    price: num(formData, "price"),
    priceOld: num(formData, "priceOld") || null,
    certPrice: num(formData, "certPrice"),
    certPriceOld: num(formData, "certPriceOld") || null,
    seatsLeft: num(formData, "seatsLeft") || null,
    isActive: formData.get("isActive") === "on",
    isFeatured: formData.get("isFeatured") === "on",
    categoryId: optStr(formData, "categoryId"),
  };

  if (!data.slug || !data.title) redirect(id ? `/webadmin/program/${id}?e=lengkapi` : "/webadmin/program/new?e=lengkapi");
  if (Number.isNaN(data.scheduleAt.getTime())) {
    redirect(id ? `/webadmin/program/${id}?e=tanggaltidakvalid` : "/webadmin/program/new?e=tanggaltidakvalid");
  }

  // certClaimOpen dihandle via raw SQL agar tidak bergantung pada versi Prisma client
  const certClaimOpen = formData.get("certClaimOpen") === "on";

  try {
    if (id) {
      await prisma.program.update({ where: { id }, data });
      await prisma.$executeRaw`UPDATE \`program\` SET \`certClaimOpen\` = ${certClaimOpen} WHERE \`id\` = ${id}`;
    } else {
      const created = await prisma.program.create({ data });
      await prisma.$executeRaw`UPDATE \`program\` SET \`certClaimOpen\` = ${certClaimOpen} WHERE \`id\` = ${created.id}`;
    }
  } catch (err) {
    if (isUniqueError(err)) {
      // slug sudah dipakai program lain
      redirect(id ? `/webadmin/program/${id}?e=slug` : "/webadmin/program/new?e=slug");
    }
    throw err;
  }
  revalidatePath("/");
  revalidatePath("/webadmin/program");
  redirect("/webadmin/program?ok=1");
}

const CONTENT_BLOCK_TYPES = ["heading", "text", "image", "video", "list", "stack", "split", "quote"];

/** Validasi & sanitasi blok mentah dari editor sebelum disimpan — blok yang tidak valid/kosong dibuang. */
export async function sanitizeContentBlocks(input: unknown): Promise<Prisma.InputJsonValue> {
  if (!Array.isArray(input)) return [];
  const out: Record<string, unknown>[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const b = raw as Record<string, unknown>;
    const type = String(b.type ?? "");
    if (!CONTENT_BLOCK_TYPES.includes(type)) continue;
    const id = typeof b.id === "string" && b.id ? b.id : `blk_${out.length}`;

    if (type === "heading") {
      const text = String(b.text ?? "").trim();
      if (text) out.push({ id, type, text });
    } else if (type === "text") {
      const html = await sanitizeHtml(String(b.html ?? "").trim());
      if (html) out.push({ id, type, html });
    } else if (type === "image") {
      const url = String(b.url ?? "").trim();
      const caption = String(b.caption ?? "").trim();
      if (url) out.push({ id, type, url, ...(caption ? { caption } : {}) });
    } else if (type === "video") {
      const url = String(b.url ?? "").trim();
      const caption = String(b.caption ?? "").trim();
      if (url && isValidVideoUrl(url)) out.push({ id, type, url, ...(caption ? { caption } : {}) });
    } else if (type === "list") {
      const items = Array.isArray(b.items) ? b.items.map((v) => String(v).trim()).filter(Boolean) : [];
      const title = String(b.title ?? "").trim();
      if (items.length) out.push({ id, type, items, ...(title ? { title } : {}) });
    } else if (type === "stack") {
      const items = Array.isArray(b.items)
        ? (b.items as unknown[])
            .map((v) => {
              const item = v as { label?: unknown; value?: unknown };
              return { label: String(item.label ?? "").trim(), value: Number(item.value ?? 0) || 0 };
            })
            .filter((it) => it.label)
        : [];
      const title = String(b.title ?? "").trim();
      if (items.length) out.push({ id, type, items, ...(title ? { title } : {}) });
    } else if (type === "split") {
      const leftItems = Array.isArray(b.leftItems)
        ? (b.leftItems as unknown[])
            .map((v) => {
              const item = v as { label?: unknown; value?: unknown };
              return { label: String(item.label ?? "").trim(), value: Number(item.value ?? 0) || 0 };
            })
            .filter((it) => it.label)
        : [];
      const rightItems = Array.isArray(b.rightItems) ? b.rightItems.map((v) => String(v).trim()).filter(Boolean) : [];
      if (leftItems.length || rightItems.length) {
        const leftTitle = String(b.leftTitle ?? "").trim() || "Yang Anda Terima";
        const rightTitle = String(b.rightTitle ?? "").trim() || "Yang Anda Pelajari";
        out.push({ id, type, leftTitle, leftItems, rightTitle, rightItems });
      }
    } else if (type === "quote") {
      const text = String(b.text ?? "").trim();
      const author = String(b.author ?? "").trim();
      if (text) out.push({ id, type, text, ...(author ? { author } : {}) });
    }
  }
  return out as Prisma.InputJsonValue;
}

/** Simpan blok konten editor halaman program (dipanggil langsung dari client, bukan lewat <form>). */
export async function saveProgramContentBlocks(
  programId: string,
  blocks: unknown
): Promise<{ ok?: true; error?: string }> {
  await requireAdmin();
  try {
    const clean = await sanitizeContentBlocks(blocks);
    const updated = await prisma.program.update({ where: { id: programId }, data: { contentBlocks: clean }, select: { slug: true } });
    revalidatePath(`/program/${updated.slug}`);
    revalidatePath(`/webadmin/program/${programId}/konten`);
    return { ok: true };
  } catch (err) {
    console.error("[saveProgramContentBlocks]", err);
    return { error: "Gagal menyimpan blok konten. Coba lagi." };
  }
}

/** Pengaturan kriteria kelulusan & sertifikat (tab Kelulusan) */
export async function saveGraduationSettings(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const completionCriteria = (formData.get("completionCriteria") ?? "ALL_LESSONS") as
    | "ALL_LESSONS" | "ALL_QUIZZES";
  const certKind = (formData.get("certKind") ?? "ACHIEVEMENT") as
    | "PARTICIPATION" | "COMPLETION" | "ACHIEVEMENT";
  const passingScore = Math.min(100, Math.max(0, num(formData, "passingScore") || 60));
  const maxTestAttempts = Math.max(0, num(formData, "maxTestAttempts"));

  await prisma.program.update({
    where: { id },
    data: { completionCriteria, certKind, passingScore, maxTestAttempts },
  });
  revalidatePath(`/webadmin/program/${id}/kelulusan`);
  redirect(`/webadmin/program/${id}/kelulusan?ok=1`);
}

export async function toggleProgram(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const cur = await prisma.program.findUnique({ where: { id } });
  if (cur) await prisma.program.update({ where: { id }, data: { isActive: !cur.isActive } });
  revalidatePath("/webadmin/program");
  revalidatePath("/");
}

/** Buka / tutup klaim sertifikat secara manual — dari daftar program atau form edit */
export async function toggleCertClaim(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  // Gunakan raw SQL agar tidak bergantung pada versi Prisma client yang ter-cache
  await prisma.$executeRaw`UPDATE \`program\` SET \`certClaimOpen\` = NOT \`certClaimOpen\` WHERE \`id\` = ${id}`;
  revalidatePath("/webadmin/program");
  revalidatePath("/member");
}

export async function deleteProgram(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const regCount = await prisma.registration.count({ where: { programId: id } });
  if (regCount > 0) {
    // ada pendaftar → jangan hapus data, cukup nonaktifkan
    await prisma.program.update({ where: { id }, data: { isActive: false } });
  } else {
    // modul & lesson ikut terhapus via onDelete: Cascade; soal dihapus manual
    await prisma.question.deleteMany({ where: { programId: id } });
    await prisma.program.delete({ where: { id } });
  }
  revalidatePath("/webadmin/program");
  revalidatePath("/");
}

// ─── Soal kuis ───────────────────────────────────────────────────

/** Tujuan kembali setelah simpan/hapus soal: halaman materi kuis (fallback: kurikulum) */
function questionBackUrl(programId: string, lessonId: string | null): string {
  return lessonId
    ? `/webadmin/program/${programId}/lms/lesson/${lessonId}`
    : `/webadmin/program/${programId}/lms`;
}

export async function saveQuestion(formData: FormData) {
  await requireAdmin();
  const id = optStr(formData, "id");
  const programId = String(formData.get("programId"));
  const lessonId = optStr(formData, "lessonId"); // terisi = soal kuis materi
  const data = {
    text: String(formData.get("text") ?? "").trim(),
    optionA: String(formData.get("optionA") ?? "").trim(),
    optionB: String(formData.get("optionB") ?? "").trim(),
    optionC: String(formData.get("optionC") ?? "").trim(),
    optionD: String(formData.get("optionD") ?? "").trim(),
    correct: (["A", "B", "C", "D"].includes(String(formData.get("correct"))) ? String(formData.get("correct")) : "A") as "A" | "B" | "C" | "D",
    order: num(formData, "order"),
  };
  if (!data.text) redirect(questionBackUrl(programId, lessonId));

  if (id) {
    await prisma.question.update({ where: { id }, data });
  } else {
    // urutan otomatis di akhir jika tidak diisi
    if (!data.order) {
      const last = await prisma.question.findFirst({
        where: lessonId ? { lessonId } : { programId, lessonId: null },
        orderBy: { order: "desc" },
      });
      data.order = (last?.order ?? 0) + 1;
    }
    await prisma.question.create({ data: { ...data, programId, lessonId } });
  }
  revalidatePath(`/webadmin/program/${programId}/soal`);
  revalidatePath(`/webadmin/program/${programId}/lms`);

  // "Simpan & Tambah Lagi" → langsung ke form soal baru berikutnya
  if (String(formData.get("intent") ?? "") === "next" && lessonId) {
    redirect(`/webadmin/program/${programId}/soal/new?lesson=${lessonId}&ok=1`);
  }
  redirect(`${questionBackUrl(programId, lessonId)}?ok=1`);
}

export async function deleteQuestion(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const programId = String(formData.get("programId"));
  const existing = await prisma.question.findUnique({ where: { id }, select: { lessonId: true } });
  await prisma.question.delete({ where: { id } }).catch((err) => console.error("[deleteQuestion] Gagal:", err));
  revalidatePath(`/webadmin/program/${programId}/soal`);
  revalidatePath(`/webadmin/program/${programId}/lms`);
  redirect(`${questionBackUrl(programId, existing?.lessonId ?? null)}?deleted=1`);
}

// ─── Kelompok Modul ──────────────────────────────────────────────

export async function saveLmsGroup(formData: FormData) {
  await requireAdmin();

  const id = optStr(formData, "id");
  const programId = String(formData.get("programId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();

  if (!programId || !title) redirect(`/webadmin/program/${programId}/lms?e=lengkapi`);

  if (id) {
    await prisma.lmsGroup.update({ where: { id }, data: { title } });
  } else {
    const last = await prisma.lmsGroup.findFirst({ where: { programId }, orderBy: { order: "desc" } });
    await prisma.lmsGroup.create({ data: { programId, title, order: (last?.order ?? 0) + 1 } });
  }

  revalidatePath(`/webadmin/program/${programId}/lms`);
}

/** Hapus kelompok — modul di dalamnya TIDAK ikut terhapus (menjadi tanpa kelompok) */
export async function deleteLmsGroup(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const programId = String(formData.get("programId"));
  await prisma.lmsGroup.delete({ where: { id } }).catch((err) => console.error("[deleteLmsGroup] Gagal:", err));
  revalidatePath(`/webadmin/program/${programId}/lms`);
  revalidatePath(`/member/lms`);
}

export async function moveLmsGroup(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const programId = String(formData.get("programId"));
  const dir = String(formData.get("dir")) === "up" ? "up" : "down";

  const groups = await prisma.lmsGroup.findMany({ where: { programId }, orderBy: { order: "asc" } });
  const idx = groups.findIndex((g) => g.id === id);
  const swapIdx = dir === "up" ? idx - 1 : idx + 1;
  if (idx === -1 || swapIdx < 0 || swapIdx >= groups.length) return;

  const reordered = [...groups];
  [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];

  await prisma.$transaction(
    reordered.map((g, i) => prisma.lmsGroup.update({ where: { id: g.id }, data: { order: i + 1 } }))
  );

  revalidatePath(`/webadmin/program/${programId}/lms`);
}

// ─── Modul LMS ───────────────────────────────────────────────────

export async function saveLmsModule(formData: FormData) {
  await requireAdmin();

  const id = optStr(formData, "id");
  const programId = String(formData.get("programId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  // groupId dari form: "" = tanpa kelompok
  const hasGroupField = formData.has("groupId");
  const groupId = optStr(formData, "groupId");
  const rawBatchIds = formData.getAll("batchIds").map((v) => String(v));

  if (!programId || !title) redirect(`/webadmin/program/${programId}/lms?e=lengkapi`);

  let moduleId: string;

  if (id) {
    await prisma.lmsModule.update({
      where: { id },
      data: hasGroupField ? { title, groupId } : { title },
    });
    moduleId = id;
  } else {
    const last = await prisma.lmsModule.findFirst({ where: { programId, groupId }, orderBy: { order: "desc" } });
    const created = await prisma.lmsModule.create({ data: { programId, groupId, title, order: (last?.order ?? 0) + 1 } });
    moduleId = created.id;
  }

  // Sync batch links: hapus semua lalu create ulang sesuai centang
  const batchIds = [...new Set(rawBatchIds)];
  await prisma.batchModule.deleteMany({ where: { moduleId } });
  if (batchIds.length > 0) {
    await prisma.batchModule.createMany({
      data: batchIds.map((batchId) => ({ batchId, moduleId })),
    });
  }

  revalidatePath(`/webadmin/program/${programId}/lms`);
}

export async function deleteLmsModule(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const programId = String(formData.get("programId"));
  await prisma.lmsModule.delete({ where: { id } }).catch((err) => console.error("[deleteLmsModule] Gagal:", err));
  revalidatePath(`/webadmin/program/${programId}/lms`);
}

/** Geser urutan modul ke atas / bawah — dalam lingkup kelompoknya */
export async function moveLmsModule(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const programId = String(formData.get("programId"));
  const dir = String(formData.get("dir")) === "up" ? "up" : "down";

  const current = await prisma.lmsModule.findUnique({ where: { id }, select: { groupId: true } });
  if (!current) return;

  const modules = await prisma.lmsModule.findMany({
    where: { programId, groupId: current.groupId },
    orderBy: { order: "asc" },
  });
  const idx = modules.findIndex((m) => m.id === id);
  const swapIdx = dir === "up" ? idx - 1 : idx + 1;
  if (idx === -1 || swapIdx < 0 || swapIdx >= modules.length) return;

  const reordered = [...modules];
  [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];

  await prisma.$transaction(
    reordered.map((m, i) => prisma.lmsModule.update({ where: { id: m.id }, data: { order: i + 1 } }))
  );

  revalidatePath(`/webadmin/program/${programId}/lms`);
}

// ─── Materi (Lesson) ─────────────────────────────────────────────

const LESSON_TYPES = ["VIDEO", "TEXT", "PDF", "QUIZ"] as const;
type LessonTypeStr = (typeof LESSON_TYPES)[number];

export async function saveLmsLesson(formData: FormData) {
  await requireAdmin();
  try {
    const id = optStr(formData, "id");
    const programId = String(formData.get("programId") ?? "").trim();
    const moduleId = String(formData.get("moduleId") ?? "").trim();
    const title = String(formData.get("title") ?? "").trim();
    const rawType = String(formData.get("type") ?? "VIDEO");
    const type: LessonTypeStr = (LESSON_TYPES as readonly string[]).includes(rawType) ? (rawType as LessonTypeStr) : "VIDEO";
    const videoUrl = optStr(formData, "videoUrl");
    if (videoUrl && !isValidVideoUrl(videoUrl)) {
      redirect(`/webadmin/program/${programId}/lms/lesson/${id || "new"}?e=video`);
    }
    const fileUrl = optStr(formData, "fileUrl");
    const content = await sanitizeHtml(optStr(formData, "content"));
    const duration = String(formData.get("duration") ?? "10 menit").trim() || "10 menit";
    const passingScoreRaw = num(formData, "passingScore");
    const hasPassingScore = formData.has("passingScore") && String(formData.get("passingScore")).trim() !== "";
    const passingScore = type === "QUIZ" && hasPassingScore ? Math.min(100, Math.max(0, passingScoreRaw)) : null;
    const isPreview = formData.get("isPreview") === "on";
    const allowDownload = formData.get("allowDownload") === "on";

    if (!programId || !moduleId || !title) redirect(`/webadmin/program/${programId}/lms?e=lengkapi`);

    const data = { moduleId, title, type, videoUrl, fileUrl, content, duration, passingScore, isPreview, allowDownload };

    let lessonId = id;
    if (id) {
      await prisma.lesson.update({ where: { id }, data });
    } else {
      const last = await prisma.lesson.findFirst({ where: { moduleId }, orderBy: { order: "desc" } });
      const created = await prisma.lesson.create({ data: { ...data, order: (last?.order ?? 0) + 1 } });
      lessonId = created.id;
    }

    revalidatePath(`/webadmin/program/${programId}/lms`);
    if (!id && type === "QUIZ") {
      redirect(`/webadmin/program/${programId}/lms/lesson/${lessonId}?ok=baru`);
    }
    redirect(`/webadmin/program/${programId}/lms?ok=1`);
  } catch (err) {
    console.error("[saveLmsLesson]", err);
    const programId = String(formData.get("programId") ?? "").trim();
    redirect(`/webadmin/program/${programId}/lms?e=gagal`);
  }
}

export async function deleteLmsLesson(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const programId = String(formData.get("programId"));
  await prisma.lesson.delete({ where: { id } }).catch((err) => console.error("[deleteLmsLesson] Gagal:", err));
  revalidatePath(`/webadmin/program/${programId}/lms`);
  redirect(`/webadmin/program/${programId}/lms?deleted=1`);
}

/** Geser urutan materi dalam satu modul */
export async function moveLmsLesson(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const programId = String(formData.get("programId"));
  const moduleId = String(formData.get("moduleId"));
  const dir = String(formData.get("dir")) === "up" ? "up" : "down";

  const lessons = await prisma.lesson.findMany({ where: { moduleId }, orderBy: { order: "asc" } });
  const idx = lessons.findIndex((l) => l.id === id);
  const swapIdx = dir === "up" ? idx - 1 : idx + 1;
  if (idx === -1 || swapIdx < 0 || swapIdx >= lessons.length) return;

  const reordered = [...lessons];
  [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];

  await prisma.$transaction(
    reordered.map((l, i) => prisma.lesson.update({ where: { id: l.id }, data: { order: i + 1 } }))
  );

  revalidatePath(`/webadmin/program/${programId}/lms`);
}

// ─── Pendaftar ───────────────────────────────────────────────────

/** Tandai lunas manual (mis. transfer langsung) + kirim WA akses */
export async function markPaid(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const reg = await prisma.registration.findUnique({ where: { id }, include: { program: true, batch: true, payment: true } });
  const MARKPAID_ALLOWED = ["REGISTERED", "EXPIRED", "FAILED"];
  if (!reg || !MARKPAID_ALLOWED.includes(reg.status)) return;

  const amount = reg.program.price > 0 ? reg.program.price : reg.program.certPrice;
  const [payment] = await prisma.$transaction([
    prisma.payment.upsert({
      where: { registrationId: reg.id },
      create: { registrationId: reg.id, amount, status: "PAID", paidAt: new Date() },
      update: { status: "PAID", paidAt: new Date() },
    }),
    prisma.registration.update({ where: { id: reg.id }, data: { status: "PAID" } }),
  ]);
  await recordAffiliateConversion(payment.id);
  await linkLeadToRegistration(reg.id, reg.whatsapp, reg.programId, true);

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const memberUrl = `${baseUrl}/member`;
  if (reg.program.price > 0) {
    const scheduleStr = reg.batch ? formatJadwal(reg.batch.scheduleAt) : formatJadwal(reg.program.scheduleAt);
    const zoomLinkVal = reg.batch ? (reg.batch.zoomLink || null) : reg.program.zoomLink;
    const waGroupLinkVal = reg.batch ? (reg.batch.waGroupLink || null) : reg.program.waGroupLink;
    const lmsLinkVal = reg.batch ? (reg.batch.recordingLink || null) : reg.program.lmsLink;
    await sendWa(reg.whatsapp, msgAccess({
      name: reg.name,
      programTitle: reg.program.title,
      schedule: scheduleStr,
      zoomLink: zoomLinkVal,
      waGroupLink: waGroupLinkVal,
      lmsLink: lmsLinkVal,
      memberUrl,
    }));
  } else {
    await sendWa(reg.whatsapp, msgPaid(reg.name, reg.program.title, memberUrl));
  }

  // Kirim email pembayaran sukses — best-effort (template email tdk memuat jadwal)
  await sendEmail({
    to: reg.email,
    subject: `Pembayaran Berhasil: Akses Pelatihan ${reg.program.title}`,
    html: getPaidEmailHtml(reg.name, reg.program.title, memberUrl,
      reg.batch ? (reg.batch.zoomLink || null) : reg.program.zoomLink,
      reg.batch ? (reg.batch.waGroupLink || null) : reg.program.waGroupLink,
      reg.batch ? (reg.batch.recordingLink || null) : reg.program.lmsLink),
  }).catch((err) => console.error("Gagal mengirim email manual markPaid:", err));

  revalidatePath("/webadmin/pendaftar");
  revalidatePath("/webadmin");
}

export async function deleteRegistration(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  await prisma.certificate.deleteMany({ where: { registrationId: id } });
  await prisma.testAttempt.deleteMany({ where: { registrationId: id } });
  await prisma.payment.deleteMany({ where: { registrationId: id } });
  await prisma.registration.delete({ where: { id } }).catch((err) => console.error("[deleteRegistration] Gagal:", err));
  revalidatePath("/webadmin/pendaftar");
  revalidatePath("/webadmin");
}

export async function saveRegistration(formData: FormData) {
  await requireAdmin();

  const id = optStr(formData, "id");
  const programId = String(formData.get("programId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const whatsappInput = String(formData.get("whatsapp") ?? "").trim();
  const whatsapp = whatsappInput ? normalizeWa(whatsappInput) : whatsappInput;
  const email = String(formData.get("email") ?? "").trim();
  const status = String(formData.get("status") ?? "REGISTERED") as "REGISTERED" | "PAID" | "PASSED";
  const institution = optStr(formData, "institution");

  if (!programId || !name || !whatsapp || !email) {
    redirect("/webadmin/pendaftar?e=lengkapi");
  }

  const data = { programId, name, whatsapp, email, status, institution };

  try {
    let regId: string;
    if (id) {
      await prisma.registration.update({ where: { id }, data });
      regId = id;
    } else {
      const created = await prisma.registration.create({ data });
      regId = created.id;
    }

    // Tautkan ke Lead pipeline (hasil sesuai status pembayaran)
    await linkLeadToRegistration(regId, whatsapp, programId, status === "PAID");

    // Admin menandai lulus manual → terbitkan sertifikat langsung (bukan cuma ubah status),
    // supaya "PASSED" selalu konsisten dengan sertifikat yang benar-benar ada. Tetap taat pada
    // gerbang keamanan (sakelar situs-wide + publish per-program + jadwal batch) — kalau salah
    // satu masih tertutup, sertifikat akan menyusul otomatis lewat backfill saat admin publish
    // program ini (backfill itu sendiri tetap mengecek ulang jadwal batch, lihat toggleCertPublish).
    if (status === "PASSED") {
      const program = await prisma.program.findUnique({ where: { id: programId }, select: { type: true, scheduleAt: true, certPublished: true } });
      if (program?.certPublished && (await isCertIssuanceEnabled()) && (await isScheduleGateOpen(regId, program)).open) {
        await issueCertificate(regId).catch((err) => console.error("[saveRegistration] Gagal menerbitkan sertifikat:", err));
      }
    }

    // Pastikan ada User record agar peserta bisa login member
    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email }, { whatsapp }] },
      select: { id: true },
    });
    const userId = existingUser?.id ?? (
      await prisma.user.create({
        data: { name, email, whatsapp, role: "STUDENT" },
        select: { id: true },
      })
    ).id;

    // Hubungkan semua registrasi dengan email/WA ini yang belum punya userId
    await prisma.registration.updateMany({
      where: { userId: null, OR: [{ email }, { whatsapp }] },
      data: { userId },
    });
    // Pastikan registrasi ini terhubung juga
    await prisma.registration.update({
      where: { id: regId },
      data: { userId },
    });
  } catch (err) {
    if (isUniqueError(err)) {
      redirect("/webadmin/pendaftar?e=duplikat");
    }
    throw err;
  }

  revalidatePath("/webadmin/pendaftar");
  revalidatePath("/webadmin");
  redirect("/webadmin/pendaftar?ok=1");
}

// ─── Upload & Sertifikat ─────────────────────────────────────────

/**
 * Hapus sertifikat yang sudah terbit (mis. terbit keliru sebelum acara selesai) —
 * status pendaftaran dikembalikan ke PAID (kalau sudah pernah lunas) atau REGISTERED,
 * supaya peserta bisa diproses ulang begitu syarat kelulusan benar-benar terpenuhi.
 */
export async function deleteCertificate(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  // Boleh dipanggil dari /webadmin/sertifikat (flat) maupun /webadmin/pendaftar (per batch) —
  // kembalikan admin ke halaman+filter asalnya, bukan selalu lempar ke /webadmin/sertifikat.
  const returnTo = optStr(formData, "returnTo") || "/webadmin/sertifikat";

  const cert = await prisma.certificate.findUnique({
    where: { id },
    include: { registration: { include: { payment: true } } },
  });
  if (!cert) redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}e=notfound`);

  const revertStatus = cert.registration.payment?.status === "PAID" ? "PAID" : "REGISTERED";

  await prisma.$transaction([
    prisma.certificate.delete({ where: { id } }),
    prisma.registration.update({ where: { id: cert.registrationId }, data: { status: revertStatus } }),
  ]);

  revalidatePath("/webadmin/sertifikat");
  revalidatePath("/webadmin/pendaftar");
  redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}ok=dihapus`);
}

/** Sakelar global: nyalakan/matikan penerbitan sertifikat baru di seluruh situs. */
export async function toggleCertIssuance() {
  await requireAdmin();
  const current = await isCertIssuanceEnabled();
  await prisma.systemSetting.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", certIssuanceEnabled: !current },
    update: { certIssuanceEnabled: !current },
  });
  revalidatePath("/webadmin/sertifikat");
}

/**
 * Gerbang rilis sertifikat PER PROGRAM. Sebelum ini di-publish, sertifikat program TIDAK PERNAH
 * auto-terbit ke peserta — walau syarat kelulusan LMS-nya sudah 100% — supaya admin bisa uji
 * desain sertifikat (tab "Sertifikat" di halaman program) dengan tenang sebelum peserta melihatnya.
 * Begitu admin publish (false → true), langsung backfill: peserta yang SUDAH eligible atau sudah
 * ditandai admin "PASSED" secara manual sebelumnya, langsung diterbitkan sertifikatnya — tidak perlu
 * menunggu mereka membuka LMS lagi.
 */
export async function toggleCertPublish(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const program = await prisma.program.findUnique({ where: { id } });
  if (!program) redirect("/webadmin/program");

  const nextPublished = !program.certPublished;
  await prisma.program.update({ where: { id }, data: { certPublished: nextPublished } });

  let issuedCount = 0;
  if (nextPublished && (await isCertIssuanceEnabled())) {
    const updatedProgram = { ...program, certPublished: true };
    const candidates = await prisma.registration.findMany({
      where: { programId: id, certificate: null },
      select: { id: true, status: true },
    });
    for (const reg of candidates) {
      // Sudah ditandai admin "PASSED" manual → lewati cek penyelesaian materi/kuis (itu sudah jadi
      // keputusan admin sebelumnya), TAPI tetap wajib lewat gerbang jadwal batch — supaya publish
      // tidak memblast sertifikat+WA ke peserta di batch yang belum mulai. Selain itu → cek penuh
      // via checkCertEligibility seperti biasa (materi/kuis + jadwal).
      const shouldIssue =
        reg.status === "PASSED"
          ? (await isScheduleGateOpen(reg.id, updatedProgram)).open
          : (await checkCertEligibility(reg.id, updatedProgram)).eligible;
      if (shouldIssue) {
        await issueCertificate(reg.id).catch((err) => console.error("[toggleCertPublish] Gagal menerbitkan sertifikat:", err));
        issuedCount++;
      }
    }
  }

  revalidatePath(`/webadmin/program/${id}/cert`);
  revalidatePath("/webadmin/sertifikat");
  redirect(`/webadmin/program/${id}/cert?ok=${nextPublished ? "published" : "unpublished"}&issued=${issuedCount}`);
}

// ─── Video (Bunny.net Stream) ─────────────────────────────────────

/**
 * Siapkan sesi upload video langsung dari browser ke Bunny (protokol TUS) —
 * file video TIDAK lewat server Next.js (body size limit server action kecil).
 * Kembalikan tanda tangan sekali-pakai, BUKAN write API key itu sendiri.
 */
export async function createBunnyUploadSession(title: string): Promise<
  { guid: string; libraryId: string; expire: number; signature: string; cdnHostname: string } | { error: string }
> {
  await requireAdmin();
  try {
    const { guid } = await createBunnyVideo(title || "Materi tanpa judul");
    const auth = getBunnyUploadAuth(guid);
    return {
      guid,
      libraryId: auth.libraryId,
      expire: auth.expire,
      signature: auth.signature,
      cdnHostname: process.env.BUNNY_STREAM_CDN_HOSTNAME ?? "",
    };
  } catch (err) {
    console.error("[createBunnyUploadSession]", err);
    return { error: err instanceof Error ? err.message : "Gagal menyiapkan upload video." };
  }
}

/** Hapus video Bunny lama saat diganti dengan video baru — best-effort. */
export async function deleteBunnyVideoAction(guid: string) {
  await requireAdmin();
  await deleteBunnyVideo(guid);
}

const ALLOWED_UPLOAD_EXT = ["pdf", "png", "jpg", "jpeg", "webp"];

/** Direktori penyimpanan file upload — pakai env UPLOADS_DIR atau fallback ke home untuk persistensi. */
const UPLOADS_DIR = process.env.UPLOADS_DIR ?? join(process.env.HOME || "/tmp", "jetschool-uploads");
const ALLOWED_UPLOAD_MIME = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB

/**
 * Upload file ke public/uploads. TIDAK melempar error — di production Next
 * menyembunyikan pesan error server action, jadi kembalikan { url | error }.
 */
export async function uploadFileAction(formData: FormData): Promise<{ url?: string; error?: string }> {
  try {
    const { writeFile, mkdir } = await import("fs/promises");

    await requireAdmin();
    const file = formData.get("file") as File;
    if (!file || file.size === 0) return { error: "File kosong atau tidak terbaca." };
    if (file.size > MAX_UPLOAD_BYTES) return { error: "Ukuran file maksimal 20 MB." };

    const ext = (file.name.split(".").pop() ?? "").toLowerCase();
    if (!ALLOWED_UPLOAD_EXT.includes(ext)) {
      return { error: `Tipe file .${ext} tidak diizinkan. Gunakan: ${ALLOWED_UPLOAD_EXT.join(", ")}.` };
    }
    // Validasi MIME type dari server (bukan dari client) — cegah rename berbahaya
    if (!ALLOWED_UPLOAD_MIME.includes(file.type)) {
      return { error: `Format file tidak dikenali. Gunakan PDF atau gambar (PNG/JPG/WebP).` };
    }

    const bytes = await file.arrayBuffer();
    let buffer: Buffer = Buffer.from(bytes);
    const uploadDir = UPLOADS_DIR;
    await mkdir(uploadDir, { recursive: true });

    let finalFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");

    // Check if it's an image
    const isImage = ["png", "jpg", "jpeg", "webp"].includes(ext);
    if (isImage) {
      try {
        const target = (formData.get("target") || formData.get("preset")) as "thumbnail" | "avatar" | "certificate" | "banner" | "article" | "original" | null;
        const res = await compressToWebP(buffer, {
          targetPreset: target ?? undefined,
          quality: 80,
        });
        buffer = res.buffer;
        
        // Change the extension of finalFilename to .webp
        const nameWithoutExt = finalFilename.substring(0, finalFilename.lastIndexOf(".")) || finalFilename;
        finalFilename = `${nameWithoutExt}.webp`;
      } catch (sharpError) {
        console.error("[sharpError]", sharpError);
      }
    } else if (ext === "pdf") {
      try {
        const { PDFDocument } = await import("pdf-lib");
        const pdfDoc = await PDFDocument.load(buffer);
        const compressedPdfBytes = await pdfDoc.save({
          useObjectStreams: true,
        });
        buffer = Buffer.from(compressedPdfBytes);
      } catch (pdfError) {
        console.error("[pdfError]", pdfError);
      }
    }

    const filename = `${Date.now()}-${finalFilename}`;
    await writeFile(join(uploadDir, filename), buffer);

    return { url: `/api/uploads/${filename}` };
  } catch (err) {
    console.error("[uploadFileAction]", err);
    return { error: `Gagal menyimpan file di server: ${err instanceof Error ? err.message : "kesalahan tak dikenal"}.` };
  }
}

// ─── Media Gallery ──────────────────────────────────────────────

/**
 * Simpan file ke tabel media gallery setelah upload — dipanggil dari
 * client setelah uploadFileAction berhasil.
 */
export async function saveToMediaGallery(
  programId: string,
  filename: string,
  url: string,
  mimeType: string,
  size: number,
): Promise<{ id?: string; error?: string }> {
  await requireAdmin();
  try {
    const media = await prisma.media.create({
      data: { programId, filename, url, mimeType, size },
      select: { id: true },
    });
    revalidatePath(`/webadmin/program/${programId}/media`);
    return { id: media.id };
  } catch (err) {
    console.error("[saveToMediaGallery]", err);
    return { error: "Gagal menyimpan ke galeri media." };
  }
}

/** Ambil daftar media per program (server function). */
export async function getMediaGallery(programId: string): Promise<
  { id: string; filename: string; url: string; mimeType: string; size: number; createdAt: Date }[]
> {
  await requireAdmin();
  return prisma.media.findMany({
    where: { programId },
    orderBy: { createdAt: "desc" },
    select: { id: true, filename: true, url: true, mimeType: true, size: true, createdAt: true },
  });
}

/** Hapus media dari gallery — file fisik tetap ada di disk, hanya catatan DB yang dihapus. */
export async function deleteMedia(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const programId = String(formData.get("programId"));
  await prisma.media.delete({ where: { id } }).catch((err) => console.error("[deleteMedia] Gagal:", err));
  revalidatePath(`/webadmin/program/${programId}/media`);
}

export async function saveCertTemplate(programId: string, certBgUrl: string | null, certConfig: unknown) {
  await requireAdmin();
  await prisma.program.update({
    where: { id: programId },
    data: {
      certBgUrl,
      certConfig: certConfig ? (JSON.parse(JSON.stringify(certConfig)) as Prisma.InputJsonValue) : Prisma.DbNull,
    },
  });
  revalidatePath(`/webadmin/program/${programId}`);
  revalidatePath(`/webadmin/program/${programId}/cert`);
}

// ─── Master Template Sertifikat (Reusable) ─────────────────────

export async function saveNewCertTemplate(name: string, description: string | undefined, certBgUrl: string | null, certConfig: unknown) {
  await requireAdmin();
  const template = await prisma.certificateTemplate.create({
    data: {
      name: name.trim() || "Template Tanpa Nama",
      description: description?.trim() || null,
      certBgUrl,
      certConfig: (certConfig ? JSON.parse(JSON.stringify(certConfig)) : {}) as Prisma.InputJsonValue,
    },
  });
  revalidatePath("/webadmin/templates-sertifikat");
  return template;
}

export async function updateMasterCertTemplate(id: string, name: string, description: string | undefined, certBgUrl: string | null, certConfig: unknown) {
  await requireAdmin();
  const updated = await prisma.certificateTemplate.update({
    where: { id },
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      certBgUrl,
      certConfig: (certConfig ? JSON.parse(JSON.stringify(certConfig)) : {}) as Prisma.InputJsonValue,
    },
  });
  revalidatePath("/webadmin/templates-sertifikat");
  return updated;
}

export async function deleteMasterCertTemplate(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  await prisma.certificateTemplate.delete({ where: { id } }).catch((err: unknown) => console.error("[deleteMasterCertTemplate] Gagal:", err));
  revalidatePath("/webadmin/templates-sertifikat");
}

export async function getCertTemplatesList() {
  await requireAdmin();
  return prisma.certificateTemplate.findMany({
    orderBy: { createdAt: "desc" },
  });
}

export async function saveBatchCertConfig(batchId: string, certBgUrl: string | null, certConfig: unknown) {
  await requireAdmin();
  const batch = await prisma.programBatch.update({
    where: { id: batchId },
    data: {
      certBgUrl,
      certConfig: certConfig ? (JSON.parse(JSON.stringify(certConfig)) as Prisma.InputJsonValue) : Prisma.JsonNull,
    },
  });
  revalidatePath(`/webadmin/program/${batch.programId}/batch`);
}

// ─── Kategori ────────────────────────────────────────────────────

export async function saveCategory(formData: FormData) {
  await requireAdmin();

  const id = optStr(formData, "id");
  const name = String(formData.get("name") ?? "").trim();
  let slug = String(formData.get("slug") ?? "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  const isFeatured = formData.get("isFeatured") === "on";

  if (!name) redirect("/webadmin/kategori?e=lengkapi");
  if (!slug) {
    slug = name.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  }

  const data = {
    name,
    slug,
    isFeatured,
  };

  try {
    if (id) {
      await prisma.category.update({ where: { id }, data });
    } else {
      await prisma.category.create({ data });
    }
  } catch (err) {
    if (isUniqueError(err)) {
      redirect(id ? `/webadmin/kategori?id=${id}&e=slug` : "/webadmin/kategori?e=slug");
    }
    throw err;
  }

  revalidatePath("/");
  revalidatePath("/webadmin/kategori");
  redirect("/webadmin/kategori?ok=1");
}

export async function deleteCategory(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  await prisma.category.delete({ where: { id } }).catch((err) => console.error("[deleteCategory] Gagal:", err));
  revalidatePath("/");
  revalidatePath("/webadmin/kategori");
  redirect("/webadmin/kategori?deleted=1");
}

// ─── Voucher / Diskon ────────────────────────────────────────────

export async function saveVoucher(formData: FormData) {
  await requireAdmin();

  const id = optStr(formData, "id");
  const code = String(formData.get("code") ?? "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
  const type = (String(formData.get("type") ?? "PERCENT") === "FIXED" ? "FIXED" : "PERCENT") as "PERCENT" | "FIXED";
  const value = num(formData, "value");
  const maxDiscount = num(formData, "maxDiscount") || null;
  const maxUses = num(formData, "maxUses") || null;
  const isActive = formData.get("isActive") === "on";
  const validFromRaw = String(formData.get("validFrom") ?? "").trim();
  const validUntilRaw = String(formData.get("validUntil") ?? "").trim();
  const validFrom = validFromRaw ? parseWIB(validFromRaw) : null;
  const validUntil = validUntilRaw ? parseWIB(validUntilRaw) : null;

  if (!code || value <= 0) redirect(id ? `/webadmin/voucher?id=${id}&e=lengkapi` : "/webadmin/voucher?e=lengkapi");
  if (type === "PERCENT" && value > 100) redirect(id ? `/webadmin/voucher?id=${id}&e=persen` : "/webadmin/voucher?e=persen");
  if ((validFrom && isNaN(validFrom.getTime())) || (validUntil && isNaN(validUntil.getTime()))) {
    redirect(id ? `/webadmin/voucher?id=${id}&e=tanggal` : "/webadmin/voucher?e=tanggal");
  }

  const data = { code, type, value, maxDiscount, maxUses, isActive, validFrom, validUntil };

  try {
    if (id) {
      await prisma.voucher.update({ where: { id }, data });
    } else {
      await prisma.voucher.create({ data });
    }
  } catch (err) {
    if (isUniqueError(err)) {
      redirect(id ? `/webadmin/voucher?id=${id}&e=kode` : "/webadmin/voucher?e=kode");
    }
    throw err;
  }

  revalidatePath("/webadmin/voucher");
  redirect("/webadmin/voucher?ok=1");
}

export async function toggleVoucher(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const cur = await prisma.voucher.findUnique({ where: { id } });
  if (cur) await prisma.voucher.update({ where: { id }, data: { isActive: !cur.isActive } });
  revalidatePath("/webadmin/voucher");
}

export async function deleteVoucher(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  // Payment.voucherId pakai onDelete: SetNull — histori transaksi yang sudah memakai voucher ini tetap ada.
  await prisma.voucher.delete({ where: { id } }).catch((err) => console.error("[deleteVoucher] Gagal:", err));
  revalidatePath("/webadmin/voucher");
  redirect("/webadmin/voucher?deleted=1");
}

// ─── Refund ──────────────────────────────────────────────────────

/** Catat refund manual (dana dikembalikan admin di luar sistem) + cabut akses peserta otomatis. */
export async function refundPayment(
  registrationId: string,
  amount: number,
  reason: string
): Promise<{ ok?: true; error?: string; warning?: string }> {
  await requireAdmin();

  const reg = await prisma.registration.findUnique({
    where: { id: registrationId },
    include: { payment: true },
  });
  if (!reg || !reg.payment) return { error: "Pendaftaran atau pembayaran tidak ditemukan." };
  if (reg.payment.status !== "PAID" || !["PAID", "PASSED"].includes(reg.status)) {
    return { error: "Hanya pembayaran yang sudah lunas yang bisa direfund." };
  }
  if (!Number.isFinite(amount) || amount <= 0 || amount > reg.payment.amount) {
    return { error: `Jumlah refund harus antara Rp 1 dan Rp ${reg.payment.amount.toLocaleString("id-ID")}.` };
  }
  const trimmedReason = reason.trim();
  if (!trimmedReason) return { error: "Alasan refund wajib diisi." };

  // Conditional update atomik (PAID → REFUNDED) sebagai gerbang idempoten:
  // klik ganda / dua admin bersamaan — hanya satu yang berhasil melewati gerbang ini.
  const claimed = await prisma.payment.updateMany({
    where: { id: reg.payment.id, status: "PAID" },
    data: { status: "REFUNDED", refundedAt: new Date(), refundAmount: amount, refundReason: trimmedReason },
  });
  if (claimed.count === 0) {
    return { error: "Pembayaran ini sudah direfund sebelumnya." };
  }
  await prisma.registration.update({ where: { id: reg.id }, data: { status: "REFUNDED" } });

  const voidResult = await voidAffiliateConversion(reg.payment.id, `Refund: ${trimmedReason}`);

  revalidatePath("/webadmin/pendaftar");
  revalidatePath("/webadmin");
  revalidatePath("/webadmin/affiliate");
  return voidResult.alreadyWithdrawn
    ? { ok: true, warning: "Komisi affiliate untuk transaksi ini sudah terlanjur ditarik — perlu rekonsiliasi manual di halaman Affiliate." }
    : { ok: true };
}

// ─── User Management ─────────────────────────────────────────────

export async function saveUser(formData: FormData) {
  await requireAdmin();

  const id = optStr(formData, "id");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const whatsappInput = optStr(formData, "whatsapp");
  const whatsapp = whatsappInput ? normalizeWa(whatsappInput) : whatsappInput;
  const role = String(formData.get("role") ?? "STUDENT") as "ADMIN" | "TEACHER" | "STUDENT";
  const password = String(formData.get("password") ?? "");

  if (!name || !email) {
    redirect("/webadmin/user?e=lengkapi");
  }

  const data: Prisma.UserUpdateInput = {
    name,
    email,
    whatsapp,
    role,
  };

  if (password.length > 0) {
    data.passwordHash = hashPassword(password);
  }

  try {
    if (id) {
      await prisma.user.update({ where: { id }, data });
    } else {
      if (password.length === 0 && role !== "STUDENT") {
        redirect("/webadmin/user?e=password-wajib");
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await prisma.user.create({ data: data as any });
    }
  } catch (err) {
    if (isUniqueError(err)) {
      redirect(id ? `/webadmin/user?id=${id}&e=duplikat` : "/webadmin/user?e=duplikat");
    }
    throw err;
  }

  revalidatePath("/webadmin/user");
  redirect("/webadmin/user?ok=1");
}

export async function deleteUser(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  await prisma.user.delete({ where: { id } }).catch((err) => console.error("[deleteUser] Gagal:", err));
  revalidatePath("/webadmin/user");
  redirect("/webadmin/user?deleted=1");
}

// ─── Batch Program (jadwal berulang / angkatan) ──────────────────

export async function createBatch(formData: FormData) {
  await requireAdmin();
  const programId = String(formData.get("programId") ?? "").trim();
  const scheduleAtRaw = String(formData.get("scheduleAt") ?? "").trim();
  const seatsLeftRaw = optStr(formData, "seatsLeft");

  if (!programId) redirect("/webadmin/program");
  if (!scheduleAtRaw) redirect(`/webadmin/program/${programId}/batch?e=lengkapi`);

  const scheduleAt = parseWIB(scheduleAtRaw);
  if (isNaN(scheduleAt.getTime())) redirect(`/webadmin/program/${programId}/batch?e=tanggal`);

  await prisma.programBatch.create({
    data: {
      programId,
      scheduleAt,
      seatsLeft: seatsLeftRaw ? parseInt(seatsLeftRaw, 10) : null,
    },
  });

  revalidatePath(`/webadmin/program/${programId}/batch`);
  redirect(`/webadmin/program/${programId}/batch?ok=1`);
}

export async function toggleBatch(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const programId = String(formData.get("programId"));
  const batch = await prisma.programBatch.findUnique({ where: { id } });
  if (batch) await prisma.programBatch.update({ where: { id }, data: { isActive: !batch.isActive } });
  revalidatePath(`/webadmin/program/${programId}/batch`);
}

/**
 * Toggle rilis sertifikat per batch (keputusan owner 8 Agu 2026).
 * - PUBLISH: set certPublished=true → langsung issue otomatis untuk semua peserta
 *   LUNAS (PAID) di batch itu yang belum punya sertifikat. Tidak peduli hadir/tidak,
 *   tidak peduli status PASSED — yang penting lunas & batch sudah selesai.
 * - UNPUBLISH: set certPublished=false → sertifikat baru tidak terbit (yang sudah
 *   terbit sebelumnya tidak dihapus).
 */
export async function toggleBatchCertPublish(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const programId = String(formData.get("programId"));
  const batch = await prisma.programBatch.findUnique({
    where: { id },
    include: { program: { select: { certPublished: true } } },
  });
  if (!batch) {
    revalidatePath(`/webadmin/program/${programId}/batch`);
    return;
  }

  const next = !batch.certPublished;
  await prisma.programBatch.update({ where: { id }, data: { certPublished: next } });

  // Saat publish: issue sertifikat untuk semua peserta LUNAS batch ini yang belum punya.
  // Diproses paralel per chunk agar batch besar tidak menembus timeout server action.
  let issued = 0;
  if (next && batch.program.certPublished) {
    const regs = await prisma.registration.findMany({
      where: { batchId: id, status: "PAID", certificate: { is: null } },
      select: { id: true },
    });
    const CHUNK = 10;
    for (let i = 0; i < regs.length; i += CHUNK) {
      const results = await Promise.all(
        regs.slice(i, i + CHUNK).map((r) =>
          issueCertificate(r.id)
            .then(() => 1)
            .catch((err) => {
              console.error(`[toggleBatchCertPublish] Gagal issue ${r.id}:`, err);
              return 0;
            })
        )
      );
      issued += results.reduce((a, b) => a + b, 0);
    }
  }

  revalidatePath(`/webadmin/program/${programId}/batch`);
  redirect(`/webadmin/program/${programId}/batch?cert=${next ? "published" : "unpublished"}&issued=${issued}`);
}

export async function deleteBatch(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const programId = String(formData.get("programId"));
  // Registration.batchId pakai onDelete: SetNull — histori pendaftaran tetap ada, cuma tautan batch-nya dilepas.
  await prisma.programBatch.delete({ where: { id } }).catch((err) => console.error("[deleteBatch] Gagal:", err));
  revalidatePath(`/webadmin/program/${programId}/batch`);
  redirect(`/webadmin/program/${programId}/batch?deleted=1`);
}

// ─── Integrasi API (Hermes agent, dll.) ──────────────────────────

/** Ambil key aktif, atau buat satu jika belum ada — supaya halaman selalu punya key untuk ditampilkan. */
export async function ensureApiKey(): Promise<string> {
  await requireAdmin();
  const existing = await prisma.apiKey.findFirst({ where: { isActive: true }, orderBy: { createdAt: "desc" } });
  if (existing) return existing.key;

  const created = await prisma.apiKey.create({
    data: { key: generateApiKey(), label: "Hermes Agent Marketing" },
  });
  return created.key;
}

/** Nonaktifkan key lama, buat key baru — key lama langsung berhenti berfungsi. */
export async function regenerateApiKey() {
  await requireAdmin();
  await prisma.apiKey.updateMany({ where: { isActive: true }, data: { isActive: false } });
  await prisma.apiKey.create({
    data: { key: generateApiKey(), label: "Hermes Agent Marketing" },
  });
  revalidatePath("/webadmin/integrasi");
  redirect("/webadmin/integrasi?ok=1");
}

// ─── Artikel ───────────────────────────────────────────────────────

export async function saveArticle(formData: FormData) {
  await requireAdmin();

  const id = optStr(formData, "id");
  const title = String(formData.get("title") ?? "").trim();
  let slug = slugify(String(formData.get("slug") ?? ""));
  const excerpt = String(formData.get("excerpt") ?? "").trim();
  const contentRaw = String(formData.get("content") ?? "").trim();
  const coverImageUrl = optStr(formData, "coverImageUrl");
  const authorName = String(formData.get("authorName") ?? "").trim() || "Tim Jetschool Academy";
  const isPublished = formData.get("isPublished") === "on";

  if (!title || !excerpt) redirect(`/webadmin/artikel/${id ?? "new"}?e=lengkapi`);
  if (!slug) slug = slugify(title);

  const content = await sanitizeHtml(contentRaw);
  if (!content) redirect(`/webadmin/artikel/${id ?? "new"}?e=konten`);

  // Set publishedAt sekali saat pertama kali dipublikasikan — tidak berubah lagi di edit berikutnya
  const existing = id ? await prisma.article.findUnique({ where: { id }, select: { publishedAt: true } }) : null;
  const publishedAt = isPublished ? (existing?.publishedAt ?? new Date()) : existing?.publishedAt ?? null;

  const data = { title, slug, excerpt, content, coverImageUrl, authorName, isPublished, publishedAt };

  try {
    if (id) {
      await prisma.article.update({ where: { id }, data });
    } else {
      await prisma.article.create({ data });
    }
  } catch (err) {
    if (isUniqueError(err)) {
      redirect(`/webadmin/artikel/${id ?? "new"}?e=slug`);
    }
    throw err;
  }

  revalidatePath("/webadmin/artikel");
  revalidatePath("/artikel");
  redirect("/webadmin/artikel?ok=1");
}

export async function deleteArticle(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  await prisma.article.delete({ where: { id } }).catch((err) => console.error("[deleteArticle] Gagal:", err));
  revalidatePath("/webadmin/artikel");
  revalidatePath("/artikel");
  redirect("/webadmin/artikel?deleted=1");
}

// ─── Broadcast ─────────────────────────────────────────────────────

export async function sendBroadcast(formData: FormData) {
  await requireAdmin();

  const programId = optStr(formData, "programId");
  const batchId = optStr(formData, "batchId");
  const messageType = String(formData.get("messageType") ?? "").trim() as "zoom" | "grup" | "custom";
  const customMessage = String(formData.get("customMessage") ?? "").trim();

  if (!messageType) redirect("/webadmin/broadcast?e=tipe");
  if (!programId && !batchId) redirect("/webadmin/broadcast?e=target");
  if (messageType === "custom" && !customMessage) redirect("/webadmin/broadcast?e=pesan");

  // ── Cari penerima ──
  // Program GRATIS: status REGISTERED (nggak ada payment)
  // Program BERBAYAR: cuma PAID/PASSED (yang belum bayar jangan dikirimi)
  const prog = programId ? await prisma.program.findUnique({ where: { id: programId }, select: { price: true } }) : null;
  const isFree = prog ? prog.price === 0 : false;
  const onlyNew = formData.get("onlyNew") === "1";

  // Cek kapan terakhir broadcast
  let lastSentAt: Date | null = null;
  if (onlyNew && programId) {
    const setting = await prisma.systemSetting.findUnique({ where: { id: "singleton" } });
    const key = `last_broadcast_${programId}`;
    const raw = setting as Record<string, unknown> | null;
    lastSentAt = raw?.[key] ? new Date(raw[key] as string) : null;
  }

  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"}/api/webadmin/broadcast`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-secret": process.env.JETSCHOOL_API_KEY || "internal" },
    body: JSON.stringify({
      programId, batchId, messageType,
      customMessage: messageType === "custom" ? customMessage : undefined,
      includeRegistered: isFree,
      onlyNew,
      lastSentAt: lastSentAt?.toISOString(),
    }),
  });

  const data = await res.json();
  if (!res.ok) redirect(`/webadmin/broadcast?e=${encodeURIComponent(data.error || "Gagal")}`);

  // Simpan timestamp broadcast terakhir
  if (programId && data.sent > 0) {
    await prisma.$executeRaw`UPDATE systemSetting SET \`last_broadcast_${programId}\` = NOW() WHERE id = 'singleton'`;
  }

  const resultQuery = new URLSearchParams({ ok: "1", sent: String(data.sent), failed: String(data.failed), total: String(data.total) });
  redirect(`/webadmin/broadcast?${resultQuery.toString()}`);
}

export async function updateBatchLinks(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const programId = String(formData.get("programId") ?? "");
  const zoomLink = String(formData.get("zoomLink") ?? "").trim();
  const waGroupLink = String(formData.get("waGroupLink") ?? "").trim();
  const recordingLink = String(formData.get("recordingLink") ?? "").trim();
  if (!id) redirect(`/webadmin/program/${programId}/batch?e=id`);
  await prisma.programBatch.update({
    where: { id },
    data: {
      zoomLink: zoomLink || null,
      waGroupLink: waGroupLink || null,
      recordingLink: recordingLink || null,
    },
  });
  redirect(`/webadmin/program/${programId}/batch?ok=1`);
}
