"use client";

import { useState, type CSSProperties } from "react";
import { regenerateApiKey } from "@/app/webadmin/actions";

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API tidak tersedia (mis. http tanpa TLS) — biarkan user select manual
    }
  }

  return (
    <div className="field full">
      <label>{label}</label>
      <div style={{ display: "flex", gap: ".5rem" }}>
        <input type="text" value={value} readOnly onFocus={(e) => e.target.select()} style={{ fontFamily: "monospace", fontSize: ".85rem" }} />
        <button type="button" className="btn btn-sm" onClick={handleCopy} style={{ flexShrink: 0 }}>
          {copied ? "Tersalin!" : "Salin"}
        </button>
      </div>
    </div>
  );
}

const preStyle: CSSProperties = {
  background: "var(--chip)",
  padding: "1rem",
  borderRadius: "var(--r-sm)",
  fontSize: ".8rem",
  overflowX: "auto",
  fontFamily: "monospace",
  whiteSpace: "pre",
};

function EndpointRow({ method, path, desc }: { method: string; path: string; desc: string }) {
  const colors: Record<string, string> = {
    GET: "#2563eb",
    POST: "#16a34a",
    PATCH: "#d97706",
    DELETE: "#dc2626",
  };
  return (
    <tr>
      <td data-label="Method">
        <span style={{ color: colors[method] ?? "#000", fontWeight: 800, fontFamily: "monospace", fontSize: ".78rem" }}>
          {method}
        </span>
      </td>
      <td data-label="Path" style={{ fontFamily: "monospace", fontSize: ".82rem" }}>{path}</td>
      <td data-label="Fungsi" style={{ fontSize: ".85rem" }}>{desc}</td>
    </tr>
  );
}

export default function ApiIntegrationClient({
  apiUrl,
  apiKey,
  siteUrl,
}: {
  apiUrl: string;
  apiKey: string;
  siteUrl: string;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <div className="form-section">
        <header>
          <h3>Endpoint & Key</h3>
          <p>Konfigurasikan ini di Hermes agent marketing untuk membaca katalog program secara otomatis.</p>
        </header>
        <div className="fs-body">
          <CopyField label="URL Endpoint (baca katalog program)" value={apiUrl} />
          <CopyField label="API Key (header X-API-Key)" value={apiKey} />
        </div>
      </div>

      <div className="form-section">
        <header>
          <h3>Contoh Pemakaian (Baca)</h3>
        </header>
        <div className="fs-body">
          <div className="field full">
            <pre style={preStyle}>
{`curl "${apiUrl}" \\
  -H "X-API-Key: ${apiKey}"`}
            </pre>
          </div>
        </div>
      </div>

      <div className="form-section">
        <header>
          <h3>Semua Endpoint</h3>
          <p>Endpoint tulis butuh header tambahan <code>Content-Type: application/json</code> dan body JSON.</p>
        </header>
        <div className="fs-body">
          <div className="field full" style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Method</th>
                  <th>Path</th>
                  <th>Fungsi</th>
                </tr>
              </thead>
              <tbody>
                <EndpointRow method="GET" path="/api/v1/programs" desc="Daftar program aktif + batch online & offline lengkap" />
                <EndpointRow method="GET" path="/api/v1/programs/:id" desc="Detail satu program beserta semua batch online/offline" />
                <EndpointRow method="POST" path="/api/v1/programs" desc="Buat program baru" />
                <EndpointRow method="PATCH" path="/api/v1/programs/:id" desc="Ubah sebagian field program" />
                <EndpointRow method="GET" path="/api/v1/programs/:id/batches" desc="Daftar batch program (filter ?type=ONLINE|OFFLINE)" />
                <EndpointRow method="POST" path="/api/v1/programs/:id/batches" desc="Tambah batch baru (online / offline tatap muka)" />
                <EndpointRow method="GET" path="/api/v1/batches/:id" desc="Detail spesifik satu batch (kuota, harga, link)" />
                <EndpointRow method="PATCH" path="/api/v1/batches/:id" desc="Ubah batch (nama, tipe, jadwal, venue, harga, link)" />
                <EndpointRow method="DELETE" path="/api/v1/batches/:id" desc="Hapus batch" />
                <EndpointRow method="GET" path="/api/v1/articles" desc="Daftar semua artikel (termasuk draf)" />
                <EndpointRow method="POST" path="/api/v1/articles" desc="Buat artikel baru" />
                <EndpointRow method="PATCH" path="/api/v1/articles/:id" desc="Ubah sebagian field artikel" />
                <EndpointRow method="DELETE" path="/api/v1/articles/:id" desc="Hapus artikel" />
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="form-section">
        <header>
          <h3>Contoh: Buat Artikel</h3>
        </header>
        <div className="fs-body">
          <div className="field full">
            <pre style={preStyle}>
{`curl -X POST "${siteUrl}/api/v1/articles" \\
  -H "X-API-Key: ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "5 Tren AI di 2026",
    "excerpt": "Ringkasan tren AI yang wajib diketahui pemula.",
    "content": "<p>Isi artikel dalam HTML...</p>",
    "isPublished": true
  }'`}
            </pre>
          </div>
        </div>
      </div>

      <div className="form-section">
        <header>
          <h3>Contoh: Buat Program</h3>
        </header>
        <div className="fs-body">
          <div className="field full">
            <pre style={preStyle}>
{`curl -X POST "${siteUrl}/api/v1/programs" \\
  -H "X-API-Key: ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "Digital Marketing untuk Pemula",
    "type": "WEBINAR",
    "tagline": "Kuasai iklan digital dalam 2 jam",
    "description": "Deskripsi lengkap program...",
    "mentorName": "Budi Santoso",
    "mentorBio": "Praktisi digital marketing 8 tahun.",
    "scheduleAt": "2026-08-15T10:00:00.000Z",
    "materi": ["Riset target audiens", "Copywriting iklan", "Optimasi budget"],
    "deliverables": [{ "label": "Template iklan siap pakai", "value": 150000 }],
    "price": 0,
    "certPrice": 49000
  }'`}
            </pre>
          </div>
        </div>
      </div>

      <div className="form-section">
        <header>
          <h3>Contoh: Isi Halaman Program (Markdown)</h3>
          <p>
            Cara termudah menyusun tampilan halaman program — tulis seperti markdown biasa lewat field{" "}
            <code>contentMarkdown</code>, sistem otomatis mengubahnya jadi blok judul/teks/gambar/video/daftar/value-stack/kutipan.
            Kirim di body <code>POST</code> saat buat program, atau <code>PATCH</code> ke program yang sudah ada.
          </p>
        </header>
        <div className="fs-body">
          <div className="field full">
            <pre style={preStyle}>
{`curl -X PATCH "${siteUrl}/api/v1/programs/PROGRAM_ID" \\
  -H "X-API-Key: ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "contentMarkdown": "## Kenapa Ikut Program Ini?\\n\\nDi kelas ini kamu akan **praktik langsung** bikin AI Agent dari nol, bukan cuma teori.\\n\\n## Yang Anda Pelajari\\n- Riset target audiens\\n- Copywriting iklan\\n- Optimasi budget\\n\\n## Yang Anda Terima\\n- Rekaman selamanya | 150000\\n- Akses grup komunitas | 0\\n\\n![Cuplikan sesi kelas](https://www.youtube.com/watch?v=dQw4w9WgXcQ)\\n\\n> Kelasnya sangat membantu, langsung bisa dipakai kerja.\\n> — Budi, Alumni"
  }'`}
            </pre>
          </div>
          <p className="adm-note" style={{ marginTop: "-.4rem" }}>
            Sintaks: <code># / ##</code> judul · paragraf biasa teks (<code>**tebal**</code>/<code>*miring*</code>) ·{" "}
            <code>![keterangan](url)</code> gambar (otomatis jadi video kalau url YouTube/Vimeo/Bunny) ·{" "}
            <code>- poin</code> daftar · <code>- Label | 150000</code> value stack · <code>{"> teks"}</code> kutipan
            (baris terakhir diawali <code>—</code> jadi nama sumber).
          </p>
        </div>
      </div>

      <div className="form-section">
        <header>
          <h3>Contoh: Tambah Batch Online &amp; Offline</h3>
          <p>Hermes dapat membuat batch bertipe Online via Zoom ataupun Offline Tatap Muka dengan kuota dan harga Early Bird.</p>
        </header>
        <div className="fs-body">
          <div className="field full">
            <p style={{ fontWeight: 700, marginBottom: "0.4rem", fontSize: "0.85rem" }}>1. Batch Online (Zoom):</p>
            <pre style={preStyle}>
{`curl -X POST "${siteUrl}/api/v1/programs/PROGRAM_ID/batches" \\
  -H "X-API-Key: ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Batch 7 Online",
    "batchType": "ONLINE",
    "scheduleAt": "2026-09-26T13:00:00.000Z",
    "priceOnline": 490000,
    "priceOnlineEb": 225000,
    "quotaOnlineEb": 20
  }'`}
            </pre>
            <p style={{ fontWeight: 700, marginTop: "1rem", marginBottom: "0.4rem", fontSize: "0.85rem" }}>2. Batch Offline (Tatap Muka):</p>
            <pre style={preStyle}>
{`curl -X POST "${siteUrl}/api/v1/programs/PROGRAM_ID/batches" \\
  -H "X-API-Key: ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Batch 2 Offline Bekasi",
    "batchType": "OFFLINE",
    "hasOffline": true,
    "scheduleAt": "2026-10-03T13:00:00.000Z",
    "offlineVenue": "Coworking Space Kota Bekasi",
    "offlineSeatsMax": 20,
    "priceOffline": 1400000,
    "priceOfflineEb": 750000,
    "quotaOfflineEb": 10
  }'`}
            </pre>
          </div>
        </div>
      </div>

      <div className="form-section">
        <header>
          <h3>Regenerate Key</h3>
          <p>Key lama langsung berhenti berfungsi. Update konfigurasi Hermes agent setelah regenerate.</p>
        </header>
        <div className="fs-body">
          <div className="field full">
            {!confirming ? (
              <button type="button" className="btn btn-sm btn-danger" onClick={() => setConfirming(true)} style={{ width: "fit-content" }}>
                Regenerate API Key
              </button>
            ) : (
              <div style={{ display: "flex", gap: ".6rem", alignItems: "center" }}>
                <span style={{ fontSize: ".85rem", fontWeight: 700 }}>Yakin? Integrasi yang pakai key lama akan berhenti.</span>
                <form action={regenerateApiKey}>
                  <button type="submit" className="btn btn-sm btn-danger">Ya, Regenerate</button>
                </form>
                <button type="button" className="btn btn-sm" onClick={() => setConfirming(false)}>Batal</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
