"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import ConfirmButton from "@/components/ConfirmButton";
import AdminLmsLessonList, { type LessonRow } from "./AdminLmsLessonList";
import { saveLmsModule, deleteLmsModule, deleteLmsModuleAction, reorderLmsModulesAction } from "@/app/webadmin/actions";

export type ModuleRow = {
  id: string;
  title: string;
  groupId: string | null;
  lessons: LessonRow[];
  batchLinks: { batchId: string }[];
};

export type GroupOption = { id: string; title: string };
export type BatchOption = { id: string; label: string };

interface AdminLmsModuleListProps {
  programId: string;
  groupId: string | null;
  initialModules: ModuleRow[];
  groupPrefix?: string;
  groups: GroupOption[];
  batches: BatchOption[];
}

export default function AdminLmsModuleList({
  programId,
  groupId: _groupId,
  initialModules,
  groupPrefix,
  groups,
  batches,
}: AdminLmsModuleListProps) {
  const [modules, setModules] = useState<ModuleRow[]>(initialModules);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setModules(initialModules);
  }, [initialModules]);

  const saveOrder = async (newModules: ModuleRow[]) => {
    setIsSaving(true);
    const orderedIds = newModules.map((m) => m.id);
    try {
      await reorderLmsModulesAction(programId, orderedIds);
    } catch (err) {
      console.error("Gagal menyimpan urutan modul:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const moveModule = (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= modules.length || fromIdx === toIdx) return;
    const updated = [...modules];
    const [moved] = updated.splice(fromIdx, 1);
    updated.splice(toIdx, 0, moved);
    setModules(updated);
    saveOrder(updated);
  };

  const handleDeleteModule = async (moduleId: string) => {
    const prev = modules;
    setModules(modules.filter((m) => m.id !== moduleId));
    const res = await deleteLmsModuleAction(programId, moduleId);
    if (!res.ok) setModules(prev);
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
      moveModule(draggingIdx, targetIdx);
    }
    setDraggingIdx(null);
    setDragOverIdx(null);
  };

  const handleDragEnd = () => {
    setDraggingIdx(null);
    setDragOverIdx(null);
  };

  if (modules.length === 0) {
    return null;
  }

  return (
    <div className="lms-modules-dnd-container">
      {isSaving && (
        <div className="lms-dnd-saving-badge">
          <span>Menyimpan urutan modul…</span>
        </div>
      )}

      {modules.map((mod, mIdx) => {
        const label = groupPrefix ? `${groupPrefix}${mIdx + 1}` : String(mIdx + 1);
        const isDragging = draggingIdx === mIdx;
        const isDragOver = dragOverIdx === mIdx && draggingIdx !== mIdx;

        return (
          <section
            key={mod.id}
            draggable
            onDragStart={(e) => {
              // Hanya mulai drag jika tidak sedang klik input/select/button
              const target = e.target as HTMLElement;
              if (target.closest("input, select, button, a")) {
                e.preventDefault();
                return;
              }
              handleDragStart(e, mIdx);
            }}
            onDragOver={(e) => handleDragOver(e, mIdx)}
            onDrop={(e) => handleDrop(e, mIdx)}
            onDragEnd={handleDragEnd}
            className={`lms-mod${isDragging ? " is-dragging" : ""}${isDragOver ? " is-drag-over" : ""}`}
          >
            <div className="lms-mod-head">
              <div className="lms-mod-head-top">
                {/* Drag Handle */}
                <span
                  className="lms-drag-handle lms-mod-drag-handle"
                  title="Klik dan geser untuk memindahkan urutan modul ini"
                  aria-label="Geser urutan modul"
                >
                  ⠿
                </span>

                <span className="mod-no">{label}</span>
                <span className="lms-mod-count">
                  {mod.lessons.length} materi
                </span>

                <div className="lms-mod-actions">
                  <button
                    type="button"
                    className="icon-btn"
                    disabled={mIdx === 0}
                    onClick={() => moveModule(mIdx, mIdx - 1)}
                    title="Geser ke atas"
                    aria-label="Geser ke atas"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    disabled={mIdx === modules.length - 1}
                    onClick={() => moveModule(mIdx, mIdx + 1)}
                    title="Geser ke bawah"
                    aria-label="Geser ke bawah"
                  >
                    ↓
                  </button>

                  <form action={deleteLmsModule}>
                    <input type="hidden" name="id" value={mod.id} />
                    <input type="hidden" name="programId" value={programId} />
                    <ConfirmButton
                      className="icon-btn danger"
                      title="Hapus modul"
                      message={`Hapus modul "${mod.title}" beserta ${mod.lessons.length} materinya? Progres belajar peserta pada modul ini ikut terhapus.`}
                      onConfirm={() => handleDeleteModule(mod.id)}
                    >
                      Hapus
                    </ConfirmButton>
                  </form>
                </div>
              </div>

              <form action={saveLmsModule} className="lms-mod-form">
                <input type="hidden" name="id" value={mod.id} />
                <input type="hidden" name="programId" value={programId} />
                <div className="lms-mod-title-row">
                  <input
                    name="title"
                    defaultValue={mod.title}
                    required
                    title="Klik untuk mengganti nama modul"
                    className="lms-mod-title-input"
                  />
                  <select
                    name="groupId"
                    defaultValue={mod.groupId ?? ""}
                    title="Pindahkan ke kelompok lain"
                    className="lms-mod-group-select"
                  >
                    <option value="">Tanpa kelompok</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>{g.title}</option>
                    ))}
                  </select>
                  <button type="submit" className="btn btn-sm btn-purple lms-mod-save-btn">Simpan</button>
                </div>

                <div className="lms-batch-selector">
                  <div style={{ display: "flex", alignItems: "center", gap: ".5rem", flexWrap: "wrap", width: "100%", marginBottom: ".2rem" }}>
                    <span className="lms-batch-label">Akses Batch:</span>
                    {batches.length > 0 && (
                      <>
                        {mod.batchLinks.length === 0 ? (
                          <span
                            className="lms-batch-status-badge empty"
                            title="Modul ini hanya dapat dilihat admin dan tersembunyi dari seluruh peserta"
                          >
                            🔒 Belum ada batch dipilih (hanya admin)
                          </span>
                        ) : mod.batchLinks.length === batches.length ? (
                          <span className="lms-batch-status-badge all">
                            ✓ Semua batch ({batches.length})
                          </span>
                        ) : (
                          <span className="lms-batch-status-badge partial">
                            ✓ {mod.batchLinks.length} dari {batches.length} batch dipilih
                          </span>
                        )}

                        <button
                          type="button"
                          className="lms-btn-batch-action"
                          onClick={(e) => {
                            const form = e.currentTarget.closest("form");
                            if (!form) return;
                            const cbs = form.querySelectorAll<HTMLInputElement>('input[name="batchIds"]');
                            const allChecked = Array.from(cbs).every((cb) => cb.checked);
                            cbs.forEach((cb) => {
                              cb.checked = !allChecked;
                            });
                          }}
                          title="Klik untuk memilih atau membatalkan semua batch sekaligus"
                        >
                          Pilih Semua / Batal
                        </button>

                        <button
                          type="submit"
                          className="btn btn-xs btn-purple"
                          style={{ fontSize: ".7rem", padding: ".15rem .6rem", height: "auto", marginLeft: "auto" }}
                          title="Simpan pengaturan batch modul ini"
                        >
                          Simpan Akses
                        </button>
                      </>
                    )}
                  </div>

                  {batches.length > 0 ? (
                    batches.map((b) => (
                      <label key={b.id} className="lms-batch-chip">
                        <input
                          type="checkbox"
                          name="batchIds"
                          value={b.id}
                          defaultChecked={mod.batchLinks.some((bl) => bl.batchId === b.id)}
                        />
                        <span>{b.label}</span>
                      </label>
                    ))
                  ) : (
                    <span style={{ fontSize: ".78rem", color: "var(--ink-faint)" }}>Belum ada batch/angkatan.</span>
                  )}
                </div>
              </form>
            </div>

            <div className="lms-lessons">
              <AdminLmsLessonList
                programId={programId}
                moduleId={mod.id}
                initialLessons={mod.lessons}
              />

              <div className="lms-add-lesson-btn-wrapper">
                <Link
                  href={`/webadmin/program/${programId}/lms/lesson/new?module=${mod.id}`}
                  className="btn btn-sm lms-add-lesson-btn"
                >
                  + Tambah Materi / Tes
                </Link>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
