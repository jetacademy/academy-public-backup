// Materi LMS (panduan buatan instruktur) sebagai sumber rujukan kedua Asisten Hermes.
// Cakupannya persis materi yang BOLEH dilihat peserta di halaman LMS: program & batch
// pendaftarannya, dan hanya materi preview bila belum bayar — asisten tidak boleh jadi jalan
// pintas membaca materi berbayar. Hanya konten teks materi (PDF sudah sama dengan dokumentasi resmi).

import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { batchModuleWhere } from "@/lib/certificates";
import { chunkMarkdown } from "./chunker";
import { Bm25Index, tokenize, type SearchDoc, type SearchHit } from "./search";
import { LMS_SECTION } from "./prompts";

/** URL potongan materi disimpan netral (tanpa registrationId) supaya jawaban cache bisa dipakai
 *  semua peserta program yang sama — diterjemahkan ke URL LMS milik penanya saat dikirim. */
export const LMS_URL_PREFIX = "lms://";

export function resolveLmsUrl(url: string, registrationId: string | null): string {
  if (!url.startsWith(LMS_URL_PREFIX)) return url;
  const lessonId = url.slice(LMS_URL_PREFIX.length);
  return registrationId ? `/member/lms/${registrationId}?lessonId=${encodeURIComponent(lessonId)}` : "/member";
}

/** HTML dari rich text editor → markdown sederhana (heading & daftar dipertahankan untuk chunking). */
export function htmlToMarkdown(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<h([1-4])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, l: string, t: string) => `\n\n${"#".repeat(Number(l))} ${t}\n\n`)
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_, c: string) => `\n\n\`\`\`\n${c}\n\`\`\`\n\n`)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|ul|ol|blockquote|tr)>/gi, "\n\n")
    .replace(/<(strong|b)>([\s\S]*?)<\/\1>/gi, "**$2**")
    .replace(/<code>([\s\S]*?)<\/code>/gi, "`$1`")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

type LmsIndex = { signature: string; index: Bm25Index<SearchDoc> };

// Indeks kecil per (program, batch, akses) — dibangun ulang hanya bila isi materi berubah.
const cache = new Map<string, LmsIndex>();
const MAX_CACHE = 100;

export async function getLmsIndex(registrationId: string): Promise<LmsIndex | null> {
  const reg = await prisma.registration.findUnique({
    where: { id: registrationId },
    select: { status: true, batchId: true, program: { select: { id: true, price: true, certPrice: true } } },
  });
  if (!reg) return null;

  const paid = reg.status === "PAID" || reg.status === "PASSED";
  const program = reg.program;
  // Sama dengan gerbang halaman LMS: program berbayar belum lunas = preview saja;
  // webinar gratis dengan sertifikat berbayar belum lunas = tidak ada materi.
  if (!paid && program.price === 0 && program.certPrice > 0) return null;
  const previewOnly = !paid && program.price > 0;

  const lessons = await prisma.lesson.findMany({
    where: {
      type: { not: "QUIZ" },
      content: { not: null },
      ...(previewOnly ? { isPreview: true } : {}),
      module: { programId: program.id, ...batchModuleWhere(reg.batchId) },
    },
    orderBy: [{ module: { order: "asc" } }, { order: "asc" }],
    select: { id: true, title: true, content: true, module: { select: { title: true } } },
  });
  const usable = lessons.filter((l) => (l.content ?? "").replace(/<[^>]+>/g, "").trim().length >= 40);
  if (!usable.length) return null;

  const signature = createHash("sha256")
    .update(usable.map((l) => `${l.id}\u0000${l.title}\u0000${l.content}`).join("\u0001"))
    .digest("hex")
    .slice(0, 32);
  const key = `${program.id}|${reg.batchId ?? ""}|${previewOnly ? "p" : "f"}`;
  const hit = cache.get(key);
  if (hit?.signature === signature) return hit;

  const docs: SearchDoc[] = [];
  for (const l of usable) {
    const raw = l.content!;
    const md = /<\/?[a-z][^>]*>/i.test(raw) ? htmlToMarkdown(raw) : raw;
    const title = l.title.replace(/^[^\p{L}\p{N}]+/u, "").trim() || l.title; // buang emoji di depan judul
    const parts = chunkMarkdown(md, {
      url: `${LMS_URL_PREFIX}${l.id}`,
      section: LMS_SECTION,
      fallbackTitle: title,
      anchors: false,
    });
    parts.forEach((p, i) => docs.push({ ...p, title, heading: p.heading, id: `${l.id}:${i}` }));
  }
  if (!docs.length) return null;

  const built = { signature, index: new Bm25Index(docs) };
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value!);
  cache.set(key, built);
  return built;
}

/**
 * Pilih potongan materi yang BENAR-BENAR relevan. Skor BM25 di korpus sekecil ini tidak bisa
 * dibandingkan secara absolut, jadi dipakai cakupan kata: minimal 2 kata penting dari
 * pertanyaan (atau salah satu query rewrite) muncul, dan ≥ 40% dari kata pentingnya.
 */
// Kata yang muncul di hampir semua materi kursus Hermes — tidak menandakan relevansi.
const GENERIC_TERMS = new Set(["hermes", "agent", "desktop", "app", "aplikasi", "ai", "nous", "research"]);

export function selectLmsHits(hits: SearchHit<SearchDoc>[], queries: string[], max = 2): SearchDoc[] {
  const querySets = queries
    .map((q) => new Set(tokenize(q).filter((t) => !GENERIC_TERMS.has(t))))
    .filter((s) => s.size > 0);
  const out: SearchDoc[] = [];
  for (const { doc } of hits) {
    const docTokens = new Set(tokenize(`${doc.title} ${doc.heading} ${doc.content}`));
    const relevant = querySets.some((qs) => {
      let matched = 0;
      for (const t of qs) if (docTokens.has(t)) matched++;
      return matched >= 2 && matched / qs.size >= 0.4;
    });
    if (relevant) out.push(doc);
    if (out.length >= max) break;
  }
  return out;
}
