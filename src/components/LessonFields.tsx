"use client";

import { useId, useRef, useState } from "react";
import { uploadFileAction } from "@/app/webadmin/actions";
import RichTextEditor from "@/components/RichTextEditor";
import VideoUploader from "@/components/VideoUploader";
import MediaPicker from "@/components/MediaPicker";

type LessonData = {
  title?: string;
  type?: string;
  videoUrl?: string | null;
  fileUrl?: string | null;
  content?: string | null;
  duration?: string;
  passingScore?: number | null;
  isPreview?: boolean;
  allowDownload?: boolean;
};

const TYPES: { value: string; label: string; hint: string }[] = [
  { value: "VIDEO", label: "Video", hint: "Upload video langsung (diproses Bunny Stream), atau tempel URL YouTube/Vimeo." },
  { value: "TEXT", label: "Teks / Artikel", hint: "Tulis materi bacaan dengan format lengkap: judul bagian, tebal, daftar, tautan." },
  { value: "PDF", label: "PDF / Dokumen", hint: "Upload file PDF (maks 20 MB) atau tempel URL PDF eksternal." },
  { value: "QUIZ", label: "Kuis", hint: "Kuis bisa ditempatkan di posisi mana pun dalam modul. Peserta harus lulus agar materi dianggap selesai." },
];

/**
 * Field-field form materi — dirender di dalam <form action={saveLmsLesson}>.
 * Menampilkan dua kartu: Konten Materi (berubah sesuai tipe) dan Pengaturan.
 */
export default function LessonFields({ lesson, programId }: { lesson?: LessonData; programId?: string }) {
  const [type, setType] = useState(lesson?.type ?? "VIDEO");
  const [fileUrl, setFileUrl] = useState(lesson?.fileUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uid = useId();

  const activeType = TYPES.find((t) => t.value === type) ?? TYPES[0];

  async function handleUpload(file: File) {
    setUploadErr(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await uploadFileAction(fd);
      if (res.error || !res.url) {
        setUploadErr(res.error ?? "Upload gagal. Coba lagi.");
      } else {
        setFileUrl(res.url);
      }
    } catch {
      setUploadErr("Upload gagal (koneksi/server). Coba lagi.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="editor-cols">
      <div className="form-section">
        <header>
          <h3>Konten Materi</h3>
          <p>{activeType.hint}</p>
        </header>
        <div className="fs-body" style={{ gridTemplateColumns: "1fr" }}>
          <div className="field">
            <label>Judul Materi</label>
            <input name="title" defaultValue={lesson?.title ?? ""} placeholder="cth: Pengenalan Digital Marketing" required />
          </div>

          <div className="field">
            <label>Tipe Konten</label>
            <div className="seg">
              {TYPES.map((t) => (
                <label key={t.value} className={type === t.value ? "on" : ""}>
                  <input
                    type="radio"
                    name="type"
                    value={t.value}
                    checked={type === t.value}
                    onChange={() => setType(t.value)}
                  />
                  {t.label}
                </label>
              ))}
            </div>
          </div>

          {type === "VIDEO" && (
            <div className="field">
              <label>Video</label>
              <VideoUploader name="videoUrl" defaultValue={lesson?.videoUrl ?? ""} programId={programId} />
            </div>
          )}

          {type === "PDF" && (
            <div className="field">
              <label>File PDF</label>
              <input type="hidden" name="fileUrl" value={fileUrl} />
              <div className="upload-box">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  id={`${uid}-pdf`}
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload(f);
                  }}
                />
                <button
                  type="button"
                  className="btn btn-sm btn-purple"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? "Mengunggah…" : "Pilih File PDF"}
                </button>
                {fileUrl && !uploading && (
                  <a href={fileUrl} target="_blank" rel="noreferrer" style={{ fontSize: ".8rem", fontWeight: 700, color: "var(--purple)" }}>
                    Lihat file terpasang
                  </a>
                )}
                {!fileUrl && !uploading && (
                  <span style={{ fontSize: ".78rem", color: "var(--ink-faint)", fontWeight: 600 }}>Belum ada file terpasang</span>
                )}
              </div>
              {uploadErr && (
                <span style={{ display: "block", marginTop: ".4rem", fontSize: ".78rem", color: "var(--red)", fontWeight: 700 }}>{uploadErr}</span>
              )}
              <div style={{ display: "flex", gap: ".4rem", alignItems: "center", marginTop: ".6rem" }}>
                <input
                  defaultValue={lesson?.fileUrl ?? ""}
                  onChange={(e) => setFileUrl(e.target.value.trim())}
                  placeholder="…atau tempel URL PDF eksternal di sini"
                  style={{ flex: 1, minWidth: 0 }}
                />
                {programId && (
                  <MediaPicker
                    programId={programId}
                    onSelect={(url) => setFileUrl(url)}
                    trigger={
                      <button type="button" className="btn btn-sm" title="Pilih dari Gallery">
                        📁
                      </button>
                    }
                  />
                )}
              </div>
              <div className="field full" style={{ display: "flex", alignItems: "center", gap: ".6rem", marginBottom: 0, marginTop: ".6rem" }}>
                <input
                  type="checkbox"
                  name="allowDownload"
                  id={`${uid}-download`}
                  defaultChecked={lesson?.allowDownload ?? false}
                  style={{ width: "auto" }}
                />
                <label htmlFor={`${uid}-download`} style={{ margin: 0, fontSize: ".82rem" }}>
                  Izinkan peserta mengunduh PDF ini (kalau tidak dicentang, hanya bisa dibaca di LMS)
                </label>
              </div>
            </div>
          )}

          {type === "TEXT" && (
            <div className="field">
              <label>Isi Materi</label>
              <RichTextEditor
                name="content"
                defaultValue={lesson?.content ?? ""}
                minHeight="16rem"
                placeholder="Tulis materi pembelajaran di sini…"
                programId={programId}
              />
            </div>
          )}

          {type === "VIDEO" && (
            <div className="field">
              <label>Catatan / Deskripsi Tambahan (opsional)</label>
              <RichTextEditor
                name="content"
                defaultValue={lesson?.content ?? ""}
                minHeight="7rem"
                placeholder="Ringkasan atau catatan pendamping video…"
                programId={programId}
              />
            </div>
          )}

          {type === "QUIZ" && (
            <p className="adm-note" style={{ margin: 0 }}>
              Soal-soal kuis dikelola di bagian bawah halaman ini setelah materi disimpan.
            </p>
          )}
        </div>
      </div>

      <div className="form-section">
        <header>
          <h3>Pengaturan</h3>
        </header>
        <div className="fs-body" style={{ gridTemplateColumns: "1fr" }}>
          <div className="field">
            <label>Durasi Estimasi</label>
            <input name="duration" defaultValue={lesson?.duration ?? "10 menit"} placeholder="cth: 15 menit" />
          </div>

          {type === "QUIZ" && (
            <div className="field">
              <label>Skor Lulus Kuis</label>
              <input name="passingScore" inputMode="numeric" defaultValue={lesson?.passingScore ?? ""} placeholder="Kosongkan = ikut skor program" />
            </div>
          )}

          <div className="field full" style={{ display: "flex", alignItems: "center", gap: ".6rem", marginBottom: 0 }}>
            <input
              type="checkbox"
              name="isPreview"
              id={`${uid}-preview`}
              defaultChecked={lesson?.isPreview ?? false}
              style={{ width: "auto" }}
            />
            <label htmlFor={`${uid}-preview`} style={{ margin: 0, fontSize: ".82rem" }}>
              Jadikan preview gratis — bisa dilihat calon peserta sebelum membayar
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
