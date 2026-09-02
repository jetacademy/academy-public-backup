"use client";

import { useRef, useState } from "react";
import { Upload as TusUpload } from "tus-js-client";
import { createBunnyUploadSession, deleteBunnyVideoAction } from "@/app/webadmin/actions";
import MediaPicker from "./MediaPicker";

const BUNNY_EMBED_RE = /iframe\.mediadelivery\.net\/embed\/(\d+)\/([a-f0-9-]+)/i;
const MAX_VIDEO_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB — batas wajar sisi klien, Bunny sendiri jauh lebih longgar

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Upload video ke Bunny Stream langsung dari browser (protokol TUS resumable),
 * dengan drag & drop, progress bar, batal, dan pratinjau player setelah selesai.
 * Bisa juga diisi manual pakai URL YouTube/Vimeo.
 */
export default function VideoUploader({ name, defaultValue, programId }: { name: string; defaultValue: string; programId?: string }) {
  const [videoUrl, setVideoUrl] = useState(defaultValue);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<TusUpload | null>(null);

  const isBunnyVideo = BUNNY_EMBED_RE.test(videoUrl);

  async function startUpload(file: File) {
    setError(null);
    if (!file.type.startsWith("video/")) {
      setError("File harus berupa video (mp4, mov, mkv, dll).");
      return;
    }
    if (file.size > MAX_VIDEO_BYTES) {
      setError(`Ukuran file terlalu besar (maks ${formatBytes(MAX_VIDEO_BYTES)}).`);
      return;
    }

    setUploading(true);
    setProgress(0);
    setFileName(file.name);
    setFileSize(file.size);

    try {
      const session = await createBunnyUploadSession(file.name);
      if ("error" in session) {
        setError(session.error);
        return;
      }
      const { guid, libraryId, expire, signature } = session;
      const oldEmbed = videoUrl;

      await new Promise<void>((resolve, reject) => {
        const upload = new TusUpload(file, {
          endpoint: "https://video.bunnycdn.com/tusupload",
          retryDelays: [0, 3000, 5000, 10000],
          headers: {
            AuthorizationSignature: signature,
            AuthorizationExpire: String(expire),
            VideoId: guid,
            LibraryId: libraryId,
          },
          metadata: { filetype: file.type, title: file.name },
          onError: (err) => reject(err),
          onProgress: (sent, total) => setProgress(Math.round((sent / total) * 100)),
          onSuccess: () => resolve(),
        });
        uploadRef.current = upload;
        upload.start();
      });

      setVideoUrl(`https://iframe.mediadelivery.net/embed/${libraryId}/${guid}`);

      // Video lama (kalau ada & beda) dihapus dari Bunny — best-effort, tidak blocking
      const oldMatch = oldEmbed.match(BUNNY_EMBED_RE);
      if (oldMatch) deleteBunnyVideoAction(oldMatch[2]).catch(() => {});
    } catch (err) {
      const aborted = err instanceof Error && err.message.toLowerCase().includes("abort");
      if (!aborted) setError(err instanceof Error ? err.message : "Upload video gagal. Coba lagi.");
    } finally {
      setUploading(false);
      uploadRef.current = null;
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function handleCancel() {
    uploadRef.current?.abort(true);
    setUploading(false);
    setProgress(0);
  }

  function handleReplace() {
    setVideoUrl("");
    setError(null);
  }

  return (
    <>
      {/* Hidden field yang benar-benar dikirim di form */}
      <input type="hidden" name={name} value={videoUrl} />
      {/* Trik validasi native: blokir submit form selama upload masih berjalan */}
      <input
        type="text"
        readOnly
        required
        tabIndex={-1}
        value={uploading ? "" : "ok"}
        aria-hidden="true"
        style={{ position: "absolute", width: 0, height: 0, opacity: 0, pointerEvents: "none" }}
        onInvalid={(e) => e.currentTarget.setCustomValidity("Tunggu upload video selesai sebelum menyimpan materi.")}
        onChange={() => {}}
      />

      {uploading ? (
        <div className="video-progress-card">
          <div className="video-progress-head">
            <span className="video-progress-name" title={fileName}>{fileName} · {formatBytes(fileSize)}</span>
            <span className="video-progress-pct">{progress}%</span>
          </div>
          <div className="video-progress-track">
            <div className="video-progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <button type="button" className="btn btn-sm video-progress-cancel" onClick={handleCancel}>
            Batalkan Upload
          </button>
        </div>
      ) : isBunnyVideo ? (
        <div className="video-preview-card">
          <div className="video-preview-frame">
            <iframe src={videoUrl} allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowFullScreen title="Pratinjau video" />
          </div>
          <div className="video-preview-foot">
            <span>✓ Video Bunny terpasang{fileName && ` — ${fileName}`}</span>
            <button type="button" className="btn btn-sm" onClick={handleReplace}>Ganti Video</button>
          </div>
        </div>
      ) : (
        <>
          <div
            className={`video-drop${dragging ? " dragging" : ""}${error ? " has-error" : ""}`}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer.files?.[0];
              if (f) startUpload(f);
            }}
          >
            <input
              ref={inputRef}
              type="file"
              accept="video/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) startUpload(f);
              }}
            />
            <div className="video-drop-icon">▶</div>
            <div className="video-drop-title">Klik untuk pilih video, atau tarik &amp; lepas di sini</div>
            <div className="video-drop-sub">MP4, MOV, MKV — diproses otomatis oleh Bunny Stream (CDN cepat, tanpa iklan)</div>
          </div>

          {error && (
            <span style={{ display: "block", marginTop: ".5rem", fontSize: ".78rem", color: "var(--red)", fontWeight: 700 }}>{error}</span>
          )}

          <div style={{ display: "flex", gap: ".4rem", alignItems: "center", marginTop: ".7rem" }}>
            <input
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value.trim())}
              placeholder="…atau tempel URL YouTube/Vimeo di sini"
              style={{ flex: 1, minWidth: 0 }}
            />
            {programId && (
              <MediaPicker
                programId={programId}
                onSelect={(url) => setVideoUrl(url)}
                trigger={
                  <button type="button" className="btn btn-sm" title="Pilih dari Gallery">
                    📁
                  </button>
                }
              />
            )}
          </div>
        </>
      )}
    </>
  );
}
