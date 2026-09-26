"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface LmsHeaderProps {
  programTitle: string;
  currentLessonTitle?: string;
  completedCount: number;
  totalLessons: number;
  progressPercent: number;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onOpenDrawer: () => void;
}

export default function LmsHeader({
  programTitle,
  currentLessonTitle,
  completedCount,
  totalLessons,
  progressPercent,
  sidebarOpen,
  onToggleSidebar,
  onOpenDrawer,
}: LmsHeaderProps) {
  const [showCallout, setShowCallout] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    try {
      const seen = localStorage.getItem("lms_materi_tooltip_seen_v1");
      if (!seen) {
        const timer = setTimeout(() => {
          setShowCallout(true);
        }, 400);
        return () => clearTimeout(timer);
      }
    } catch {
      // Abaikan jika localStorage tidak diizinkan di browser private
    }
  }, []);

  const handleDismissCallout = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setShowCallout(false);
    try {
      localStorage.setItem("lms_materi_tooltip_seen_v1", "1");
    } catch {}
  };

  const handleMateriClick = (action: () => void) => {
    handleDismissCallout();
    action();
  };

  return (
    <header className="lms-header">
      {/* Kiri: Back to Dashboard + Judul Program & Materi */}
      <div className="lms-header-left">
        <Link
          href="/member"
          className="lms-back-link"
          title="Kembali ke Dashboard Member"
        >
          <span className="lms-back-arrow" aria-hidden="true">←</span>
          <span className="lms-back-text">Dashboard</span>
        </Link>

        <div className="lms-header-divider" aria-hidden="true" />

        <div className="lms-header-title-box">
          <span className="lms-header-prog-name">{programTitle}</span>
          <h1 className="lms-header-lesson-name">
            {currentLessonTitle || "Kurikulum Belajar"}
          </h1>
        </div>
      </div>

      {/* Kanan: Progress Bar Ringkas + Tombol Buka Kurikulum */}
      <div className="lms-header-right">
        {/* Progress ringkas */}
        <div className="lms-header-progress" title={`Progres: ${completedCount} dari ${totalLessons} materi (${progressPercent}%)`}>
          <div className="lms-header-progress-bar">
            <div
              className="lms-header-progress-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="lms-header-progress-text">
            {completedCount}/{totalLessons} ({progressPercent}%)
          </span>
        </div>

        {/* Anchor Tombol Materi & Tooltip */}
        <div
          className="lms-curriculum-anchor"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Tombol Kurikulum Desktop (Toggle Sidebar) */}
          <button
            type="button"
            className={`lms-curriculum-btn desktop-only${sidebarOpen ? " active" : ""}`}
            onClick={() => handleMateriClick(onToggleSidebar)}
            aria-label="Buka atau tutup daftar materi"
            title={sidebarOpen ? "Sembunyikan daftar materi" : "Tampilkan daftar materi"}
          >
            <span className="lms-btn-ping" aria-hidden="true">
              <span className="lms-btn-ping-dot" />
            </span>
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="3" y1="6" x2="17" y2="6" />
              <line x1="3" y1="10" x2="17" y2="10" />
              <line x1="3" y1="14" x2="11" y2="14" />
            </svg>
            <span>Materi</span>
          </button>

          {/* Tombol Kurikulum Mobile (Buka Drawer) */}
          <button
            type="button"
            className="lms-curriculum-btn mobile-only standout"
            onClick={() => handleMateriClick(onOpenDrawer)}
            aria-label="Buka daftar materi pembelajaran"
          >
            <span className="lms-btn-ping" aria-hidden="true">
              <span className="lms-btn-ping-dot" />
            </span>
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="3" y1="6" x2="17" y2="6" />
              <line x1="3" y1="10" x2="17" y2="10" />
              <line x1="3" y1="14" x2="11" y2="14" />
            </svg>
            <span>Materi</span>
          </button>

          {/* Tooltips & Callout Buka Materi */}
          {(showCallout || isHovered) && (
            <div
              className={`lms-materi-callout${showCallout ? " is-callout" : " is-hover"}`}
              role="tooltip"
              onClick={() => handleMateriClick(onOpenDrawer)}
            >
              <div className="lms-materi-callout-arrow" aria-hidden="true" />
              <div className="lms-materi-callout-content">
                <div className="lms-materi-callout-header">
                  <span className="lms-materi-callout-badge">
                    <span className="lms-materi-callout-icon" aria-hidden="true">📚</span>
                    <span>Akses Materi</span>
                  </span>
                  {showCallout && (
                    <button
                      type="button"
                      className="lms-materi-callout-close"
                      onClick={handleDismissCallout}
                      aria-label="Tutup petunjuk"
                      title="Tutup petunjuk"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <p className="lms-materi-callout-text">
                  Klik di sini untuk melihat <strong>seluruh daftar materi</strong> &amp; bab kelas.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
