import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";

type EmailPayload = {
  to: string;
  subject: string;
  html: string;
};

// Singleton transporter
let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      // Pakai ulang koneksi SMTP (bukan handshake TLS baru per email) & batasi paralel
      // supaya lonjakan pendaftaran tidak membanjiri server mail.
      pool: true,
      maxConnections: 3,
      connectionTimeout: 15_000,
      socketTimeout: 30_000,
    });
  }
  return transporter;
}

export async function sendEmail({ to, subject, html }: EmailPayload) {
  const from = process.env.SMTP_FROM ?? `Jetschool Academy <${process.env.SMTP_USER}>`;
  const client = getTransporter();

  if (client) {
    try {
      await client.sendMail({ from, to, subject, html });
      console.log(`[Email] Berhasil dikirim ke: ${to} (Subject: ${subject})`);
      return;
    } catch (err) {
      console.error("[Email] Gagal mengirim lewat SMTP:", err);
    }
  }

  // Fallback: hanya di development, log ke terminal
  if (process.env.NODE_ENV === "development") {
    const logDir = path.join(process.cwd(), "scratch");
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const logFile = path.join(logDir, "emails.log");
    const logMessage = `
=========================================
TIMESTAMP: ${new Date().toISOString()}
KE       : ${to}
SUBJEK   : ${subject}
-----------------------------------------
${html.replace(/<[^>]*>/g, " ").trim()}
=========================================
`;

    fs.appendFileSync(logFile, logMessage, "utf-8");
    console.log(`\n[Email Simulation Dev] Ke: ${to}\nSubjek: ${subject}\nTeks tercatat di: scratch/emails.log\n`);
  } else {
    console.warn(`[Email] Gagal kirim ke ${to} — SMTP tidak tersedia.`);
  }
}

// ─── Helpers ────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ─── Templates ───────────────────────────────────────────────────

export function getWelcomeEmailHtml(name: string, programTitle: string, schedule: string, joinUrl: string) {
  const safeName = escapeHtml(name);
  const safeTitle = escapeHtml(programTitle);
  const safeSchedule = escapeHtml(schedule);
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px; color: #17161a; background: #ffffff;">
      <h2 style="color: #232176; margin-top: 0;">Halo ${safeName}, selamat bergabung! 👋</h2>
      <p>Pendaftaran Anda untuk program <strong>${safeTitle}</strong> telah berhasil.</p>
      <div style="background: #f7f6f8; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <p style="margin: 0 0 8px 0;">📅 <strong>Jadwal Pelaksanaan:</strong> ${safeSchedule}</p>
        <p style="margin: 0;">🔗 <strong>Tautan Penting:</strong> Gabung grup koordinasi WhatsApp untuk mendapatkan update terkini.</p>
      </div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${joinUrl}" style="background: #232176; color: #ffffff; padding: 12px 24px; border-radius: 99px; text-decoration: none; font-weight: bold; display: inline-block;">Gabung Grup WhatsApp Sekarang</a>
      </div>
      <p style="font-size: 0.9em; color: #56545c;">Jika tombol di atas tidak dapat diklik, salin tautan berikut ke browser Anda: <br/> <a href="${joinUrl}" style="color: #232176;">${joinUrl}</a></p>
      <hr style="border: 0; border-top: 1px solid #eaeaea; margin: 30px 0;"/>
      <p style="font-size: 0.8em; color: #9c99a3; text-align: center;">Jetschool Academy &copy; 2026. Semua hak dilindungi.</p>
    </div>
  `;
}

export function getPaidEmailHtml(name: string, programTitle: string, memberUrl: string, zoomLink?: string | null, waGroupLink?: string | null, lmsLink?: string | null) {
  const safeName = escapeHtml(name);
  const safeTitle = escapeHtml(programTitle);
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px; color: #17161a; background: #ffffff;">
      <h2 style="color: #232176; margin-top: 0;">Pembayaran Dikonfirmasi! 🎉</h2>
      <p>Halo ${safeName}, pembayaran Anda untuk program <strong>${safeTitle}</strong> telah lunas. Akses penuh ke program Anda kini telah aktif.</p>
      
      <div style="background: #f7f6f8; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #232176; font-size: 1rem;">🔗 Detail Akses Pelatihan:</h3>
        ${zoomLink ? `<p style="margin: 0 0 8px 0;">📹 <strong>Link Zoom Live:</strong> <a href="${zoomLink}" style="color: #232176;">Gabung Zoom</a></p>` : ""}
        ${waGroupLink ? `<p style="margin: 0 0 8px 0;">💬 <strong>Link WhatsApp Group:</strong> <a href="${waGroupLink}" style="color: #232176;">Gabung Grup</a></p>` : ""}
        ${lmsLink ? `<p style="margin: 0 0 8px 0;">🖥️ <strong>Link Platform LMS:</strong> <a href="${lmsLink}" style="color: #232176;">Akses LMS</a></p>` : ""}
        <p style="margin: 0;">📝 <strong>Materi &amp; Tes:</strong> selesaikan pembelajaran di dashboard Anda — e-sertifikat terbit otomatis begitu syarat kelulusan terpenuhi.</p>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${memberUrl}" style="background: #f7941d; color: #ffffff; padding: 12px 24px; border-radius: 99px; text-decoration: none; font-weight: bold; display: inline-block;">Buka Dashboard Belajar</a>
      </div>

      <hr style="border: 0; border-top: 1px solid #eaeaea; margin: 30px 0;"/>
      <p style="font-size: 0.8em; color: #9c99a3; text-align: center;">Jetschool Academy &copy; 2026. Semua hak dilindungi.</p>
    </div>
  `;
}

export function getCertEmailHtml(name: string, programTitle: string, certUrl: string) {
  const safeName = escapeHtml(name);
  const safeTitle = escapeHtml(programTitle);
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px; color: #17161a; background: #ffffff;">
      <h2 style="color: #232176; margin-top: 0;">Selamat, Sertifikat Anda Telah Terbit! 🏆</h2>
      <p>Halo ${safeName}, selamat atas kelulusan Anda dalam program <strong>${safeTitle}</strong>. E-sertifikat resmi Anda telah berhasil diterbitkan dan diverifikasi oleh sistem.</p>
      
      <div style="text-align: center; margin: 40px 0;">
        <a href="${certUrl}" style="background: #232176; color: #ffffff; padding: 14px 28px; border-radius: 99px; text-decoration: none; font-weight: bold; display: inline-block;">Unduh e-Sertifikat Resmi</a>
      </div>

      <p style="font-size: 0.9em; color: #56545c; text-align: center;">Sertifikat ini dilengkapi dengan QR Code verifikasi unik untuk pembuktian keabsahan publik.</p>
      <hr style="border: 0; border-top: 1px solid #eaeaea; margin: 30px 0;"/>
      <p style="font-size: 0.8em; color: #9c99a3; text-align: center;">Jetschool Academy &copy; 2026. Semua hak dilindungi.</p>
    </div>
  `;
}

export function getContactMessageEmailHtml(params: { name: string; email: string; whatsapp: string; message: string }): string {
  const safeName = escapeHtml(params.name);
  const safeEmail = escapeHtml(params.email);
  const safeWhatsapp = escapeHtml(params.whatsapp);
  const safeMessage = escapeHtml(params.message).replace(/\n/g, "<br/>");
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px; color: #17161a; background: #ffffff;">
      <h2 style="color: #232176; margin-top: 0;">Pesan Baru dari Formulir Hubungi Kami</h2>
      <div style="background: #f7f6f8; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <p style="margin: 0 0 8px 0;"><strong>Nama:</strong> ${safeName}</p>
        <p style="margin: 0 0 8px 0;"><strong>WhatsApp:</strong> ${safeWhatsapp}</p>
        <p style="margin: 0;"><strong>Email:</strong> ${safeEmail || "(tidak diisi)"}</p>
      </div>
      <p style="margin: 0 0 8px 0;"><strong>Pesan:</strong></p>
      <p style="white-space: pre-wrap;">${safeMessage}</p>
      <hr style="border: 0; border-top: 1px solid #eaeaea; margin: 30px 0;"/>
      <p style="font-size: 0.8em; color: #9c99a3; text-align: center;">Dikirim otomatis dari halaman /contact Jetschool Academy.</p>
    </div>
  `;
}

export function getOtpEmailHtml(code: string): string {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px; color: #17161a; background: #ffffff;">
      <h2 style="color: #232176; margin-top: 0;">Kode Verifikasi Anda 🔐</h2>
      <p>Gunakan kode berikut untuk masuk ke akun Jetschool Academy Anda. Kode berlaku selama <strong>5 menit</strong>.</p>

      <div style="text-align: center; margin: 32px 0;">
        <div style="display: inline-block; background: #f3f4f6; border: 2px dashed #d1d5db; border-radius: 10px; padding: 18px 48px;">
          <span style="font-size: 40px; font-weight: 800; letter-spacing: 12px; color: #232176;">${code}</span>
        </div>
      </div>

      <p style="font-size: 0.9em; color: #56545c;">Jika Anda tidak meminta kode ini, abaikan email ini. Jangan bagikan kode kepada siapa pun — tim kami tidak akan pernah memintanya.</p>
      <hr style="border: 0; border-top: 1px solid #eaeaea; margin: 30px 0;"/>
      <p style="font-size: 0.8em; color: #9c99a3; text-align: center;">Jetschool Academy &copy; ${new Date().getFullYear()}. Semua hak dilindungi.</p>
    </div>
  `;
}

export function getInvoiceEmailHtml(params: {
  name: string;
  programTitle: string;
  price: number;
  invoiceUrl: string;
}): string {
  const priceFormatted = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(params.price);
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px; color: #17161a; background: #ffffff;">
      <h2 style="color: #232176; margin-top: 0;">Selesaikan Pembayaran Anda ⏰</h2>
      <p>Halo ${escapeHtml(params.name)}, Anda terdaftar pada program <strong>${escapeHtml(params.programTitle)}</strong>.</p>
      <p>Untuk mengaktifkan akses kelas, silakan selesaikan pembayaran sebesar <strong>${priceFormatted}</strong>:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${params.invoiceUrl}" style="background: #f7941d; color: #ffffff; padding: 12px 28px; border-radius: 99px; text-decoration: none; font-weight: bold; display: inline-block;">Bayar Sekarang</a>
      </div>
      <p style="font-size: 0.9em; color: #56545c;">Invoice berlaku 24 jam. Setelah lunas, Anda otomatis menerima email konfirmasi berisi link akses kelas.</p>
      <hr style="border: 0; border-top: 1px solid #eaeaea; margin: 30px 0;"/>
      <p style="font-size: 0.8em; color: #9c99a3; text-align: center;">Jetschool Academy &copy; ${new Date().getFullYear()}. Semua hak dilindungi.</p>
    </div>
  `;
}

export function getInvoiceExpiredEmailHtml(params: {
  name: string;
  programTitle: string;
  registerUrl: string;
}): string {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px; color: #17161a; background: #ffffff;">
      <h2 style="color: #b45309; margin-top: 0;">Invoice Anda Telah Kedaluwarsa ⚠️</h2>
      <p>Halo ${escapeHtml(params.name)}, invoice untuk program <strong>${escapeHtml(params.programTitle)}</strong> sudah melewati batas waktu dan tidak dapat digunakan lagi.</p>
      <p>Jika Anda masih ingin bergabung, silakan daftar kembali melalui tombol di bawah — prosesnya hanya membutuhkan beberapa menit.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${params.registerUrl}" style="background: #232176; color: #ffffff; padding: 12px 28px; border-radius: 99px; text-decoration: none; font-weight: bold; display: inline-block;">Daftar Ulang</a>
      </div>
      <p style="font-size: 0.9em; color: #56545c;">Butuh bantuan? Hubungi kami langsung melalui WhatsApp Admin.</p>
      <hr style="border: 0; border-top: 1px solid #eaeaea; margin: 30px 0;"/>
      <p style="font-size: 0.8em; color: #9c99a3; text-align: center;">Jetschool Academy &copy; ${new Date().getFullYear()}. Semua hak dilindungi.</p>
    </div>
  `;
}

export function getInvoiceFailedEmailHtml(params: {
  name: string;
  programTitle: string;
  registerUrl: string;
}): string {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px; color: #17161a; background: #ffffff;">
      <h2 style="color: #dc2626; margin-top: 0;">Pembayaran Gagal Diproses ❌</h2>
      <p>Halo ${escapeHtml(params.name)}, pembayaran untuk program <strong>${escapeHtml(params.programTitle)}</strong> gagal diproses oleh sistem pembayaran.</p>
      <p>Kemungkinan penyebab: saldo tidak cukup, transaksi ditolak bank, atau koneksi terputus saat pembayaran berlangsung.</p>
      <p>Silakan coba daftar kembali dan gunakan metode pembayaran lain:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${params.registerUrl}" style="background: #232176; color: #ffffff; padding: 12px 28px; border-radius: 99px; text-decoration: none; font-weight: bold; display: inline-block;">Coba Lagi</a>
      </div>
      <p style="font-size: 0.9em; color: #56545c;">Jika dana sudah terpotong dan program belum aktif, segera hubungi admin kami via WhatsApp untuk proses pengembalian dana.</p>
      <hr style="border: 0; border-top: 1px solid #eaeaea; margin: 30px 0;"/>
      <p style="font-size: 0.8em; color: #9c99a3; text-align: center;">Jetschool Academy &copy; ${new Date().getFullYear()}. Semua hak dilindungi.</p>
    </div>
  `;
}

export function getAffiliateInviteEmailHtml(name: string, dashboardUrl: string): string {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px; color: #17161a; background: #ffffff;">
      <h2 style="color: #232176; margin-top: 0;">Anda Diundang Menjadi Affiliate! 🤝</h2>
      <p>Halo ${escapeHtml(name)}, tim kami ingin mengajak Anda bergabung sebagai <strong>Affiliate Jetschool Academy</strong>.</p>
      <p>Dapatkan komisi setiap ada pendaftaran lewat link referral Anda, dan pembeli yang memakai kode Anda juga mendapat harga lebih murah.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${dashboardUrl}" style="background: #232176; color: #ffffff; padding: 12px 28px; border-radius: 99px; text-decoration: none; font-weight: bold; display: inline-block;">Terima Undangan</a>
      </div>
      <hr style="border: 0; border-top: 1px solid #eaeaea; margin: 30px 0;"/>
      <p style="font-size: 0.8em; color: #9c99a3; text-align: center;">Jetschool Academy &copy; ${new Date().getFullYear()}. Semua hak dilindungi.</p>
    </div>
  `;
}

export function getAffiliateWithdrawalEmailHtml(params: {
  name: string;
  amountLabel: string;
  status: "completed" | "rejected";
  reason?: string;
  dashboardUrl: string;
}): string {
  const isDone = params.status === "completed";
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px; color: #17161a; background: #ffffff;">
      <h2 style="color: ${isDone ? "#232176" : "#dc2626"}; margin-top: 0;">${isDone ? "Penarikan Komisi Berhasil ✅" : "Penarikan Komisi Ditolak ❌"}</h2>
      <p>Halo ${escapeHtml(params.name)}, pengajuan penarikan komisi Anda sebesar <strong>${escapeHtml(params.amountLabel)}</strong> ${isDone ? "telah berhasil dicairkan." : "belum bisa kami proses."}</p>
      ${!isDone && params.reason ? `<p><strong>Alasan:</strong> ${escapeHtml(params.reason)}</p>` : ""}
      <div style="text-align: center; margin: 30px 0;">
        <a href="${params.dashboardUrl}" style="background: #232176; color: #ffffff; padding: 12px 28px; border-radius: 99px; text-decoration: none; font-weight: bold; display: inline-block;">Buka Dashboard Affiliate</a>
      </div>
      <hr style="border: 0; border-top: 1px solid #eaeaea; margin: 30px 0;"/>
      <p style="font-size: 0.8em; color: #9c99a3; text-align: center;">Jetschool Academy &copy; ${new Date().getFullYear()}. Semua hak dilindungi.</p>
    </div>
  `;
}

export function getTicketReplyEmailHtml(params: { name: string; subject: string; ticketUrl: string }): string {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px; color: #17161a; background: #ffffff;">
      <h2 style="color: #232176; margin-top: 0;">Ada Balasan Baru untuk Tiket Anda 💬</h2>
      <p>Halo ${escapeHtml(params.name)}, tiket Anda "<strong>${escapeHtml(params.subject)}</strong>" mendapat balasan baru dari tim kami.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${params.ticketUrl}" style="background: #232176; color: #ffffff; padding: 12px 28px; border-radius: 99px; text-decoration: none; font-weight: bold; display: inline-block;">Lihat Balasan</a>
      </div>
      <hr style="border: 0; border-top: 1px solid #eaeaea; margin: 30px 0;"/>
      <p style="font-size: 0.8em; color: #9c99a3; text-align: center;">Jetschool Academy &copy; ${new Date().getFullYear()}. Semua hak dilindungi.</p>
    </div>
  `;
}

export function getWelcomeMemberEmailHtml(name: string, loginUrl: string): string {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px; color: #17161a; background: #ffffff;">
      <h2 style="color: #232176; margin-top: 0;">Selamat Datang di Jetschool Academy! 🎉</h2>
      <p>Halo ${escapeHtml(name)},</p>
      <p>Akun Anda telah berhasil dibuat. Anda kini bisa mengakses dashboard belajar, memantau progress, dan mengelola sertifikat dari satu tempat.</p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${loginUrl}" style="background: #232176; color: #ffffff; padding: 13px 32px; border-radius: 99px; text-decoration: none; font-weight: bold; display: inline-block;">Masuk ke Dashboard</a>
      </div>
      <p style="font-size: 0.9em; color: #56545c;">Jika ada pertanyaan, jangan ragu menghubungi tim kami. Selamat belajar!</p>
      <hr style="border: 0; border-top: 1px solid #eaeaea; margin: 30px 0;"/>
      <p style="font-size: 0.8em; color: #9c99a3; text-align: center;">Jetschool Academy &copy; ${new Date().getFullYear()}. Semua hak dilindungi.</p>
    </div>
  `;
}
