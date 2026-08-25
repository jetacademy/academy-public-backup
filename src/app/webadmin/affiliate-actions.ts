"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin, getAdminSession } from "@/lib/admin-auth";
import { sendWa, msgAffiliateInvite, msgTicketReply } from "@/lib/wa";
import { sendEmail, getAffiliateInviteEmailHtml, getTicketReplyEmailHtml } from "@/lib/email";
import { generateUniqueAffiliateCode, getAffiliateSettings, settleWithdrawalConversions, notifyWithdrawalResult } from "@/lib/affiliate";
import { createPayout } from "@/lib/xendit";

function optStr(formData: FormData, key: string): string | null {
  const v = String(formData.get(key) ?? "").trim();
  return v.length > 0 ? v : null;
}
function num(formData: FormData, key: string): number {
  return Number(String(formData.get(key) ?? "0").replace(/[^\d]/g, "")) || 0;
}

// ─── Undangan Affiliate ────────────────────────────────────────────

/** Kirim/kirim ulang "tombol penawaran" affiliate ke seorang user. */
export async function inviteAffiliate(formData: FormData) {
  const session = await getAdminSession();
  if (!session) return;
  const userId = String(formData.get("userId") ?? "");
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) redirect("/webadmin/affiliate?e=usernotfound");

  const settings = await getAffiliateSettings();
  const existing = await prisma.affiliate.findUnique({ where: { userId } });

  let affiliate;
  if (existing) {
    if (existing.status === "ACTIVE") redirect("/webadmin/affiliate?e=sudahaktif");
    // PENDING (kirim ulang) atau REJECTED/SUSPENDED (undang ulang) → reset ke PENDING
    affiliate = await prisma.affiliate.update({
      where: { id: existing.id },
      data: { status: "PENDING", invitedAt: new Date(), invitedBy: session.name || session.email, respondedAt: null },
    });
  } else {
    const code = await generateUniqueAffiliateCode(user.name);
    affiliate = await prisma.affiliate.create({
      data: {
        userId,
        code,
        commissionType: settings.defaultCommissionType,
        commissionValue: settings.defaultCommissionValue,
        discountType: settings.defaultDiscountType,
        discountValue: settings.defaultDiscountValue,
        invitedBy: session.name || session.email,
      },
    });
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const dashboardUrl = `${baseUrl}/member/affiliate`;
  if (user.whatsapp) await sendWa(user.whatsapp, msgAffiliateInvite(user.name, dashboardUrl));
  await sendEmail({
    to: user.email,
    subject: "Anda Diundang Menjadi Affiliate Jetschool Academy",
    html: getAffiliateInviteEmailHtml(user.name, dashboardUrl),
  }).catch((err) => console.error("Gagal mengirim email undangan affiliate:", err));

  void affiliate;
  revalidatePath("/webadmin/affiliate");
  redirect("/webadmin/affiliate?ok=diundang");
}

/** Nonaktifkan sementara / aktifkan kembali seorang affiliate — kode berhenti/berfungsi lagi. */
export async function toggleAffiliateSuspend(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const affiliate = await prisma.affiliate.findUnique({ where: { id } });
  if (!affiliate || !["ACTIVE", "SUSPENDED"].includes(affiliate.status)) return;
  await prisma.affiliate.update({
    where: { id },
    data: { status: affiliate.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" },
  });
  revalidatePath("/webadmin/affiliate");
}

/** Ubah rate komisi & diskon customer untuk satu affiliate (bisa beda-beda per orang). */
export async function updateAffiliateRates(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const commissionType = (String(formData.get("commissionType") ?? "PERCENT") === "FIXED" ? "FIXED" : "PERCENT") as "PERCENT" | "FIXED";
  const commissionValue = num(formData, "commissionValue");
  const discountType = (String(formData.get("discountType") ?? "PERCENT") === "FIXED" ? "FIXED" : "PERCENT") as "PERCENT" | "FIXED";
  const discountValue = num(formData, "discountValue");
  const adminNote = optStr(formData, "adminNote");

  if (commissionType === "PERCENT" && commissionValue > 100) redirect(`/webadmin/affiliate/${id}?e=persen`);
  if (discountType === "PERCENT" && discountValue > 100) redirect(`/webadmin/affiliate/${id}?e=persen`);

  await prisma.affiliate.update({
    where: { id },
    data: { commissionType, commissionValue, discountType, discountValue, adminNote },
  });
  revalidatePath("/webadmin/affiliate");
  revalidatePath(`/webadmin/affiliate/${id}`);
  redirect(`/webadmin/affiliate/${id}?ok=1`);
}

/** Ganti kode referral custom seorang affiliate (dari sisi admin — mis. permintaan lewat tiket). */
export async function adminSetAffiliateCode(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const codeRaw = String(formData.get("code") ?? "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
  if (codeRaw.length < 3) redirect(`/webadmin/affiliate/${id}?e=kodependek`);

  try {
    await prisma.affiliate.update({ where: { id }, data: { code: codeRaw } });
  } catch {
    redirect(`/webadmin/affiliate/${id}?e=kodedipakai`);
  }
  revalidatePath("/webadmin/affiliate");
  revalidatePath(`/webadmin/affiliate/${id}`);
  redirect(`/webadmin/affiliate/${id}?ok=1`);
}

// ─── Pengaturan Global ──────────────────────────────────────────────

export async function saveAffiliateSettings(formData: FormData) {
  await requireAdmin();
  const defaultCommissionType = (String(formData.get("defaultCommissionType") ?? "PERCENT") === "FIXED" ? "FIXED" : "PERCENT") as "PERCENT" | "FIXED";
  const defaultCommissionValue = num(formData, "defaultCommissionValue");
  const defaultDiscountType = (String(formData.get("defaultDiscountType") ?? "PERCENT") === "FIXED" ? "FIXED" : "PERCENT") as "PERCENT" | "FIXED";
  const defaultDiscountValue = num(formData, "defaultDiscountValue");
  const minWithdrawal = num(formData, "minWithdrawal");
  const holdDays = Math.max(0, num(formData, "holdDays"));
  const cookieDays = Math.max(1, num(formData, "cookieDays"));
  const termsText = optStr(formData, "termsText");

  await getAffiliateSettings(); // pastikan baris singleton ada
  await prisma.affiliateSettings.update({
    where: { id: "singleton" },
    data: { defaultCommissionType, defaultCommissionValue, defaultDiscountType, defaultDiscountValue, minWithdrawal, holdDays, cookieDays, termsText },
  });
  revalidatePath("/webadmin/affiliate/pengaturan");
  redirect("/webadmin/affiliate/pengaturan?ok=1");
}

// ─── Penarikan (Withdrawal) ──────────────────────────────────────────

/**
 * Proses pencairan SUNGGUHAN lewat Xendit Payout — mentransfer uang nyata.
 * Hanya boleh dipicu dari UI admin yang sudah minta konfirmasi eksplisit.
 */
export async function processWithdrawalPayout(withdrawalId: string): Promise<{ ok?: true; error?: string }> {
  await requireAdmin();

  const withdrawal = await prisma.affiliateWithdrawal.findUnique({
    where: { id: withdrawalId },
    include: { affiliate: { include: { user: true } } },
  });
  if (!withdrawal) return { error: "Pengajuan penarikan tidak ditemukan." };
  if (withdrawal.status !== "REQUESTED") return { error: "Pengajuan ini sudah diproses sebelumnya." };

  // Kunci status lebih dulu secara atomik (REQUESTED → PROCESSING) SEBELUM memanggil API
  // Xendit — mencegah klik ganda admin memicu dua payout & status DB menggantung
  // jika proses mati di antara API call dan update.
  const locked = await prisma.affiliateWithdrawal.updateMany({
    where: { id: withdrawal.id, status: "REQUESTED" },
    data: { status: "PROCESSING", processedBy: (await getAdminSession())?.email ?? "admin" },
  });
  if (locked.count === 0) {
    return { error: "Pengajuan ini sudah diproses sebelumnya." };
  }

  try {
    const payout = await createPayout({
      referenceId: withdrawal.id,
      amount: withdrawal.amount,
      channelCode: withdrawal.channelCode,
      accountNumber: withdrawal.accountNumber,
      accountHolderName: withdrawal.accountHolderName,
      description: `Komisi Affiliate — ${withdrawal.affiliate.user.name}`,
    });

    const isImmediatelyDone = payout.status === "SUCCEEDED";
    await prisma.affiliateWithdrawal.update({
      where: { id: withdrawal.id },
      data: {
        status: isImmediatelyDone ? "COMPLETED" : "PROCESSING",
        xenditPayoutId: payout.id,
        xenditReferenceId: payout.reference_id,
        processedAt: isImmediatelyDone ? new Date() : null,
      },
    });

    if (isImmediatelyDone) {
      await settleWithdrawalConversions(withdrawal.affiliateId, withdrawal.amount);
      await notifyWithdrawalResult(withdrawal.id, "completed");
    }

    revalidatePath("/webadmin/affiliate/penarikan");
    return { ok: true };
  } catch (err) {
    console.error("[processWithdrawalPayout]", err);
    return { error: err instanceof Error ? err.message : "Gagal memproses payout ke Xendit." };
  }
}

/** Tolak pengajuan penarikan sebelum diproses — dana tidak pernah keluar, saldo affiliate utuh kembali. */
export async function rejectWithdrawal(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id"));
  const reason = String(formData.get("reason") ?? "").trim() || "Ditolak admin.";

  const withdrawal = await prisma.affiliateWithdrawal.findUnique({ where: { id } });
  if (!withdrawal || withdrawal.status !== "REQUESTED") redirect("/webadmin/affiliate/penarikan");

  await prisma.affiliateWithdrawal.update({
    where: { id },
    data: { status: "REJECTED", failureReason: reason, processedAt: new Date(), processedBy: (await getAdminSession())?.email ?? "admin" },
  });
  await notifyWithdrawalResult(id, "rejected", reason);

  revalidatePath("/webadmin/affiliate/penarikan");
  redirect("/webadmin/affiliate/penarikan?ok=ditolak");
}

/**
 * Fallback manual — admin menandai penarikan SUDAH ditransfer di luar sistem (mis. sudah
 * dicek langsung di dashboard Xendit / transfer manual), untuk kasus webhook payout belum masuk.
 */
export async function markWithdrawalCompletedManually(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id"));
  const withdrawal = await prisma.affiliateWithdrawal.findUnique({ where: { id } });
  if (!withdrawal || !["REQUESTED", "PROCESSING"].includes(withdrawal.status)) redirect("/webadmin/affiliate/penarikan");

  await prisma.affiliateWithdrawal.update({
    where: { id },
    data: { status: "COMPLETED", processedAt: new Date(), processedBy: (await getAdminSession())?.email ?? "admin" },
  });
  await settleWithdrawalConversions(withdrawal.affiliateId, withdrawal.amount);
  await notifyWithdrawalResult(id, "completed");

  revalidatePath("/webadmin/affiliate/penarikan");
  redirect("/webadmin/affiliate/penarikan?ok=selesai");
}

// ─── Tiket Dukungan ─────────────────────────────────────────────────

export async function replyTicket(formData: FormData): Promise<void> {
  const session = await getAdminSession();
  if (!session) return;
  const ticketId = String(formData.get("ticketId") ?? "");
  const message = String(formData.get("message") ?? "").trim();
  const newStatus = String(formData.get("status") ?? "IN_PROGRESS") as "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  if (!ticketId || !message) redirect(`/webadmin/affiliate/tiket/${ticketId}?e=lengkapi`);

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) redirect("/webadmin/affiliate/tiket");

  await prisma.$transaction([
    prisma.ticketMessage.create({
      data: { ticketId, senderRole: "ADMIN", senderName: session.name || session.email, message },
    }),
    prisma.ticket.update({ where: { id: ticketId }, data: { status: newStatus } }),
  ]);

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const ticketUrl = `${baseUrl}/member/affiliate/tiket/${ticketId}`;
  if (ticket.whatsapp) await sendWa(ticket.whatsapp, msgTicketReply(ticket.name, ticket.subject, ticketUrl));
  await sendEmail({
    to: ticket.email,
    subject: `Balasan Tiket: ${ticket.subject}`,
    html: getTicketReplyEmailHtml({ name: ticket.name, subject: ticket.subject, ticketUrl }),
  }).catch((err) => console.error("Gagal mengirim email balasan tiket:", err));

  revalidatePath("/webadmin/affiliate/tiket");
  revalidatePath(`/webadmin/affiliate/tiket/${ticketId}`);
  redirect(`/webadmin/affiliate/tiket/${ticketId}?ok=1`);
}

export async function setTicketStatus(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id"));
  const status = String(formData.get("status") ?? "OPEN") as "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  await prisma.ticket.update({ where: { id }, data: { status } });
  revalidatePath("/webadmin/affiliate/tiket");
}
