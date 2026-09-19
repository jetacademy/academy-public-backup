"use client";

import { useState } from "react";
import Link from "next/link";
import LmsHeader from "./LmsHeader";
import LmsSidebar from "./LmsSidebar";

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

interface LmsViewContainerProps {
  programTitle: string;
  currentLessonTitle?: string;
  completedCount: number;
  totalLessons: number;
  progressPercent: number;
  prevLesson: { id: string; title: string } | null;
  nextLesson: { id: string; title: string } | null;
  registrationId: string;
  sidebarSections: Section[];
  currentLessonId: string;
  completedLessonIdsArr: string[];
  isAllDone: boolean;
  currentIndex: number;
  allLessonsCount: number;
  children: React.ReactNode;
}

export default function LmsViewContainer({
  programTitle,
  currentLessonTitle,
  completedCount,
  totalLessons,
  progressPercent,
  prevLesson,
  nextLesson,
  registrationId,
  sidebarSections,
  currentLessonId,
  completedLessonIdsArr,
  isAllDone,
  children,
}: LmsViewContainerProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="lms-app-layout">
      {/* Header Bersih */}
      <LmsHeader
        programTitle={programTitle}
        currentLessonTitle={currentLessonTitle}
        completedCount={completedCount}
        totalLessons={totalLessons}
        progressPercent={progressPercent}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        onOpenDrawer={() => setDrawerOpen(true)}
      />

      {/* Main Split-Pane */}
      <div className={`lms-main-split${!sidebarOpen ? " sidebar-hidden" : ""}`}>
        {/* Konten Utama Materi */}
        <main className="lms-content-scroll">
          <div className="lms-content-wrapper">
            {children}

            {/* Navigasi Sebelumnya / Berikutnya di Bawah Materi (Desktop & Tablet) */}
            {!isAllDone && (
              <nav className="lms-inline-nav" aria-label="Navigasi Materi">
                {prevLesson ? (
                  <Link
                    href={`/member/lms/${registrationId}?lessonId=${prevLesson.id}`}
                    className="lms-nav-card prev"
                  >
                    <span className="lms-nav-card-dir">← Sebelumnya</span>
                    <span className="lms-nav-card-title">{prevLesson.title}</span>
                  </Link>
                ) : (
                  <div className="lms-nav-card prev disabled">
                    <span className="lms-nav-card-dir">Mulai Belajar</span>
                    <span className="lms-nav-card-title">Materi Pertama</span>
                  </div>
                )}

                {nextLesson ? (
                  <Link
                    href={`/member/lms/${registrationId}?lessonId=${nextLesson.id}`}
                    className="lms-nav-card next"
                  >
                    <span className="lms-nav-card-dir">Berikutnya →</span>
                    <span className="lms-nav-card-title">{nextLesson.title}</span>
                  </Link>
                ) : (
                  <div className="lms-nav-card next disabled">
                    <span className="lms-nav-card-dir">Akhir Materi</span>
                    <span className="lms-nav-card-title">Materi Terakhir</span>
                  </div>
                )}
              </nav>
            )}
          </div>
        </main>

        {/* Sidebar Kurikulum Desktop */}
        <LmsSidebar
          sections={sidebarSections}
          currentLessonId={currentLessonId}
          completedLessonIds={completedLessonIdsArr}
          registrationId={registrationId}
          completedCount={completedCount}
          totalLessons={totalLessons}
          progressPercent={progressPercent}
          isAllDone={isAllDone}
        />
      </div>

      {/* Drawer Kurikulum Mobile (Single Source of Truth) */}
      <LmsSidebar
        sections={sidebarSections}
        currentLessonId={currentLessonId}
        completedLessonIds={completedLessonIdsArr}
        registrationId={registrationId}
        completedCount={completedCount}
        totalLessons={totalLessons}
        progressPercent={progressPercent}
        isAllDone={isAllDone}
        drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />

      {/* Mobile Bottom Bar — Simpel, Mudah Dipahami, Jelas */}
      <nav className="lms-mobile-bar" aria-label="Navigasi Bawah">
        {prevLesson ? (
          <Link
            href={`/member/lms/${registrationId}?lessonId=${prevLesson.id}`}
            className="lms-mob-bar-btn prev"
            title="Materi Sebelumnya"
          >
            ← Sblm
          </Link>
        ) : (
          <span className="lms-mob-bar-btn disabled">
            ← Sblm
          </span>
        )}

        <button
          type="button"
          className="lms-mob-bar-btn center"
          onClick={() => setDrawerOpen(true)}
          aria-label="Buka Kurikulum Materi"
        >
          Kurikulum · {progressPercent}%
        </button>

        {nextLesson ? (
          <Link
            href={`/member/lms/${registrationId}?lessonId=${nextLesson.id}`}
            className="lms-mob-bar-btn next"
            title="Materi Berikutnya"
          >
            Lanjut →
          </Link>
        ) : (
          <span className="lms-mob-bar-btn disabled">
            Lanjut →
          </span>
        )}
      </nav>
    </div>
  );
}
