"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { processWithdrawalPayout } from "@/app/webadmin/affiliate-actions";

/**
 * Tombol admin untuk mencairkan penarikan komisi SUNGGUHAN lewat Xendit Payout.
 * Klik ini mentransfer uang nyata — makanya ada konfirmasi 2 langkah (checkbox + tombol).
 */
export default function ProcessPayoutButton({
  withdrawalId,
  amountLabel,
  destinationLabel,
}: {
  withdrawalId: string;
  amountLabel: string;
  destinationLabel: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);
  const router = useRouter();

  const openModal = () => {
    setConfirmed(false);
    setError("");
    setIsOpen(true);
  };
  const closeModal = useCallback(() => {
    if (pending) return;
    setIsOpen(false);
  }, [pending]);

  const handleConfirm = async () => {
    if (!confirmed) {
      setError("Centang dulu kotak konfirmasi di atas.");
      return;
    }
    setError("");
    setPending(true);
    try {
      const res = await processWithdrawalPayout(withdrawalId);
      if (res.error) {
        setError(res.error);
        setPending(false);
        return;
      }
      setIsOpen(false);
      setPending(false);
      router.refresh();
    } catch {
      setError("Gagal memproses payout. Coba lagi.");
      setPending(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeModal]);

  useEffect(() => {
    if (!isOpen) return;
    const originalStyle = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = setTimeout(() => cancelButtonRef.current?.focus(), 50);
    return () => {
      document.body.style.overflow = originalStyle;
      clearTimeout(timer);
    };
  }, [isOpen]);

  return (
    <>
      <button type="button" className="btn btn-sm btn-purple" onClick={openModal} disabled={pending}>
        Proses via Xendit
      </button>

      {isOpen && createPortal(
        <div className="confirm-backdrop" onClick={closeModal}>
          <div className="confirm-card" onClick={(ev) => ev.stopPropagation()} role="dialog" aria-modal="true">
            <div className="confirm-icon-wrap">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>

            <h3 className="confirm-title">Cairkan Dana Sungguhan?</h3>
            <p className="confirm-desc">
              Tindakan ini akan mentransfer <strong>{amountLabel}</strong> ke <strong>{destinationLabel}</strong> lewat Xendit Payout — dana benar-benar keluar dan tidak bisa dibatalkan setelah diproses.
            </p>

            {error && <div className="form-error" role="alert" style={{ marginBottom: "0.8rem" }}>{error}</div>}

            <label style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", textAlign: "left", fontSize: "0.85rem", margin: "0.8rem 0" }}>
              <input type="checkbox" checked={confirmed} onChange={(ev) => setConfirmed(ev.target.checked)} style={{ marginTop: "0.2rem" }} />
              <span>Saya sudah memeriksa jumlah dan rekening/e-wallet tujuan di atas, dan yakin ingin melanjutkan transfer ini.</span>
            </label>

            <div className="confirm-actions">
              <button type="button" className="confirm-btn confirm-btn-cancel" onClick={closeModal} disabled={pending} ref={cancelButtonRef}>
                Batal
              </button>
              <button type="button" className="confirm-btn confirm-btn-danger" onClick={handleConfirm} disabled={pending || !confirmed}>
                {pending ? (
                  <>
                    <span className="confirm-spinner"></span>
                    Memproses...
                  </>
                ) : (
                  "Ya, Cairkan Sekarang"
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
