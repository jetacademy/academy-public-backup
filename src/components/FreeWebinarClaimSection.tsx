"use client";

import { useState } from "react";
import Icon from "@/components/Icon";
import MemberPayCertButton from "@/components/MemberPayCertButton";
import ClaimCertButton from "@/components/ClaimCertButton";
import { rupiah } from "@/lib/format";

interface FreeWebinarClaimSectionProps {
  registrationId: string;
  claimIsOpen: boolean;
  certPaid: boolean;
  pendingCertPay: { invoiceUrl: string | null; amount: number } | null;
  certPrice: number;
  hasInternalLms: boolean;
  hasExternalLms: boolean;
  lmsLink?: string | null;
  batchLabel?: string | null;
  /** @deprecated tidak dipakai di render — dipertahankan agar pemanggil tetap valid */
  programTitle?: string;
}

export default function FreeWebinarClaimSection({
  registrationId,
  claimIsOpen,
  certPaid,
  pendingCertPay,
  certPrice,
  hasInternalLms,
  hasExternalLms,
  lmsLink,
  batchLabel,
}: FreeWebinarClaimSectionProps) {
  const [showBenefits, setShowBenefits] = useState(false);

  // Jika pembayaran sertifikat sudah pending atau lunas, otomatis tampilkan isi detail
  const shouldAutoShow = !!pendingCertPay || certPaid;
  const isExpanded = showBenefits || shouldAutoShow;

  return (
    <div 
      className="bonus-unlocked-card reveal in" 
      style={{
        background: isExpanded ? "linear-gradient(145deg, #f0fdf4 0%, #dcfce7 100%)" : "var(--white)",
        borderColor: isExpanded ? "#22c55e" : "var(--border)",
        boxShadow: isExpanded ? "0 4px 20px rgba(34, 197, 94, .12)" : "var(--shadow-sm)",
        transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)"
      }}
    >
      {/* ── HEADER ── */}
      <div 
        className="bonus-unlocked-header" 
        style={{ 
          borderBottom: isExpanded ? "1px solid rgba(34, 197, 94, .2)" : "none",
          paddingBottom: isExpanded ? ".7rem" : "0",
          marginBottom: isExpanded ? "1rem" : "0"
        }}
      >
        <span className="bonus-unlocked-icon" style={{ filter: isExpanded ? "none" : "grayscale(1) opacity(0.7)" }}>
          {certPaid ? "🎉" : "🎓"}
        </span>
        <div>
          <p className="bonus-unlocked-title" style={{ color: isExpanded ? "#14532d" : "var(--ink)", fontWeight: 800 }}>
            Klaim e-Sertifikat &amp; Akses Rekaman
          </p>
          <p className="bonus-unlocked-sub" style={{ color: isExpanded ? "#166534" : "var(--ink-soft)" }}>
            {certPaid
              ? "Akses eksklusif Anda sudah terbuka penuh"
              : claimIsOpen
              ? "Klaim sertifikat dan paket bonus Anda sekarang."
              : "Menu klaim belum dibuka oleh panitia/admin."}
          </p>
        </div>
      </div>

      {/* ── CASE 1: Belum Dibuka oleh Admin (claimIsOpen === false) ── */}
      {!claimIsOpen && (
        <div style={{ marginTop: "1rem", width: "100%" }}>
          <button
            type="button"
            className="btn"
            disabled
            style={{
              width: "100%",
              backgroundColor: "var(--bg)",
              color: "var(--ink-faint)",
              cursor: "not-allowed",
              fontWeight: 700,
              padding: "0.85rem",
              borderRadius: "var(--r-md)",
              border: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem"
            }}
          >
            <Icon name="lock" size={16} />
            Klaim Sertifikat (Belum Dibuka Admin)
          </button>
        </div>
      )}

      {/* ── CASE 2: Sudah Dibuka oleh Admin (claimIsOpen === true) ── */}
      {claimIsOpen && (
        <>
          {/* Jika belum klik klaim, tampilkan tombol klaim awal tanpa detail harga/benefit */}
          {!isExpanded ? (
            <div style={{ marginTop: "1rem", width: "100%" }}>
              <button
                type="button"
                className="btn btn-purple btn-block"
                style={{
                  fontWeight: 700,
                  padding: "0.85rem",
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem"
                }}
                onClick={() => setShowBenefits(true)}
              >
                <Icon name="award" size={16} />
                Klaim e-Sertifikat &amp; Akses Rekaman
              </button>
            </div>
          ) : (
            /* Jika sudah expanded (sudah klik klaim, atau lunas/pending) */
            <div className="reveal in" style={{ width: "100%" }}>
              {/* Tampilkan daftar benefit */}
              <div className="bonus-unlocked-items" style={{ margin: "1rem 0" }}>
                {hasInternalLms && (
                  <div className={`bonus-item${!certPaid ? " bonus-item-locked" : ""}`}>
                    {certPaid ? "📚" : "🔒"} Video Rekaman + Modul PDF + Post-Test
                  </div>
                )}
                {hasExternalLms && !hasInternalLms && (
                  <div className={`bonus-item${!certPaid ? " bonus-item-locked" : ""}`}>
                    {certPaid ? "📚" : "🔒"} Video Rekaman &amp; Materi Eksklusif
                  </div>
                )}
                <div className={`bonus-item${!certPaid ? " bonus-item-locked" : ""}`}>
                  {certPaid ? "🎓" : "🔒"} e-Sertifikat (terbit setelah lulus post-test)
                </div>
              </div>

              {/* Tombol aksi: gerbang pembayaran atau claim */}
              {certPaid ? (
                /* Lunas → akses LMS */
                <div style={{ marginTop: "1rem" }}>
                  {hasInternalLms ? (
                    <a href={`/member/lms/${registrationId}`} className="btn btn-purple btn-block" style={{ textAlign: "center", display: "block" }}>
                      📚 Akses Materi &amp; Post-Test
                    </a>
                  ) : hasExternalLms ? (
                    <a href={lmsLink!} target="_blank" rel="noopener noreferrer" className="btn btn-purple btn-block" style={{ textAlign: "center", display: "block" }}>
                      📚 {batchLabel ? `Rekaman sesi batch ${batchLabel}` : "Akses Rekaman &amp; Materi"}
                    </a>
                  ) : (
                    <ClaimCertButton registrationId={registrationId} />
                  )}
                </div>
              ) : pendingCertPay ? (
                /* Invoice pending */
                <div style={{ marginTop: "1rem" }}>
                  <a
                    href={pendingCertPay.invoiceUrl ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-yellow btn-block"
                    style={{ textAlign: "center", color: "#78350f", fontWeight: 700, display: "block" }}
                  >
                    Selesaikan Pembayaran Sertifikat ({rupiah(pendingCertPay.amount)})
                  </a>
                </div>
              ) : certPrice > 0 ? (
                /* Belum checkout dan berbayar */
                <div style={{ marginTop: "1rem" }}>
                  <MemberPayCertButton
                    registrationId={registrationId}
                    certPrice={certPrice}
                    className="btn btn-purple btn-block"
                  />
                  <p style={{ fontSize: "0.72rem", color: "#15803d", fontWeight: 600, textAlign: "center", marginTop: "0.5rem", lineHeight: 1.4 }}>
                    Sertifikat bersifat opsional untuk menutupi biaya operasional &amp; mendapatkan seluruh bonus materi.
                  </p>
                </div>
              ) : (
                /* Gratis klaim langsung */
                <div style={{ marginTop: "1rem" }}>
                  <ClaimCertButton registrationId={registrationId} />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
