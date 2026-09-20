"use client";

import { useState } from "react";
import { deleteMediaAction } from "@/app/webadmin/actions";

export type MediaItem = {
  id: string;
  filename: string;
  url: string;
  mimeType: string;
  size: number;
  createdAt: Date | string;
  type?: string;
};

interface MediaGridProps {
  media: MediaItem[];
  selectable?: boolean;
  onSelect?: (url: string) => void;
  programId?: string;
  onDelete?: (id: string) => void;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getItemType(mime: string, url: string): "IMAGE" | "PDF" | "VIDEO" | "FILE" {
  const m = (mime || "").toLowerCase();
  const u = (url || "").toLowerCase();
  if (m.startsWith("image/") || /\.(webp|png|jpe?g|gif|svg|avif)$/i.test(u)) return "IMAGE";
  if (m.includes("pdf") || u.endsWith(".pdf")) return "PDF";
  if (m.startsWith("video/") || /\.(mp4|webm|mov|mkv)$/i.test(u)) return "VIDEO";
  return "FILE";
}

export default function MediaGrid({
  media: initialMedia,
  selectable,
  onSelect,
  programId,
  onDelete,
}: MediaGridProps) {
  const [mediaList, setMediaList] = useState<MediaItem[]>(initialMedia);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "IMAGE" | "PDF" | "VIDEO">("ALL");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Sync if initialMedia changes
  if (initialMedia !== mediaList && initialMedia.length !== mediaList.length) {
    setMediaList(initialMedia);
  }

  const filteredMedia = mediaList.filter((item) => {
    const type = getItemType(item.mimeType, item.url);
    if (typeFilter !== "ALL" && type !== typeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        item.filename.toLowerCase().includes(q) ||
        item.url.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleDelete = async (item: MediaItem) => {
    setDeletingId(item.id);
    try {
      const res = await deleteMediaAction(item.id, programId);
      if (res.ok) {
        setMediaList((prev) => prev.filter((m) => m.id !== item.id));
        onDelete?.(item.id);
        setConfirmDeleteId(null);
      } else {
        alert(res.error || "Gagal menghapus file.");
      }
    } catch (err) {
      console.error("[MediaGrid:delete]", err);
      alert("Terjadi kesalahan saat menghapus file.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleCopy = (e: React.MouseEvent, item: MediaItem) => {
    e.stopPropagation();
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(item.url);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  if (mediaList.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--ink-soft)" }}>
        <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>📁</div>
        <p style={{ margin: 0, fontSize: "0.9rem" }}>
          Belum ada media di program ini. Upload file gambar atau PDF untuk mulai.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Filter and Search Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "0.6rem",
          background: "var(--white)",
          padding: "0.6rem 0.9rem",
          borderRadius: "var(--r-sm, 8px)",
          border: "1px solid var(--border)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flex: 1, minWidth: "200px" }}>
          <span style={{ fontSize: "0.85rem", opacity: 0.6 }}>🔍</span>
          <input
            type="text"
            placeholder="Cari file…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              border: "none",
              outline: "none",
              background: "transparent",
              fontSize: "0.82rem",
              width: "100%",
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              style={{ border: "none", background: "none", cursor: "pointer", color: "var(--ink-faint)" }}
            >
              ×
            </button>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
          <button
            type="button"
            className={`mm-chip${typeFilter === "ALL" ? " is-active" : ""}`}
            onClick={() => setTypeFilter("ALL")}
          >
            Semua ({mediaList.length})
          </button>
          <button
            type="button"
            className={`mm-chip${typeFilter === "IMAGE" ? " is-active" : ""}`}
            onClick={() => setTypeFilter("IMAGE")}
          >
            🖼️ Gambar
          </button>
          <button
            type="button"
            className={`mm-chip${typeFilter === "PDF" ? " is-active" : ""}`}
            onClick={() => setTypeFilter("PDF")}
          >
            📄 PDF
          </button>
          <button
            type="button"
            className={`mm-chip${typeFilter === "VIDEO" ? " is-active" : ""}`}
            onClick={() => setTypeFilter("VIDEO")}
          >
            🎬 Video
          </button>
        </div>
      </div>

      {/* Grid */}
      {filteredMedia.length === 0 ? (
        <div style={{ textAlign: "center", padding: "2.5rem 1rem", color: "var(--ink-soft)" }}>
          Tidak ada media yang cocok dengan pencarian &quot;{searchQuery}&quot;.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
            gap: "0.9rem",
          }}
        >
          {filteredMedia.map((item) => {
            const type = getItemType(item.mimeType, item.url);
            const isDeleting = deletingId === item.id;
            const isConfirming = confirmDeleteId === item.id;

            return (
              <div
                key={item.id}
                style={{
                  background: "var(--white)",
                  border: "1.5px solid var(--border)",
                  borderRadius: "var(--r-md, 10px)",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  cursor: selectable ? "pointer" : "default",
                  transition: "all 0.15s ease",
                  position: "relative",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                }}
                onClick={() => selectable && onSelect?.(item.url)}
              >
                {/* Real Preview Container */}
                <div
                  style={{
                    height: 120,
                    position: "relative",
                    background: "#f1f3f7",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                  }}
                >
                  {type === "IMAGE" ? (
                    <img
                      src={item.url}
                      alt={item.filename}
                      loading="lazy"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        transition: "transform 0.2s ease",
                      }}
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = "none";
                      }}
                    />
                  ) : type === "PDF" ? (
                    <div style={{ textAlign: "center", color: "#b91c1c" }}>
                      <span style={{ fontSize: "2.5rem" }}>📄</span>
                    </div>
                  ) : (
                    <div style={{ textAlign: "center", color: "#6d28d9" }}>
                      <span style={{ fontSize: "2.5rem" }}>🎬</span>
                    </div>
                  )}

                  {/* Type Badge */}
                  <span
                    style={{
                      position: "absolute",
                      top: 6,
                      left: 6,
                      fontSize: "0.62rem",
                      fontWeight: 800,
                      padding: "0.15rem 0.45rem",
                      borderRadius: 4,
                      background: "rgba(15, 23, 42, 0.75)",
                      color: "#fff",
                      backdropFilter: "blur(4px)",
                    }}
                  >
                    {type}
                  </span>

                  {/* View Original in new tab */}
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    title="Buka file asli di tab baru"
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      position: "absolute",
                      top: 6,
                      right: 6,
                      width: 24,
                      height: 24,
                      borderRadius: 6,
                      background: "rgba(255,255,255,0.85)",
                      display: "grid",
                      placeItems: "center",
                      fontSize: "0.75rem",
                      color: "var(--ink)",
                      textDecoration: "none",
                      backdropFilter: "blur(2px)",
                    }}
                  >
                    ↗
                  </a>
                </div>

                {/* Info */}
                <div style={{ padding: "0.5rem 0.65rem", flex: 1, display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                  <div
                    title={item.filename}
                    style={{
                      fontSize: "0.76rem",
                      fontWeight: 600,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.filename}
                  </div>
                  <div style={{ fontSize: "0.68rem", color: "var(--ink-faint)", display: "flex", justifyContent: "space-between" }}>
                    <span>{formatBytes(item.size)}</span>
                  </div>
                </div>

                {/* Confirm Delete Overlay */}
                {isConfirming ? (
                  <div
                    style={{
                      padding: "0.4rem 0.6rem",
                      background: "#fef2f2",
                      borderTop: "1px solid #fecaca",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.3rem",
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span style={{ fontSize: "0.68rem", color: "#991b1b", fontWeight: 600 }}>
                      Hapus permanen?
                    </span>
                    <div style={{ display: "flex", gap: "0.3rem" }}>
                      <button
                        type="button"
                        className="btn btn-xs"
                        style={{ background: "#dc2626", color: "#fff", border: "none", flex: 1 }}
                        disabled={isDeleting}
                        onClick={() => handleDelete(item)}
                      >
                        {isDeleting ? "…" : "Ya, Hapus"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-xs"
                        style={{ flex: 1 }}
                        onClick={() => setConfirmDeleteId(null)}
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "0.35rem 0.6rem",
                      borderTop: "1px solid var(--border)",
                      background: "#fafbfd",
                    }}
                  >
                    {selectable ? (
                      <button
                        type="button"
                        className="btn btn-xs btn-purple"
                        style={{ fontSize: "0.72rem", padding: "0.2rem 0.6rem" }}
                        onClick={() => onSelect?.(item.url)}
                      >
                        Pilih
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => handleCopy(e, item)}
                        style={{
                          border: "none",
                          background: "transparent",
                          cursor: "pointer",
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          color: copiedId === item.id ? "#16a34a" : "var(--purple)",
                          padding: 0,
                        }}
                      >
                        {copiedId === item.id ? "✓ Tersalin" : "📋 Salin URL"}
                      </button>
                    )}

                    <button
                      type="button"
                      title="Hapus media ini dari galeri dan server"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDeleteId(item.id);
                      }}
                      style={{
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        fontSize: "0.85rem",
                        color: "#ef4444",
                        padding: "0.1rem 0.3rem",
                        borderRadius: 4,
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
