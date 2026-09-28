import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMemberSession } from "@/lib/member-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { askHermesHelp, type HelpEvent } from "@/lib/hermes-help/assistant";
import { getHelpSettings } from "@/lib/hermes-help/docs-store";
import { usedToday } from "@/lib/hermes-help/quota";
import type { ChatTurn } from "@/lib/hermes-help/prompts";

export const dynamic = "force-dynamic";

const MAX_QUESTION = 1000;
const MAX_IMAGE_CHARS = 2_000_000; // ±1,5 MB — browser sudah mengecilkan gambar sebelum kirim
const IMAGE_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

/** GET — status kuota untuk ditampilkan widget saat dibuka. */
export async function GET() {
  const identifier = await getMemberSession();
  if (!identifier) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const settings = await getHelpSettings();
  const used = await usedToday(identifier);
  return NextResponse.json({ enabled: settings.enabled, remaining: Math.max(0, settings.dailyQuota - used), quota: settings.dailyQuota });
}

/**
 * POST — tanya Asisten Hermes. Respons berupa NDJSON stream (satu event JSON per baris):
 * meta (sumber) → delta… (potongan jawaban) → done | error.
 */
export async function POST(req: Request) {
  const identifier = await getMemberSession();
  if (!identifier) return NextResponse.json({ error: "Silakan login terlebih dahulu." }, { status: 401 });

  const settings = await getHelpSettings();
  if (!settings.enabled) {
    return NextResponse.json({ error: "Asisten Hermes sedang dinonaktifkan admin." }, { status: 503 });
  }

  const limited = checkRateLimit(`help-chat:${identifier}`, 6, 60_000);
  if (!limited.ok) return NextResponse.json({ error: limited.error }, { status: limited.status });

  let body: { message?: unknown; image?: unknown; history?: unknown; registrationId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Format data tidak valid." }, { status: 400 });
  }

  const question = typeof body.message === "string" ? body.message.trim().slice(0, MAX_QUESTION) : "";
  const image = typeof body.image === "string" && body.image ? body.image : null;
  if (!question && !image) return NextResponse.json({ error: "Pertanyaan tidak boleh kosong." }, { status: 400 });
  if (image && (image.length > MAX_IMAGE_CHARS || !IMAGE_RE.test(image))) {
    return NextResponse.json({ error: "Gambar tidak valid atau terlalu besar (maks ±1,5 MB)." }, { status: 400 });
  }
  const history: ChatTurn[] = Array.isArray(body.history)
    ? body.history
        .filter((t): t is ChatTurn => !!t && typeof t === "object" && typeof (t as ChatTurn).content === "string")
        .map((t) => ({ role: t.role === "assistant" ? "assistant" : "user", content: t.content }))
    : [];

  // Hanya peserta terdaftar (punya minimal satu pendaftaran) yang bisa memakai asisten.
  const registrationId = typeof body.registrationId === "string" ? body.registrationId : null;
  const reg = await prisma.registration.findFirst({
    where: {
      OR: [{ email: identifier }, { whatsapp: identifier }],
      ...(registrationId ? { id: registrationId } : {}),
    },
    select: { id: true },
  });
  if (!reg) return NextResponse.json({ error: "Fitur ini khusus peserta terdaftar." }, { status: 403 });

  const remaining = settings.dailyQuota - (await usedToday(identifier));
  if (remaining <= 0) {
    return NextResponse.json(
      { error: `Kuota harian (${settings.dailyQuota} pertanyaan) sudah habis. Coba lagi besok, ya.`, remaining: 0 },
      { status: 429 },
    );
  }

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
        closed = true;
        try {
          controller.close();
        } catch {}
      }
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
