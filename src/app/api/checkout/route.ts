import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createInvoice, isXenditConfigured } from "@/lib/xendit";
import { normalizeWa } from "@/lib/wa";
import { checkRateLimit } from "@/lib/rate-limit";
import { validateVoucher, consumeVoucher } from "@/lib/voucher";
import { linkLeadToRegistration } from "@/lib/lead-link";
import { resolveAffiliateForCheckout, applyAffiliateDiscount, recordAffiliateConversion, getAffiliateRefCookie } from "@/lib/affiliate";

/**
 * POST /api/checkout — buat invoice Xendit untuk paket sertifikat.
 * Peserta diidentifikasi lewat nomor WA yang dipakai saat daftar webinar.
 */
export async function POST(req: Request) {
  // Rate limit: maks 20 checkout per IP per 60 detik
  const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "anonymous";
  const limit = checkRateLimit(`checkout:${ip}`, 20, 60_000);
  if (!limit.ok) {
    return NextResponse.json({ error: limit.error }, { status: limit.status });
  }

  let body: { whatsapp?: string; programSlug?: string; voucherCode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Format data tidak valid." }, { status: 400 });
  }

  const whatsappRaw = (body.whatsapp ?? "").trim();
  const whatsapp = normalizeWa(whatsappRaw);
  if (!/^628[0-9]{8,13}$/.test(whatsapp)) {
    return NextResponse.json({ error: "Nomor WhatsApp tidak valid (contoh: 081234567890)." }, { status: 400 });
  }
  const programSlug = (body.programSlug ?? "").trim();
  const voucherCode = (body.voucherCode ?? "").trim();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

  try {
    const program = await prisma.program.findUnique({ where: { slug: programSlug } });
    if (!program) return NextResponse.json({ error: "Program tidak ditemukan." }, { status: 404 });

    const now = new Date();
    if (now < new Date(program.scheduleAt)) {
      const formattedDate = new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Jakarta"
      }).format(program.scheduleAt);
      return NextResponse.json(
        { error: `Klaim sertifikat belum dibuka. Program ini baru dimulai pada tanggal ${formattedDate} WIB.` },
        { status: 400 }
      );
    }

    const reg = await prisma.registration.findUnique({
      where: { whatsapp_programId: { whatsapp, programId: program.id } },
      include: { payment: true, certificate: true },
    });
    if (!reg) {
      return NextResponse.json(
        { error: "Nomor WA ini belum terdaftar di program tersebut. Pakai nomor yang sama dengan saat daftar webinar ya." },
        { status: 404 }
      );
    }

    // sudah lulus → langsung ke sertifikat
    if (reg.certificate) {
      return NextResponse.json({ ok: true, postTestUrl: `${baseUrl}/sertifikat/${reg.certificate.number}` });
    }
    // sudah bayar → langsung ke post-test
    if (reg.status === "PAID") {
      return NextResponse.json({ ok: true, postTestUrl: `${baseUrl}/member` });
    }

    // invoice pending yang masih ada → pakai ulang
    if (reg.payment?.status === "PENDING" && reg.payment.invoiceUrl) {
      return NextResponse.json({ ok: true, invoiceUrl: reg.payment.invoiceUrl });
    }

    // ── Affiliate (kode manual ATAU cookie dari link ?ref=) — diprioritaskan di atas voucher ──
    const refCookie = await getAffiliateRefCookie();
    const affiliate = await resolveAffiliateForCheckout(voucherCode, refCookie);

    // ── Voucher/diskon (opsional) — dilewati jika sudah dapat diskon dari affiliate ──────────
    const voucherResult = !affiliate && voucherCode
      ? await validateVoucher(voucherCode, program.certPrice)
      : null;
    if (voucherResult && "error" in voucherResult) {
      return NextResponse.json({ error: voucherResult.error }, { status: 400 });
    }
    const affiliateResult = affiliate ? applyAffiliateDiscount(affiliate, program.certPrice) : null;
    const discountAmount = affiliateResult ? affiliateResult.discountAmount : voucherResult ? voucherResult.discountAmount : 0;
    const voucherId = voucherResult ? voucherResult.voucher.id : null;
    const affiliateId = affiliateResult ? affiliateResult.affiliate.id : null;
    const originalAmount = affiliateResult || voucherResult ? program.certPrice : null;
    const chargeAmount = affiliateResult ? affiliateResult.finalAmount : voucherResult ? voucherResult.finalAmount : program.certPrice;

    // MODE DEV tanpa Xendit, ATAU diskon menutup seluruh harga → langsung tandai lunas
    if (!isXenditConfigured()) {
      console.warn("[checkout] XENDIT_SECRET_KEY kosong — MODE DEV: pembayaran dianggap lunas.");
      if (process.env.NODE_ENV === "production" && process.env.XENDIT_DEV_BYPASS !== "true") {
        return NextResponse.json({ error: "Pembayaran belum dikonfigurasi. Hubungi admin." }, { status: 503 });
      }
    }
    if (!isXenditConfigured() || chargeAmount === 0) {
      // Guard kuota voucher atomik — gagalkan jika kuota habis (anti double-spend)
      if (voucherId && !(await consumeVoucher(voucherId, voucherResult!.voucher.maxUses))) {
        return NextResponse.json({ error: "Kuota pemakaian voucher ini sudah habis." }, { status: 400 });
      }
      const [payment] = await prisma.$transaction([
        prisma.payment.upsert({
          where: { registrationId: reg.id },
          create: { registrationId: reg.id, amount: chargeAmount, originalAmount, discountAmount, voucherId, affiliateId, status: "PAID", paidAt: new Date() },
          update: { amount: chargeAmount, originalAmount, discountAmount, voucherId, affiliateId, status: "PAID", paidAt: new Date() },
        }),
        prisma.registration.update({ where: { id: reg.id }, data: { status: "PAID" } }),
      ]);
      if (affiliateId) await recordAffiliateConversion(payment.id);
      await linkLeadToRegistration(reg.id, reg.whatsapp, reg.programId, true);
      return NextResponse.json({ ok: true, postTestUrl: `${baseUrl}/member` });
    }

    const invoice = await createInvoice({
      externalId: `ACADEMY-${reg.id}`,
      amount: chargeAmount,
      payerEmail: reg.email,
      description: affiliateResult
        ? `Paket Sertifikat — ${program.title} (${reg.name}) (Affiliate: ${affiliateResult.affiliate.code})`
        : voucherResult
        ? `Paket Sertifikat — ${program.title} (${reg.name}) (Voucher: ${voucherResult.voucher.code})`
        : `Paket Sertifikat — ${program.title} (${reg.name})`,
      successRedirectUrl: `${baseUrl}/member`,
    });

    // Guard kuota voucher atomik — gagalkan sebelum buat invoice jika kuota habis (anti double-spend)
    if (voucherId && !(await consumeVoucher(voucherId, voucherResult!.voucher.maxUses))) {
      return NextResponse.json({ error: "Kuota pemakaian voucher ini sudah habis." }, { status: 400 });
    }

    await prisma.$transaction([
      prisma.payment.upsert({
        where: { registrationId: reg.id },
        create: {
          registrationId: reg.id,
          amount: chargeAmount,
          originalAmount,
          discountAmount,
          voucherId,
          affiliateId,
          xenditInvoiceId: invoice.id,
          invoiceUrl: invoice.invoice_url,
        },
        update: { amount: chargeAmount, originalAmount, discountAmount, voucherId, affiliateId, xenditInvoiceId: invoice.id, invoiceUrl: invoice.invoice_url, status: "PENDING" },
      }),
    ]);

    return NextResponse.json({ ok: true, invoiceUrl: invoice.invoice_url });
  } catch (err) {
    console.error("[checkout]", err);
    return NextResponse.json({ error: "Gagal menyiapkan pembayaran. Coba lagi atau hubungi admin." }, { status: 500 });
  }
}
