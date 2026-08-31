import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isValidCallback } from "@/lib/xendit";
import { sendWa, msgPaid, msgAccess, normalizeWa } from "@/lib/wa";
import { formatJadwal } from "@/lib/format";
import { sendEmail, getPaidEmailHtml, getInvoiceExpiredEmailHtml, getInvoiceFailedEmailHtml } from "@/lib/email";
import { recordAffiliateConversion, settleWithdrawalConversions, notifyWithdrawalResult } from "@/lib/affiliate";
import { sendCapiEvent, buildPurchaseEvent } from "@/lib/capi";

/**
 * POST /api/webhooks/xendit — dipanggil server Xendit untuk 2 jenis event yang beda bentuk payload:
 *  1. Invoice (pembayaran masuk) — payload flat: { id, external_id, status, paid_at }.
 *  2. Payout (pencairan komisi affiliate keluar) — payload berbungkus: { event, data: { id, reference_id, status } }.
 * Set URL ini di Dashboard Xendit → Settings → Webhooks, untuk kategori Invoices DAN Payouts:
 *   https://domainkamu.com/api/webhooks/xendit
 */
export async function POST(req: Request) {
  // verifikasi bahwa request benar-benar dari Xendit
  if (!isValidCallback(req.headers.get("x-callback-token"))) {
    return NextResponse.json({ error: "Token tidak valid." }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Payload tidak valid." }, { status: 400 });
  }

  // ── Payout callback (pencairan komisi affiliate) ─────────────────────
  const maybePayout = raw as { event?: string; data?: { id?: string; reference_id?: string; status?: string; failure_code?: string } };
  if (typeof maybePayout.event === "string" && maybePayout.event.startsWith("payout.")) {
    try {
      const data = maybePayout.data ?? {};
      const referenceId = data.reference_id; // kita isi dengan AffiliateWithdrawal.id saat createPayout
      if (!referenceId) return NextResponse.json({ error: "reference_id tidak ditemukan." }, { status: 400 });

      const withdrawal = await prisma.affiliateWithdrawal.findFirst({
        where: { OR: [{ id: referenceId }, { xenditPayoutId: data.id ?? "" }] },
      });
      if (!withdrawal) return NextResponse.json({ error: "Penarikan tidak ditemukan." }, { status: 404 });
      if (withdrawal.status !== "PROCESSING") {
        return NextResponse.json({ ok: true }); // sudah final / idempoten, tidak ada yang perlu diubah
      }

      if (data.status === "SUCCEEDED") {
        await prisma.affiliateWithdrawal.update({ where: { id: withdrawal.id }, data: { status: "COMPLETED", processedAt: new Date() } });
        await settleWithdrawalConversions(withdrawal.affiliateId, withdrawal.amount);
        await notifyWithdrawalResult(withdrawal.id, "completed");
      } else if (data.status === "FAILED") {
        await prisma.affiliateWithdrawal.update({
          where: { id: withdrawal.id },
          data: { status: "FAILED", failureReason: data.failure_code ?? "Payout gagal diproses Xendit." },
        });
        await notifyWithdrawalResult(withdrawal.id, "rejected", data.failure_code ?? "Payout gagal diproses Xendit.");
      }
      return NextResponse.json({ ok: true });
    } catch (err) {
      console.error("[webhook xendit payout]", err);
      return NextResponse.json({ error: "Gagal memproses webhook payout." }, { status: 500 });
    }
  }

  // ── Invoice callback (pembayaran masuk) ──────────────────────────────
  const event = raw as { id?: string; external_id?: string; status?: string; paid_at?: string };
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

  try {
    if (!event.external_id) {
      return NextResponse.json({ error: "external_id tidak ditemukan." }, { status: 400 });
    }
    // external_id kita isi dengan registrationId saat membuat invoice
    const INVOICE_PREFIX = "ACADEMY-";
    const registrationId = event.external_id.startsWith(INVOICE_PREFIX)
      ? event.external_id.slice(INVOICE_PREFIX.length)
      : event.external_id;

    const payment = await prisma.payment.findFirst({
      where: {
        OR: [
          { xenditInvoiceId: event.id ?? "" },
          { registrationId },
        ],
      },
      include: { registration: { include: { program: true, batch: true } } },
    });
    if (!payment) return NextResponse.json({ error: "Pembayaran tidak ditemukan." }, { status: 404 });

    // Pastikan webhook ini untuk invoice yang masih aktif — tolak stale callback
    const isCurrentInvoice = !event.id || payment.xenditInvoiceId === event.id;

    if (event.status === "PAID" && isCurrentInvoice) {
      // Gerbang idempoten atomik: hanya webhook yang berhasil mentransisi status
      // non-PAID → PAID yang boleh mengirim notifikasi/CAPI — mencegah dobel kirim
      // saat dua callback PAID hampir bersimultan.
      const claimed = await prisma.payment.updateMany({
        where: { id: payment.id, status: { not: "PAID" } },
        data: { status: "PAID", paidAt: event.paid_at ? new Date(event.paid_at) : new Date() },
      });
      if (claimed.count > 0) {
        await prisma.registration.update({
          where: { id: payment.registrationId },
          data: { status: "PAID" },
        });

        await recordAffiliateConversion(payment.id);

        // Kirim Purchase event ke Meta Conversions API (server-side)
        const reg = payment.registration;
        sendCapiEvent(buildPurchaseEvent(
          reg.email,
          reg.whatsapp,
          payment.amount,
          reg.program.title,
          payment.id,
        )).catch((err) => console.error("[CAPI] Gagal kirim event:", err));

        const memberUrl = `${baseUrl}/member`;
        const scheduleStr = reg.batch ? formatJadwal(reg.batch.scheduleAt) : formatJadwal(reg.program.scheduleAt);
        const zoomLinkVal = reg.batch ? (reg.batch.zoomLink || null) : reg.program.zoomLink;
        const waGroupLinkVal = reg.batch ? (reg.batch.waGroupLink || null) : reg.program.waGroupLink;
        const lmsLinkVal = reg.batch ? (reg.batch.recordingLink || null) : reg.program.lmsLink;

        if (reg.program.price > 0) {
          // program berbayar → kirim semua akses (grup, LMS, Zoom) + link post-test
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
          // webinar gratis → yang dibayar adalah paket sertifikat, kirim link post-test
          await sendWa(reg.whatsapp, msgPaid(reg.name, reg.program.title, memberUrl));
        }

        // Kirim email pembayaran sukses — best-effort
        await sendEmail({
          to: reg.email,
          subject: `Pembayaran Berhasil: Akses Pelatihan ${reg.program.title}`,
          html: getPaidEmailHtml(reg.name, reg.program.title, memberUrl, zoomLinkVal, waGroupLinkVal, lmsLinkVal),
        }).catch((err) => console.error("Gagal mengirim email webhook lunas:", err));

        // Buat akun & registrasi lunas untuk setiap peserta tambahan
        if (reg.participants) {
          try {
            const rawP = reg.participants;
            const participantsList: Array<{ name: string; email?: string; whatsapp?: string }> = Array.isArray(rawP)
              ? rawP.map((item: unknown) => {
                  if (typeof item === "string") return { name: item };
                  if (item && typeof item === "object") {
                    const obj = item as Record<string, unknown>;
                    return {
                      name: String(obj.name ?? ""),
                      email: obj.email ? String(obj.email) : undefined,
                      whatsapp: obj.whatsapp ? String(obj.whatsapp) : undefined,
                    };
                  }
                  return { name: "" };
                })
              : [];

            for (const p of participantsList) {
              if (!p.email || !p.whatsapp || p.name.length < 3) continue;
              const pWa = normalizeWa(p.whatsapp);
              const pEmail = p.email.toLowerCase().trim();

              let pUser = await prisma.user.findFirst({
                where: { OR: [{ email: pEmail }, { whatsapp: pWa }] },
              });
              if (!pUser) {
                pUser = await prisma.user.create({
                  data: { name: p.name, email: pEmail, whatsapp: pWa, role: "STUDENT" },
                });
              }

              await prisma.registration.upsert({
                where: { whatsapp_programId: { whatsapp: pWa, programId: reg.programId } },
                create: {
                  name: p.name,
                  whatsapp: pWa,
                  email: pEmail,
                  institution: reg.institution,
                  programId: reg.programId,
                  userId: pUser.id,
                  batchId: reg.batchId,
                  status: "PAID",
                },
                update: {
                  name: p.name,
                  email: pEmail,
                  institution: reg.institution,
                  userId: pUser.id,
                  status: "PAID",
                  ...(reg.batchId ? { batchId: reg.batchId } : {}),
                },
              });

              if (reg.program.price > 0) {
                await sendWa(pWa, msgAccess({
                  name: p.name,
                  programTitle: reg.program.title,
                  schedule: scheduleStr,
                  zoomLink: zoomLinkVal,
                  waGroupLink: waGroupLinkVal,
                  lmsLink: lmsLinkVal,
                  memberUrl,
                })).catch((err) => console.error("Gagal mengirim WA peserta tambahan webhook:", err));
              } else {
                await sendWa(pWa, msgPaid(p.name, reg.program.title, memberUrl)).catch((err) => console.error("Gagal mengirim WA peserta tambahan webhook:", err));
              }

              await sendEmail({
                to: pEmail,
                subject: `Pembayaran Berhasil: Akses Pelatihan ${reg.program.title}`,
                html: getPaidEmailHtml(p.name, reg.program.title, memberUrl, zoomLinkVal, waGroupLinkVal, lmsLinkVal),
              }).catch((err) => console.error("Gagal mengirim email peserta tambahan webhook:", err));
            }
          } catch (err) {
            console.error("Gagal memproses peserta tambahan di webhook Xendit:", err);
          }
        }
      }
    } else if (event.status === "EXPIRED" && payment.status !== "PAID" && isCurrentInvoice) {
      await prisma.$transaction([
        prisma.payment.update({ where: { id: payment.id }, data: { status: "EXPIRED" } }),
        prisma.registration.update({ where: { id: payment.registrationId }, data: { status: "EXPIRED" } }),
      ]);
      // Notifikasi email invoice kedaluwarsa — best-effort
      const reg = payment.registration;
      await sendEmail({
        to: reg.email,
        subject: `Invoice Kedaluwarsa: ${reg.program.title}`,
        html: getInvoiceExpiredEmailHtml({
          name: reg.name,
          programTitle: reg.program.title,
          registerUrl: `${baseUrl}/program/${reg.program.slug}`,
        }),
      }).catch((err) => console.error("[webhook] Gagal kirim email EXPIRED:", err));
    } else if (event.status === "FAILED" && payment.status !== "PAID" && isCurrentInvoice) {
      await prisma.$transaction([
        prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } }),
        prisma.registration.update({ where: { id: payment.registrationId }, data: { status: "FAILED" } }),
      ]);
      // Notifikasi email pembayaran gagal — best-effort
      const regFailed = payment.registration;
      await sendEmail({
        to: regFailed.email,
        subject: `Pembayaran Gagal: ${regFailed.program.title}`,
        html: getInvoiceFailedEmailHtml({
          name: regFailed.name,
          programTitle: regFailed.program.title,
          registerUrl: `${baseUrl}/program/${regFailed.program.slug}`,
        }),
      }).catch((err) => console.error("[webhook] Gagal kirim email FAILED:", err));
    } else {
      console.warn("[webhook] Status tidak dikenal / stale callback:", event.status);
      return NextResponse.json({ error: `Status tidak dikenal: ${event.status}` }, { status: 202 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[webhook xendit]", err);
    return NextResponse.json({ error: "Gagal memproses webhook." }, { status: 500 });
  }
}
