import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendWa, msgWelcome, msgAccess, normalizeWa } from "@/lib/wa";
import { createInvoice, isXenditConfigured } from "@/lib/xendit";
import { formatJadwal } from "@/lib/format";
import { sendEmail, getWelcomeEmailHtml, getPaidEmailHtml, getInvoiceEmailHtml } from "@/lib/email";
import { checkRateLimit } from "@/lib/rate-limit";
import { createMemberSession } from "@/lib/member-auth";
import { linkLeadToRegistration } from "@/lib/lead-link";
import { validateVoucher, consumeVoucher } from "@/lib/voucher";
import { resolveAffiliateForCheckout, applyAffiliateDiscount, recordAffiliateConversion, getAffiliateRefCookie } from "@/lib/affiliate";

/**
 * POST /api/register — satu pintu untuk semua tipe program.
 * Dukungan multi-pendaftar (1 group WA/email, banyak peserta via participants[]).
 *
 * - Program GRATIS (webinar): simpan pendaftar → WA sambutan (Zoom + grup).
 * - Program BERBAYAR (kelas/workshop/bootcamp): simpan pendaftar →
 *   buat invoice Xendit → client diarahkan ke halaman pembayaran.
 *   Akses (grup/LMS/Zoom) dikirim via WA oleh webhook setelah lunas.
 */
export async function POST(req: Request) {
  // Rate limit: maks 10 registrasi per IP per 60 detik
  const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "anonymous";
  const limit = checkRateLimit(`register:${ip}`, 10, 60_000);
  if (!limit.ok) {
    return NextResponse.json({ error: limit.error }, { status: limit.status });
  }

  let body: {
    name?: string;
    whatsapp?: string;
    email?: string;
    programSlug?: string;
    institution?: string;
    batchId?: string;
    credential?: string;
    participants?: string[];
    voucherCode?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Format data tidak valid." }, { status: 400 });
  }

  const name = (body.name ?? "").trim().slice(0, 100);
  const whatsappRaw = (body.whatsapp ?? "").trim();
  const whatsapp = normalizeWa(whatsappRaw);
  const email = (body.email ?? "").trim().toLowerCase();
  const programSlug = (body.programSlug ?? "").trim();
  const institution = (body.institution ?? "").trim().slice(0, 100).replace(/<[^>]*>/g, "");
  if (institution && institution.length < 3) {
    return NextResponse.json({ error: "Lembaga/Instansi minimal 3 karakter" }, { status: 400 });
  }
  const batchIdInput = (body.batchId ?? "").trim();
  const credential = (body.credential ?? "").trim();
  const voucherCode = (body.voucherCode ?? "").trim();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

  if (name.length < 3) return NextResponse.json({ error: "Nama minimal 3 huruf." }, { status: 400 });
  if (!/^628[0-9]{8,13}$/.test(whatsapp)) return NextResponse.json({ error: "Nomor WhatsApp tidak valid (contoh: 081234567890)." }, { status: 400 });
  if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "Email tidak valid." }, { status: 400 });

  // ── Multi-pendaftar: parse & validasi peserta tambahan ──────────
  const rawParticipants = Array.isArray(body.participants) ? body.participants : [];
  const participants: string[] = [];
  for (const p of rawParticipants) {
    const trimmed = (typeof p === "string" ? p : "").trim().slice(0, 100);
    if (trimmed.length < 3) {
      return NextResponse.json({
        error: "Nama peserta tidak valid. Setiap nama minimal 3 huruf.",
      }, { status: 400 });
    }
    // Cegah duplikasi nama dalam satu group
    if (participants.includes(trimmed)) {
      return NextResponse.json({
        error: `Nama "${trimmed}" sudah dipakai untuk peserta lain. Setiap peserta harus punya nama berbeda.`,
      }, { status: 400 });
    }
    participants.push(trimmed);
  }
  // Cek nama utama jangan sama dengan peserta tambahan
  if (participants.includes(name)) {
    return NextResponse.json({
      error: `Nama "${name}" sudah digunakan.`,
    }, { status: 400 });
  }
  const participantCount = 1 + participants.length; // pendaftar utama + tambahan
  if (participantCount > 10) {
    return NextResponse.json({ error: "Maksimal 10 peserta dalam satu pendaftaran." }, { status: 400 });
  }

  // ── [FIX C1] Verifikasi Google credential jika dikirim ──────────
  if (credential) {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      return NextResponse.json({ error: "Login Google belum dikonfigurasi." }, { status: 503 });
    }
    try {
      const res = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        return NextResponse.json({ error: "Token Google tidak valid." }, { status: 401 });
      }
      const payload = (await res.json()) as {
        aud?: string;
        email?: string;
        email_verified?: string;
        error_description?: string;
      };
      if (payload.error_description) {
        return NextResponse.json({ error: "Sesi Google sudah kedaluwarsa." }, { status: 401 });
      }
      if (payload.aud !== clientId) {
        return NextResponse.json({ error: "Token tidak cocok dengan aplikasi ini." }, { status: 401 });
      }
      if (!payload.email || payload.email.toLowerCase() !== email) {
        return NextResponse.json({ error: "Email tidak cocok dengan akun Google." }, { status: 400 });
      }
      if (payload.email_verified !== "true") {
        return NextResponse.json({ error: "Email Google belum diverifikasi." }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: "Gagal memverifikasi token Google. Coba lagi." }, { status: 503 });
    }
  }

  try {
    const program = await prisma.program.findUnique({ where: { slug: programSlug } });
    if (!program || !program.isActive) {
      // [FIX M2] Hapus petunjuk internal dari pesan error
      return NextResponse.json({ error: "Program tidak ditemukan atau tidak aktif." }, { status: 404 });
    }

    // batchId opsional — kalau dikirim, pastikan benar-benar milik program ini (bukan program lain)
    let batchId: string | null = null;
    if (batchIdInput) {
      const batch = await prisma.programBatch.findFirst({ where: { id: batchIdInput, programId: program.id, isActive: true } });
      if (!batch) return NextResponse.json({ error: "Jadwal batch tidak valid. Silakan pilih ulang." }, { status: 400 });

      // [FIX] Tolak batch yang jadwalnya sudah lewat
      if (new Date(batch.scheduleAt) <= new Date()) {
        return NextResponse.json({ error: "Jadwal batch yang dipilih sudah lewat. Silakan pilih jadwal berikutnya." }, { status: 400 });
      }

      // [FIX C5] Kursus tidak ada batas kursi — seatsLeft diabaikan
      batchId = batch.id;
    }

    // ── [FIX 5 Agu 2026] Cek jadwal masih aktif — tolak pendaftaran kalau semua sudah lewat ──
    // Kalau user tidak pilih batch: pastikan ada jadwal (program.scheduleAt atau batch aktif) yang masih di masa depan.
    if (!batchId) {
      const programScheduleFuture = program.scheduleAt && new Date(program.scheduleAt) > new Date();
      const upcomingBatch = await prisma.programBatch.findFirst({
        where: { programId: program.id, isActive: true, scheduleAt: { gt: new Date() } },
        orderBy: { scheduleAt: "asc" },
        select: { id: true },
      });
      if (!programScheduleFuture && !upcomingBatch) {
        return NextResponse.json(
          { error: "Pendaftaran untuk program ini sudah ditutup karena jadwal telah lewat." },
          { status: 400 }
        );
      }
    }

    // ── HARGA TETAP: zero-human-company ──────────────────────
    let unitPrice = program.price;
    if (program.slug === "zero-human-company") {
      unitPrice = 225000;
    }

    // Total harga = harga per peserta × jumlah peserta
    const totalPrice = unitPrice * participantCount;

    // ── Affiliate (kode manual ATAU cookie dari link ?ref=) — diprioritaskan di atas voucher ──
    const refCookie = await getAffiliateRefCookie();
    const affiliate = totalPrice > 0 ? await resolveAffiliateForCheckout(voucherCode, refCookie) : null;

    // ── Voucher/diskon (opsional) — dilewati jika sudah dapat diskon dari affiliate ──────────
    const voucherResult = !affiliate && voucherCode && totalPrice > 0
      ? await validateVoucher(voucherCode, totalPrice)
      : null;
    if (voucherResult && "error" in voucherResult) {
      return NextResponse.json({ error: voucherResult.error }, { status: 400 });
    }
    const affiliateResult = affiliate ? applyAffiliateDiscount(affiliate, totalPrice) : null;
    const discountAmount = affiliateResult ? affiliateResult.discountAmount : voucherResult ? voucherResult.discountAmount : 0;
    const voucherId = voucherResult ? voucherResult.voucher.id : null;
    const affiliateId = affiliateResult ? affiliateResult.affiliate.id : null;
    const originalAmount = affiliateResult || voucherResult ? totalPrice : null;
    const chargeAmount = affiliateResult ? affiliateResult.finalAmount : voucherResult ? voucherResult.finalAmount : totalPrice;

    // ── [FIX C2] Validasi duplikasi yang lebih ketat ──
    // Cari registrasi existing dengan kombinasi whatsapp ATAU email
    const existingReg = await prisma.registration.findFirst({
      where: {
        programId: program.id,
        OR: [{ whatsapp }, { email }],
      },
      include: { payment: true },
    });

    if (existingReg) {
      // Kasus 1: WA sama tapi email berbeda → tolak (cegah timpa email)
      if (existingReg.whatsapp === whatsapp && existingReg.email !== email) {
        return NextResponse.json({
          error: "Nomor WhatsApp ini sudah terdaftar dengan email berbeda. Gunakan email yang sama saat pendaftaran awal.",
        }, { status: 400 });
      }

      // Kasus 2: Email sama tapi WA berbeda → tolak (cegah false positive antar user beda)
      if (existingReg.email === email && existingReg.whatsapp !== whatsapp) {
        return NextResponse.json({
          error: "Email ini sudah terdaftar untuk program ini dengan nomor WhatsApp berbeda.",
        }, { status: 400 });
      }

      // Kasus 3: WA+Email sama persis → cek apakah masih boleh daftar ulang
      const isPaidOrFree = program.price === 0 || existingReg.status === "PAID" || existingReg.status === "PASSED" || existingReg.payment?.status === "PAID";
      if (isPaidOrFree) {
        const message = program.price === 0
          ? `Nomor WhatsApp ini sudah terdaftar untuk program ini. Silakan cek WhatsApp/Email Anda.`
          : `Nomor WhatsApp ini sudah terdaftar dan lunas untuk program ini. Silakan masuk ke menu Member.`;
        return NextResponse.json({ error: message }, { status: 400 });
      }
    }

    // 1. Cari atau buat User record untuk menyelaraskan login member
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { whatsapp }
        ]
      }
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          name,
          email,
          whatsapp,
          role: "STUDENT"
        }
      });
    }

    // idempoten: daftar dua kali dengan nomor sama = tetap sukses (update data terbaru)
    // Data multi-pendaftar disimpan di field participants (Json array of strings)
    const reg = await prisma.registration.upsert({
      where: { whatsapp_programId: { whatsapp, programId: program.id } },
      create: {
        name, whatsapp, email, institution,
        programId: program.id, userId: user.id, batchId,
        participants: participants.length > 0 ? participants : undefined,
      },
      update: {
        name, email, institution, userId: user.id,
        // Registrasi lama (EXPIRED/FAILED/CANCELLED/REFUNDED) di-reset ke REGISTERED saat coba bayar lagi —
        // Kasus 3 di atas sudah menolak lebih dulu kalau statusnya benar-benar PAID/PASSED.
        status: "REGISTERED",
        ...(batchId ? { batchId } : {}),
        ...(participants.length > 0 ? { participants } : {}),
      },
      include: { payment: true },
    });

    // Buat session member secara otomatis setelah pendaftaran berhasil
    await createMemberSession(email);

    // Tautkan ke Lead (pipeline) — hasil=REGISTERED. Saat bayar akan jadi PAID di titik checkout.
    await linkLeadToRegistration(reg.id, whatsapp, program.id, false);

    // ── PROGRAM GRATIS (WEBINAR) ─────────────────────────────────
    if (program.price === 0) {
      const selectedBatch = reg.batchId
        ? await prisma.programBatch.findUnique({ where: { id: reg.batchId } })
        : null;
      const activeScheduleAt = selectedBatch?.scheduleAt ?? program.scheduleAt;
      const activeZoomLink = selectedBatch ? (selectedBatch.zoomLink || null) : program.zoomLink;
      const activeWaGroupLink = selectedBatch ? (selectedBatch.waGroupLink || null) : program.waGroupLink;
      const formattedJadwal = formatJadwal(activeScheduleAt);

      // Gabung semua nama peserta untuk keperluan notifikasi
      const allNames = [name, ...participants];

      await sendWa(
        whatsapp,
        msgWelcome(name, program.title, formattedJadwal, activeZoomLink, activeWaGroupLink)
      );

      const pesertaInfo = participantCount > 1
        ? `\n\n📋 Total peserta: ${participantCount} orang (${allNames.join(", ")})`
        : "";

      await sendEmail({
        to: email,
        subject: `Pendaftaran Berhasil: ${program.title}`,
        html: getWelcomeEmailHtml(name, program.title, formattedJadwal, activeWaGroupLink ?? "")
          .replace("</div>", `${pesertaInfo}</div>`),
      }).catch((err) => console.error("Gagal mengirim email pendaftaran gratis:", err));

      return NextResponse.json({
        ok: true, paid: false, free: true,
        waGroupLink: activeWaGroupLink,
        participantCount,
        participants,
      });
    }

    // ── PROGRAM BERBAYAR ─────────────────────────────────────────
    // sudah lunas sebelumnya → langsung beri akses lagi (bukan sekadar "!= REGISTERED",
    // karena EXPIRED/FAILED/CANCELLED/REFUNDED juga bukan REGISTERED tapi HARUS bisa bayar ulang)
    if (reg.status === "PAID" || reg.status === "PASSED") {
      const selectedBatch = reg.batchId
        ? await prisma.programBatch.findUnique({ where: { id: reg.batchId } })
        : null;
      const activeWaGroupLink = selectedBatch ? (selectedBatch.waGroupLink || null) : program.waGroupLink;
      const activeLmsLink = selectedBatch ? (selectedBatch.recordingLink || null) : program.lmsLink;

      return NextResponse.json({
        ok: true, paid: true,
        waGroupLink: activeWaGroupLink,
        lmsLink: activeLmsLink,
        participantCount,
        participants,
      });
    }

    // invoice pending masih berlaku → pakai ulang
    if (reg.payment?.status === "PENDING" && reg.payment.invoiceUrl) {
      return NextResponse.json({
        ok: true,
        invoiceUrl: reg.payment.invoiceUrl,
        participantCount,
        participants,
      });
    }

    // MODE DEV: bypass Xendit jika env XENDIT_DEV_BYPASS=true
    if (!isXenditConfigured()) {
      console.warn("[register] XENDIT_SECRET_KEY kosong — MODE DEV: pembayaran dianggap lunas.");
      if (process.env.NODE_ENV === "production" && process.env.XENDIT_DEV_BYPASS !== "true") {
        return NextResponse.json({ error: "Pembayaran belum dikonfigurasi. Hubungi admin." }, { status: 503 });
      }
    }

    // Xendit tidak dikonfigurasi (dev bypass), ATAU voucher menutup seluruh harga → langsung lunas tanpa invoice
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
      await sendWa(whatsapp, msgAccess({
        name,
        programTitle: program.title,
        schedule: formatJadwal(program.scheduleAt),
        zoomLink: program.zoomLink,
        waGroupLink: program.waGroupLink,
        lmsLink: program.lmsLink,
        memberUrl: `${baseUrl}/member`,
      }));
      await sendEmail({
        to: email,
        subject: `Pembayaran Berhasil: Akses Pelatihan ${program.title}`,
        html: getPaidEmailHtml(name, program.title, `${baseUrl}/member`, program.zoomLink, program.waGroupLink, program.lmsLink)
      }).catch((err) => console.error("Gagal mengirim email pembayaran dev:", err));

      return NextResponse.json({
        ok: true, paid: true,
        waGroupLink: program.waGroupLink,
        lmsLink: program.lmsLink,
        participantCount,
        participants,
      });
    }

    // Deskripsi invoice: cantumkan jumlah peserta + kode voucher jika dipakai
    const pesertaDesc = participantCount > 1
      ? `${program.title} × ${participantCount} peserta (${name} dkk.)`
      : `${program.title} (${name})`;
    const invoiceDesc = affiliateResult
      ? `${pesertaDesc} (Affiliate: ${affiliateResult.affiliate.code})`
      : voucherResult ? `${pesertaDesc} (Voucher: ${voucherResult.voucher.code})` : pesertaDesc;

    const invoice = await createInvoice({
      externalId: `ACADEMY-${reg.id}`,
      amount: chargeAmount,
      payerEmail: email,
      description: invoiceDesc,
      successRedirectUrl: `${baseUrl}/member`, // [FIX G5] Redirect ke dashboard, bukan program page
    });

    // Guard kuota voucher atomik — gagalkan sebelum buat invoice jika kuota habis (anti double-spend)
    if (voucherId && !(await consumeVoucher(voucherId, voucherResult!.voucher.maxUses))) {
      return NextResponse.json({ error: "Kuota pemakaian voucher ini sudah habis." }, { status: 400 });
    }

    await prisma.$transaction([
      prisma.payment.upsert({
        where: { registrationId: reg.id },
        create: { registrationId: reg.id, amount: chargeAmount, originalAmount, discountAmount, voucherId, affiliateId, xenditInvoiceId: invoice.id, invoiceUrl: invoice.invoice_url },
        update: { xenditInvoiceId: invoice.id, invoiceUrl: invoice.invoice_url, status: "PENDING", amount: chargeAmount, originalAmount, discountAmount, voucherId, affiliateId },
      }),
    ]);

    await sendEmail({
      to: email,
      subject: `Selesaikan Pembayaran: ${program.title}`,
      html: getInvoiceEmailHtml({ name, programTitle: program.title, price: chargeAmount, invoiceUrl: invoice.invoice_url }),
    }).catch((err) => console.error("Gagal mengirim email invoice:", err));

    return NextResponse.json({
      ok: true,
      invoiceUrl: invoice.invoice_url,
      participantCount,
      participants,
    });
  } catch (err: unknown) {
    console.error("[register]", err);
    return NextResponse.json(
      { error: `Terjadi kesalahan: ${err instanceof Error ? err.message : String(err)}` },
      { status: 503 }
    );
  }
}
