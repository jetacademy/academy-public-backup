// Penyimpanan dokumentasi Hermes + OpenRouter: sinkron llms-full.txt → tabel helpdocchunk, dan indeks
// BM25 di memori proses. Sinkron berjalan OTOMATIS (tanpa cron/kerja admin):
// - belum ada potongan sama sekali → sinkron dulu sebelum menjawab (sekali seumur hidup);
// - sinkron terakhir > 7 hari → sinkron ulang di latar belakang setelah respons terkirim.
// Hash sha256 mencegah tulis ulang DB bila dokumentasi belum berubah.

import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { runAfterResponse } from "@/lib/background";
import { chunkDocs, chunkOpenRouterDocs, DOCS_FULL_URL, OPENROUTER_FULL_URL } from "./chunker";
import { Bm25Index, type SearchDoc } from "./search";
import { buildTopics, DEFAULT_INSTRUCTOR_NOTES } from "./prompts";

const SETTINGS_ID = "singleton";
const REFRESH_MS = 7 * 24 * 60 * 60 * 1000;
const RETRY_MS = 10 * 60 * 1000;

export async function getHelpSettings() {
  return prisma.helpChatSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID },
    update: {},
  });
}

/** Dipakai halaman LMS untuk menampilkan widget — baca saja (tanpa upsert), default aktif. */
export async function isHelpChatEnabled(): Promise<boolean> {
  if (!process.env.OPENROUTER_API_KEY) return false;
  try {
    const s = await prisma.helpChatSettings.findUnique({ where: { id: SETTINGS_ID }, select: { enabled: true } });
    return s?.enabled ?? true;
  } catch {
    return false; // tabel belum dimigrasi → sembunyikan widget, jangan gagalkan halaman LMS
  }
}

// ── Sinkron ─────────────────────────────────────────────────────────────────

let syncing: Promise<SyncResult> | null = null;

export type SyncResult = { changed: boolean; chunks: number; error?: string };

// Naikkan bila logika pemotongan/penyaringan berubah → hash berubah → indeks dibangun ulang
// walau isi dokumentasi di sumbernya sama.
const INDEX_VERSION = "2";

async function download(url: string, marker: string, label: string): Promise<string> {
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`Gagal mengunduh dokumentasi ${label} (HTTP ${res.status})`);
  const text = await res.text();
  if (text.length < 10_000 || !text.includes(marker)) throw new Error(`Format dokumentasi ${label} tidak dikenali`);
  return text;
}

async function doSync(force: boolean): Promise<SyncResult> {
  try {
    // Dua sumber resmi: Hermes Agent + OpenRouter (provider model yang dipakai di kelas).
    const [hermesText, openRouterText] = await Promise.all([
      download(DOCS_FULL_URL, "<!-- source:", "Hermes"),
      download(OPENROUTER_FULL_URL, "Source: https://openrouter.ai/docs/", "OpenRouter"),
    ]);

    // Hash diawali versi indeks (64 karakter total, muat di kolom VARCHAR(64)).
    const digest = createHash("sha256").update(hermesText).update(openRouterText).digest("hex");
    const hash = `${INDEX_VERSION}:${digest.slice(0, 64 - INDEX_VERSION.length - 1)}`;
    const settings = await getHelpSettings();
    if (!force && settings.docsHash === hash && settings.docsChunkCount > 0) {
      await prisma.helpChatSettings.update({ where: { id: SETTINGS_ID }, data: { docsSyncedAt: new Date(), syncError: null } });
      return { changed: false, chunks: settings.docsChunkCount };
    }

    const hermes = chunkDocs(hermesText);
    const openRouter = chunkOpenRouterDocs(openRouterText);
    if (hermes.length < 50 || openRouter.length < 20) {
      throw new Error(`Hasil potongan terlalu sedikit (Hermes ${hermes.length}, OpenRouter ${openRouter.length}) — sinkron dibatalkan`);
    }
    const chunks = [...hermes, ...openRouter.map((c) => ({ ...c, order: hermes.length + c.order }))];

    // Ganti isi tabel dalam satu transaksi: pembaca tidak pernah melihat tabel setengah terisi.
    await prisma.$transaction(
      async (tx) => {
        await tx.helpDocChunk.deleteMany({});
        for (let i = 0; i < chunks.length; i += 300) {
          await tx.helpDocChunk.createMany({ data: chunks.slice(i, i + 300) });
        }
        await tx.helpChatSettings.update({
          where: { id: SETTINGS_ID },
          data: {
            docsHash: hash,
            docsSyncedAt: new Date(),
            docsChunkCount: chunks.length,
            docsTopics: buildTopics(chunks),
            syncError: null,
          },
        });
      },
      { timeout: 120_000, maxWait: 10_000 },
    );
    return { changed: true, chunks: chunks.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[hermes-help] sinkron dokumentasi gagal:", message);
    await prisma.helpChatSettings
      .update({ where: { id: SETTINGS_ID }, data: { syncError: message.slice(0, 1000), docsSyncedAt: new Date() } })
      .catch(() => {});
    return { changed: false, chunks: 0, error: message };
  }
}

/** Satu sinkron berjalan pada satu waktu per proses. */
export function syncHermesDocs(force = false): Promise<SyncResult> {
  if (!syncing) syncing = doSync(force).finally(() => (syncing = null));
  return syncing;
}

// ── Indeks di memori ────────────────────────────────────────────────────────

export type IndexedChunk = SearchDoc;

type Loaded = { hash: string; index: Bm25Index<IndexedChunk>; topics: string | null };
let loaded: Loaded | null = null;
let loading: Promise<Loaded | null> | null = null;

async function loadIndex(hash: string, topics: string | null): Promise<Loaded | null> {
  const rows = await prisma.helpDocChunk.findMany({
    orderBy: { order: "asc" },
    select: { id: true, url: true, section: true, title: true, heading: true, content: true },
  });
  if (!rows.length) return null;
  return { hash, index: new Bm25Index(rows), topics };
}

/**
 * Indeks siap pakai. Tiap panggilan membaca 1 baris settings (murah) supaya proses lain yang
 * baru selesai sinkron ikut terdeteksi — indeks dibangun ulang hanya jika hash berubah.
 */
export async function getDocsIndex(): Promise<(Loaded & { instructorNotes: string }) | null> {
  let settings = await getHelpSettings();

  const sinceLast = Date.now() - (settings.docsSyncedAt?.getTime() ?? 0);
  // Indeks versi lama (logika potong/sumber berubah) → sinkron ulang segera, jangan tunggu 7 hari.
  const stale = !settings.docsHash?.startsWith(`${INDEX_VERSION}:`);

  if (!settings.docsHash || settings.docsChunkCount === 0) {
    // Belum ada data sama sekali: terpaksa menunggu sinkron pertama.
    await syncHermesDocs();
    settings = await getHelpSettings();
    if (!settings.docsHash) return null;
  } else if ((stale && sinceLast > RETRY_MS) || sinceLast > REFRESH_MS) {
    // Sudah ada data lama yang masih bisa dipakai → sinkron di latar belakang. Jeda RETRY_MS
    // mencegah tiap pertanyaan mengunduh ulang 10 MB bila sumber sedang tidak bisa diakses.
    runAfterResponse("hermes-help-sync", () => syncHermesDocs());
  }

  const hash = settings.docsHash!;
  let index: Loaded | null = loaded?.hash === hash ? loaded : null;
  if (!index) {
    if (!loading) {
      loading = loadIndex(hash, settings.docsTopics)
        .then((l) => (loaded = l ?? loaded))
        .finally(() => (loading = null));
    }
    index = await loading;
  }
  // Catatan instruktur dibaca segar tiap pertanyaan (bisa diubah admin kapan saja).
  return index ? { ...index, instructorNotes: settings.instructorNotes ?? DEFAULT_INSTRUCTOR_NOTES } : null;
}
