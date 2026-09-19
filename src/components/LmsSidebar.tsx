"use client";

import { useEffect, useRef, useState, useMemo } from "react";
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

function highlightMatch(text: string, query: string) {
  if (!query) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={i} className="lms-highlight">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

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
  const [searchQuery, setSearchQuery] = useState("");
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
  const sectionsWithModIndex = useMemo(() => {
    return sections.reduce<
      { title: string | null; modules: (Module & { moduleNo: number })[] }[]
    >((acc, section) => {
      // Hanya kelompok yang memiliki modul yang disertakan
      if (section.modules.length === 0) return acc;

      const prevCount = acc.reduce((sum, item) => sum + item.modules.length, 0);
      const modules = section.modules.map((mod, mIdx) => ({
        ...mod,
        moduleNo: prevCount + mIdx + 1,
      }));
      acc.push({ title: section.title, modules });
      return acc;
    }, []);
  }, [sections]);

  const query = searchQuery.trim().toLowerCase();

  const filteredSections = useMemo(() => {
    if (!query) return sectionsWithModIndex;

    return sectionsWithModIndex
      .map((section) => {
        const sectionMatches = section.title?.toLowerCase().includes(query);
        const filteredModules = section.modules
          .map((mod) => {
            const moduleMatches = mod.title.toLowerCase().includes(query);
            const matchingLessons = mod.lessons.filter(
              (l) => l.title.toLowerCase().includes(query) || (l.duration && l.duration.toLowerCase().includes(query))
            );

            if (moduleMatches) {
              return mod;
            } else if (matchingLessons.length > 0) {
              return { ...mod, lessons: matchingLessons };
            }
            return sectionMatches ? mod : null;
          })
          .filter((m): m is Module & { moduleNo: number } => m !== null);

        if (filteredModules.length > 0) {
          return { title: section.title, modules: filteredModules };
        }
        return null;
      })
      .filter((s): s is { title: string | null; modules: (Module & { moduleNo: number })[] } => s !== null);
  }, [sectionsWithModIndex, query]);

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

      {/* Kolom Pencarian Materi & Modul */}
      <div className="lms-side-search-box">
        <span className="lms-side-search-icon" aria-hidden="true">🔍</span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari materi atau modul…"
          className="lms-side-search-input"
          aria-label="Cari materi atau modul"
        />
        {searchQuery && (
          <button
            type="button"
            className="lms-side-search-clear"
            onClick={() => setSearchQuery("")}
            title="Hapus pencarian"
            aria-label="Hapus pencarian"
          >
            ✕
          </button>
        )}
      </div>

      {/* Notifikasi Hasil Pencarian Kosong */}
      {query && filteredSections.length === 0 && (
        <div className="lms-side-search-empty">
          <p style={{ margin: "0 0 0.5rem", fontSize: "0.85rem", color: "var(--ink-soft)" }}>
            Tidak ada materi untuk kata kunci <strong>&ldquo;{searchQuery}&rdquo;</strong>.
          </p>
          <button
            type="button"
            className="btn btn-sm btn-line"
            style={{ fontSize: "0.76rem", padding: "0.25rem 0.6rem" }}
            onClick={() => setSearchQuery("")}
          >
            Reset Pencarian
          </button>
        </div>
      )}

      {/* Daftar Modul & Materi */}
      <div className="lms-curriculum-list">
        {filteredSections.map((section, sIdx) => (
          <div key={sIdx} className="lms-section-group">
            {section.title && (
              <div className="lms-section-title">
                {highlightMatch(section.title, query)}
              </div>
            )}

            {section.modules.map((mod) => {
              return (
                <div key={mod.id} className="lms-module-card">
                  <div className="lms-module-header">
                    <span className="lms-module-num">Modul {mod.moduleNo}</span>
                    <h3 className="lms-module-title">
                      {highlightMatch(mod.title, query)}
                    </h3>
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
                                {highlightMatch(les.title, query)}
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
