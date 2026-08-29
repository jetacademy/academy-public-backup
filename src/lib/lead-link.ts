import { prisma } from "@/lib/prisma";

/**
 * Tautkan sebuah pendaftaran (Registration) ke Lead yang cocok, dan tutup
 * pipeline lead.
 *
 * Strategi pencocokan (owner 29 Agu 2026):
 * 1. Lead yang punya `registrationId` = sama → sudah tertaut, hanya update hasil/status.
 * 2. Cari lead aktif (hasil=ACTIVE) dengan WHATSAPP yang sama DAN program yang sama.
 * 3. Fallback: lead aktif dengan whatsapp yang sama (program boleh beda).
 *
 * Dipanggil saat registrasi dibuat (mengarah hasil=REGISTERED) dan saat bayar
 * (hasil=PAID). Kalau tidak ada lead cocok → no-op (aman).
 */
export async function linkLeadToRegistration(
  registrationId: string,
  whatsapp: string,
  programId: string,
  paid: boolean,
): Promise<void> {
  try {
    const wa = whatsapp.replace(/[^0-9]/g, "");
    if (!wa) return;

    // 1) Sudah tertaut langsung
    const existing = await prisma.lead.findUnique({ where: { registrationId } });
    let lead = existing;

    // 2) Cari by whatsapp + program (aktif saja)
    if (!lead) {
      lead = await prisma.lead.findFirst({
        where: {
          whatsapp: { contains: wa || wa.slice(-10) },
          programId,
          hasil: "ACTIVE",
        },
        orderBy: { createdAt: "desc" },
      });
    }

    // 3) Fallback by whatsapp saja
    if (!lead) {
      lead = await prisma.lead.findFirst({
        where: { whatsapp: { contains: wa || wa.slice(-10) }, hasil: "ACTIVE" },
        orderBy: { createdAt: "desc" },
      });
    }

    if (!lead) return;

    const now = new Date();
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        registrationId,
        hasil: paid ? "PAID" : "REGISTERED",
        nextFollowUpAt: null,
        closedAt: now,
      },
    });
  } catch (err) {
    // Jangan pernah menggagalkan alur registrasi karena link lead gagal.
    console.error("[lead-link] Gagal menautkan lead:", err);
  }
}