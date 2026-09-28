// Alur satu pertanyaan: cache → rewrite (klasifikasi + query EN) → BM25 → jawab (stream)
// → verifikasi perintah → simpan cache & log. Dipanggil dari /api/member/help-chat.

import { createHash } from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getDocsIndex } from "./docs-store";
import { addUsage, complete, HELP_MODEL, streamComplete, type ChatMessage, type Usage } from "./openrouter";
import {
  buildAnswerPrompt,
  buildRewriteInput,
  buildRewritePrompt,
  formatContext,
  normalizeQuestion,
  parseRewrite,
  toSourceRefs,
  trimHistory,
  type ChatTurn,
  type Intent,
  type SourceRef,
} from "./prompts";
import { findTerminalCommands, findUnverifiedCode, findUntrustedLinks } from "./answer-check";
import { getLmsIndex, resolveLmsUrl } from "./lms-source";
import { selectContext } from "./retrieve";
import { ABORTED } from "./quota";

export type HelpEvent =
  | { t: "meta"; sources: SourceRef[]; cached: boolean }
  | { t: "delta"; v: string }
  | { t: "done"; logId: string; unverified: string[]; remaining: number | null }
  | { t: "error"; message: string };

export type AskInput = {
  identifier: string;
  registrationId: string | null;
  question: string;
  image: string | null; // data URL
  history: ChatTurn[];
  remainingBefore: number; // kuota tersisa sebelum pertanyaan ini
  signal: AbortSignal;
  emit: (e: HelpEvent) => void;
};

const FALLBACK_REPLY: Record<Exclude<Intent, "hermes" | "business">, string> = {
  smalltalk: "Halo! Saya Raka, Jetschool Assistant. Silakan tanya apa saja seputar Hermes Agent, OpenRouter, atau ide membangun karyawan AI untuk bisnismu.",
  offtopic: "Maaf, saya khusus membantu seputar Hermes Agent, OpenRouter, dan penerapan karyawan AI untuk bisnis. Silakan ajukan pertanyaan seputar itu, ya.",
};

// lmsSignature ikut di kunci: jawaban yang merujuk materi kelas otomatis basi saat materi diubah,
// dan program berbeda (materi berbeda) tidak berbagi jawaban.
// Catatan instruktur juga ikut: jawaban lama basi begitu admin mengubah catatan.
// PROMPT_VERSION: naikkan saat gaya/aturan jawaban berubah (v3 = jawaban berupa prompt siap salin
// untuk Hermes Desktop, tanpa perintah terminal) supaya jawaban cache gaya lama tidak disajikan lagi.
const PROMPT_VERSION = "4"; // v4 = WhatsApp biasa (scan QR), bukan Cloud API
function cacheKey(question: string, docsHash: string, lmsSignature: string, notes: string): string {
  return createHash("sha256")
    .update(`${PROMPT_VERSION}|${normalizeQuestion(question)}|${docsHash}|${lmsSignature}|${notes}`)
    .digest("hex");
}

function userMessage(text: string, image: string | null): ChatMessage {
  return image
    ? { role: "user", content: [{ type: "text", text }, { type: "image_url", image_url: { url: image } }] }
    : { role: "user", content: text };
}

export async function askHermesHelp(input: AskInput): Promise<void> {
  const { identifier, registrationId, question, image, signal, emit } = input;
  const started = Date.now();
  const history = trimHistory(input.history);
  const standalone = !image && history.length === 0; // hanya pertanyaan berdiri sendiri yang di-cache

  const docs = await getDocsIndex();
  if (!docs) {
    emit({ t: "error", message: "Dokumentasi belum tersedia. Coba lagi beberapa saat lagi." });
    return;
  }

  // Materi kelas program ini (opsional) — kegagalan tidak boleh menggagalkan jawaban.
  const lms = registrationId
    ? await getLmsIndex(registrationId).catch((err) => {
        console.warn("[hermes-help] materi LMS gagal dimuat:", err instanceof Error ? err.message : err);
        return null;
      })
    : null;
  const publicSources = (list: SourceRef[]) => list.map((s) => ({ ...s, url: resolveLmsUrl(s.url, registrationId) }));

  // 1. Cache — 0 token, tidak memotong kuota.
  const key = cacheKey(question, docs.hash, lms?.signature ?? "", docs.instructorNotes);
  if (standalone) {
    const hit = await prisma.helpChatCache.findUnique({ where: { key } });
    if (hit) {
      await prisma.helpChatCache.update({ where: { key }, data: { hits: { increment: 1 } } });
      emit({ t: "meta", sources: publicSources(hit.sources as SourceRef[]), cached: true });
      emit({ t: "delta", v: hit.answer });
      const log = await prisma.helpChatLog.create({
        data: {
          identifier, registrationId, question, answer: hit.answer, sources: hit.sources as Prisma.InputJsonValue,
          cached: true, cacheKey: key, latencyMs: Date.now() - started,
        },
      });
      emit({ t: "done", logId: log.id, unverified: [], remaining: input.remainingBefore });
      return;
    }
  }

  let usage: Usage = { promptTokens: 0, completionTokens: 0, costUsd: 0 };
  let intent: Intent = "hermes";
  let answer = "";
  let sources: SourceRef[] = [];
  let unverified: string[] = [];
  let errorMsg: string | null = null;

  try {
    // 2. Rewrite: klasifikasi + query bahasa Inggris (dokumentasi berbahasa Inggris).
    let queries: string[] = [];
    let reply: string | null = null;
    try {
      const rw = await complete({
        messages: [
          { role: "system", content: buildRewritePrompt(docs.topics) },
          userMessage(buildRewriteInput(question, history), image),
        ],
        maxTokens: 800,
        temperature: 0,
        signal,
      });
      usage = addUsage(usage, rw.usage);
      ({ intent, queries, reply } = parseRewrite(rw.text));
    } catch (err) {
      if (signal.aborted) throw err;
      // Rewrite gagal bukan alasan gagal menjawab — lanjut pakai pertanyaan mentah.
      console.warn("[hermes-help] rewrite gagal:", err instanceof Error ? err.message : err);
    }

    if (intent === "smalltalk" || intent === "offtopic") {
      answer = reply || FALLBACK_REPLY[intent];
      emit({ t: "meta", sources: [], cached: false });
      emit({ t: "delta", v: answer });
    } else {
      // 3. Cari: query hasil rewrite + pertanyaan asli (menangkap istilah/perintah yang diketik persis).
      // Rewrite kosong pada pertanyaan lanjutan → gabungkan dengan pertanyaan sebelumnya.
      if (!queries.length) {
        const prevUser = [...history].reverse().find((t) => t.role === "user");
        if (prevUser) queries = [`${prevUser.content} ${question}`];
      }
      // Materi kelas + dokumentasi resmi (+ slot Hermes Desktop / anchor metode kelas) — lihat retrieve.ts.
      const picked = selectContext({
        docsIndex: docs.index,
        lmsIndex: lms?.index ?? null,
        question,
        queries,
        intent,
      });
      const context = formatContext(picked);
      sources = toSourceRefs(picked);
      emit({ t: "meta", sources: publicSources(sources), cached: false });

      // 4. Jawab (stream).
      const res = await streamComplete(
        {
          messages: [
            { role: "system", content: buildAnswerPrompt(context, docs.instructorNotes, intent === "business" ? "business" : "guide") },
            ...history.map((t): ChatMessage => ({ role: t.role, content: t.content })),
            userMessage(question, image),
          ],
          maxTokens: intent === "business" ? 2000 : 1500,
          temperature: 0.2,
          signal,
        },
        (v) => emit({ t: "delta", v }),
      );
      usage = addUsage(usage, res.usage);
      answer = res.text.trim();
      if (!answer) throw new Error("Jawaban kosong dari model");

      // 5. Verifikasi perintah terhadap konteks.
      const verifyCtx = `${context}\n${docs.instructorNotes}`;
      unverified = [
        ...findUnverifiedCode(answer, verifyCtx),
        ...findUntrustedLinks(answer, verifyCtx),
        // Peserta tidak memakai terminal — perintah terminal yang lolos tetap ditandai.
        ...findTerminalCommands(answer),
      ].filter((v, i, a) => a.indexOf(v) === i);

      if (standalone && unverified.length === 0) {
        await prisma.helpChatCache.upsert({
          where: { key },
          create: { key, question, answer, sources: sources as unknown as Prisma.InputJsonValue },
          update: { answer, sources: sources as unknown as Prisma.InputJsonValue },
        });
      }
    }
  } catch (err) {
    if (signal.aborted) {
      // Dibatalkan peserta: token sudah terpakai → dicatat khusus supaya tetap dihitung kuota (quota.ts).
      errorMsg = ABORTED;
    } else {
      errorMsg = err instanceof Error ? err.message : String(err);
      console.error("[hermes-help] gagal menjawab:", errorMsg);
      emit({ t: "error", message: "Maaf, Raka sedang gangguan. Silakan coba lagi sebentar lagi." });
    }
  }

  const log = await prisma.helpChatLog.create({
    data: {
      identifier,
      registrationId,
      question,
      answer: answer || null,
      sources: sources.length ? (sources as unknown as Prisma.InputJsonValue) : undefined,
      intent: errorMsg ? "error" : intent,
      cached: false,
      cacheKey: standalone ? key : null,
      hasImage: !!image,
      unverified: unverified.length ? unverified : undefined,
      model: HELP_MODEL,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      costUsd: usage.costUsd,
      latencyMs: Date.now() - started,
      error: errorMsg,
    },
  });

  if (!errorMsg) {
    emit({ t: "done", logId: log.id, unverified, remaining: Math.max(0, input.remainingBefore - 1) });
  }
}
