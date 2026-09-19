"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useFormStatus } from "react-dom";

/** Tombol submit dengan konfirmasi kustom premium — mencegah hapus tak sengaja. */
export default function ConfirmButton({
  message,
  className,
  title,
  disabled,
  onConfirm,
  children,
}: {
  message: string;
  className?: string;
  title?: string;
  disabled?: boolean;
  onConfirm?: () => Promise<void> | void;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [wasPending, setWasPending] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);

  const { pending: formPending } = useFormStatus();
  const pending = formPending || isProcessing;

  const openModal = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    formRef.current = e.currentTarget.closest("form");
    setIsOpen(true);
  };

  const closeModal = useCallback(() => {
    if (pending) return;
    setIsOpen(false);
  }, [pending]);

  const handleConfirm = async () => {
    if (onConfirm) {
      try {
        setIsProcessing(true);
        await onConfirm();
        setIsOpen(false);
      } catch (err) {
        console.error("[ConfirmButton] Error executing onConfirm:", err);
      } finally {
        setIsProcessing(false);
      }
      return;
    }
    if (!formRef.current) return;
    formRef.current.requestSubmit();
  };

  // Tutup otomatis setelah pengiriman selesai (dari true ke false)
  if (pending && !wasPending) {
    setWasPending(true);
  } else if (!pending && wasPending) {
    setWasPending(false);
    setIsOpen(false);
  }

  // Tutup dengan ESC
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeModal();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeModal]);

  // Lock scroll dan auto-focus batal
  useEffect(() => {
    if (!isOpen) return;
    const originalStyle = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    
    // Beri fokus ke tombol batal untuk keamanan
    const timer = setTimeout(() => {
      cancelButtonRef.current?.focus();
    }, 50);

    return () => {
      document.body.style.overflow = originalStyle;
      clearTimeout(timer);
    };
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        className={className}
        title={title}
        onClick={openModal}
        disabled={disabled || pending}
      >
        {children}
      </button>

      {isOpen && createPortal(
        <div className="confirm-backdrop" onClick={closeModal}>
          <div 
            className="confirm-card" 
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="confirm-icon-wrap">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            
            <h3 className="confirm-title">Konfirmasi Hapus</h3>
            <p className="confirm-desc">{message || "Apakah Anda yakin ingin menghapus data ini? Tindakan ini tidak dapat dibatalkan."}</p>
            
            <div className="confirm-actions">
              <button
                type="button"
                className="confirm-btn confirm-btn-cancel"
                onClick={closeModal}
                disabled={pending}
                ref={cancelButtonRef}
              >
                Batal
              </button>
              <button
                type="button"
                className="confirm-btn confirm-btn-danger"
                onClick={handleConfirm}
                disabled={pending}
              >
                {pending ? (
                  <>
                    <span className="confirm-spinner"></span>
                    Menghapus...
                  </>
                ) : (
                  "Ya, Hapus"
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
