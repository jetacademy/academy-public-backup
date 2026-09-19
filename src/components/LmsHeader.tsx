"use client";

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

        {/* Tombol Kurikulum Desktop (Toggle Sidebar) */}
        <button
          type="button"
          className={`lms-curriculum-btn desktop-only${sidebarOpen ? " active" : ""}`}
          onClick={onToggleSidebar}
          title={sidebarOpen ? "Sembunyikan daftar materi" : "Tampilkan daftar materi"}
        >
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="3" y1="6" x2="17" y2="6" />
            <line x1="3" y1="10" x2="17" y2="10" />
            <line x1="3" y1="14" x2="11" y2="14" />
          </svg>
          <span>Kurikulum</span>
        </button>

        {/* Tombol Kurikulum Mobile (Buka Drawer) */}
        <button
          type="button"
          className="lms-curriculum-btn mobile-only"
          onClick={onOpenDrawer}
          aria-label="Buka kurikulum materi"
        >
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="3" y1="6" x2="17" y2="6" />
            <line x1="3" y1="10" x2="17" y2="10" />
            <line x1="3" y1="14" x2="11" y2="14" />
          </svg>
          <span>Materi</span>
        </button>
      </div>
    </header>
  );
}
