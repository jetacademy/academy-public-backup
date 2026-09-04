import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/v1/stats/zero-human-company
 * Menampilkan data peserta ZHC: total, status breakdown, pendapatan.
 * Tidak perlu auth — data publik (jumlah peserta).
 */
export async function GET() {
  const program = await prisma.program.findUnique({
    where: { slug: "zero-human-company" },
  });

  if (!program) {
    return NextResponse.json({ error: "Program not found" }, { status: 404 });
  }

  const regs = await prisma.registration.findMany({
    where: { programId: program.id },
    select: { status: true },
  });

  const byStatus: Record<string, number> = {};
  for (const r of regs) {
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
  }

  const lunas = regs.filter((r) =>
    ["PAID", "PASSED"].includes(r.status)
  ).length;

  const earlyBirdQuota = 20;
  const earlyBirdSeatsLeft = Math.max(0, earlyBirdQuota - lunas);
  const isEarlyBirdActive = lunas < earlyBirdQuota;
  const currentPrice = isEarlyBirdActive ? 225000 : (program.price || 490000);

  return NextResponse.json({
    program: program.title,
    slug: program.slug,
    price: currentPrice,
    priceOld: isEarlyBirdActive ? 490000 : program.priceOld,
    earlyBirdQuota,
    earlyBirdSeatsLeft,
    isEarlyBirdActive,
    schedule: program.scheduleAt,
    total: regs.length,
    byStatus,
    lunas,
    belumBayar: byStatus["REGISTERED"] || 0,
    pendapatan: lunas * (program.price || 225000),
  });
}
