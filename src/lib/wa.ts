// ============================================================
// Evolution API — pengiriman pesan WhatsApp otomatis
// Semua pengiriman bersifat best-effort: jika server WA tidak
// tersedia, alur utama (daftar/bayar) tetap berjalan.
// ============================================================

export function normalizeWa(raw: string): string {
  let n = raw.replace(/[^0-9]/g, "");
  if (n.startsWith("0")) {
    n = "62" + n.slice(1);
  } else if (n.startsWith("8")) {
    n = "62" + n;
  }
  return n;
}

/** Identifier login (WhatsApp atau email) → bentuk baku, tanpa mengubah email. */
export function normalizeIdentifier(raw: string): string {
  const trimmed = raw.trim();
  return trimmed.includes("@") ? trimmed : normalizeWa(trimmed);
}

export async function sendWa(to: string, text: string): Promise<boolean> {
  const url = process.env.EVOLUTION_API_URL;
  const apikey = process.env.EVOLUTION_API_API_KEY;
  const instance = process.env.EVOLUTION_API_INSTANCE;

  // nilai placeholder dari .env.example dianggap belum dikonfigurasi
  const isPlaceholder = !url || !apikey || !instance || url.includes("domainkamu") || apikey.startsWith("isi_");
  if (isPlaceholder) {
    console.warn("[wa] Evolution API belum dikonfigurasi — pesan dilewati:", text.slice(0, 60));
    return false;
  }

  try {
    const res = await fetch(`${url}/message/sendText/${instance}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey },
      body: JSON.stringify({ number: normalizeWa(to), text }),
    });
    if (!res.ok) console.error("[wa] gagal kirim:", res.status, await res.text());
    return res.ok;
  } catch (err) {
    console.error("[wa] error:", err);
    return false;
  }
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
