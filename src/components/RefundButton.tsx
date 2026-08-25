"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { refundPayment } from "@/app/webadmin/actions";

/** Tombol admin untuk mencatat refund manual — memanggil refundPayment langsung (bukan lewat <form>). */
export default function RefundButton({
  registrationId,
  defaultAmount,
  className,
  title,
}: {
  registrationId: string;
  defaultAmount: number;
  className?: string;
  title?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [amount, setAmount] = useState(String(defaultAmount));
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);
  const router = useRouter();

  const openModal = () => {
    setAmount(String(defaultAmount));
    setReason("");
    setError("");
    setIsOpen(true);
  };

  const closeModal = useCallback(() => {
    if (pending) return;
    setIsOpen(false);
  }, [pending]);

  const handleConfirm = async () => {
    setError("");
    const numAmount = Number(amount.replace(/[^\d]/g, ""));
    if (!numAmount || numAmount <= 0) {
      setError("Jumlah refund harus lebih dari 0.");
      return;
    }
    if (!reason.trim()) {
      setError("Alasan refund wajib diisi.");
      return;
    }
    setPending(true);
    try {
      const res = await refundPayment(registrationId, numAmount, reason);
      if (res.error) {
        setError(res.error);
        setPending(false);
        return;
      }
      if (res.warning) {
        window.alert(res.warning);
      }
      setIsOpen(false);
      setPending(false);
      router.refresh();
    } catch {
      setError("Gagal memproses refund. Coba lagi.");
      setPending(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
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
      <button type="button" className={className} title={title} onClick={openModal} disabled={pending}>
        Refund
      </button>

      {isOpen && createPortal(
        <div className="confirm-backdrop" onClick={closeModal}>
          <div className="confirm-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="confirm-icon-wrap">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l-4-4m0 0l4-4m-4 4h11a4 4 0 010 8h-1" />
              </svg>
            </div>

            <h3 className="confirm-title">Catat Refund</h3>
            <p className="confirm-desc">
              Refund dicatat manual — pastikan dana sudah dikembalikan ke peserta secara terpisah (transfer/dashboard Xendit). Akses peserta akan otomatis dicabut.
            </p>

            {error && <div className="form-error" role="alert" style={{ marginBottom: "0.8rem" }}>{error}</div>}

            <div className="field" style={{ textAlign: "left" }}>
              <label>Jumlah Refund (Rp)</label>
              <input
                type="text"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={pending}
              />
            </div>
            <div className="field" style={{ textAlign: "left" }}>
              <label>Alasan Refund</label>
              <textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="cth: Peserta membatalkan, salah bayar, dll."
                disabled={pending}
              />
            </div>

            <div className="confirm-actions">
              <button type="button" className="confirm-btn confirm-btn-cancel" onClick={closeModal} disabled={pending} ref={cancelButtonRef}>
                Batal
              </button>
              <button type="button" className="confirm-btn confirm-btn-danger" onClick={handleConfirm} disabled={pending}>
                {pending ? (
                  <>
                    <span className="confirm-spinner"></span>
                    Memproses...
                  </>
                ) : (
                  "Ya, Catat Refund"
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
