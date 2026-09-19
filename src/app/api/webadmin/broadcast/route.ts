import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendWaDetailed } from "@/lib/wa";
import { saveBroadcastReport, BroadcastFailure } from "@/lib/broadcast-store";

export type BroadcastMessageType = "zoom" | "grup" | "custom";
export type BroadcastResult = {
  sent: number;
  failed: number;
  total: number;
  reportId?: string;
  failures?: BroadcastFailure[];
};

export async function POST(req: Request) {
  // Auth via internal secret header (dikirim dari server action)
  const secret = req.headers.get("x-internal-secret");
  const key = process.env.JETSCHOOL_API_KEY || "internal";
  if (secret !== key) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json() as { programId?: string; batchId?: string; messageType?: string; customMessage?: string; includeRegistered?: boolean; onlyNew?: boolean; lastSentAt?: string };
    const { programId, batchId, messageType, customMessage, includeRegistered, onlyNew, lastSentAt } = body;

    if (!messageType) {
      return NextResponse.json({ error: "Tipe pesan wajib diisi." }, { status: 400 });
    }
    if (!programId && !batchId) {
      return NextResponse.json({ error: "Pilih target program atau batch." }, { status: 400 });
    }
    if (messageType === "custom" && !customMessage?.trim()) {
      return NextResponse.json({ error: "Pesan custom wajib diisi." }, { status: 400 });
    }

    // ── Build where clause ──────────────────────────────────────
    const statusFilter = includeRegistered ? ["PAID", "PASSED", "REGISTERED"] : ["PAID", "PASSED"];
    const where: Record<string, unknown> = {
      status: { in: statusFilter },
    };
    if (batchId) {
      where.batchId = batchId;
    } else if (programId) {
      where.programId = programId;
    }
    // Filter hanya pendaftar baru sejak broadcast terakhir
    if (onlyNew && lastSentAt) {
      where.createdAt = { gt: new Date(lastSentAt) };
    }

    // ── Fetch recipients ────────────────────────────────────────
    const registrations = await prisma.registration.findMany({
      where,
      select: {
        id: true,
        name: true,
        whatsapp: true,
        programId: true,
        batchId: true,
        program: { select: { title: true, zoomLink: true, waGroupLink: true } },
        batch: { select: { scheduleAt: true } },
      },
    });

    if (registrations.length === 0) {
      return NextResponse.json({ error: "Tidak ada penerima yang cocok dengan filter yang dipilih." }, { status: 400 });
    }

    // ── Build message (dukung zoomLink/waGroupLink per batch jika ada) ────────
    let targetTitle = "";
    let targetZoomLink: string | null = null;
    let targetWaGroupLink: string | null = null;

    if (batchId) {
      const batch = await prisma.programBatch.findUnique({
        where: { id: batchId },
        include: { program: { select: { id: true, title: true, zoomLink: true, waGroupLink: true } } },
      });
      if (batch) {
        targetTitle = `${batch.program.title} (${batch.name || "Batch"})`;
        targetZoomLink = batch.zoomLink || batch.program.zoomLink;
        targetWaGroupLink = batch.waGroupLink || batch.program.waGroupLink;
      }
    } else if (programId) {
      const program = await prisma.program.findUnique({
        where: { id: programId },
        select: { title: true, zoomLink: true, waGroupLink: true },
      });
      if (program) {
        targetTitle = program.title;
        targetZoomLink = program.zoomLink;
        targetWaGroupLink = program.waGroupLink;
      }
    }

    let messageText = "";
    if (messageType === "zoom") {
      if (!targetZoomLink) {
        return NextResponse.json({ error: "Target ini belum memiliki link Zoom." }, { status: 400 });
      }
      messageText = `Halo {{name}},\n\nBerikut link Zoom untuk program "${targetTitle}":\n${targetZoomLink}\n\nJangan lupa catat jadwalnya ya. Sampai jumpa! 😊`;
    } else if (messageType === "grup") {
      if (!targetWaGroupLink) {
        return NextResponse.json({ error: "Target ini belum memiliki link grup WhatsApp." }, { status: 400 });
      }
      messageText = `Halo {{name}},\n\nBergabunglah dengan grup WhatsApp peserta program "${targetTitle}":\n${targetWaGroupLink}\n\nDiskusikan materi dan dapatkan info terbaru di grup ya! 😊`;
    } else if (messageType === "custom") {
      messageText = customMessage?.trim() ?? "";
    }

    if (!messageText) {
      return NextResponse.json({ error: "Pesan tidak boleh kosong." }, { status: 400 });
    }

    // ── Send broadcast sekuensial dengan pacing aman & error reporting ──
    let sent = 0;
    let failed = 0;
    const failures: BroadcastFailure[] = [];

    for (let i = 0; i < registrations.length; i++) {
      const reg = registrations[i];
      const name = (reg.name || "").trim();
      const rawWa = (reg.whatsapp || "").trim();

      if (!rawWa) {
        failed++;
        failures.push({
          id: reg.id,
          name: name || "(Tanpa Nama)",
          whatsapp: "-",
          reason: "Nomor WhatsApp kosong di database",
        });
        continue;
      }

      const personalizedText = messageText.replace(/\{\{name\}\}/g, name);
      let sendRes = await sendWaDetailed(rawWa, personalizedText);

      // Retry 1x jika server WhatsApp sibuk (429) atau koneksi timeout
      if (!sendRes.ok && (sendRes.statusCode === 429 || sendRes.error?.includes("sibuk") || sendRes.error?.includes("jaringan"))) {
        await new Promise((r) => setTimeout(r, 1500));
        sendRes = await sendWaDetailed(rawWa, personalizedText);
      }

      if (sendRes.ok) {
        sent++;
      } else {
        failed++;
        failures.push({
          id: reg.id,
          name: name || "(Tanpa Nama)",
          whatsapp: rawWa,
          reason: sendRes.error || "Gagal terkirim",
        });
      }

      // Jeda pacing 600ms antar pengiriman agar socket WhatsApp stabil
      if (i < registrations.length - 1) {
        await new Promise((r) => setTimeout(r, 600));
      }
    }

    // Simpan laporan ke broadcast store
    const report = saveBroadcastReport({
      target: targetTitle || "Target Broadcast",
      targetId: batchId || programId,
      messageType,
      total: registrations.length,
      sent,
      failed,
      failures,
    });

    const result: BroadcastResult = {
      sent,
      failed,
      total: registrations.length,
      reportId: report.id,
      failures,
    };
    console.log(`[broadcast] admin — ${messageType} → ${registrations.length} penerima (${sent} terkirim, ${failed} gagal)`);

    return NextResponse.json(result);
  } catch (err) {
    console.error("[broadcast] error:", err);
    return NextResponse.json({ error: "Gagal mengirim broadcast." }, { status: 500 });
  }
}
