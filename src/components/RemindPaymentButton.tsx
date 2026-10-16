"use client";

import { useState, useTransition } from "react";
import { sendPaymentReminderAction } from "@/app/webadmin/actions";

interface RemindPaymentButtonProps {
  registrationId: string;
  name: string;
  email: string;
  whatsapp?: string | null;
  programTitle: string;
  batchName?: string | null;
  status: string;
  hasInvoiceUrl?: boolean;
  invoiceUrl?: string | null;
  amount?: number;
  className?: string;
}

export default function RemindPaymentButton({
  registrationId,
  name,
  email,
  whatsapp,
  programTitle,
  batchName,
  status,
  hasInvoiceUrl,
  invoiceUrl: initialInvoiceUrl,
  amount,
  className = "btn btn-sm",
}: RemindPaymentButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [regenerate, setRegenerate] = useState(status === "EXPIRED" || !hasInvoiceUrl);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [currentInvoiceUrl, setCurrentInvoiceUrl] = useState(initialInvoiceUrl);

  const isExpired = status === "EXPIRED";

  const handleSend = () => {
    setResult(null);
    startTransition(async () => {
      const res = await sendPaymentReminderAction({
        registrationId,
        forceRegenerate: regenerate,
      });

      if (res.ok) {
        setResult({ ok: true, message: res.message || "Email pengingat berhasil dikirim!" });
        if (res.invoiceUrl) {
          setCurrentInvoiceUrl(res.invoiceUrl);
        }
      } else {
        setResult({ ok: false, message: res.message || "Gagal mengirim email pengingat." });
      }
    });
  };

  const cleanWa = whatsapp ? whatsapp.replace(/^0+/, "62").replace(/[^\d]/g, "") : "";
  const waText = currentInvoiceUrl
    ? `Halo Kaka ${name}, pendaftaran ${programTitle} masih pending nih. Berikut tautan pembayaran invoice resminya ya Kak 👇\n${currentInvoiceUrl}\n\nTerima kasih Kak 😊`
    : `Halo Kaka ${name}, mau ingetin pendaftaran ${programTitle} masih pending nih. Mohon segera selesaikan ya Kak 😊`;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setIsOpen(true);
          setResult(null);
          setRegenerate(status === "EXPIRED" || !hasInvoiceUrl);
        }}
        className={className}
        style={{
          background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
          color: "#ffffff",
          fontWeight: 700,
          border: "none",
          display: "inline-flex",
          alignItems: "center",
          gap: "0.3rem",
          cursor: "pointer",
        }}
        title="Kirim email pengingat pembayaran ke peserta"
      >
        <span>✉️</span> Ingatkan
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(3px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !isPending) setIsOpen(false);
          }}
        >
          <div
            style={{
              background: "var(--white, #ffffff)",
              color: "var(--ink, #1e293b)",
              borderRadius: "14px",
              boxShadow: "0 20px 45px rgba(0, 0, 0, 0.25)",
              width: "100%",
              maxWidth: "520px",
              padding: "1.5rem",
              position: "relative",
              animation: "fadeIn 0.15s ease-out",
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "1rem",
                borderBottom: "1px solid var(--border, #e2e8f0)",
                paddingBottom: "0.75rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "1.3rem" }}>✉️</span>
                <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "var(--purple, #232176)" }}>
                  Ingatkan Pembayaran
                </h3>
              </div>
              <button
                type="button"
                onClick={() => !isPending && setIsOpen(false)}
                disabled={isPending}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: "1.2rem",
                  color: "var(--ink-faint, #94a3b8)",
                  cursor: "pointer",
                  padding: "0.2rem 0.5rem",
                  borderRadius: "6px",
                }}
                title="Tutup"
              >
                ✕
              </button>
            </div>

            {/* Rincian Pendaftar */}
            <div
              style={{
                background: "var(--chip, #f8fafc)",
                border: "1px solid var(--border, #e2e8f0)",
                borderRadius: "10px",
                padding: "0.9rem 1rem",
                marginBottom: "1rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.45rem",
                fontSize: "0.85rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--ink-faint, #64748b)" }}>Penerima:</span>
                <strong style={{ color: "var(--ink, #1e293b)" }}>
                  Halo Kaka {name}
                </strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--ink-faint, #64748b)" }}>Email:</span>
                <span style={{ color: "var(--purple, #232176)", fontWeight: 600 }}>{email}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--ink-faint, #64748b)" }}>Program:</span>
                <span style={{ fontWeight: 600, textAlign: "right", maxWidth: "65%" }}>
                  {programTitle} {batchName && `(${batchName})`}
                </span>
              </div>
              {amount !== undefined && amount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px dashed #e2e8f0", paddingTop: "0.4rem" }}>
                  <span style={{ color: "var(--ink-faint, #64748b)" }}>Tagihan:</span>
                  <strong style={{ color: "#d97706" }}>Rp {amount.toLocaleString("id-ID")}</strong>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "var(--ink-faint, #64748b)" }}>Status Invoice:</span>
                {isExpired ? (
                  <span className="badge" style={{ background: "#fee2e2", color: "#b91c1c", fontWeight: 700, fontSize: "0.72rem" }}>
                    ⚠️ Kedaluwarsa (Expired)
                  </span>
                ) : hasInvoiceUrl ? (
                  <span className="badge" style={{ background: "#dcfce7", color: "#15803d", fontWeight: 700, fontSize: "0.72rem" }}>
                    🟢 Invoice Aktif
                  </span>
                ) : (
                  <span className="badge" style={{ background: "#fef3c7", color: "#b45309", fontWeight: 700, fontSize: "0.72rem" }}>
                    ⏳ Belum Ada Invoice
                  </span>
                )}
              </div>
            </div>

            {/* Opsi Generate Ulang Xendit */}
            <div
              style={{
                background: regenerate ? "rgba(245, 158, 11, 0.08)" : "#ffffff",
                border: regenerate ? "1.5px solid #f59e0b" : "1px solid var(--border, #e2e8f0)",
                borderRadius: "10px",
                padding: "0.75rem 0.9rem",
                marginBottom: "1rem",
                transition: "all 0.15s ease",
              }}
            >
              <label style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem", cursor: "pointer", margin: 0 }}>
                <input
                  type="checkbox"
                  checked={regenerate}
                  onChange={(e) => setRegenerate(e.target.checked)}
                  disabled={isPending}
                  style={{ marginTop: "0.2rem", width: "1.05rem", height: "1.05rem", accentColor: "#d97706" }}
                />
                <div style={{ fontSize: "0.82rem" }}>
                  <strong style={{ color: regenerate ? "#b45309" : "var(--ink, #1e293b)", display: "block" }}>
                    🔄 Generate Ulang Invoice Xendit Baru
                  </strong>
                  <span style={{ color: "var(--ink-faint, #64748b)", fontSize: "0.76rem", lineHeight: 1.35, display: "block", marginTop: "0.15rem" }}>
                    {isExpired
                      ? "Invoice sebelumnya telah kedaluwarsa. Sistem akan otomatis menerbitkan invoice Xendit baru dengan masa aktif 24 jam."
                      : "Centang jika ingin memperpanjang batas pembayaran dengan invoice baru 24 jam."}
                  </span>
                </div>
              </label>
            </div>

            {/* Pesan Sapaan Kaka Preview */}
            <div
              style={{
                fontSize: "0.78rem",
                color: "var(--ink-soft, #475569)",
                background: "#f1f5f9",
                borderRadius: "8px",
                padding: "0.65rem 0.85rem",
                marginBottom: "1rem",
                lineHeight: 1.45,
              }}
            >
              💬 <em>Email akan dikirim dengan sapaan akrab <strong>&ldquo;Halo Kaka {name} 👋&rdquo;</strong> serta tombol &amp; tautan link invoice resmi Xendit.</em>
            </div>

            {/* Alert Status Result */}
            {result && (
              <div
                className={`adm-alert ${result.ok ? "ok" : "err"}`}
                style={{
                  marginBottom: "1rem",
                  padding: "0.65rem 0.85rem",
                  fontSize: "0.82rem",
                  borderRadius: "8px",
                }}
              >
                {result.message}
              </div>
            )}

            {/* Actions Footer */}
            <div style={{ display: "flex", gap: "0.6rem", justifyContent: "flex-end", flexWrap: "wrap" }}>
              {whatsapp && cleanWa && (
                <a
                  href={`https://wa.me/${cleanWa}?text=${encodeURIComponent(waText)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-sm"
                  style={{
                    background: "#25D366",
                    color: "#ffffff",
                    fontWeight: 600,
                    fontSize: "0.78rem",
                    padding: "0.45rem 0.8rem",
                  }}
                  title="Kirim pesan pengingat ke WhatsApp peserta"
                >
                  📲 Kirim WA
                </a>
              )}

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={isPending}
                className="btn btn-sm"
                style={{ fontSize: "0.78rem", padding: "0.45rem 0.8rem" }}
              >
                {result?.ok ? "Tutup" : "Batal"}
              </button>

              <button
                type="button"
                onClick={handleSend}
                disabled={isPending}
                className="btn btn-sm"
                style={{
                  background: "var(--purple, #232176)",
                  color: "#ffffff",
                  fontWeight: 700,
                  fontSize: "0.78rem",
                  padding: "0.45rem 1rem",
                  opacity: isPending ? 0.7 : 1,
                  cursor: isPending ? "not-allowed" : "pointer",
                }}
              >
                {isPending ? "⏳ Mengirim..." : "🚀 Kirim Email Pengingat"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
