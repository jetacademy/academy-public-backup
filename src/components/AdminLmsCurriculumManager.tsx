"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import ConfirmButton from "@/components/ConfirmButton";
import {
  saveLmsGroup,
  deleteLmsGroup,
  deleteLmsGroupAction,
  moveLmsGroup,
  saveLmsModule,
  deleteLmsModule,
  deleteLmsModuleAction,
  reorderLmsModulesAction,
  deleteLmsLesson,
  deleteLmsLessonAction,
  moveLmsLessonAction,
} from "@/app/webadmin/actions";

const TYPE_CHIP: Record<string, { cls: string; label: string }> = {
  VIDEO: { cls: "video", label: "Video" },
  TEXT: { cls: "text", label: "Teks" },
  PDF: { cls: "pdf", label: "PDF" },
  QUIZ: { cls: "quiz", label: "Kuis" },
};

export type LessonRow = {
  id: string;
  moduleId?: string;
  title: string;
  type: string;
  duration: string;
  isPreview: boolean;
  passingScore: number | null;
  _count: { questions: number };
};

export type ModuleRow = {
  id: string;
  title: string;
  groupId: string | null;
  lessons: LessonRow[];
  batchLinks: { batchId: string }[];
};

export type GroupRow = {
  id: string;
  title: string;
  order: number;
  modules: ModuleRow[];
};

export type GroupOption = { id: string; title: string };
export type BatchOption = { id: string; label: string };

interface AdminLmsCurriculumManagerProps {
  programId: string;
  initialGroups: GroupRow[];
  initialOrphanModules: ModuleRow[];
  groupOptions: GroupOption[];
  batchOptions: BatchOption[];
}

type ActiveLessonDrag = {
  lessonId: string;
  sourceModuleId: string;
  lesson: LessonRow;
};

type LessonDropTarget = {
  moduleId: string;
  index: number;
  position: "before" | "after" | "end" | "empty";
};

type ActiveModuleDrag = {
  moduleId: string;
  groupId: string | null;
  index: number;
};

export default function AdminLmsCurriculumManager({
  programId,
  initialGroups,
  initialOrphanModules,
  groupOptions,
  batchOptions,
}: AdminLmsCurriculumManagerProps) {
  const [groups, setGroups] = useState<GroupRow[]>(initialGroups);
  const [orphanModules, setOrphanModules] = useState<ModuleRow[]>(initialOrphanModules);

  // Drag states
  const [activeLessonDrag, setActiveLessonDrag] = useState<ActiveLessonDrag | null>(null);
  const [lessonDropTarget, setLessonDropTarget] = useState<LessonDropTarget | null>(null);
  const [hoveredModuleId, setHoveredModuleId] = useState<string | null>(null);

  const [activeModuleDrag, setActiveModuleDrag] = useState<ActiveModuleDrag | null>(null);
  const [moduleDragOverIdx, setModuleDragOverIdx] = useState<{ groupId: string | null; index: number } | null>(null);

  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Collapse / Expand state (hide/show)
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [collapsedModules, setCollapsedModules] = useState<Record<string, boolean>>({});

  const storageKey = `admin_lms_collapse_${programId}`;

  // Hydrate collapse state dari localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.groups) setCollapsedGroups(parsed.groups);
        if (parsed.modules) setCollapsedModules(parsed.modules);
      }
    } catch {
      // ignore localStorage errors
    }
  }, [storageKey]);

  const saveCollapseState = (
    newGroups: Record<string, boolean>,
    newModules: Record<string, boolean>
  ) => {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ groups: newGroups, modules: newModules })
      );
    } catch {
      // ignore
    }
  };

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = { ...prev, [groupId]: !prev[groupId] };
      saveCollapseState(next, collapsedModules);
      return next;
    });
  };

  const toggleModule = (moduleId: string) => {
    setCollapsedModules((prev) => {
      const next = { ...prev, [moduleId]: !prev[moduleId] };
      saveCollapseState(collapsedGroups, next);
      return next;
    });
  };

  const collapseAll = () => {
    const allG: Record<string, boolean> = {};
    groups.forEach((g) => {
      allG[g.id] = true;
    });
    const allM: Record<string, boolean> = {};
    groups.forEach((g) => {
      g.modules.forEach((m) => {
        allM[m.id] = true;
      });
    });
    orphanModules.forEach((m) => {
      allM[m.id] = true;
    });
    setCollapsedGroups(allG);
    setCollapsedModules(allM);
    saveCollapseState(allG, allM);
  };

  const expandAll = () => {
    setCollapsedGroups({});
    setCollapsedModules({});
    saveCollapseState({}, {});
  };

  // Simpan ref state sebelum drag untuk rollback jika gagal
  const previousStateRef = useRef<{ groups: GroupRow[]; orphanModules: ModuleRow[] }>({
    groups: initialGroups,
    orphanModules: initialOrphanModules,
  });

  // Sync dengan props saat data dari server berubah
  useEffect(() => {
    setGroups(initialGroups);
    setOrphanModules(initialOrphanModules);
  }, [initialGroups, initialOrphanModules]);

  // Helper untuk mencari modul di state
  const findModule = (moduleId: string): { module: ModuleRow; groupId: string | null } | null => {
    for (const g of groups) {
      const m = g.modules.find((mod) => mod.id === moduleId);
      if (m) return { module: m, groupId: g.id };
    }
    const om = orphanModules.find((mod) => mod.id === moduleId);
    if (om) return { module: om, groupId: null };
    return null;
  };

  // ─────────────────────────────────────────────────────────────
  // LESSON DRAG & DROP (Bisa pindah antar modul dan antar kelompok)
  // ─────────────────────────────────────────────────────────────

  const handleLessonDragStart = (
    e: React.DragEvent,
    lesson: LessonRow,
    sourceModuleId: string
  ) => {
    e.stopPropagation();
    const dragData: ActiveLessonDrag = {
      lessonId: lesson.id,
      sourceModuleId,
      lesson,
    };
    setActiveLessonDrag(dragData);
    e.dataTransfer.setData("application/json", JSON.stringify(dragData));
    e.dataTransfer.setData("text/plain", lesson.id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleLessonDragOverItem = (
    e: React.DragEvent,
    targetModuleId: string,
    targetIndex: number
  ) => {
    if (!activeLessonDrag) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const isAfter = e.clientY > midY;
    const computedIndex = isAfter ? targetIndex + 1 : targetIndex;

    setHoveredModuleId(targetModuleId);
    setLessonDropTarget({
      moduleId: targetModuleId,
      index: computedIndex,
      position: isAfter ? "after" : "before",
    });
  };

  const handleLessonDragOverModuleFooter = (
    e: React.DragEvent,
    targetModuleId: string,
    lessonCount: number
  ) => {
    if (!activeLessonDrag) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";

    setHoveredModuleId(targetModuleId);
    setLessonDropTarget({
      moduleId: targetModuleId,
      index: lessonCount,
      position: lessonCount === 0 ? "empty" : "end",
    });
  };

  const handleLessonDrop = async (e: React.DragEvent, targetModuleId: string) => {
    e.preventDefault();
    e.stopPropagation();

    let dragData = activeLessonDrag;
    if (!dragData) {
      try {
        const raw = e.dataTransfer.getData("application/json");
        if (raw) dragData = JSON.parse(raw);
      } catch {
        // ignore
      }
    }

    if (!dragData) {
      resetLessonDrag();
      return;
    }

    const { lessonId, sourceModuleId, lesson } = dragData;
    const dropTarget = lessonDropTarget;
    const targetIdx = dropTarget && dropTarget.moduleId === targetModuleId ? dropTarget.index : undefined;

    // Cek jika posisi sama persis
    if (sourceModuleId === targetModuleId) {
      const sourceModInfo = findModule(sourceModuleId);
      if (sourceModInfo) {
        const currentIdx = sourceModInfo.module.lessons.findIndex((l) => l.id === lessonId);
        if (targetIdx !== undefined && (currentIdx === targetIdx || (currentIdx === targetIdx - 1 && dropTarget?.position === "after"))) {
          resetLessonDrag();
          return;
        }
      }
    }

    // Simpan snapshot untuk kemungkinan rollback
    previousStateRef.current = { groups, orphanModules };

    // OPTIMISTIC UPDATE
    const newGroups = groups.map((g) => ({
      ...g,
      modules: g.modules.map((m) => ({
        ...m,
        lessons: [...m.lessons],
      })),
    }));

    const newOrphans = orphanModules.map((m) => ({
      ...m,
      lessons: [...m.lessons],
    }));

    const getAllModules = () => {
      const list: ModuleRow[] = [];
      newGroups.forEach((g) => list.push(...g.modules));
      list.push(...newOrphans);
      return list;
    };

    const allMods = getAllModules();
    const srcMod = allMods.find((m) => m.id === sourceModuleId);
    const tgtMod = allMods.find((m) => m.id === targetModuleId);

    if (!srcMod || !tgtMod) {
      resetLessonDrag();
      return;
    }

    // 1. Ambil & hapus dari modul asal
    const srcIdx = srcMod.lessons.findIndex((l) => l.id === lessonId);
    let movingLesson = lesson;
    if (srcIdx !== -1) {
      const [removed] = srcMod.lessons.splice(srcIdx, 1);
      if (removed) movingLesson = removed;
    }

    // 2. Sisipkan ke modul tujuan
    let finalInsertIdx = targetIdx !== undefined ? targetIdx : tgtMod.lessons.length;
    // Koreksi jika di modul yang sama dan ditarik ke bawah
    if (sourceModuleId === targetModuleId && srcIdx !== -1 && srcIdx < finalInsertIdx) {
      finalInsertIdx = Math.max(0, finalInsertIdx - 1);
    }
    finalInsertIdx = Math.max(0, Math.min(finalInsertIdx, tgtMod.lessons.length));
    tgtMod.lessons.splice(finalInsertIdx, 0, { ...movingLesson, moduleId: targetModuleId });

    // Update state reaktif
    setGroups(newGroups);
    setOrphanModules(newOrphans);
    resetLessonDrag();

    // Feedback pesan
    const targetGroupName = groups.find((g) => g.modules.some((m) => m.id === targetModuleId))?.title ?? "Modul Tanpa Kelompok";
    setStatusMessage(`Memindahkan materi ke ${tgtMod.title} (${targetGroupName})…`);
    setErrorMessage(null);

    // Jalankan Server Action
    try {
      const res = await moveLmsLessonAction(programId, lessonId, targetModuleId, finalInsertIdx);
      if (!res.ok) {
        throw new Error(res.error || "Gagal memindahkan materi");
      }
      setTimeout(() => setStatusMessage(null), 2500);
    } catch (err: any) {
      console.error("[handleLessonDrop] Error:", err);
      // Rollback
      setGroups(previousStateRef.current.groups);
      setOrphanModules(previousStateRef.current.orphanModules);
      setErrorMessage(err?.message || "Gagal memindahkan materi. Posisi dikembalikan.");
      setStatusMessage(null);
    }
  };

  const resetLessonDrag = () => {
    setActiveLessonDrag(null);
    setLessonDropTarget(null);
    setHoveredModuleId(null);
  };

  // ─────────────────────────────────────────────────────────────
  // MODULE REORDERING (Drag & Drop urutan modul dalam grup / list)
  // ─────────────────────────────────────────────────────────────

  const handleModuleDragStart = (e: React.DragEvent, moduleId: string, groupId: string | null, index: number) => {
    // Jangan drag modul jika mengklik input / button / link / lesson
    const target = e.target as HTMLElement;
    if (target.closest("input, select, button, a, .lms-lesson-item, .lms-lessons")) {
      e.preventDefault();
      return;
    }
    setActiveModuleDrag({ moduleId, groupId, index });
    e.dataTransfer.setData("text/plain", moduleId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleModuleDragOver = (e: React.DragEvent, groupId: string | null, index: number) => {
    if (!activeModuleDrag || activeLessonDrag) return;
    if (activeModuleDrag.groupId !== groupId) return; // Hanya reorder dalam grup yang sama
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

    if (!moduleDragOverIdx || moduleDragOverIdx.index !== index || moduleDragOverIdx.groupId !== groupId) {
      setModuleDragOverIdx({ groupId, index });
    }
  };

  const handleModuleDrop = async (e: React.DragEvent, groupId: string | null, targetIdx: number) => {
    if (!activeModuleDrag || activeLessonDrag) return;
    if (activeModuleDrag.groupId !== groupId) return;
    e.preventDefault();

    const fromIdx = activeModuleDrag.index;
    if (fromIdx === targetIdx) {
      resetModuleDrag();
      return;
    }

    if (groupId) {
      const gIdx = groups.findIndex((g) => g.id === groupId);
      if (gIdx === -1) return;
      const updatedMods = [...groups[gIdx].modules];
      const [moved] = updatedMods.splice(fromIdx, 1);
      updatedMods.splice(targetIdx, 0, moved);

      const nextGroups = [...groups];
      nextGroups[gIdx] = { ...nextGroups[gIdx], modules: updatedMods };
      setGroups(nextGroups);
      resetModuleDrag();

      setStatusMessage("Menyimpan urutan modul…");
      try {
        await reorderLmsModulesAction(programId, updatedMods.map((m) => m.id));
        setTimeout(() => setStatusMessage(null), 2000);
      } catch (err) {
        console.error("Gagal menyimpan urutan modul:", err);
        setStatusMessage(null);
      }
    } else {
      const updatedOrphans = [...orphanModules];
      const [moved] = updatedOrphans.splice(fromIdx, 1);
      updatedOrphans.splice(targetIdx, 0, moved);
      setOrphanModules(updatedOrphans);
      resetModuleDrag();

      setStatusMessage("Menyimpan urutan modul…");
      try {
        await reorderLmsModulesAction(programId, updatedOrphans.map((m) => m.id));
        setTimeout(() => setStatusMessage(null), 2000);
      } catch (err) {
        console.error("Gagal menyimpan urutan modul:", err);
        setStatusMessage(null);
      }
    }
  };

  const resetModuleDrag = () => {
    setActiveModuleDrag(null);
    setModuleDragOverIdx(null);
  };

  // Hapus modul dengan optimistic update
  const handleDeleteModule = async (moduleId: string, moduleTitle: string, groupId: string | null) => {
    previousStateRef.current = { groups, orphanModules };

    // 1. Optimistic remove
    if (groupId) {
      setGroups((prevG) =>
        prevG.map((g) =>
          g.id === groupId
            ? { ...g, modules: g.modules.filter((m) => m.id !== moduleId) }
            : g
        )
      );
    } else {
      setOrphanModules((prevO) => prevO.filter((m) => m.id !== moduleId));
    }

    setStatusMessage(`Menghapus modul "${moduleTitle}"…`);
    try {
      const res = await deleteLmsModuleAction(programId, moduleId);
      if (!res.ok) throw new Error(res.error || "Gagal menghapus modul");
      setStatusMessage(`Modul "${moduleTitle}" berhasil dihapus.`);
      setTimeout(() => setStatusMessage(null), 2500);
    } catch (err: any) {
      console.error("[handleDeleteModule] Error:", err);
      setGroups(previousStateRef.current.groups);
      setOrphanModules(previousStateRef.current.orphanModules);
      setErrorMessage(err?.message || "Gagal menghapus modul.");
      setStatusMessage(null);
    }
  };

  // Hapus materi dengan optimistic update
  const handleDeleteLesson = async (lessonId: string, lessonTitle: string, moduleId: string) => {
    previousStateRef.current = { groups, orphanModules };

    setGroups((prevG) =>
      prevG.map((g) => ({
        ...g,
        modules: g.modules.map((m) =>
          m.id === moduleId ? { ...m, lessons: m.lessons.filter((l) => l.id !== lessonId) } : m
        ),
      }))
    );
    setOrphanModules((prevO) =>
      prevO.map((m) =>
        m.id === moduleId ? { ...m, lessons: m.lessons.filter((l) => l.id !== lessonId) } : m
      )
    );

    setStatusMessage(`Menghapus materi "${lessonTitle}"…`);
    try {
      const res = await deleteLmsLessonAction(programId, lessonId);
      if (!res.ok) throw new Error(res.error || "Gagal menghapus materi");
      setStatusMessage(`Materi "${lessonTitle}" berhasil dihapus.`);
      setTimeout(() => setStatusMessage(null), 2500);
    } catch (err: any) {
      console.error("[handleDeleteLesson] Error:", err);
      setGroups(previousStateRef.current.groups);
      setOrphanModules(previousStateRef.current.orphanModules);
      setErrorMessage(err?.message || "Gagal menghapus materi.");
      setStatusMessage(null);
    }
  };

  // Hapus kelompok dengan optimistic update (modul dikeluarkan jadi tanpa kelompok)
  const handleDeleteGroup = async (groupId: string, groupTitle: string) => {
    previousStateRef.current = { groups, orphanModules };

    const targetGroup = groups.find((g) => g.id === groupId);
    const releasedModules = targetGroup ? targetGroup.modules.map((m) => ({ ...m, groupId: null })) : [];

    setGroups((prevG) => prevG.filter((g) => g.id !== groupId));
    setOrphanModules((prevO) => [...prevO, ...releasedModules]);

    setStatusMessage(`Menghapus kelompok "${groupTitle}"…`);
    try {
      const res = await deleteLmsGroupAction(programId, groupId);
      if (!res.ok) throw new Error(res.error || "Gagal menghapus kelompok");
      setStatusMessage(`Kelompok "${groupTitle}" berhasil dihapus.`);
      setTimeout(() => setStatusMessage(null), 2500);
    } catch (err: any) {
      console.error("[handleDeleteGroup] Error:", err);
      setGroups(previousStateRef.current.groups);
      setOrphanModules(previousStateRef.current.orphanModules);
      setErrorMessage(err?.message || "Gagal menghapus kelompok.");
      setStatusMessage(null);
    }
  };

  // Render Modul tunggal
  const renderModuleCard = (
    mod: ModuleRow,
    mIdx: number,
    groupId: string | null,
    groupPrefix?: string,
    totalInList?: number
  ) => {
    const label = groupPrefix ? `${groupPrefix}${mIdx + 1}` : String(mIdx + 1);
    const isModuleDragging = activeModuleDrag?.moduleId === mod.id;
    const isModuleDragOver = moduleDragOverIdx?.groupId === groupId && moduleDragOverIdx?.index === mIdx && !isModuleDragging;

    // Status drop target materi
    const isLessonDragActive = Boolean(activeLessonDrag);
    const isTargetOfLessonDrop = hoveredModuleId === mod.id;
    const isFooterDropActive =
      lessonDropTarget?.moduleId === mod.id &&
      (lessonDropTarget.position === "end" || lessonDropTarget.position === "empty");

    const isModCollapsed = Boolean(collapsedModules[mod.id]);

    return (
      <section
        key={mod.id}
        draggable={!isLessonDragActive}
        onDragStart={(e) => handleModuleDragStart(e, mod.id, groupId, mIdx)}
        onDragOver={(e) => {
          if (isLessonDragActive) {
            e.preventDefault();
            setHoveredModuleId(mod.id);
          } else {
            handleModuleDragOver(e, groupId, mIdx);
          }
        }}
        onDrop={(e) => {
          if (isLessonDragActive) {
            handleLessonDrop(e, mod.id);
          } else {
            handleModuleDrop(e, groupId, mIdx);
          }
        }}
        onDragEnd={resetModuleDrag}
        className={`lms-mod${isModCollapsed ? " is-collapsed" : ""}${isModuleDragging ? " is-dragging" : ""}${isModuleDragOver ? " is-drag-over" : ""}${
          isLessonDragActive && isTargetOfLessonDrop ? " is-lesson-drop-target" : ""
        }`}
      >
        <div className="lms-mod-head">
          <div className="lms-mod-head-top">
            {/* Tombol Collapse / Expand Modul */}
            <button
              type="button"
              className="lms-collapse-toggle-btn"
              onClick={() => toggleModule(mod.id)}
              title={isModCollapsed ? "Bentangkan materi modul ini" : "Ciutkan materi modul ini"}
              aria-label={isModCollapsed ? "Bentangkan modul" : "Ciutkan modul"}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  transform: isModCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
                  transition: "transform 0.18s ease",
                }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {/* Drag Handle Modul */}
            <span
              className="lms-drag-handle lms-mod-drag-handle"
              title="Klik dan geser untuk memindahkan urutan modul ini"
              aria-label="Geser urutan modul"
            >
              ⠿
            </span>

            <span className="mod-no">{label}</span>
            <span className="lms-mod-count">{mod.lessons.length} materi</span>

            <div className="lms-mod-actions">
              <button
                type="button"
                className="icon-btn"
                disabled={mIdx === 0}
                onClick={async () => {
                  if (groupId) {
                    const gIdx = groups.findIndex((g) => g.id === groupId);
                    if (gIdx === -1 || mIdx === 0) return;
                    const updated = [...groups[gIdx].modules];
                    [updated[mIdx], updated[mIdx - 1]] = [updated[mIdx - 1], updated[mIdx]];
                    const next = [...groups];
                    next[gIdx] = { ...next[gIdx], modules: updated };
                    setGroups(next);
                    await reorderLmsModulesAction(programId, updated.map((m) => m.id));
                  } else {
                    if (mIdx === 0) return;
                    const updated = [...orphanModules];
                    [updated[mIdx], updated[mIdx - 1]] = [updated[mIdx - 1], updated[mIdx]];
                    setOrphanModules(updated);
                    await reorderLmsModulesAction(programId, updated.map((m) => m.id));
                  }
                }}
                title="Geser ke atas"
                aria-label="Geser ke atas"
              >
                ↑
              </button>
              <button
                type="button"
                className="icon-btn"
                disabled={totalInList !== undefined ? mIdx === totalInList - 1 : false}
                onClick={async () => {
                  if (groupId) {
                    const gIdx = groups.findIndex((g) => g.id === groupId);
                    if (gIdx === -1 || mIdx >= groups[gIdx].modules.length - 1) return;
                    const updated = [...groups[gIdx].modules];
                    [updated[mIdx], updated[mIdx + 1]] = [updated[mIdx + 1], updated[mIdx]];
                    const next = [...groups];
                    next[gIdx] = { ...next[gIdx], modules: updated };
                    setGroups(next);
                    await reorderLmsModulesAction(programId, updated.map((m) => m.id));
                  } else {
                    if (mIdx >= orphanModules.length - 1) return;
                    const updated = [...orphanModules];
                    [updated[mIdx], updated[mIdx + 1]] = [updated[mIdx + 1], updated[mIdx]];
                    setOrphanModules(updated);
                    await reorderLmsModulesAction(programId, updated.map((m) => m.id));
                  }
                }}
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
                  onConfirm={() => handleDeleteModule(mod.id, mod.title, groupId)}
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
                {groupOptions.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title}
                  </option>
                ))}
              </select>
              <button type="submit" className="btn btn-sm btn-purple lms-mod-save-btn">
                Simpan
              </button>
            </div>

            <div className="lms-batch-selector">
              <div style={{ display: "flex", alignItems: "center", gap: ".5rem", flexWrap: "wrap", width: "100%", marginBottom: ".2rem" }}>
                <span className="lms-batch-label">Akses Batch:</span>
                {batchOptions.length > 0 && (
                  <>
                    {mod.batchLinks.length === 0 ? (
                      <span
                        className="lms-batch-status-badge empty"
                        title="Modul ini hanya dapat dilihat admin dan tersembunyi dari seluruh peserta"
                      >
                        🔒 Belum ada batch dipilih (hanya admin)
                      </span>
                    ) : mod.batchLinks.length === batchOptions.length ? (
                      <span className="lms-batch-status-badge all">
                        ✓ Semua batch ({batchOptions.length})
                      </span>
                    ) : (
                      <span className="lms-batch-status-badge partial">
                        ✓ {mod.batchLinks.length} dari {batchOptions.length} batch dipilih
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

              {batchOptions.length > 0 ? (
                batchOptions.map((b) => (
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
                <span style={{ fontSize: ".78rem", color: "var(--ink-faint)" }}>
                  Belum ada batch/angkatan.
                </span>
              )}
            </div>
          </form>
        </div>

        {/* Daftar Materi di Modul Ini */}
        <div className="lms-lessons">
          {mod.lessons.length === 0 ? (
            <div
              className={`lms-empty-lesson-dropzone${isLessonDragActive ? " is-active" : ""}`}
              onDragOver={(e) => handleLessonDragOverModuleFooter(e, mod.id, 0)}
              onDrop={(e) => handleLessonDrop(e, mod.id)}
            >
              {isLessonDragActive ? (
                <span>⬇ Lepaskan materi di sini untuk memasukkan ke modul ini</span>
              ) : (
                <span style={{ fontStyle: "italic", color: "var(--ink-faint)", fontSize: ".8rem" }}>
                  Belum ada materi di modul ini. Tarik materi ke sini atau klik tombol di bawah.
                </span>
              )}
            </div>
          ) : (
            <div className="lms-lessons-dnd-list">
              {mod.lessons.map((les, lesIdx) => {
                const chip = TYPE_CHIP[les.type] ?? TYPE_CHIP.VIDEO;
                const isItemDragging = activeLessonDrag?.lessonId === les.id;
                const isDropTargetTop =
                  lessonDropTarget?.moduleId === mod.id &&
                  lessonDropTarget?.index === lesIdx &&
                  lessonDropTarget?.position === "before" &&
                  !isItemDragging;
                const isDropTargetBottom =
                  lessonDropTarget?.moduleId === mod.id &&
                  lessonDropTarget?.index === lesIdx + 1 &&
                  lessonDropTarget?.position === "after" &&
                  !isItemDragging;

                return (
                  <div key={les.id} style={{ position: "relative" }}>
                    {/* Indikator bar drop di atas item */}
                    {isDropTargetTop && <div className="lms-lesson-drop-bar before" />}

                    <div
                      draggable
                      onDragStart={(e) => handleLessonDragStart(e, les, mod.id)}
                      onDragOver={(e) => handleLessonDragOverItem(e, mod.id, lesIdx)}
                      onDrop={(e) => handleLessonDrop(e, mod.id)}
                      onDragEnd={resetLessonDrag}
                      className={`lms-lesson-item${isItemDragging ? " is-dragging" : ""}${
                        isDropTargetTop || isDropTargetBottom ? " is-drag-over" : ""
                      }`}
                    >
                      {/* Handle Drag Materi */}
                      <span
                        className="lms-drag-handle"
                        title="Klik dan seret untuk memindahkan materi ini ke modul / kelompok lain"
                        aria-label="Geser materi"
                      >
                        ⠿
                      </span>

                      <div className="lms-lesson-main">
                        <div className="lms-lesson-meta-top">
                          <span className={`type-chip ${chip.cls}`}>{chip.label}</span>
                          {les.isPreview && (
                            <span className="badge" style={{ fontSize: ".62rem" }}>
                              Preview Gratis
                            </span>
                          )}
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
                            onClick={async () => {
                              if (lesIdx === 0) return;
                              const targetIdx = lesIdx - 1;
                              const updated = [...mod.lessons];
                              [updated[lesIdx], updated[targetIdx]] = [updated[targetIdx], updated[lesIdx]];
                              // Optimistic
                              setGroups((prevG) =>
                                prevG.map((g) => ({
                                  ...g,
                                  modules: g.modules.map((m) =>
                                    m.id === mod.id ? { ...m, lessons: updated } : m
                                  ),
                                }))
                              );
                              setOrphanModules((prevO) =>
                                prevO.map((m) =>
                                  m.id === mod.id ? { ...m, lessons: updated } : m
                                )
                              );
                              await moveLmsLessonAction(programId, les.id, mod.id, targetIdx);
                            }}
                            title="Geser ke atas"
                            aria-label="Geser ke atas"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className="icon-btn"
                            disabled={lesIdx === mod.lessons.length - 1}
                            onClick={async () => {
                              if (lesIdx >= mod.lessons.length - 1) return;
                              const targetIdx = lesIdx + 1;
                              const updated = [...mod.lessons];
                              [updated[lesIdx], updated[targetIdx]] = [updated[targetIdx], updated[lesIdx]];
                              // Optimistic
                              setGroups((prevG) =>
                                prevG.map((g) => ({
                                  ...g,
                                  modules: g.modules.map((m) =>
                                    m.id === mod.id ? { ...m, lessons: updated } : m
                                  ),
                                }))
                              );
                              setOrphanModules((prevO) =>
                                prevO.map((m) =>
                                  m.id === mod.id ? { ...m, lessons: updated } : m
                                )
                              );
                              await moveLmsLessonAction(programId, les.id, mod.id, targetIdx);
                            }}
                            title="Geser ke bawah"
                            aria-label="Geser ke bawah"
                          >
                            ↓
                          </button>
                        </div>

                        <div className="lms-lesson-ops">
                          <Link
                            href={`/webadmin/program/${programId}/lms/lesson/${les.id}`}
                            className="btn btn-sm lms-btn-edit"
                          >
                            Edit
                          </Link>
                          <form action={deleteLmsLesson}>
                            <input type="hidden" name="id" value={les.id} />
                            <input type="hidden" name="programId" value={programId} />
                            <ConfirmButton
                              className="icon-btn danger"
                              title="Hapus materi"
                              message={`Hapus materi "${les.title}"?`}
                              onConfirm={() => handleDeleteLesson(les.id, les.title, mod.id)}
                            >
                              Hapus
                            </ConfirmButton>
                          </form>
                        </div>
                      </div>
                    </div>

                    {/* Indikator bar drop di bawah item */}
                    {isDropTargetBottom && <div className="lms-lesson-drop-bar after" />}
                  </div>
                );
              })}
            </div>
          )}

          {/* Area Tambah Materi / Dropzone Akhir Modul */}
          <div
            className={`lms-add-lesson-btn-wrapper${isFooterDropActive ? " is-drop-active" : ""}`}
            onDragOver={(e) => handleLessonDragOverModuleFooter(e, mod.id, mod.lessons.length)}
            onDrop={(e) => handleLessonDrop(e, mod.id)}
          >
            {isLessonDragActive ? (
              <div className="lms-lesson-drop-hint">
                <span>⬇ Lepaskan di sini untuk meletakkan di akhir modul ini</span>
              </div>
            ) : (
              <Link
                href={`/webadmin/program/${programId}/lms/lesson/new?module=${mod.id}`}
                className="btn btn-sm lms-add-lesson-btn"
              >
                + Tambah Materi / Tes
              </Link>
            )}
          </div>
        </div>
      </section>
    );
  };

  return (
    <div className="lms-curriculum-manager">
      {/* Toast / Status Notifikasi */}
      {statusMessage && (
        <div className="lms-dnd-floating-status" role="status">
          <span className="lms-dnd-spinner" />
          <span>{statusMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="adm-alert err" style={{ marginBottom: "1rem" }}>
          <span>{errorMessage}</span>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setErrorMessage(null)}
            style={{ marginLeft: "auto" }}
          >
            ×
          </button>
        </div>
      )}

      {/* Toolbar Kurikulum: Statistik & Tombol Ciutkan/Bentangkan Semua */}
      <div className="lms-curriculum-toolbar">
        <div className="lms-toolbar-info">
          <span>Struktur Kurikulum:</span>
          <span className="lms-toolbar-pill">{groups.length} Bagian</span>
          <span className="lms-toolbar-pill">
            {groups.reduce((acc, g) => acc + g.modules.length, 0) + orphanModules.length} Modul
          </span>
          <span className="lms-toolbar-pill">
            {groups.reduce(
              (acc, g) => acc + g.modules.reduce((mAcc, m) => mAcc + m.lessons.length, 0),
              0
            ) + orphanModules.reduce((mAcc, m) => mAcc + m.lessons.length, 0)}{" "}
            Materi
          </span>
        </div>

        <div className="lms-toolbar-actions">
          <button
            type="button"
            className="lms-btn-toolbar"
            onClick={collapseAll}
            title="Ciutkan semua bagian dan modul agar tampilan ringkas"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="4 14 10 14 10 20" />
              <polyline points="20 10 14 10 14 4" />
              <line x1="14" y1="10" x2="21" y2="3" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </svg>
            Ciutkan Semua
          </button>
          <button
            type="button"
            className="lms-btn-toolbar"
            onClick={expandAll}
            title="Bentangkan semua bagian dan modul"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 3 21 3 21 9" />
              <polyline points="9 21 3 21 3 15" />
              <line x1="21" y1="3" x2="14" y2="10" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </svg>
            Bentangkan Semua
          </button>
        </div>
      </div>

      {/* Render Semua Kelompok Modul */}
      {groups.map((group, gIdx) => {
        const isGroupCollapsed = Boolean(collapsedGroups[group.id]);
        return (
          <section key={group.id} className={`lms-group${isGroupCollapsed ? " is-collapsed" : ""}`}>
            <div className="lms-group-head">
              <div className="lms-group-head-top">
                {/* Tombol Collapse / Expand Bagian */}
                <button
                  type="button"
                  className="lms-collapse-toggle-btn"
                  onClick={() => toggleGroup(group.id)}
                  title={isGroupCollapsed ? "Bentangkan bagian ini" : "Ciutkan bagian ini"}
                  aria-label={isGroupCollapsed ? "Bentangkan bagian" : "Ciutkan bagian"}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      transform: isGroupCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
                      transition: "transform 0.18s ease",
                    }}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                <span className="group-no">Bagian {gIdx + 1}</span>
                <span className="lms-group-count">{group.modules.length} modul</span>
              <div className="lms-group-actions">
                <form action={moveLmsGroup}>
                  <input type="hidden" name="id" value={group.id} />
                  <input type="hidden" name="programId" value={programId} />
                  <input type="hidden" name="dir" value="up" />
                  <button
                    type="submit"
                    className="icon-btn"
                    disabled={gIdx === 0}
                    title="Geser ke atas"
                    aria-label="Geser ke atas"
                  >
                    ↑
                  </button>
                </form>
                <form action={moveLmsGroup}>
                  <input type="hidden" name="id" value={group.id} />
                  <input type="hidden" name="programId" value={programId} />
                  <input type="hidden" name="dir" value="down" />
                  <button
                    type="submit"
                    className="icon-btn"
                    disabled={gIdx === groups.length - 1}
                    title="Geser ke bawah"
                    aria-label="Geser ke bawah"
                  >
                    ↓
                  </button>
                </form>
                <form action={deleteLmsGroup}>
                  <input type="hidden" name="id" value={group.id} />
                  <input type="hidden" name="programId" value={programId} />
                  <ConfirmButton
                    className="icon-btn danger"
                    title="Hapus kelompok"
                    message={`Hapus kelompok "${group.title}"? Modul di dalamnya TIDAK ikut terhapus — hanya keluar dari kelompok.`}
                    onConfirm={() => handleDeleteGroup(group.id, group.title)}
                  >
                    Hapus
                  </ConfirmButton>
                </form>
              </div>
            </div>

            <form action={saveLmsGroup} className="lms-group-form">
              <input type="hidden" name="id" value={group.id} />
              <input type="hidden" name="programId" value={programId} />
              <input
                name="title"
                defaultValue={group.title}
                required
                title="Klik untuk mengganti nama kelompok"
                className="lms-group-title-input"
              />
              <button type="submit" className="btn btn-sm btn-purple lms-group-save-btn">
                Simpan Nama
              </button>
            </form>
          </div>

          <div className="lms-group-body">
            {group.modules.length === 0 ? (
              <p
                style={{
                  fontSize: ".82rem",
                  color: "var(--ink-faint)",
                  fontStyle: "italic",
                  margin: "0 0 .8rem",
                  padding: ".5rem 0",
                }}
              >
                Belum ada modul di Bagian ini. Buat modul di bawah untuk menaruh materi.
              </p>
            ) : (
              <div className="lms-modules-dnd-container">
                {group.modules.map((mod, mIdx) =>
                  renderModuleCard(mod, mIdx, group.id, `${gIdx + 1}.`, group.modules.length)
                )}
              </div>
            )}

            {/* Tambah modul ke kelompok ini */}
            <form
              action={saveLmsModule}
              className="lms-add-module-form"
              style={{ marginTop: group.modules.length > 0 ? "1rem" : 0 }}
            >
              <input type="hidden" name="programId" value={programId} />
              <input type="hidden" name="groupId" value={group.id} />
              <input
                name="title"
                placeholder={`Nama modul baru di Bagian ${gIdx + 1}…`}
                required
                className="lms-add-module-input"
              />
              <button type="submit" className="btn btn-sm btn-purple lms-add-module-btn">
                + Tambah Modul
              </button>
            </form>
          </div>
        </section>
        );
      })}

      {/* Modul tanpa kelompok (Orphan Modules) */}
      {orphanModules.length > 0 && (
        <div style={{ marginTop: groups.length > 0 ? "1.6rem" : 0 }}>
          {groups.length > 0 && (
            <h3 style={{ fontSize: ".9rem", color: "var(--ink-soft)", margin: "0 0 .8rem" }}>
              Modul Tanpa Kelompok
            </h3>
          )}
          <div className="lms-modules-dnd-container">
            {orphanModules.map((mod, mIdx) =>
              renderModuleCard(mod, mIdx, null, undefined, orphanModules.length)
            )}
          </div>
        </div>
      )}
    </div>
  );
}
