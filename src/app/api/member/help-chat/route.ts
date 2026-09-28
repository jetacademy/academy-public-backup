import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMemberSession } from "@/lib/member-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { askHermesHelp, type HelpEvent } from "@/lib/hermes-help/assistant";
import { getHelpSettings } from "@/lib/hermes-help/docs-store";
import { dailyBudgetUsd, hasHelpChatAccess, spentTodayUsd, usedToday } from "@/lib/hermes-help/quota";
import type { ChatTurn } from "@/lib/hermes-help/prompts";

export const dynamic = "force-dynamic";

const MAX_QUESTION = 1000;
const MAX_IMAGE_CHARS = 2_000_000; // ±1,5 MB — browser sudah mengecilkan gambar sebelum kirim
const MAX_BODY_BYTES = 2_300_000; // gambar + pertanyaan + riwayat singkat
const MAX_HISTORY_ITEMS = 8;
const IMAGE_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

// Satu pertanyaan aktif per peserta: mencegah banyak request paralel lolos cek kuota bersamaan
// dan membebani provider. (In-memory — cukup untuk deployment satu instance seperti Hostinger.)
const inFlight = new Set<string>();

/** Baca body dengan batas ukuran — tanpa ini, body raksasa di-parse utuh ke memori. */
async function readJsonCapped(req: Request, max: number): Promise<unknown> {
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > max) throw new RangeError("too-large");
  if (!req.body) return null;
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel().catch(() => {});
      throw new RangeError("too-large");
    }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

/** Pendaftaran milik sesi ini yang memberi hak memakai Raka (sama dengan gerbang akses LMS). */
async function findEligibleRegistration(identifier: string, registrationId: string | null) {
  const regs = await prisma.registration.findMany({
    where: {
      OR: [{ email: identifier }, { whatsapp: identifier }],
      ...(registrationId ? { id: registrationId } : {}),
    },
    select: { id: true, status: true, program: { select: { price: true, certPrice: true } } },
    take: 50,
  });
  return regs.find((r) => hasHelpChatAccess(r, r.program)) ?? null;
}

/** GET — status kuota untuk ditampilkan widget saat dibuka. */
export async function GET() {
  const identifier = await getMemberSession();
  if (!identifier) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const settings = await getHelpSettings();
  const used = await usedToday(identifier);
  return NextResponse.json({ enabled: settings.enabled, remaining: Math.max(0, settings.dailyQuota - used), quota: settings.dailyQuota });
}

/**
 * POST — tanya Raka (Jetschool Assistant). Respons berupa NDJSON stream (satu event JSON per baris):
 * meta (sumber) → delta… (potongan jawaban) → done | error.
 */
export async function POST(req: Request) {
  const identifier = await getMemberSession();
  if (!identifier) return NextResponse.json({ error: "Silakan login terlebih dahulu." }, { status: 401 });

  const settings = await getHelpSettings();
  if (!settings.enabled) {
    return NextResponse.json({ error: "Raka sedang dinonaktifkan admin." }, { status: 503 });
  }

  const limited = checkRateLimit(`help-chat:${identifier}`, 6, 60_000);
  if (!limited.ok) return NextResponse.json({ error: limited.error }, { status: limited.status });

  if (inFlight.has(identifier)) {
    return NextResponse.json({ error: "Tunggu jawaban sebelumnya selesai dulu, ya." }, { status: 429 });
  }

  let body: { message?: unknown; image?: unknown; history?: unknown; registrationId?: unknown };
  try {
    const parsed = await readJsonCapped(req, MAX_BODY_BYTES);
    if (!parsed || typeof parsed !== "object") throw new SyntaxError("bukan objek");
    body = parsed as typeof body;
  } catch (err) {
    if (err instanceof RangeError) {
      return NextResponse.json({ error: "Data terlalu besar. Kecilkan gambar lalu coba lagi." }, { status: 413 });
    }
    return NextResponse.json({ error: "Format data tidak valid." }, { status: 400 });
  }

  const question = typeof body.message === "string" ? body.message.trim().slice(0, MAX_QUESTION) : "";
  const image = typeof body.image === "string" && body.image ? body.image : null;
  if (!question && !image) return NextResponse.json({ error: "Pertanyaan tidak boleh kosong." }, { status: 400 });
  if (image && (image.length > MAX_IMAGE_CHARS || !IMAGE_RE.test(image))) {
    return NextResponse.json({ error: "Gambar tidak valid atau terlalu besar (maks ±1,5 MB)." }, { status: 400 });
  }
  // Riwayat dari browser tidak dipercaya: dipotong jumlah & panjangnya (trimHistory), dan pertanyaan
  // yang membawa riwayat TIDAK pernah di-cache — jadi riwayat palsu hanya memengaruhi jawaban si pengirim.
  const history: ChatTurn[] = Array.isArray(body.history)
    ? body.history
        .slice(-MAX_HISTORY_ITEMS)
        .filter((t): t is ChatTurn => !!t && typeof t === "object" && typeof (t as ChatTurn).content === "string")
        .map((t) => ({ role: t.role === "assistant" ? "assistant" : "user", content: t.content.slice(0, 2000) }))
    : [];

  const registrationId = typeof body.registrationId === "string" ? body.registrationId.slice(0, 64) : null;
  const reg = await findEligibleRegistration(identifier, registrationId);
  if (!reg) {
    return NextResponse.json(
      { error: "Raka tersedia untuk peserta dengan akses materi penuh. Selesaikan pembayaran untuk memakai fitur ini." },
      { status: 403 },
    );
  }

  const remaining = settings.dailyQuota - (await usedToday(identifier));
  if (remaining <= 0) {
    return NextResponse.json(
      { error: `Kuota harian (${settings.dailyQuota} pertanyaan) sudah habis. Coba lagi besok, ya.`, remaining: 0 },
      { status: 429 },
    );
  }

  // Plafon biaya harian seluruh peserta — pengaman terakhir terhadap pemakaian massal.
  if ((await spentTodayUsd()) >= dailyBudgetUsd()) {
    console.warn("[help-chat] plafon biaya harian tercapai");
    return NextResponse.json(
      { error: "Raka sedang mencapai batas pemakaian hari ini. Silakan coba lagi besok, ya." },
      { status: 503 },
    );
  }

  inFlight.add(identifier);
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const emit = (e: HelpEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
        } catch {
          closed = true; // klien sudah menutup koneksi
        }
      };
      try {
        await askHermesHelp({
          identifier,
          registrationId: reg.id,
          question: question || "Tolong jelaskan gambar ini.",
          image,
          history,
          remainingBefore: remaining,
          signal: req.signal,
          emit,
        });
      } catch (err) {
        console.error("[help-chat]", err);
        emit({ t: "error", message: "Maaf, terjadi kesalahan. Silakan coba lagi." });
      } finally {
        inFlight.delete(identifier);
        closed = true;
        try {
          controller.close();
        } catch {}
      }
    },
    cancel() {
      // Klien menutup koneksi sebelum stream dimulai/selesai — pastikan kunci dilepas.
      inFlight.delete(identifier);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no", // matikan buffering reverse proxy (nginx/LiteSpeed) supaya stream mengalir
      "X-Content-Type-Options": "nosniff",
    },
  });
}
