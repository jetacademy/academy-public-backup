import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMemberSession } from "@/lib/member-auth";

/**
 * POST — 👍/👎 atas satu jawaban. 👎 langsung membuang jawaban itu dari cache supaya
 * peserta berikutnya dengan pertanyaan sama mendapat jawaban baru, bukan jawaban yang sama-sama salah.
 */
export async function POST(req: Request) {
  const identifier = await getMemberSession();
  if (!identifier) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { logId?: unknown; value?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Format data tidak valid." }, { status: 400 });
  }
  const value = body.value === 1 ? 1 : body.value === -1 ? -1 : null;
  if (typeof body.logId !== "string" || value === null) {
    return NextResponse.json({ error: "Data tidak valid." }, { status: 400 });
  }

  const log = await prisma.helpChatLog.findUnique({ where: { id: body.logId }, select: { identifier: true, cacheKey: true } });
  if (!log || log.identifier !== identifier) return NextResponse.json({ error: "Tidak ditemukan." }, { status: 404 });

  await prisma.helpChatLog.update({ where: { id: body.logId }, data: { feedback: value } });
  if (value === -1 && log.cacheKey) {
    await prisma.helpChatCache.deleteMany({ where: { key: log.cacheKey } });
  }
  return NextResponse.json({ ok: true });
}
