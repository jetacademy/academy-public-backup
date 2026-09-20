"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getMediaGallery,
  deleteMediaAction,
  uploadToMediaGalleryAction,
} from "@/app/webadmin/actions";

export type MediaItem = {
  id: string;
  filename: string;
  url: string;
  mimeType: string;
  size: number;
  createdAt: Date | string;
};

interface MediaPickerProps {
  programId: string;
  onSelect: (url: string) => void;
  trigger?: React.ReactNode;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(dateVal: Date | string): string {
  try {
    const d = new Date(dateVal);
    return d.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "-";
  }
}

function getItemType(mime: string, url: string): "IMAGE" | "PDF" | "VIDEO" | "FILE" {
  const m = (mime || "").toLowerCase();
  const u = (url || "").toLowerCase();
  if (m.startsWith("image/") || /\.(webp|png|jpe?g|gif|svg|avif)$/i.test(u)) return "IMAGE";
  if (m.includes("pdf") || u.endsWith(".pdf")) return "PDF";
  if (m.startsWith("video/") || /\.(mp4|webm|mov|mkv)$/i.test(u)) return "VIDEO";
  return "FILE";
}

export default function MediaPicker({ programId, onSelect, trigger }: MediaPickerProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"gallery" | "upload">("gallery");

  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "IMAGE" | "PDF" | "VIDEO">("ALL");

  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>("");
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const [copiedUrl, setCopiedUrl] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load media items from server
  const loadMedia = useCallback(async () => {
    if (!programId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getMediaGallery(programId);
      setMedia(data);
      if (data.length > 0 && !selectedId) {
        setSelectedId(data[0].id);
      }
    } catch (err) {
      console.error("[MediaPicker] Gagal memuat media:", err);
      setError("Gagal memuat galeri media. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  }, [programId, selectedId]);

  function handleOpen() {
    setOpen(true);
    loadMedia();
  }

  function handleClose() {
    setOpen(false);
    setConfirmDeleteId(null);
  }

  function handleConfirmSelect(url: string) {
    if (!url) return;
    onSelect(url);
    handleClose();
  }

  // Dialog native open/close
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open) {
      el.showModal();
    } else {
      el.close();
    }
  }, [open]);

  // Click backdrop to close
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    function onClick(e: MouseEvent) {
      if (e.target === el) handleClose();
    }
    el.addEventListener("click", onClick);
    return () => el.removeEventListener("click", onClick);
  }, [open]);

  // Keyboard navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && open) {
        handleClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Filtered media list
  const filteredMedia = useMemo(() => {
    return media.filter((item) => {
      const type = getItemType(item.mimeType, item.url);
      if (typeFilter !== "ALL" && type !== typeFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.filename.toLowerCase().includes(q) ||
          item.url.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [media, typeFilter, searchQuery]);

  const selectedItem = useMemo(() => {
    return media.find((m) => m.id === selectedId) ?? (filteredMedia[0] || null);
  }, [media, selectedId, filteredMedia]);

  // Upload handler
  async function handleFileUpload(file: File) {
    if (!file || !programId) return;

    setIsUploading(true);
    setUploadStatus("Mengompresi dan mengunggah file…");
    setError(null);

    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("programId", programId);

      const res = await uploadToMediaGalleryAction(fd);
      if (!res.ok || !res.item) {
        setError(res.error || "Gagal mengunggah media.");
        setIsUploading(false);
        return;
      }

      // Prepend to media list & select it
      setMedia((prev) => [res.item!, ...prev]);
      setSelectedId(res.item.id);
      setActiveTab("gallery");
    } catch (err) {
      console.error("[MediaPicker:upload]", err);
      setError("Terjadi kesalahan saat mengunggah file.");
    } finally {
      setIsUploading(false);
      setUploadStatus("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // Delete handler
  async function handleDeleteMedia(id: string) {
    setDeletingId(id);
    try {
      const res = await deleteMediaAction(id, programId);
      if (res.ok) {
        setMedia((prev) => prev.filter((m) => m.id !== id));
        if (selectedId === id) {
          setSelectedId(null);
        }
        setConfirmDeleteId(null);
      } else {
        alert(res.error || "Gagal menghapus file.");
      }
    } catch (err) {
      console.error("[MediaPicker:delete]", err);
      alert("Terjadi kesalahan saat menghapus file.");
    } finally {
      setDeletingId(null);
    }
  }

  function handleCopyUrl(url: string) {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(url);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  }

  return (
    <>
      {/* Trigger Button */}
      <span onClick={handleOpen} style={{ display: "inline-block", cursor: "pointer" }}>
        {trigger ?? (
          <button type="button" className="btn btn-sm">
            📁 Pilih dari Gallery
          </button>
        )}
      </span>

      {/* Media Manager Dialog */}
      <dialog ref={dialogRef} className="mm-dialog">
        <div className="mm-container">
          {/* Header */}
          <div className="mm-header">
            <div className="mm-tabs">
              <button
                type="button"
                className={`mm-tab-btn${activeTab === "gallery" ? " is-active" : ""}`}
                onClick={() => setActiveTab("gallery")}
              >
                <span>📁 Galeri Media</span>
                <span className="mm-tab-count">{media.length}</span>
              </button>
              <button
                type="button"
                className={`mm-tab-btn${activeTab === "upload" ? " is-active" : ""}`}
                onClick={() => setActiveTab("upload")}
              >
                <span>⬆️ Upload File Baru</span>
              </button>
            </div>

            <button
              type="button"
              className="mm-close-btn"
              onClick={handleClose}
              title="Tutup Media Manager (Esc)"
              aria-label="Tutup"
            >
              ✕
            </button>
          </div>

          {/* Tab 1: Galeri Media */}
          {activeTab === "gallery" && (
            <>
              {/* Toolbar: Search, Filters, Stats */}
              <div className="mm-toolbar">
                <div className="mm-search-box">
                  <span style={{ fontSize: "0.85rem", opacity: 0.6 }}>🔍</span>
                  <input
                    type="text"
                    className="mm-search-input"
                    placeholder="Cari file berdasarkan nama…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      style={{
                        border: "none",
                        background: "none",
                        cursor: "pointer",
                        color: "var(--ink-faint)",
                        padding: 0,
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>

                <div className="mm-filter-chips">
                  <button
                    type="button"
                    className={`mm-chip${typeFilter === "ALL" ? " is-active" : ""}`}
                    onClick={() => setTypeFilter("ALL")}
                  >
                    Semua ({media.length})
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

                  <button
                    type="button"
                    className="btn btn-sm btn-purple"
                    style={{ fontSize: "0.74rem", padding: "0.3rem 0.7rem", marginLeft: "0.3rem" }}
                    onClick={() => setActiveTab("upload")}
                  >
                    + Upload
                  </button>
                </div>
              </div>

              {/* Body: Grid + Sidebar */}
              <div className="mm-body">
                {/* Main Grid */}
                <div className="mm-grid-container">
                  {loading && (
                    <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--ink-soft)" }}>
                      <span className="lms-dnd-spinner" style={{ marginBottom: "0.5rem" }} />
                      <p style={{ margin: 0, fontSize: "0.85rem" }}>Memuat galeri media…</p>
                    </div>
                  )}

                  {error && (
                    <div className="adm-alert err" style={{ margin: "1rem" }}>
                      <span>{error}</span>
                      <button
                        type="button"
                        className="btn btn-xs"
                        onClick={loadMedia}
                        style={{ marginLeft: "auto" }}
                      >
                        Coba Lagi
                      </button>
                    </div>
                  )}

                  {!loading && !error && filteredMedia.length === 0 && (
                    <div style={{ textAlign: "center", padding: "3.5rem 1rem", color: "var(--ink-soft)" }}>
                      <div style={{ fontSize: "2.5rem", marginBottom: "0.6rem" }}>📁</div>
                      <h4 style={{ margin: "0 0 0.4rem", fontSize: "0.95rem" }}>
                        {searchQuery ? "Tidak ada media yang cocok" : "Belum ada media di program ini"}
                      </h4>
                      <p style={{ margin: "0 0 1rem", fontSize: "0.8rem", color: "var(--ink-faint)" }}>
                        {searchQuery
                          ? `Tidak ditemukan file dengan kata kunci "${searchQuery}".`
                          : "Upload gambar (WebP/PNG/JPG), dokumen PDF, atau materi video untuk mulai."}
                      </p>
                      <button
                        type="button"
                        className="btn btn-purple btn-sm"
                        onClick={() => setActiveTab("upload")}
                      >
                        Upload Media Sekarang
                      </button>
                    </div>
                  )}

                  {!loading && !error && filteredMedia.length > 0 && (
                    <div className="mm-grid">
                      {filteredMedia.map((item) => {
                        const type = getItemType(item.mimeType, item.url);
                        const isSelected = selectedId === item.id;

                        return (
                          <div
                            key={item.id}
                            className={`mm-card${isSelected ? " is-selected" : ""}`}
                            onClick={() => setSelectedId(item.id)}
                            onDoubleClick={() => handleConfirmSelect(item.url)}
                            title={`${item.filename} (Klik 2x untuk memilih)`}
                          >
                            {/* Thumbnail Container */}
                            <div className="mm-card-thumb">
                              {type === "IMAGE" ? (
                                <img
                                  src={item.url}
                                  alt={item.filename}
                                  loading="lazy"
                                  className="mm-card-img"
                                  onError={(e) => {
                                    (e.currentTarget as HTMLElement).style.display = "none";
                                  }}
                                />
                              ) : type === "PDF" ? (
                                <div style={{ textAlign: "center", color: "#b91c1c" }}>
                                  <span style={{ fontSize: "2.2rem" }}>📄</span>
                                </div>
                              ) : (
                                <div style={{ textAlign: "center", color: "#6d28d9" }}>
                                  <span style={{ fontSize: "2.2rem" }}>🎬</span>
                                </div>
                              )}

                              <span className="mm-card-badge">{type}</span>

                              {isSelected && (
                                <span className="mm-card-selected-icon" title="Dipilih">
                                  ✓
                                </span>
                              )}
                            </div>

                            {/* Info */}
                            <div className="mm-card-info">
                              <div className="mm-card-title">{item.filename}</div>
                              <div className="mm-card-meta">
                                <span>{formatBytes(item.size)}</span>
                                <span>{formatDate(item.createdAt)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Detail Inspector Sidebar */}
                {selectedItem && (
                  <div className="mm-sidebar">
                    <h4 style={{ margin: 0, fontSize: "0.85rem", color: "var(--ink-soft)" }}>
                      Detail Media
                    </h4>

                    {/* Preview Box */}
                    <div className="mm-preview-box">
                      {getItemType(selectedItem.mimeType, selectedItem.url) === "IMAGE" ? (
                        <img
                          src={selectedItem.url}
                          alt={selectedItem.filename}
                          className="mm-preview-img"
                        />
                      ) : getItemType(selectedItem.mimeType, selectedItem.url) === "PDF" ? (
                        <div style={{ textAlign: "center", color: "#b91c1c" }}>
                          <span style={{ fontSize: "3rem" }}>📄</span>
                          <div style={{ fontSize: "0.75rem", fontWeight: 700, marginTop: "0.2rem" }}>
                            Dokumen PDF
                          </div>
                        </div>
                      ) : (
                        <div style={{ textAlign: "center", color: "#6d28d9" }}>
                          <span style={{ fontSize: "3rem" }}>🎬</span>
                          <div style={{ fontSize: "0.75rem", fontWeight: 700, marginTop: "0.2rem" }}>
                            File Video
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Metadata */}
                    <div className="mm-file-details">
                      <div className="mm-detail-row">
                        <span>Nama:</span>
                        <strong title={selectedItem.filename}>{selectedItem.filename}</strong>
                      </div>
                      <div className="mm-detail-row">
                        <span>Tipe:</span>
                        <strong>{selectedItem.mimeType || getItemType(selectedItem.mimeType, selectedItem.url)}</strong>
                      </div>
                      <div className="mm-detail-row">
                        <span>Ukuran:</span>
                        <strong>{formatBytes(selectedItem.size)}</strong>
                      </div>
                      <div className="mm-detail-row">
                        <span>Diupload:</span>
                        <strong>{formatDate(selectedItem.createdAt)}</strong>
                      </div>
                    </div>

                    {/* URL & Copy */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                      <label style={{ fontSize: "0.7rem", color: "var(--ink-faint)", margin: 0 }}>
                        URL Berkas:
                      </label>
                      <div className="mm-url-copy">
                        <input
                          type="text"
                          readOnly
                          value={selectedItem.url}
                          className="mm-url-input"
                        />
                        <button
                          type="button"
                          onClick={() => handleCopyUrl(selectedItem.url)}
                          style={{
                            border: "none",
                            background: "transparent",
                            cursor: "pointer",
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            color: copiedUrl ? "#16a34a" : "var(--purple)",
                            padding: "0.2rem 0.4rem",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {copiedUrl ? "✓ Tersalin" : "Salin"}
                        </button>
                      </div>
                    </div>

                    {/* Delete Confirmation or Actions */}
                    <div className="mm-sidebar-actions">
                      <button
                        type="button"
                        className="btn btn-purple"
                        style={{ width: "100%", justifyContent: "center", fontWeight: 700 }}
                        onClick={() => handleConfirmSelect(selectedItem.url)}
                      >
                        ✓ Pilih Media Ini
                      </button>

                      <a
                        href={selectedItem.url}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-sm"
                        style={{ width: "100%", justifyContent: "center", fontSize: "0.75rem" }}
                      >
                        ↗ Lihat File Asli
                      </a>

                      {confirmDeleteId === selectedItem.id ? (
                        <div
                          style={{
                            padding: "0.6rem",
                            borderRadius: 8,
                            background: "#fef2f2",
                            border: "1px solid #fecaca",
                            marginTop: "0.4rem",
                          }}
                        >
                          <p style={{ margin: "0 0 0.5rem", fontSize: "0.72rem", color: "#991b1b" }}>
                            Hapus file ini permanen dari galeri dan server?
                          </p>
                          <div style={{ display: "flex", gap: "0.4rem" }}>
                            <button
                              type="button"
                              className="btn btn-xs"
                              style={{
                                background: "#dc2626",
                                color: "#fff",
                                border: "none",
                                flex: 1,
                              }}
                              disabled={deletingId === selectedItem.id}
                              onClick={() => handleDeleteMedia(selectedItem.id)}
                            >
                              {deletingId === selectedItem.id ? "Menghapus…" : "Ya, Hapus"}
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
                        <button
                          type="button"
                          className="btn btn-sm"
                          style={{
                            width: "100%",
                            justifyContent: "center",
                            fontSize: "0.75rem",
                            color: "#dc2626",
                            borderColor: "#fecaca",
                            background: "#fff",
                            marginTop: "0.2rem",
                          }}
                          onClick={() => setConfirmDeleteId(selectedItem.id)}
                        >
                          🗑️ Hapus File
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="mm-footer">
                <div style={{ fontSize: "0.78rem", color: "var(--ink-soft)" }}>
                  {selectedItem ? (
                    <span>
                      Dipilih: <strong>{selectedItem.filename}</strong>
                    </span>
                  ) : (
                    <span>Pilih file dari daftar atau upload baru</span>
                  )}
                </div>

                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button type="button" className="btn btn-sm" onClick={handleClose}>
                    Batal
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-purple"
                    disabled={!selectedItem}
                    onClick={() => selectedItem && handleConfirmSelect(selectedItem.url)}
                  >
                    Gunakan File Ini
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Tab 2: Upload File Baru */}
          {activeTab === "upload" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <div
                className={`mm-dropzone-container${isDraggingOver ? " is-dragover" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingOver(true);
                }}
                onDragLeave={() => setIsDraggingOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDraggingOver(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleFileUpload(file);
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf,video/*"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                />

                <div className="mm-dropzone-icon">☁️</div>

                <h3 style={{ margin: "0 0 0.4rem", fontSize: "1.1rem" }}>
                  Tarik & letakkan file ke sini untuk mengunggah
                </h3>
                <p style={{ margin: "0 0 1.2rem", color: "var(--ink-soft)", fontSize: "0.82rem" }}>
                  Mendukung gambar (PNG, JPG, WebP otomatis dikompres), dokumen PDF, atau file video (maks 20 MB).
                </p>

                <button
                  type="button"
                  className="btn btn-purple"
                  disabled={isUploading}
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                >
                  {isUploading ? (
                    <>
                      <span className="lms-dnd-spinner" style={{ marginRight: "0.5rem" }} />
                      {uploadStatus || "Mengunggah…"}
                    </>
                  ) : (
                    "Pilih File dari Komputer"
                  )}
                </button>
              </div>

              {error && (
                <div className="adm-alert err" style={{ margin: "0 1.5rem 1.5rem" }}>
                  {error}
                </div>
              )}
            </div>
          )}
        </div>
      </dialog>
    </>
  );
}
