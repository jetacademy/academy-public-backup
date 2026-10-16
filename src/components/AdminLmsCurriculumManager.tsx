"use client";

import { useState, useEffect, useRef, useMemo } from "react";
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

const TYPE_CHIP: Record<string, { cls: string; label: string; icon: string }> = {
  VIDEO: { cls: "video", label: "Video", icon: "🎥" },
  TEXT: { cls: "text", label: "Teks", icon: "📄" },
  PDF: { cls: "pdf", label: "PDF", icon: "📑" },
  QUIZ: { cls: "quiz", label: "Kuis", icon: "❓" },
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
  allBatches: boolean;
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

/**
 * Akses batch per modul. "Semua batch" = modul otomatis ikut di batch mana pun, termasuk batch
 * yang dibuat belakangan. Centang per batch tetap dikirim (disembunyikan, bukan disabled) supaya
 * pilihan lama tidak hilang kalau "Semua batch" dimatikan lagi.
 */
function BatchAccessSelector({ mod, batchOptions }: { mod: ModuleRow; batchOptions: BatchOption[] }) {
  const [allBatches, setAllBatches] = useState(mod.allBatches);
  const linked = mod.batchLinks.length;

  return (
    <div className="lms-batch-selector">
      <div style={{ display: "flex", alignItems: "center", gap: ".5rem", flexWrap: "wrap", width: "100%", marginBottom: ".2rem" }}>
        <span className="lms-batch-label">Akses Batch:</span>
        {allBatches ? (
          <span className="lms-batch-status-badge all">✓ Semua batch, termasuk batch baru</span>
        ) : batchOptions.length === 0 ? null : linked === 0 ? (
          <span
            className="lms-batch-status-badge empty"
            title="Modul ini hanya dapat dilihat admin dan tersembunyi dari seluruh peserta"
          >
            Belum ada batch dipilih (hanya admin)
          </span>
        ) : (
          <span className="lms-batch-status-badge partial">
            ✓ {linked} dari {batchOptions.length} batch dipilih
          </span>
        )}

        <label className="lms-batch-chip lms-batch-chip-all" title="Modul otomatis tersedia di semua batch, termasuk batch yang ditambahkan nanti">
          <input
            type="checkbox"
            name="allBatches"
            checked={allBatches}
            onChange={(e) => setAllBatches(e.target.checked)}
          />
          <span>Semua batch</span>
        </label>

        {!allBatches && batchOptions.length > 0 && (
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
        )}

        <button
          type="submit"
          className="btn btn-xs btn-purple"
          style={{ fontSize: ".7rem", padding: ".15rem .6rem", height: "auto", marginLeft: "auto" }}
          title="Simpan pengaturan batch modul ini"
        >
          Simpan Akses
        </button>
      </div>

      <div style={{ display: allBatches ? "none" : "contents" }}>
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
    </div>
  );
}

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

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");

  // Quick Action Toggles at Top
  const [showTopAddGroup, setShowTopAddGroup] = useState(false);
  const [showTopAddModule, setShowTopAddModule] = useState(false);
  const [targetGroupIdForNewModule, setTargetGroupIdForNewModule] = useState<string>("");

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

  // Filter Match Helpers
  const isLessonMatch = (les: LessonRow) => {
    const q = searchQuery.toLowerCase().trim();
    const titleMatch = !q || les.title.toLowerCase().includes(q);
    const typeMatch =
      typeFilter === "ALL" ||
      (typeFilter === "PREVIEW" ? les.isPreview : les.type === typeFilter);
    return titleMatch && typeMatch;
  };

  const isModuleMatch = (mod: ModuleRow) => {
    const q = searchQuery.toLowerCase().trim();
    if (mod.lessons.some(isLessonMatch)) return true;
    if (typeFilter === "ALL" && q && mod.title.toLowerCase().includes(q)) return true;
    return false;
  };

  const isGroupMatch = (g: GroupRow) => {
    const q = searchQuery.toLowerCase().trim();
    if (g.modules.some(isModuleMatch)) return true;
    if (typeFilter === "ALL" && q && g.title.toLowerCase().includes(q)) return true;
    return false;
  };

  const isFiltering = searchQuery.trim() !== "" || typeFilter !== "ALL";

  // Matching count calculation
  const matchingLessonsCount = useMemo(() => {
    if (!isFiltering) return 0;
    let count = 0;
    groups.forEach((g) => {
      g.modules.forEach((m) => {
        count += m.lessons.filter(isLessonMatch).length;
      });
    });
    orphanModules.forEach((m) => {
      count += m.lessons.filter(isLessonMatch).length;
    });
    return count;
  }, [groups, orphanModules, searchQuery, typeFilter, isFiltering]);

  // Auto-expand on search
  useEffect(() => {
    if (isFiltering) {
      expandAll();
    }
  }, [searchQuery, typeFilter]);

  // ─────────────────────────────────────────────────────────────
  // LESSON DRAG & DROP (Bisa pindah antar modul dan antar kelompok)
  // ─────────────────────────────────────────────────────────────

  const handleLessonDragStart = (
    e: React.DragEvent,
    lesson: LessonRow,
    sourceModuleId: string
  ) => {
    e.stopPropagation();
    setActiveLessonDrag({ lessonId: lesson.id, sourceModuleId, lesson });
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData(
      "text/plain",
      JSON.stringify({ lessonId: lesson.id, sourceModuleId })
    );
  };

  const handleLessonDragOverItem = (
    e: React.DragEvent,
    moduleId: string,
    index: number
  ) => {
    if (!activeLessonDrag) return;
    e.preventDefault();
    e.stopPropagation();

    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const isTopHalf = offsetY < rect.height / 2;

    setLessonDropTarget({
      moduleId,
      index,
      position: isTopHalf ? "before" : "after",
    });
    setHoveredModuleId(moduleId);
  };

  const handleLessonDragOverModuleFooter = (
    e: React.DragEvent,
    moduleId: string,
    lessonsLength: number
  ) => {
    if (!activeLessonDrag) return;
    e.preventDefault();
    e.stopPropagation();

    setLessonDropTarget({
      moduleId,
      index: lessonsLength,
      position: lessonsLength === 0 ? "empty" : "end",
    });
    setHoveredModuleId(moduleId);
  };

  const handleLessonDrop = async (e: React.DragEvent, targetModuleId: string) => {
    if (!activeLessonDrag) return;
    e.preventDefault();
    e.stopPropagation();

    const { lessonId, sourceModuleId, lesson } = activeLessonDrag;
    const dropInfo = lessonDropTarget;

    const targetIndex = dropInfo
      ? dropInfo.position === "after"
        ? dropInfo.index + 1
        : dropInfo.index
      : 0;

    resetLessonDrag();

    if (sourceModuleId === targetModuleId) {
      const srcMod = findModule(sourceModuleId)?.module;
      if (srcMod) {
        const fromIdx = srcMod.lessons.findIndex((l) => l.id === lessonId);
        let finalIdx = targetIndex;
        if (fromIdx < targetIndex) finalIdx -= 1;
        if (fromIdx === finalIdx) return;
      }
    }

    previousStateRef.current = { groups, orphanModules };

    // 1. Optimistic Update
    const removeLessonFromList = (modules: ModuleRow[]): ModuleRow[] =>
      modules.map((m) =>
        m.id === sourceModuleId
          ? { ...m, lessons: m.lessons.filter((l) => l.id !== lessonId) }
          : m
      );

    const addLessonToList = (modules: ModuleRow[]): ModuleRow[] =>
      modules.map((m) => {
        if (m.id !== targetModuleId) return m;
        const newLessons = [...m.lessons];
        const insertAt = Math.min(Math.max(0, targetIndex), newLessons.length);
        newLessons.splice(insertAt, 0, { ...lesson, moduleId: targetModuleId });
        return { ...m, lessons: newLessons };
      });

    let nextGroups = groups.map((g) => ({
      ...g,
      modules: removeLessonFromList(g.modules),
    }));
    let nextOrphans = removeLessonFromList(orphanModules);

    nextGroups = nextGroups.map((g) => ({
      ...g,
      modules: addLessonToList(g.modules),
    }));
    nextOrphans = addLessonToList(nextOrphans);

    setGroups(nextGroups);
    setOrphanModules(nextOrphans);

    // 2. Server Action
    const targetModTitle = findModule(targetModuleId)?.module.title || "Modul";
    setStatusMessage(`Memindahkan materi "${lesson.title}" ke "${targetModTitle}"…`);

    try {
      const res = await moveLmsLessonAction(programId, lessonId, targetModuleId, targetIndex);
      if (!res.ok) throw new Error(res.error || "Gagal memindahkan materi");
      setStatusMessage(`Materi "${lesson.title}" berhasil dipindahkan.`);
      setTimeout(() => setStatusMessage(null), 2500);
    } catch (err: any) {
      console.error("[handleLessonDrop] Error:", err);
      setGroups(previousStateRef.current.groups);
      setOrphanModules(previousStateRef.current.orphanModules);
      setErrorMessage(err?.message || "Gagal memindahkan materi. Perubahan dibatalkan.");
      setStatusMessage(null);
    }
  };

  const resetLessonDrag = () => {
    setActiveLessonDrag(null);
    setLessonDropTarget(null);
    setHoveredModuleId(null);
  };

  // ─────────────────────────────────────────────────────────────
  // MODULE DRAG & DROP (Urutan modul dalam satu kelompok/orphan)
  // ─────────────────────────────────────────────────────────────

  const handleModuleDragStart = (
    e: React.DragEvent,
    moduleId: string,
    groupId: string | null,
    index: number
  ) => {
    if (activeLessonDrag) return;
    setActiveModuleDrag({ moduleId, groupId, index });
    e.dataTransfer.effectAllowed = "move";
  };

  const handleModuleDragOver = (
    e: React.DragEvent,
    groupId: string | null,
    index: number
  ) => {
    if (!activeModuleDrag || activeLessonDrag) return;
    if (activeModuleDrag.groupId !== groupId) return;
    e.preventDefault();
    setModuleDragOverIdx({ groupId, index });
  };

  const handleModuleDrop = async (
    e: React.DragEvent,
    groupId: string | null,
    targetIdx: number
  ) => {
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

    const isLessonDragActive = Boolean(activeLessonDrag);
    const isTargetOfLessonDrop = hoveredModuleId === mod.id;
    const isFooterDropActive =
      lessonDropTarget?.moduleId === mod.id &&
      (lessonDropTarget.position === "end" || lessonDropTarget.position === "empty");

    const isModCollapsed = Boolean(collapsedModules[mod.id]);

    const displayedLessons = isFiltering ? mod.lessons.filter(isLessonMatch) : mod.lessons;

    return (
      <section
        key={mod.id}
        id={`lms-mod-${mod.id}`}
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
            <span className="lms-mod-count">
              {mod.lessons.length} materi
              {isFiltering && displayedLessons.length < mod.lessons.length && (
                <span style={{ color: "var(--purple)", marginLeft: "0.25rem" }}>
                  ({displayedLessons.length} cocok)
                </span>
              )}
            </span>

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
                className="lms-mod-title-input"
                title="Klik untuk mengganti nama modul"
              />
              <select
                name="groupId"
                defaultValue={mod.groupId ?? ""}
                className="lms-mod-group-select"
                title="Pindahkan modul ini ke kelompok lain"
              >
                <option value="">Tanpa Kelompok</option>
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

            <BatchAccessSelector mod={mod} batchOptions={batchOptions} />
          </form>
        </div>

        <div className="lms-mod-body">
          {displayedLessons.length === 0 ? (
            <p className="lms-empty-hint">
              {isFiltering
                ? "Tidak ada materi di modul ini yang cocok dengan filter pencarian."
                : "Belum ada materi di modul ini. Klik tombol di bawah atau seret materi ke sini."}
            </p>
          ) : (
            <div className="lms-lessons-list">
              {displayedLessons.map((les, lesIdx) => {
                const chip = TYPE_CHIP[les.type] ?? { cls: "", label: les.type, icon: "📄" };
                const isItemDragging = activeLessonDrag?.lessonId === les.id;
                const isDropTargetTop =
                  lessonDropTarget?.moduleId === mod.id &&
                  lessonDropTarget.index === lesIdx &&
                  lessonDropTarget.position === "before";
                const isDropTargetBottom =
                  lessonDropTarget?.moduleId === mod.id &&
                  lessonDropTarget.index === lesIdx &&
                  lessonDropTarget.position === "after";

                return (
                  <div key={les.id} className="lms-lesson-item-wrapper">
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
                          <span className={`type-chip ${chip.cls}`}>
                            <span>{chip.icon}</span>
                            <span>{chip.label}</span>
                          </span>
                          {les.isPreview && (
                            <span
                              className="badge"
                              style={{
                                fontSize: ".62rem",
                                background: "rgba(0, 184, 148, 0.15)",
                                color: "#00b894",
                                fontWeight: 700,
                              }}
                            >
                              ✓ Preview Gratis
                            </span>
                          )}
                          {les.type === "QUIZ" && (
                            <span
                              className="badge"
                              style={{
                                fontSize: ".62rem",
                                background: "rgba(108, 92, 231, 0.1)",
                                color: "var(--purple)",
                                fontWeight: 700,
                              }}
                            >
                              ❓ {les._count.questions} soal
                            </span>
                          )}
                          {les.duration && (
                            <span className="l-meta" style={{ display: "inline-flex", alignItems: "center", gap: "0.2rem" }}>
                              ⏱️ {les.duration}
                            </span>
                          )}
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
                              message={`Hapus materi "${les.title}"? Histori progres belajar materi ini akan terhapus.`}
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
                style={{ fontWeight: 700 }}
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

      {/* Top Action & Navigation Controls Bar */}
      <div
        style={{
          background: "var(--white)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-md)",
          padding: "1rem 1.25rem",
          marginBottom: "1.2rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.85rem",
          boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
        }}
      >
        {/* Row 1: Search, Type Filter & Quick Jump */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            flexWrap: "wrap",
          }}
        >
          {/* Search Box */}
          <div style={{ position: "relative", flex: "1 1 240px", minWidth: "180px" }}>
            <span
              style={{
                position: "absolute",
                left: "0.8rem",
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--ink-faint)",
                fontSize: "0.85rem",
              }}
            >
              🔍
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari materi, kuis, modul, bagian..."
              style={{
                width: "100%",
                padding: "0.55rem 2rem 0.55rem 2.2rem",
                borderRadius: "var(--r-sm)",
                border: "1px solid var(--border)",
                fontSize: "0.85rem",
                background: "var(--chip)",
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                style={{
                  position: "absolute",
                  right: "0.6rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  color: "var(--ink-faint)",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Filter Tipe Materi */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            style={{
              padding: "0.55rem 0.8rem",
              borderRadius: "var(--r-sm)",
              border: "1px solid var(--border)",
              fontSize: "0.85rem",
              background: "var(--white)",
              fontWeight: 600,
            }}
          >
            <option value="ALL">Semua Tipe Materi</option>
            <option value="VIDEO">🎥 Video</option>
            <option value="TEXT">📄 Teks Bacaan</option>
            <option value="PDF">📑 Dokumen PDF</option>
            <option value="QUIZ">❓ Kuis &amp; Soal</option>
            <option value="PREVIEW">🆓 Preview Gratis</option>
          </select>

          {/* Quick Jump Navigator */}
          <select
            onChange={(e) => {
              const modId = e.target.value;
              if (!modId) return;
              const info = findModule(modId);
              if (info) {
                if (info.groupId) {
                  setCollapsedGroups((prev) => ({ ...prev, [info.groupId!]: false }));
                }
                setCollapsedModules((prev) => ({ ...prev, [modId]: false }));
                setTimeout(() => {
                  const el = document.getElementById(`lms-mod-${modId}`);
                  if (el) {
                    el.scrollIntoView({ behavior: "smooth", block: "center" });
                    el.classList.add("lms-mod-highlight");
                    setTimeout(() => el.classList.remove("lms-mod-highlight"), 2000);
                  }
                }, 50);
              }
              e.target.value = "";
            }}
            defaultValue=""
            style={{
              padding: "0.55rem 0.8rem",
              borderRadius: "var(--r-sm)",
              border: "1px solid var(--border)",
              fontSize: "0.85rem",
              background: "var(--white)",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <option value="" disabled>
              ⚡ Lompat ke Modul...
            </option>
            {groups.map((g, gIdx) => (
              <optgroup key={g.id} label={`Bagian ${gIdx + 1}: ${g.title}`}>
                {g.modules.map((m, mIdx) => (
                  <option key={m.id} value={m.id}>
                    {gIdx + 1}.{mIdx + 1} {m.title} ({m.lessons.length} materi)
                  </option>
                ))}
              </optgroup>
            ))}
            {orphanModules.length > 0 && (
              <optgroup label="Modul Tanpa Kelompok">
                {orphanModules.map((m, mIdx) => (
                  <option key={m.id} value={m.id}>
                    {mIdx + 1}. {m.title} ({m.lessons.length} materi)
                  </option>
                ))}
              </optgroup>
            )}
          </select>

          {/* Top Quick Action Buttons */}
          <div style={{ display: "flex", gap: "0.5rem", marginLeft: "auto", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => {
                setShowTopAddGroup(!showTopAddGroup);
                setShowTopAddModule(false);
              }}
              className="btn btn-sm btn-purple"
              style={{ fontWeight: 700 }}
            >
              {showTopAddGroup ? "✕ Tutup" : "+ Kelompok Baru"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowTopAddModule(!showTopAddModule);
                setShowTopAddGroup(false);
              }}
              className="btn btn-sm"
              style={{ fontWeight: 700, background: "var(--white)", border: "1px solid var(--border)" }}
            >
              {showTopAddModule ? "✕ Tutup" : "+ Modul Baru"}
            </button>
          </div>
        </div>

        {/* Row 2: Status Filter Indicator & Expand/Collapse All */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "0.6rem",
            paddingTop: "0.5rem",
            borderTop: "1px dashed var(--border)",
          }}
        >
          <div style={{ fontSize: "0.82rem", color: "var(--ink-soft)" }}>
            {isFiltering ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
                <span>
                  Menemukan <strong>{matchingLessonsCount}</strong> materi yang sesuai.
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setTypeFilter("ALL");
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--purple)",
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: "0.8rem",
                    padding: 0,
                  }}
                >
                  ✕ Reset Filter
                </button>
              </span>
            ) : (
              <span>
                Struktur: <strong>{groups.length}</strong> Bagian ·{" "}
                <strong>{groups.reduce((a, g) => a + g.modules.length, 0) + orphanModules.length}</strong> Modul ·{" "}
                <strong>
                  {groups.reduce(
                    (a, g) => a + g.modules.reduce((ma, m) => ma + m.lessons.length, 0),
                    0
                  ) + orphanModules.reduce((ma, m) => ma + m.lessons.length, 0)}
                </strong>{" "}
                Materi
              </span>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <button
              type="button"
              className="btn btn-xs"
              onClick={collapseAll}
              title="Ciutkan semua agar tampilan ringkas"
              style={{ fontSize: "0.75rem", padding: "0.3rem 0.65rem", fontWeight: 600 }}
            >
              Ciutkan Semua
            </button>
            <button
              type="button"
              className="btn btn-xs"
              onClick={expandAll}
              title="Bentangkan semua modul dan materi"
              style={{ fontSize: "0.75rem", padding: "0.3rem 0.65rem", fontWeight: 600 }}
            >
              Bentangkan Semua
            </button>
          </div>
        </div>
      </div>

      {/* Top Quick Create Form: Kelompok Baru */}
      {showTopAddGroup && (
        <div
          style={{
            background: "var(--white)",
            border: "2px solid var(--purple)",
            borderRadius: "var(--r-md)",
            padding: "1.2rem 1.4rem",
            marginBottom: "1.2rem",
            boxShadow: "0 6px 20px rgba(108, 92, 231, 0.12)",
            animation: "fadeIn 0.2s ease-in-out",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
            <h4 style={{ margin: 0, fontWeight: 800, color: "var(--ink)", fontSize: "0.95rem" }}>
              📁 Tambah Kelompok Modul (Bagian Baru)
            </h4>
            <button
              type="button"
              onClick={() => setShowTopAddGroup(false)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-soft)", fontSize: "1.1rem" }}
            >
              ✕
            </button>
          </div>
          <form action={saveLmsGroup} style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
            <input type="hidden" name="programId" value={programId} />
            <input
              name="title"
              placeholder={`mis. Bagian ${groups.length + 1}: Praktik & Studi Kasus`}
              required
              style={{
                flex: "1 1 260px",
                padding: "0.6rem 0.85rem",
                borderRadius: "var(--r-sm)",
                border: "1px solid var(--border)",
                fontSize: "0.88rem",
              }}
            />
            <button type="submit" className="btn btn-purple" style={{ fontWeight: 700, padding: "0.6rem 1.4rem" }}>
              Simpan Kelompok
            </button>
          </form>
        </div>
      )}

      {/* Top Quick Create Form: Modul Baru */}
      {showTopAddModule && (
        <div
          style={{
            background: "var(--white)",
            border: "2px solid var(--purple)",
            borderRadius: "var(--r-md)",
            padding: "1.2rem 1.4rem",
            marginBottom: "1.2rem",
            boxShadow: "0 6px 20px rgba(108, 92, 231, 0.12)",
            animation: "fadeIn 0.2s ease-in-out",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
            <h4 style={{ margin: 0, fontWeight: 800, color: "var(--ink)", fontSize: "0.95rem" }}>
              📦 Tambah Modul (Sub-Bab) Baru
            </h4>
            <button
              type="button"
              onClick={() => setShowTopAddModule(false)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-soft)", fontSize: "1.1rem" }}
            >
              ✕
            </button>
          </div>
          <form action={saveLmsModule} style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
            <input type="hidden" name="programId" value={programId} />
            <select
              name="groupId"
              value={targetGroupIdForNewModule}
              onChange={(e) => setTargetGroupIdForNewModule(e.target.value)}
              style={{
                flex: "0 0 220px",
                padding: "0.6rem 0.8rem",
                borderRadius: "var(--r-sm)",
                border: "1px solid var(--border)",
                fontSize: "0.85rem",
                background: "var(--white)",
                fontWeight: 600,
              }}
            >
              <option value="">(Tanpa Kelompok / Lepas)</option>
              {groups.map((g, idx) => (
                <option key={g.id} value={g.id}>
                  Bagian {idx + 1}: {g.title}
                </option>
              ))}
            </select>
            <input
              name="title"
              placeholder="Nama modul (cth: Pengantar & Konsep Dasar)..."
              required
              style={{
                flex: "1 1 260px",
                padding: "0.6rem 0.85rem",
                borderRadius: "var(--r-sm)",
                border: "1px solid var(--border)",
                fontSize: "0.88rem",
              }}
            />
            <button type="submit" className="btn btn-purple" style={{ fontWeight: 700, padding: "0.6rem 1.4rem" }}>
              Simpan Modul
            </button>
          </form>
        </div>
      )}

      {/* Render Semua Kelompok Modul */}
      {groups.map((group, gIdx) => {
        if (isFiltering && !isGroupMatch(group)) return null;

        const isGroupCollapsed = Boolean(collapsedGroups[group.id]);
        return (
          <section key={group.id} id={`lms-group-${group.id}`} className={`lms-group${isGroupCollapsed ? " is-collapsed" : ""}`}>
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
                  {group.modules.map((mod, mIdx) => {
                    if (isFiltering && !isModuleMatch(mod)) return null;
                    return renderModuleCard(mod, mIdx, group.id, `${gIdx + 1}.`, group.modules.length);
                  })}
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
            <h3 style={{ fontSize: ".95rem", fontWeight: 800, color: "var(--ink)", margin: "0 0 .8rem" }}>
              📦 Modul Tanpa Kelompok (Mandiri)
            </h3>
          )}
          <div className="lms-modules-dnd-container">
            {orphanModules.map((mod, mIdx) => {
              if (isFiltering && !isModuleMatch(mod)) return null;
              return renderModuleCard(mod, mIdx, null, undefined, orphanModules.length);
            })}
          </div>
        </div>
      )}
    </div>
  );
}
