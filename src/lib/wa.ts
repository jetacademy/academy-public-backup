// ============================================================
// Evolution API — pengiriman pesan WhatsApp otomatis
// Semua pengiriman bersifat best-effort: jika server WA tidak
// tersedia, alur utama (daftar/bayar) tetap berjalan.
// ============================================================

export function normalizeWa(raw: string): string {
  if (!raw) return "";
  let trimmed = raw.trim();
  // Jika diawali "00", bersihkan prefix panggilan internasional (mis. 0062 -> 62)
  if (trimmed.startsWith("00")) {
    trimmed = trimmed.slice(2);
  }
  let n = trimmed.replace(/[^0-9]/g, "");
  // Jika formatnya 6208xxx (salah ketik awalan 62 + 08), rapikan jadi 628xxx
  if (n.startsWith("6208")) {
    n = "628" + n.slice(4);
  } else if (n.startsWith("0")) {
    n = "62" + n.slice(1);
  } else if (n.startsWith("8")) {
    n = "62" + n;
  }
  return n;
}

export type WaValidationResult = {
  valid: boolean;
  normalized: string;
  reason?: string;
};

/** Validasi pra-kirim nomor WhatsApp untuk mendeteksi nomor rusak/email sebelum dikirim ke API */
export function validateWaNumber(raw: string): WaValidationResult {
  if (!raw || !raw.trim()) {
    return { valid: false, normalized: "", reason: "Nomor WhatsApp kosong" };
  }
  if (raw.includes("@")) {
    return { valid: false, normalized: "", reason: "Format data berupa email, bukan nomor telepon" };
  }
  const normalized = normalizeWa(raw);
  if (!normalized) {
    return { valid: false, normalized: "", reason: "Nomor tidak mengandung angka valid" };
  }
  // Panjang nomor telepon seluler internasional umumnya 10-15 digit
  if (normalized.length < 10) {
    return { valid: false, normalized, reason: `Nomor terlalu pendek (${normalized.length} digit, min 10 digit)` };
  }
  if (normalized.length > 15) {
    return { valid: false, normalized, reason: `Nomor terlalu panjang (${normalized.length} digit, maks 15 digit)` };
  }
  // Khusus Indonesia (62), wajib nomor seluler diawali 628
  if (normalized.startsWith("62")) {
    if (!normalized.startsWith("628")) {
      return { valid: false, normalized, reason: "Bukan nomor HP seluler (harus diawali 08 atau 628)" };
    }
  }
  return { valid: true, normalized };
}

/** Identifier login (WhatsApp atau email) → bentuk baku, tanpa mengubah email. */
export function normalizeIdentifier(raw: string): string {
  const trimmed = raw.trim();
  return trimmed.includes("@") ? trimmed : normalizeWa(trimmed);
}

export type SendWaDetailResult = {
  ok: boolean;
  statusCode?: number;
  error?: string;
  targetPhone: string;
  responseBody?: unknown;
};

/** Kirim pesan WA dengan informasi status dan alasan error lengkap */
export async function sendWaDetailed(to: string, text: string): Promise<SendWaDetailResult> {
  const validation = validateWaNumber(to);
  if (!validation.valid) {
    return {
      ok: false,
      error: validation.reason || "Format nomor WhatsApp tidak valid",
      targetPhone: validation.normalized || to,
    };
  }

  const url = process.env.EVOLUTION_API_URL;
  const apikey = process.env.EVOLUTION_API_API_KEY;
  const instance = process.env.EVOLUTION_API_INSTANCE;

  // nilai placeholder dari .env.example dianggap belum dikonfigurasi
  const isPlaceholder = !url || !apikey || !instance || url.includes("domainkamu") || apikey.startsWith("isi_");
  if (isPlaceholder) {
    console.warn("[wa] Evolution API belum dikonfigurasi — pesan dilewati:", text.slice(0, 60));
    return {
      ok: false,
      error: "Evolution API belum dikonfigurasi di server",
      targetPhone: validation.normalized,
    };
  }

  try {
    const res = await fetch(`${url}/message/sendText/${instance}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey },
      body: JSON.stringify({ number: validation.normalized, text }),
    });

    let resBody: Record<string, unknown> | null = null;
    try {
      resBody = (await res.json()) as Record<string, unknown>;
    } catch {
      // bukan json
    }

    if (!res.ok) {
      let errorMsg = `HTTP ${res.status}`;
      if (resBody) {
        const respObj = resBody.response as Record<string, unknown> | undefined;
        if (typeof resBody.message === "string") {
          errorMsg = resBody.message;
        } else if (Array.isArray(resBody.message)) {
          errorMsg = resBody.message.join(", ");
        } else if (resBody.error) {
          errorMsg = typeof resBody.error === "string" ? resBody.error : JSON.stringify(resBody.error);
        } else if (respObj && typeof respObj.message === "string") {
          errorMsg = respObj.message;
        } else if (respObj && respObj.message) {
          errorMsg = JSON.stringify(respObj.message);
        }
      }

      // Terjemahkan error umum WhatsApp/Evolution API ke bahasa yang jelas
      if (res.status === 400 && /not.*registered|not.*exists|invalid/i.test(errorMsg)) {
        errorMsg = "Nomor tidak terdaftar di WhatsApp";
      } else if (res.status === 429) {
        errorMsg = "Rate limit WhatsApp / server sedang sibuk";
      } else if (res.status === 503 || res.status === 502) {
        errorMsg = "Gateway WhatsApp tidak dapat dihubungi";
      }

      console.error("[wa] gagal kirim:", res.status, errorMsg);
      return {
        ok: false,
        statusCode: res.status,
        error: errorMsg,
        targetPhone: validation.normalized,
        responseBody: resBody,
      };
    }

    return {
      ok: true,
      statusCode: res.status,
      targetPhone: validation.normalized,
      responseBody: resBody,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Gagal koneksi ke server WA";
    console.error("[wa] error:", err);
    return {
      ok: false,
      error: errorMsg,
      targetPhone: validation.normalized,
    };
  }
}

export async function sendWa(to: string, text: string): Promise<boolean> {
  const result = await sendWaDetailed(to, text);
  return result.ok;
}

// ---------- Template pesan (jelas, sopan, profesional) ----------

export function msgWelcome(
  name: string,
  programTitle: string,
  schedule: string,
  zoomLink?: string | null,
  waGroupLink?: string | null,
  memberUrl?: string
) {
  const dashboardUrl = memberUrl || `${process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"}/member`;
  return [
    `Halo ${name},`,
    ``,
    `Terima kasih. Pendaftaran Anda untuk *${programTitle}* telah berhasil terdaftar.`,
    ``,
    `Jadwal Pelatihan: ${schedule}`,
    ``,
    `Untuk mengakses link Zoom Live, grup WhatsApp peserta, dan materi lengkap, silakan masuk ke dashboard belajar Anda di tautan berikut:`,
    dashboardUrl,
    ``,
    `Salam,`,
    `Tim Jetschool Academy`,
  ].join("\n");
}

export function msgPaid(name: string, programTitle: string, memberUrl: string) {
  return [
    `Halo ${name},`,
    ``,
    `Pembayaran paket sertifikat *${programTitle}* telah kami terima. Terima kasih.`,
    ``,
    `Langkah terakhir: selesaikan materi & tes di dashboard belajar Anda. Setelah syarat kelulusan terpenuhi, e-sertifikat terbit otomatis.`,
    memberUrl,
    ``,
    `Salam,`,
    `Tim Jetschool Academy`,
  ].join("\n");
}

/** Akses program berbayar (kelas/workshop/bootcamp) setelah pembayaran diterima */
export function msgAccess(params: {
  name: string;
  programTitle: string;
  schedule?: string | null;
  zoomLink?: string | null;
  waGroupLink?: string | null;
  lmsLink?: string | null;
  memberUrl: string;
  attendanceType?: "ONLINE" | "OFFLINE" | string;
  venue?: string | null;
}) {
  const isOffline = params.attendanceType === "OFFLINE";
  return [
    `Halo ${params.name},`,
    ``,
    `Terima kasih. Pembayaran Anda untuk *${params.programTitle}* telah kami terima dan terkonfirmasi.`,
    ``,
    isOffline
      ? `*Format: Sesi Tatap Muka (Offline) - Durasi 4 Jam*`
      : `*Format: Sesi Online (Live Zoom)*`,
    params.schedule ? `Jadwal Pelatihan: ${params.schedule}` : null,
    isOffline ? `Lokasi: ${params.venue || "Coworking Space Kota Bekasi"}` : null,
    isOffline ? `Catatan: Mohon hadir 15 menit sebelum acara dan membawa laptop serta charger pribadi.` : null,
    ``,
    isOffline
      ? `Silakan masuk ke dashboard belajar Anda untuk mengakses materi modul, grup WhatsApp khusus peserta, dan informasi lengkap lokasi:`
      : `Silakan masuk ke dashboard belajar Anda untuk mengakses materi pembelajaran, tautan Zoom Live, dan bergabung ke grup WhatsApp peserta:`,
    params.memberUrl,
    ``,
    `Salam,`,
    `Tim Jetschool Academy`,
  ].filter((l) => l !== null).join("\n");
}

// ---------- Template pesan — Program Affiliate ----------

export function msgAffiliateInvite(name: string, dashboardUrl: string) {
  return [
    `Halo ${name},`,
    ``,
    `Selamat! Anda diundang untuk bergabung menjadi *Affiliate Jetschool Academy*.`,
    ``,
    `Sebagai affiliate, Anda bisa mendapatkan komisi setiap kali orang lain mendaftar program lewat link referral Anda — dan pembeli yang pakai kode Anda juga dapat harga lebih murah.`,
    ``,
    `Terima undangan dan atur kode referral Anda di sini:`,
    dashboardUrl,
    ``,
    `Salam,`,
    `Tim Jetschool Academy`,
  ].join("\n");
}

export function msgAffiliateWithdrawalCompleted(name: string, amount: string, dashboardUrl: string) {
  return [
    `Halo ${name},`,
    ``,
    `Penarikan komisi affiliate Anda sebesar *${amount}* telah kami proses dan cairkan.`,
    ``,
    `Cek detailnya di dashboard affiliate Anda:`,
    dashboardUrl,
    ``,
    `Salam,`,
    `Tim Jetschool Academy`,
  ].join("\n");
}

export function msgAffiliateWithdrawalRejected(name: string, amount: string, reason: string, dashboardUrl: string) {
  return [
    `Halo ${name},`,
    ``,
    `Mohon maaf, pengajuan penarikan komisi Anda sebesar *${amount}* belum bisa kami proses.`,
    ``,
    `Alasan: ${reason}`,
    ``,
    `Silakan cek dashboard affiliate Anda untuk detail lebih lanjut:`,
    dashboardUrl,
    ``,
    `Salam,`,
    `Tim Jetschool Academy`,
  ].join("\n");
}

export function msgTicketReply(name: string, subject: string, ticketUrl: string) {
  return [
    `Halo ${name},`,
    ``,
    `Ada balasan baru untuk tiket Anda: *${subject}*.`,
    ``,
    `Lihat balasannya di sini:`,
    ticketUrl,
    ``,
    `Salam,`,
    `Tim Jetschool Academy`,
  ].join("\n");
}

export function msgCertificate(name: string, certNumber: string, certUrl: string) {
  return [
    `Halo ${name},`,
    ``,
    `Selamat — Anda dinyatakan lulus, dan e-sertifikat Anda telah terbit.`,
    ``,
    `Nomor sertifikat: ${certNumber}`,
    `Unduh dan verifikasi: ${certUrl}`,
    ``,
    `Sertifikat ini dapat Anda lampirkan pada CV dan profil LinkedIn.`,
    ``,
    `Salam,`,
    `Tim Jetschool Academy`,
  ].join("\n");
}
