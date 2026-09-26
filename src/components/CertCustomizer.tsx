/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useRef, useLayoutEffect } from "react";
import Link from "next/link";
import { uploadFileAction, saveCertTemplate, saveNewCertTemplate } from "@/app/webadmin/actions";
import Icon from "@/components/Icon";
import CertificateSheet from "@/components/CertificateSheet";
import type { CertLayout, CertLayoutEntry } from "@/lib/types";

type ProgramData = {
  id: string;
  slug: string;
  title: string;
  mentorName: string;
  materi: any; // array string
  certBgUrl: string | null;
  certConfig: any; // JSON
};

const DEFAULT_ACCENT_COLOR = "#232176";

// Lebar acuan render CertificateSheet — sama dengan max-width .cert-a4 di halaman pratinjau/publik
// (lihat globals-cert.css). Sheet selalu di-render pada lebar tetap ini lalu diskalakan visual pakai
// CSS transform, supaya font-size berbasis cqw menghitung terhadap lebar yang SAMA persis dengan
// pratinjau/publik — apa pun lebar kolom editor ini di layar. Tanpa ini, font akan terlihat beda
// proporsi di editor (kolom sempit) vs pratinjau (lebar penuh).
const CERT_REF_WIDTH = 800;

export default function CertCustomizer({
  program,
  templates = [],
  backLink = { href: `/webadmin/program/${program.id}`, label: "Kembali ke Edit Program" },
}: {
  program: ProgramData;
  templates?: any[];
  /** Tombol di bawah pratinjau. null = sembunyikan (mis. di wizard Kirim Sertifikat yang punya navigasi sendiri). */
  backLink?: { href: string; label: string } | null;
}) {
  const materiList = Array.isArray(program.materi) ? (program.materi as string[]) : [];
  const bgInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Template Master Selector state
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  // Parse initial config
  const initialConfig = program.certConfig || {};
  const [bgUrl, setBgUrl] = useState(program.certBgUrl || "");
  const [logoUrl, setLogoUrl] = useState(initialConfig.logoUrl || "");

  const [title, setTitle] = useState(initialConfig.title || "SERTIFIKAT");
  const [subtitle, setSubtitle] = useState(initialConfig.subtitle || "KETERANGAN SELESAI TOPIK PELATIHAN");
  const [numberFormat, setNumberFormat] = useState(initialConfig.numberFormat || "NOMOR : 2500/JSA-GP/[serial]/[month]/[year]");
  const [description, setDescription] = useState(
    initialConfig.description ||
      "Sebagai peserta dalam pelatihan nasional yang diadakan oleh PT Jetschool Academy Indonesia dengan tema: \"{title}\" yang dilaksanakan pada {date}."
  );
  const [placeDate, setPlaceDate] = useState(initialConfig.placeDate || "Bekasi, [date]");
  const [accentColor, setAccentColor] = useState(initialConfig.accentColor || DEFAULT_ACCENT_COLOR);

  // Tanda tangan — hanya Direktur (satu tanda tangan resmi, sesuai kebijakan terbaru)
  const [sign2Name, setSign2Name] = useState(initialConfig.sign2Name || "Najib");
  const [sign2Role, setSign2Role] = useState(initialConfig.sign2Role || "Direktur PT Jetschool Academy Indonesia");
  const [sign2Img, setSig2Img] = useState(initialConfig.sign2Img || "");
  const [stampImg, setStampImg] = useState(initialConfig.stampImg || "");

  // Posisi & skala custom per elemen sertifikat, diatur lewat drag/resize di pratinjau live
  const [layout, setLayout] = useState<CertLayout>(initialConfig.layout || {});
  function handleLayoutChange(id: string, entry: CertLayoutEntry) {
    setLayout((prev) => ({ ...prev, [id]: entry }));
  }
  function resetLayout() {
    if (confirm("Reset semua posisi elemen ke tata letak bawaan?")) setLayout({});
  }

  // Skala visual kolom pratinjau live: sheet dirender tetap 800px lebar (CERT_REF_WIDTH), lalu
  // di-scale ke lebar kolom sebenarnya lewat CSS transform (bukan resize elemen), supaya cqw di
  // dalam CertificateSheet menghitung terhadap 800px persis seperti di halaman pratinjau/publik.
  const frameRef = useRef<HTMLDivElement>(null);
  const [frameScale, setFrameScale] = useState(1);

  useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const updateScale = () => setFrameScale(el.clientWidth / CERT_REF_WIDTH);
    updateScale();
    const ro = new ResizeObserver(updateScale);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // JP weights table
  const initialMateriJp = Array.isArray(initialConfig.materiJp) ? initialConfig.materiJp : [];
  const [materiJp, setMateriJp] = useState<{ materi: string; teori: number; tugas: number }[]>(() => {
    if (initialMateriJp.length > 0 && initialMateriJp.every((r: any) => typeof r?.materi === "string")) {
      return initialMateriJp.map((r: any) => ({
        materi: r.materi,
        teori: Number(r.teori) || 0,
        tugas: Number(r.tugas) || 0,
      }));
    }
    return materiList.map((m, idx) => {
      const match = initialMateriJp[idx];
      return {
        materi: m,
        teori: match?.teori != null ? Number(match.teori) : 5,
        tugas: match?.tugas != null ? Number(match.tugas) : 3,
      };
    });
  });

  function addJpRow() {
    setMateriJp((rows) => [...rows, { materi: "", teori: 2, tugas: 1 }]);
  }
  function removeJpRow(index: number) {
    setMateriJp((rows) => rows.filter((_, i) => i !== index));
  }
  function handleJpMateriChange(index: number, val: string) {
    setMateriJp((rows) => rows.map((r, i) => (i === index ? { ...r, materi: val } : r)));
  }

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Calculate total JP
  const totalJp = materiJp.reduce((acc, curr) => acc + curr.teori + curr.tugas, 0);

  // File upload handler
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>, target: "bg" | "logo" | "sig2" | "stamp") {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("target", target === "bg" ? "certificate" : target === "logo" ? "logo" : "signature");

    try {
      const res = await uploadFileAction(fd);
      if (res.error || !res.url) {
        alert("Gagal mengunggah berkas: " + (res.error ?? "kesalahan tak dikenal."));
        return;
      }
      const url = res.url;
      if (target === "bg") setBgUrl(url);
      if (target === "logo") setLogoUrl(url);
      if (target === "sig2") setSig2Img(url);
      if (target === "stamp") setStampImg(url);
    } catch {
      alert("Gagal mengunggah berkas: koneksi atau server bermasalah. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  // Update JP weight for a specific item
  function handleJpChange(index: number, field: "teori" | "tugas", val: number) {
    const updated = [...materiJp];
    updated[index][field] = val;
    setMateriJp(updated);
  }

  function buildConfig() {
    return {
      title,
      subtitle,
      numberFormat,
      description,
      placeDate,
      accentColor,
      sign2Name,
      sign2Role,
      sign2Img,
      stampImg,
      logoUrl,
      materiJp,
      layout,
    };
  }

  // Save to DB (program cert)
  async function handleSave() {
    setSaving(true);
    try {
      await saveCertTemplate(program.id, bgUrl || null, buildConfig());
      alert("Sertifikat program berhasil disimpan!");
    } catch (err: any) {
      alert("Gagal menyimpan: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  // Terapkan Template Master ke Editor
  function handleApplyMasterTemplate(tpl: any) {
    if (!confirm(`Terapkan desain template "${tpl.name}" ke editor sertifikat ini? Pengaturan di editor akan diperbarui.`)) return;
    const cfg = tpl.certConfig || {};
    setBgUrl(tpl.certBgUrl || "");
    if (cfg.logoUrl !== undefined) setLogoUrl(cfg.logoUrl);
    if (cfg.title) setTitle(cfg.title);
    if (cfg.subtitle) setSubtitle(cfg.subtitle);
    if (cfg.numberFormat) setNumberFormat(cfg.numberFormat);
    if (cfg.description) setDescription(cfg.description);
    if (cfg.placeDate) setPlaceDate(cfg.placeDate);
    if (cfg.accentColor) setAccentColor(cfg.accentColor);
    if (cfg.sign2Name) setSign2Name(cfg.sign2Name);
    if (cfg.sign2Role) setSign2Role(cfg.sign2Role);
    if (cfg.sign2Img !== undefined) setSig2Img(cfg.sign2Img);
    if (cfg.stampImg !== undefined) setStampImg(cfg.stampImg);
    if (cfg.layout) setLayout(cfg.layout);
    if (Array.isArray(cfg.materiJp)) {
      setMateriJp(cfg.materiJp.map((r: any) => ({
        materi: String(r.materi || ""),
        teori: Number(r.teori) || 0,
        tugas: Number(r.tugas) || 0,
      })));
    }
  }

  // Simpan sebagai Template Master Baru
  async function handleSaveAsTemplateModal() {
    const namePrompt = prompt("Masukkan nama untuk template sertifikat master ini:", `${program.title} - Template`);
    if (!namePrompt || !namePrompt.trim()) return;
    const descPrompt = prompt("Masukkan catatan/deskripsi singkat (opsional):", "");
    setSaving(true);
    try {
      await saveNewCertTemplate(namePrompt.trim(), descPrompt || undefined, bgUrl || null, buildConfig());
      alert(`Template "${namePrompt.trim()}" berhasil disimpan ke Pustaka Template Sertifikat!`);
      window.location.reload();
    } catch (err: any) {
      alert("Gagal menyimpan template: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  // Resolve template variables for preview
  const previewDesc = description
    .replace(/{title}/g, program.title)
    .replace(/{name}/g, "Syntia Bella, S.Pd.")
    .replace(/{date}/g, "02 Agustus 2026")
    .replace(/{institution}/g, "SMP Negeri 234 Yogyakarta");

  const previewNum = numberFormat
    .replace(/\[serial\]/g, "0042")
    .replace(/\[month\]/g, "VIII")
    .replace(/\[year\]/g, "2026");

  const previewPlaceDate = placeDate.replace(/\[date\]/g, "02 Agustus 2026");

  // Preview cetak/PDF: simpan draft saat ini ke sessionStorage lalu buka tab pratinjau
  function handlePreviewPdf() {
    sessionStorage.setItem(`certDraft:${program.id}`, JSON.stringify({ bgUrl, config: buildConfig() }));
    window.open(`/webadmin/program/${program.id}/cert/preview`, "_blank");
  }

  return (
    <div className="cert-editor-grid">
      {/* LEFT COLUMN: EDIT FORM */}
      <div className="reg-card" style={{ padding: "1.8rem", maxWidth: "none", margin: 0 }}>
        <h3 style={{ marginBottom: "1.5rem" }}>Pengaturan Sertifikat</h3>

        {/* Master Template Selector Header */}
        <div
          style={{
            background: "#F4F0FF",
            border: "1px solid #D8C7FF",
            borderRadius: "var(--r-md)",
            padding: "1.1rem 1.2rem",
            marginBottom: "1.5rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: ".5rem", flexWrap: "wrap", gap: ".5rem" }}>
            <h4 style={{ margin: 0, color: "var(--purple)", display: "flex", alignItems: "center", gap: ".4rem", fontSize: "0.95rem" }}>
              <Icon name="file-text" size={16} />
              Gunakan Template Sertifikat Master
            </h4>
            <Link href="/webadmin/templates-sertifikat" target="_blank" style={{ fontSize: ".78rem", color: "var(--purple)", fontWeight: 600 }}>
              Pustaka Template ↗
            </Link>
          </div>
          <p style={{ fontSize: ".8rem", color: "var(--ink-soft)", margin: "0 0 .8rem", lineHeight: 1.4 }}>
            Pilih template tersimpan dari program lain untuk diterapkan ke editor sertifikat ini.
          </p>

          <div style={{ display: "flex", gap: ".6rem", flexWrap: "wrap" }}>
            <select
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              style={{ flex: 1, minWidth: "180px", padding: ".4rem .6rem", borderRadius: "6px", border: "1px solid var(--line)" }}
            >
              <option value="">-- Pilih Template ({templates.length} Tersedia) --</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-sm btn-purple"
              disabled={!selectedTemplateId}
              onClick={() => {
                const tpl = templates.find((t) => t.id === selectedTemplateId);
                if (tpl) handleApplyMasterTemplate(tpl);
              }}
            >
              Terapkan ke Editor
            </button>
          </div>
        </div>

        {/* 1. Background & Logo */}
        <div style={{ borderBottom: "1px solid var(--line)", paddingBottom: "1.5rem", marginBottom: "1.5rem" }}>
          <h4 style={{ display: "flex", alignItems: "center", gap: ".5rem", color: "var(--purple)" }}>
            <Icon name="image" size={18} />
            Desain Background
          </h4>
          <p style={{ fontSize: ".8rem", color: "var(--ink-soft)", margin: ".3rem 0 .8rem" }}>
            Upload desain template sertifikat kosong (A4 Portrait disarankan). Kosongkan untuk pakai desain modern bawaan Jetschool Academy di bawah.
          </p>
          <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
            <input
              ref={bgInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => handleFileUpload(e, "bg")}
              disabled={loading}
            />
            <button
              type="button"
              className="btn btn-sm btn-purple"
              disabled={loading}
              onClick={() => bgInputRef.current?.click()}
            >
              {loading ? "Mengunggah..." : "Pilih File Gambar"}
            </button>
            {bgUrl && (
              <button className="btn btn-sm btn-danger" onClick={() => setBgUrl("")}>
                Hapus
              </button>
            )}
          </div>
          {bgUrl && (
            <div style={{ marginTop: ".8rem", fontSize: ".8rem", wordBreak: "break-all", opacity: 0.75 }}>
              URL: <code>{bgUrl}</code>
            </div>
          )}

          <div className="field" style={{ marginTop: "1rem" }}>
            <label>Logo Header</label>
            <p style={{ fontSize: ".8rem", color: "var(--ink-soft)", margin: ".2rem 0 .6rem" }}>
              Kosongkan untuk pakai logo bawaan Jetschool Academy.
            </p>
            <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => handleFileUpload(e, "logo")}
                disabled={loading}
              />
              <button
                type="button"
                className="btn btn-sm btn-purple"
                disabled={loading}
                onClick={() => logoInputRef.current?.click()}
              >
                {loading ? "Mengunggah..." : "Pilih File Logo"}
              </button>
              {logoUrl && (
                <button type="button" className="btn btn-sm btn-danger" onClick={() => setLogoUrl("")}>
                  Hapus
                </button>
              )}
            </div>
          </div>

          <div className="field" style={{ marginTop: "1rem" }}>
            <label>Warna Aksen (judul, garis, bracket sudut, badge nomor)</label>
            <div style={{ display: "flex", gap: ".6rem", alignItems: "center" }}>
              <input
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                style={{ width: "3rem", height: "2.2rem", padding: "2px", cursor: "pointer" }}
              />
              <input
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                placeholder="#232176"
                style={{ maxWidth: "10rem" }}
              />
            </div>
          </div>
        </div>

        {/* 2. Main Texts */}
        <div style={{ borderBottom: "1px solid var(--line)", paddingBottom: "1.5rem", marginBottom: "1.5rem" }}>
          <h4 style={{ display: "flex", alignItems: "center", gap: ".5rem", color: "var(--purple)", marginBottom: "1rem" }}>
            <Icon name="file-text" size={18} />
            Teks &amp; Deskripsi
          </h4>
          <div className="field">
            <label>Judul Sertifikat</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="SERTIFIKAT" />
          </div>
          <div className="field">
            <label>Sub-Judul</label>
            <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="KETERANGAN SELESAI TOPIK PELATIHAN" />
          </div>
          <div className="field">
            <label>Format Nomor Sertifikat</label>
            <input value={numberFormat} onChange={(e) => setNumberFormat(e.target.value)} placeholder="NOMOR : [serial]/JSA-GP/[month]/[year]" />
            <span style={{ fontSize: ".72rem", color: "var(--ink-soft)" }}>
              Gunakan: <code>[serial]</code>, <code>[month]</code>, <code>[year]</code> untuk auto-increment.
            </span>
          </div>
          <div className="field">
            <label>Template Deskripsi Kelulusan</label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Sebagai peserta dalam pelatihan nasional..."
            />
            <span style={{ fontSize: ".72rem", color: "var(--ink-soft)" }}>
              Gunakan placeholder: <code>{"{title}"}</code>, <code>{"{name}"}</code>, <code>{"{institution}"}</code>, <code>{"{date}"}</code>.
            </span>
          </div>
          <div className="field">
            <label>Tempat &amp; Tanggal Terbit</label>
            <input value={placeDate} onChange={(e) => setPlaceDate(e.target.value)} placeholder="Bekasi, [date]" />
            <span style={{ fontSize: ".72rem", color: "var(--ink-soft)" }}>
              Gunakan <code>[date]</code> untuk tanggal batch (jadwal pelatihan) peserta secara otomatis. Ganti nama kota sesuai lokasi program.
            </span>
          </div>
        </div>

        {/* 3. Syllabus JP */}
        <div style={{ borderBottom: "1px solid var(--line)", paddingBottom: "1.5rem", marginBottom: "1.5rem" }}>
          <h4 style={{ display: "flex", alignItems: "center", gap: ".5rem", color: "var(--purple)", marginBottom: ".5rem" }}>
            <Icon name="list" size={18} />
            Bobot Jam Pelajaran (JP)
          </h4>
          <p style={{ fontSize: ".8rem", color: "var(--ink-soft)", marginBottom: "1rem" }}>
            Baris materi bisa ditambah, diubah, atau dihapus bebas — tidak terikat daftar materi program.
            Total saat ini: <b>{totalJp} JP</b>.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
            {materiJp.map((m, idx) => (
              <div key={idx} style={{ background: "rgba(0,0,0,0.02)", padding: ".8rem", borderRadius: "var(--r-sm)", border: "1px solid var(--line)" }}>
                <div style={{ display: "flex", gap: ".6rem", alignItems: "center", marginBottom: ".5rem" }}>
                  <span style={{ fontSize: ".8rem", fontWeight: 700, color: "var(--ink-soft)", flexShrink: 0 }}>{idx + 1}.</span>
                  <input
                    value={m.materi}
                    onChange={(e) => handleJpMateriChange(idx, e.target.value)}
                    placeholder="Nama materi pelatihan…"
                    style={{ flex: 1, padding: ".45rem .7rem", fontSize: ".85rem", fontWeight: 600 }}
                  />
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    onClick={() => removeJpRow(idx)}
                    title="Hapus baris ini"
                    style={{ flexShrink: 0 }}
                  >
                    Hapus
                  </button>
                </div>
                <div style={{ display: "flex", gap: "1rem" }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: ".75rem", display: "block", marginBottom: ".2rem" }}>Teori (JP)</label>
                    <input
                      type="number"
                      value={m.teori}
                      onChange={(e) => handleJpChange(idx, "teori", Math.max(0, Number(e.target.value)))}
                      style={{ padding: ".4rem" }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: ".75rem", display: "block", marginBottom: ".2rem" }}>Tugas (JP)</label>
                    <input
                      type="number"
                      value={m.tugas}
                      onChange={(e) => handleJpChange(idx, "tugas", Math.max(0, Number(e.target.value)))}
                      style={{ padding: ".4rem" }}
                    />
                  </div>
                </div>
              </div>
            ))}
            <button type="button" className="btn btn-sm" onClick={addJpRow} style={{ alignSelf: "flex-start" }}>
              + Tambah Baris Materi
            </button>
          </div>
        </div>

        {/* 4. Signature — Direktur saja (satu tanda tangan resmi) */}
        <div style={{ borderBottom: "1px solid var(--line)", paddingBottom: "1.5rem", marginBottom: "1.5rem" }}>
          <h4 style={{ display: "flex", alignItems: "center", gap: ".5rem", color: "var(--purple)", marginBottom: "1rem" }}>
            <Icon name="users" size={18} />
            Tanda Tangan &amp; Stempel
          </h4>

          <div style={{ background: "rgba(108, 92, 231, 0.02)", padding: "1rem", borderRadius: "var(--r-sm)", border: "1px solid rgba(108, 92, 231, 0.15)" }}>
            <div className="field">
              <label>Nama Lengkap</label>
              <input value={sign2Name} onChange={(e) => setSign2Name(e.target.value)} placeholder="Najib" />
            </div>
            <div className="field">
              <label>Jabatan / Peran</label>
              <input value={sign2Role} onChange={(e) => setSign2Role(e.target.value)} placeholder="Direktur PT Jetschool Academy Indonesia" />
            </div>
            <div className="field">
              <label>File Tanda Tangan (PNG Transparan)</label>
              <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, "sig2")} />
              {sign2Img && <div style={{ fontSize: ".75rem", opacity: 0.7, marginTop: ".2rem" }}>Uploaded: {sign2Img}</div>}
            </div>
            <div className="field">
              <label>File Stempel Resmi (PNG Transparan)</label>
              <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, "stamp")} />
              {stampImg && <div style={{ fontSize: ".75rem", opacity: 0.7, marginTop: ".2rem" }}>Uploaded: {stampImg}</div>}
            </div>
          </div>
        </div>

        {/* Save & Preview Buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: ".7rem" }}>
          <button
            type="button"
            onClick={handlePreviewPdf}
            className="btn btn-block"
            style={{ fontWeight: 600 }}
          >
            Preview Sertifikat (Uji Coba) &amp; Download PNG
          </button>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: ".6rem" }}>
            <button
              type="button"
              onClick={handleSaveAsTemplateModal}
              className="btn btn-block"
              style={{ fontWeight: 600, border: "1px solid var(--purple)", color: "var(--purple)" }}
              disabled={saving || loading}
            >
              ➕ Simpan sbg Template Baru
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="btn btn-purple btn-block"
              style={{ fontWeight: 700 }}
              disabled={saving || loading}
            >
              {saving ? "Menyimpan..." : "Simpan ke Program Ini"}
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: LIVE PREVIEW */}
      <div className="cert-editor-preview-col">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: ".8rem" }}>
          <div>
            <h4 style={{ margin: 0 }}>Pratinjau Live (A4 Portrait)</h4>
            <small style={{ color: "var(--ink-soft)" }}>Arahkan kursor ke elemen lalu seret untuk pindah, atau seret kotak ungu di pojoknya untuk perbesar/perkecil. Klik dua kali untuk reset satu elemen.</small>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: ".8rem", flexShrink: 0 }}>
            <button type="button" className="btn btn-sm" onClick={resetLayout}>
              Reset Posisi
            </button>
            <span style={{ fontSize: ".8rem", color: "var(--purple)", fontWeight: 700 }}>✓ Sinkron Instan</span>
          </div>
        </div>

        <div
          ref={frameRef}
          className="cert-preview-wrapper"
          style={{ width: "100%", aspectRatio: "1 / 1.414", overflow: "hidden", position: "relative" }}
        >
          <div style={{ width: `${CERT_REF_WIDTH}px`, position: "absolute", top: 0, left: 0, transformOrigin: "top left", transform: `scale(${frameScale})` }}>
            <CertificateSheet
              certBgUrl={bgUrl}
              certConfig={{ logoUrl, layout }}
              accentColor={accentColor}
              title={title}
              subtitle={subtitle}
              numFormatted={previewNum}
              recipientName="Syntia Bella, S.Pd."
              recipientInstitution="SMP Negeri 234 Yogyakarta"
              descResolved={previewDesc}
              materiJp={materiJp}
              totalJp={totalJp}
              placeDateResolved={previewPlaceDate}
              qrIdLabel="JSA-0042"
              s2Name={sign2Name}
              s2Role={sign2Role}
              s2Img={sign2Img || undefined}
              stampImg={stampImg || undefined}
              editable
              onLayoutChange={handleLayoutChange}
            />
          </div>
        </div>

        {backLink && (
          <div style={{ marginTop: "1rem" }}>
            <Link href={backLink.href} className="btn btn-sm btn-block" style={{ textAlign: "center" }}>
              {backLink.label}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
