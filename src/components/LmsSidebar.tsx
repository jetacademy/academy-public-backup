"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

type Lesson = {
  id: string;
  title: string;
  type: string;
  duration: string | null;
};

type Module = {
  id: string;
  title: string;
  lessons: Lesson[];
};

type Section = {
  title: string | null;
  modules: Module[];
};

const TYPE_LABEL: Record<string, string> = {
  VIDEO: "Video",
  TEXT: "Teks",
  PDF: "PDF",
  QUIZ: "Kuis",
};

interface LmsSidebarProps {
  sections: Section[];
  currentLessonId: string;
  completedLessonIds: string[];
  registrationId: string;
  completedCount: number;
  totalLessons: number;
  progressPercent: number;
  isAllDone: boolean;
  drawer?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
}

export default function LmsSidebar({
  sections,
  currentLessonId,
  completedLessonIds,
  registrationId,
  completedCount,
  totalLessons,
  progressPercent,
  isAllDone,
  drawer = false,
  isOpen = false,
  onClose,
}: LmsSidebarProps) {
  const completedSet = new Set(completedLessonIds);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Lock scroll saat drawer mobile terbuka
  useEffect(() => {
    if (!drawer) return;
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen, drawer]);

  // Pure immutable module numbering to satisfy react-hooks/immutability
  const sectionsWithModIndex = sections.reduce<
    { title: string | null; modules: (Module & { moduleNo: number })[] }[]
  >((acc, section) => {
    const prevCount = acc.reduce((sum, item) => sum + item.modules.length, 0);
    const modules = section.modules.map((mod, mIdx) => ({
      ...mod,
      moduleNo: prevCount + mIdx + 1,
    }));
    acc.push({ title: section.title, modules });
    return acc;
  }, []);

  const content = (
    <>
      {/* Progress bar ringkas */}
      <div className="lms-side-progress-box">
        <div className="lms-side-progress-row">
          <span className="lms-side-progress-label">Progres Belajar</span>
          <span className="lms-side-progress-val">
            {completedCount}/{totalLessons} ({progressPercent}%)
          </span>
        </div>
        <div className="lms-side-progress-track">
          <div
            className="lms-side-progress-bar"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Daftar Modul & Materi */}
      <div className="lms-curriculum-list">
        {sectionsWithModIndex.map((section, sIdx) => (
          <div key={sIdx} className="lms-section-group">
            {section.title && (
              <div className="lms-section-title">
                {section.title}
              </div>
            )}

            {section.modules.map((mod) => {
              return (
                <div key={mod.id} className="lms-module-card">
                  <div className="lms-module-header">
                    <span className="lms-module-num">Modul {mod.moduleNo}</span>
                    <h3 className="lms-module-title">{mod.title}</h3>
                  </div>

                  {mod.lessons.length === 0 ? (
                    <div className="lms-empty-lesson-notice">
                      Belum ada materi
                    </div>
                  ) : (
                    <div className="lms-module-lesson-list">
                      {mod.lessons.map((les) => {
                        const isActive = les.id === currentLessonId && !isAllDone;
                        const isDone = completedSet.has(les.id);

                        return (
                          <Link
                            key={les.id}
                            href={`/member/lms/${registrationId}?lessonId=${les.id}`}
                            onClick={onClose}
                            className={`lms-nav-lesson-row${isActive ? " is-active" : ""}${isDone ? " is-done" : ""}`}
                          >
                            {/* Indikator Status Simpel */}
                            <span className="lms-nav-status" aria-hidden="true">
                              {isDone ? (
                                <span className="lms-check-icon">✓</span>
                              ) : isActive ? (
                                <span className="lms-active-dot" />
                              ) : (
                                <span className="lms-pending-dot" />
                              )}
                            </span>

                            {/* Teks Materi & Meta */}
                            <div className="lms-nav-lesson-info">
                              <span className="lms-nav-lesson-title">
                                {les.title}
                              </span>
                              <span className="lms-nav-lesson-meta">
                                {TYPE_LABEL[les.type] ?? les.type}
                                {les.duration ? ` · ${les.duration}` : ""}
                              </span>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );

  // Versi Drawer Mobile
  if (drawer) {
    return (
      <>
        <div
          className={`lms-drawer-backdrop${isOpen ? " is-open" : ""}`}
          onClick={onClose}
          aria-hidden="true"
        />
        <div
          ref={drawerRef}
          className={`lms-mobile-drawer${isOpen ? " is-open" : ""}`}
          role="dialog"
          aria-modal="true"
          aria-label="Kurikulum Kelas"
        >
          <div className="lms-drawer-topbar">
            <div>
              <h2 className="lms-drawer-heading">Kurikulum Materi</h2>
              <span className="lms-drawer-sub">
                {completedCount} dari {totalLessons} materi selesai
              </span>
            </div>
            <button
              type="button"
              className="lms-drawer-close-btn"
              onClick={onClose}
              aria-label="Tutup daftar materi"
            >
              ✕
            </button>
          </div>
          <div className="lms-drawer-content">
            {content}
          </div>
        </div>
      </>
    );
  }

  // Versi Sidebar Desktop
  return (
    <aside className="lms-sidebar-pane" aria-label="Daftar Materi">
      <div className="lms-sidebar-top">
        <h2 className="lms-sidebar-title">Kurikulum</h2>
        <span className="lms-sidebar-sub">
          {completedCount} dari {totalLessons} selesai
        </span>
      </div>
      {content}
    </aside>
  );
}
