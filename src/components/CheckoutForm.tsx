"use client";

import { useState } from "react";

type ProgramOption = { slug: string; title: string; certPrice: number };

/**
 * Form "Ambil Sertifikat": peserta memasukkan nomor WA yang dipakai daftar,
 * sistem membuat invoice Xendit lalu mengarahkan ke halaman pembayaran.
 */
export default function CheckoutForm({ programs }: { programs: ProgramOption[] }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const form = e.currentTarget;
    const voucherInput = form.elements.namedItem("voucherCode") as HTMLInputElement | null;
    const data = {
      whatsapp: (form.elements.namedItem("whatsapp") as HTMLInputElement).value.trim(),
      programSlug: (form.elements.namedItem("programSlug") as HTMLSelectElement).value,
      voucherCode: voucherInput?.value.trim() || undefined,
    };

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Gagal membuat pembayaran.");

      if (json.postTestUrl) {
        // sudah pernah bayar → langsung ke dashboard belajar / sertifikat
        window.location.href = json.postTestUrl;
      } else {
        window.fbq?.("track", "InitiateCheckout");
        window.location.href = json.invoiceUrl; // halaman pembayaran Xendit
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kendala. Coba lagi ya.");
      setLoading(false);
    }
  }

  return (
    <form className="reg-card" onSubmit={onSubmit}>
      <h3>Klaim Sertifikat Anda</h3>
      <p className="sub">Gunakan nomor WhatsApp yang sama dengan saat Anda mendaftar.</p>

      {error && <div className="form-error" role="alert">{error}</div>}

      <div className="field">
        <label htmlFor="cProgram">Program yang Anda Ikuti</label>
        <select id="cProgram" name="programSlug" required defaultValue={programs[0]?.slug}>
          {programs.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.title} — Rp {p.certPrice.toLocaleString("id-ID")}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="cWa">Nomor WhatsApp Terdaftar</label>
        <input id="cWa" name="whatsapp" type="tel" placeholder="contoh: 081234567890" pattern="0[0-9]{8,13}" required />
      </div>
      <div className="field">
        <label htmlFor="cVoucher">Kode Voucher / Afiliasi (opsional)</label>
        <input id="cVoucher" name="voucherCode" type="text" placeholder="cth: DISKON20 atau kode affiliate" />
        <span style={{ fontSize: "0.76rem", color: "var(--ink-faint)", marginTop: "0.35rem", display: "block" }}>
          Datang lewat link referral affiliate? Diskon Anda terdeteksi otomatis — kolom ini boleh dikosongkan.
        </span>
      </div>

      <button type="submit" className="btn btn-purple btn-lg btn-block" disabled={loading}>
        {loading ? "Menyiapkan pembayaran..." : "Lanjut ke Pembayaran"}
      </button>
      <p className="reg-note">Pembayaran diproses aman melalui Xendit — QRIS, transfer bank, dan e-wallet.</p>
    </form>
  );
}
