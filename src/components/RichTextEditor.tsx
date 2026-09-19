"use client";

import { useEffect, useRef, useState } from "react";
import "quill/dist/quill.snow.css";
import MediaPicker from "@/components/MediaPicker";
import { uploadMediaImageAction } from "@/app/webadmin/actions";

interface RichTextEditorProps {
  name?: string;
  defaultValue?: string | null;
  placeholder?: string;
  minHeight?: string;
  programId?: string;
  onChange?: (html: string) => void;
}

function formatVideoEmbedUrl(url: string): string {
  const trimmed = url.trim();
  // YouTube watch URL or short URL -> embed URL
  const ytMatch = trimmed.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
  if (ytMatch && ytMatch[1]) {
    return `https://www.youtube.com/embed/${ytMatch[1]}`;
  }
  // Vimeo URL -> player.vimeo.com/video/ID
  const vimeoMatch = trimmed.match(/vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/([^\/]*)\/videos\/|album\/(\d+)\/video\/|)(\d+)/i);
  if (vimeoMatch && vimeoMatch[3]) {
    return `https://player.vimeo.com/video/${vimeoMatch[3]}`;
  }
  return trimmed;
}

export default function RichTextEditor({
  name,
  defaultValue = "",
  placeholder = "Tulis materi pembelajaran di sini…",
  minHeight = "16rem",
  programId,
  onChange,
}: RichTextEditorProps) {
  const editorHostRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const quillRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [htmlValue, setHtmlValue] = useState(defaultValue ?? "");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [videoUrlInput, setVideoUrlInput] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function initQuill() {
      if (!editorHostRef.current) return;

      // Bersihkan container sebelumnya jika ada
      editorHostRef.current.innerHTML = "";
      const editorElement = document.createElement("div");
      editorHostRef.current.appendChild(editorElement);

      const { default: Quill } = await import("quill");
      if (!isMounted) return;

      const toolbarOptions = [
        [{ header: [1, 2, 3, false] }],
        ["bold", "italic", "underline", "strike"],
        [{ color: [] }, { background: [] }],
        [{ list: "ordered" }, { list: "bullet" }],
        ["blockquote", "code-block"],
        [{ align: [] }],
        ["link", "image", "video"],
        ["clean"],
      ];

      const q = new Quill(editorElement, {
        theme: "snow",
        placeholder,
        modules: {
          toolbar: toolbarOptions,
        },
      });

      quillRef.current = q;

      // Set initial content
      if (defaultValue) {
        q.clipboard.dangerouslyPasteHTML(defaultValue);
      }

      // Handler override untuk tombol image di toolbar Quill
      const toolbar = q.getModule("toolbar") as { addHandler: (name: string, fn: () => void) => void };
      if (toolbar) {
        toolbar.addHandler("image", () => {
          fileInputRef.current?.click();
        });

        toolbar.addHandler("video", () => {
          setVideoUrlInput("");
          setIsVideoModalOpen(true);
        });
      }

      // Listen text changes
      q.on("text-change", () => {
        const rootHtml = q.root.innerHTML;
        // Jika hanya berisi paragraf kosong, anggap string kosong
        const cleanVal = rootHtml === "<p><br></p>" ? "" : rootHtml;
        setHtmlValue(cleanVal);
        onChange?.(cleanVal);
      });
    }

    initQuill();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sisipkan media dari MediaPicker / Galeri
  const handleInsertMedia = (url: string) => {
    if (!quillRef.current) return;
    const q = quillRef.current;
    const range = q.getSelection(true);
    q.insertEmbed(range.index, "image", url);
    q.setSelection(range.index + 1);
  };

  // Upload file gambar baru & kompres ke WebP
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadStatus("Mengompres ke WebP & mengunggah…");

    try {
      const fd = new FormData();
      fd.append("file", file);
      if (programId) fd.append("programId", programId);
      fd.append("target", "article");

      const res = await uploadMediaImageAction(fd);
      if (res.error || !res.url) {
        alert(res.error || "Gagal mengunggah gambar.");
      } else if (quillRef.current) {
        const q = quillRef.current;
        const range = q.getSelection(true);
        q.insertEmbed(range.index, "image", res.url);
        q.setSelection(range.index + 1);
      }
    } catch (err) {
      console.error("Upload error:", err);
      alert("Terjadi kesalahan saat mengunggah gambar.");
    } finally {
      setIsUploading(false);
      setUploadStatus("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Sisipkan video embed
  const handleInsertVideo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoUrlInput.trim() || !quillRef.current) return;

    const embedUrl = formatVideoEmbedUrl(videoUrlInput.trim());
    const q = quillRef.current;
    const range = q.getSelection(true);
    q.insertEmbed(range.index, "video", embedUrl);
    q.setSelection(range.index + 1);

    setIsVideoModalOpen(false);
    setVideoUrlInput("");
  };

  return (
    <div className="lms-quill-wrapper">
      {/* Hidden input untuk Form Submit server action */}
      {name && <input type="hidden" name={name} value={htmlValue} />}

      {/* Baris Pintasan Cepat Media & Galeri di atas editor */}
      <div className="lms-rte-topbar">
        <div className="lms-rte-topbar-left">
          <button
            type="button"
            className="btn btn-sm lms-rte-action-btn"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
            title="Pilih gambar dari komputer: otomatis dikompres ke WebP dan disimpan ke Galeri"
          >
            <span>📷</span> Unggah Gambar (WebP)
          </button>

          {programId && (
            <MediaPicker
              programId={programId}
              onSelect={handleInsertMedia}
              trigger={
                <button
                  type="button"
                  className="btn btn-sm lms-rte-action-btn gallery"
                  title="Pilih gambar yang sudah pernah diunggah sebelumnya"
                >
                  <span>📁</span> Galeri Media (Reuse)
                </button>
              }
            />
          )}

          <button
            type="button"
            className="btn btn-sm lms-rte-action-btn"
            onClick={() => {
              setVideoUrlInput("");
              setIsVideoModalOpen(true);
            }}
            title="Sisipkan video YouTube atau Vimeo"
          >
            <span>🎬</span> Sisipkan Video
          </button>
        </div>

        {isUploading && (
          <div className="lms-rte-uploading-indicator">
            <span className="spinner" />
            <span>{uploadStatus}</span>
          </div>
        )}
      </div>

      {/* Hidden File Input untuk Image Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      {/* Container Quill Host */}
      <div
        ref={editorHostRef}
        className="lms-quill-host"
        style={{ minHeight }}
      />

      {/* Modal Sisipkan Video */}
      {isVideoModalOpen && (
        <div className="confirm-backdrop" onClick={() => setIsVideoModalOpen(false)}>
          <div
            className="confirm-card"
            style={{ maxWidth: "28rem", textAlign: "left" }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h3 style={{ fontSize: "1.1rem", fontWeight: 800, marginBottom: "0.5rem" }}>
              🎬 Sisipkan Video
            </h3>
            <p style={{ fontSize: "0.85rem", color: "var(--ink-soft)", marginBottom: "1rem" }}>
              Tempelkan tautan video dari <strong>YouTube</strong> atau <strong>Vimeo</strong> ke kolom di bawah ini:
            </p>

            <form onSubmit={handleInsertVideo}>
              <input
                type="url"
                required
                autoFocus
                placeholder="https://www.youtube.com/watch?v=..."
                value={videoUrlInput}
                onChange={(e) => setVideoUrlInput(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.6rem 0.8rem",
                  borderRadius: "var(--r-sm, 6px)",
                  border: "1px solid var(--chip, #cbd5e1)",
                  fontSize: "0.9rem",
                  marginBottom: "1.2rem",
                }}
              />

              <div style={{ display: "flex", gap: "0.6rem", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="btn btn-sm btn-line"
                  onClick={() => setIsVideoModalOpen(false)}
                >
                  Batal
                </button>
                <button type="submit" className="btn btn-sm btn-purple" style={{ fontWeight: 700 }}>
                  Sisipkan Video
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
