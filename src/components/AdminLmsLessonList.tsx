"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import ConfirmButton from "@/components/ConfirmButton";
import { deleteLmsLesson, reorderLmsLessonsAction } from "@/app/webadmin/actions";

const TYPE_CHIP: Record<string, { cls: string; label: string }> = {
  VIDEO: { cls: "video", label: "Video" },
  TEXT: { cls: "text", label: "Teks" },
  PDF: { cls: "pdf", label: "PDF" },
  QUIZ: { cls: "quiz", label: "Kuis" },
};

export type LessonRow = {
  id: string;
  title: string;
  type: string;
  duration: string;
  isPreview: boolean;
  passingScore: number | null;
  _count: { questions: number };
};

interface AdminLmsLessonListProps {
  programId: string;
  moduleId: string;
  initialLessons: LessonRow[];
}

export default function AdminLmsLessonList({
  programId,
  moduleId,
  initialLessons,
}: AdminLmsLessonListProps) {
  const [lessons, setLessons] = useState<LessonRow[]>(initialLessons);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Sync jika initialLessons berubah dari server
  useEffect(() => {
    setLessons(initialLessons);
  }, [initialLessons]);

  const saveOrder = async (newLessons: LessonRow[]) => {
    setIsSaving(true);
    const orderedIds = newLessons.map((l) => l.id);
    try {
      await reorderLmsLessonsAction(programId, orderedIds);
    } catch (err) {
      console.error("Gagal menyimpan urutan materi:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const moveItem = (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= lessons.length || fromIdx === toIdx) return;
    const updated = [...lessons];
    const [moved] = updated.splice(fromIdx, 1);
    updated.splice(toIdx, 0, moved);
    setLessons(updated);
    saveOrder(updated);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggingIdx(index);
    e.dataTransfer.setData("text/plain", index.toString());
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverIdx !== index) {
      setDragOverIdx(index);
    }
  };

  const handleDrop = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    if (draggingIdx !== null && draggingIdx !== targetIdx) {
      moveItem(draggingIdx, targetIdx);
    }
    setDraggingIdx(null);
    setDragOverIdx(null);
  };

  const handleDragEnd = () => {
    setDraggingIdx(null);
    setDragOverIdx(null);
  };

  if (lessons.length === 0) {
    return (
      <p style={{ fontSize: ".8rem", color: "var(--ink-faint)", fontStyle: "italic", padding: ".6rem .8rem", margin: 0 }}>
        Belum ada materi di modul ini.
      </p>
    );
  }

  return (
    <div className="lms-lessons-dnd-list">
      {isSaving && (
        <div className="lms-dnd-saving-badge">
          <span>Menyimpan urutan materi…</span>
        </div>
      )}

      {lessons.map((les, lesIdx) => {
        const chip = TYPE_CHIP[les.type] ?? TYPE_CHIP.VIDEO;
        const isDragging = draggingIdx === lesIdx;
        const isDragOver = dragOverIdx === lesIdx && draggingIdx !== lesIdx;

        return (
          <div
            key={les.id}
            draggable
            onDragStart={(e) => handleDragStart(e, lesIdx)}
            onDragOver={(e) => handleDragOver(e, lesIdx)}
            onDrop={(e) => handleDrop(e, lesIdx)}
            onDragEnd={handleDragEnd}
            className={`lms-lesson-item${isDragging ? " is-dragging" : ""}${isDragOver ? " is-drag-over" : ""}`}
          >
            {/* Handle Drag */}
            <span
              className="lms-drag-handle"
              title="Klik dan geser untuk memindahkan urutan materi"
              aria-label="Geser urutan"
            >
              ⠿
            </span>

            <div className="lms-lesson-main">
              <div className="lms-lesson-meta-top">
                <span className={`type-chip ${chip.cls}`}>{chip.label}</span>
                {les.isPreview && <span className="badge" style={{ fontSize: ".62rem" }}>Preview Gratis</span>}
                {les.type === "QUIZ" && (
                  <span className="l-meta">{les._count.questions} soal</span>
                )}
                {les.duration && <span className="l-meta">{les.duration}</span>}
              </div>
              <Link
                href={`/webadmin/program/${programId}/lms/lesson/${les.id}`}
                className="lms-lesson-title"
                title="Klik untuk mengedit materi"
              >
                {les.title}
              </Link>
            </div>

            <div className="lms-lesson-actions">
              <div className="lms-lesson-reorder">
                <button
                  type="button"
                  className="icon-btn"
                  disabled={lesIdx === 0}
                  onClick={() => moveItem(lesIdx, lesIdx - 1)}
                  title="Geser ke atas"
                  aria-label="Geser ke atas"
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  disabled={lesIdx === lessons.length - 1}
                  onClick={() => moveItem(lesIdx, lesIdx + 1)}
                  title="Geser ke bawah"
                  aria-label="Geser ke bawah"
                >
                  ↓
                </button>
              </div>

              <div className="lms-lesson-ops">
                <Link href={`/webadmin/program/${programId}/lms/lesson/${les.id}`} className="btn btn-sm lms-btn-edit">
                  Edit
                </Link>
                <form action={deleteLmsLesson}>
                  <input type="hidden" name="id" value={les.id} />
                  <input type="hidden" name="programId" value={programId} />
                  <ConfirmButton className="icon-btn danger" title="Hapus materi" message={`Hapus materi "${les.title}"?`}>
                    Hapus
                  </ConfirmButton>
                </form>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
