"use client";

import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { importOfflineRecipients } from "../../offline-cert-actions";

type Row = { name: string; whatsapp: string; email: string };

/** File .xlsx contoh dibuat langsung di browser — header persis yang dideteksi saat upload. */
function downloadTemplate() {
  const sheet = XLSX.utils.aoa_to_sheet([
    ["Nama", "WhatsApp", "Email"],
    ["Budi Santoso", "081234567890", "budi@gmail.com"],
    ["Siti Aminah", "085611112222", "siti@yahoo.com"],
  ]);
  sheet["!cols"] = [{ wch: 28 }, { wch: 18 }, { wch: 28 }];
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Penerima");
  XLSX.writeFile(book, "template-penerima-sertifikat.xlsx");
}

/** Langkah Penerima: baca Excel/CSV di browser → pratinjau → terbitkan sertifikat. */
export default function KontakUploader({ programId }: { programId: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  function handleFile(file: File) {
    setFileName(file.name);
    setError("");
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

        const parsed: Row[] = json.map((raw: Record<string, unknown>) => {
          const keys = Object.keys(raw);
          const nameKey = keys.find((k) => /nama|name/i.test(k)) ?? keys[0];
          const waKey = keys.find((k) => /wa|whatsapp|phone|no.?hp|telp/i.test(k)) ?? keys[1] ?? "";
          const emailKey = keys.find((k) => /email|e-?mail/i.test(k)) ?? keys[2] ?? "";
          return {
            name: String(raw[nameKey] ?? "").trim(),
            whatsapp: String(waKey ? raw[waKey] ?? "" : "").trim(),
            email: String(emailKey ? raw[emailKey] ?? "" : "").trim(),
          };
        });
        const valid = parsed.filter((r) => r.name);
        setRows(valid);
        if (valid.length === 0) setError("Tidak ada baris bernama di file ini. Cek kolom Nama.");
      } catch (err) {
        setRows([]);
        setError("Gagal membaca file: " + (err instanceof Error ? err.message : "format tidak dikenal"));
      }
    };
    reader.readAsArrayBuffer(file);
  }

  const incomplete = rows.filter((r) => !r.whatsapp && !r.email).length;

  return (
    <>
      <div className="kc-upload">
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          hidden
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        <button type="button" className="btn btn-purple" onClick={() => fileRef.current?.click()}>
          {fileName ? "Ganti file" : "Upload Excel / CSV"}
        </button>
        <button type="button" className="btn btn-line" onClick={downloadTemplate}>Download template</button>
        {fileName && <span className="muted" style={{ fontSize: ".82rem" }}>{fileName}</span>}
      </div>

      {error && <div className="adm-alert err" style={{ marginTop: "1rem" }}>{error}</div>}

      {rows.length > 0 && (
        <>
          <p style={{ fontSize: ".85rem", margin: "1.2rem 0 .5rem" }}>
            <b>{rows.length}</b> penerima terdeteksi
            {incomplete > 0 && (
              <span style={{ color: "var(--red)" }}> · {incomplete} tanpa WA &amp; email (akan gagal)</span>
            )}
          </p>
          <div className="tbl-wrap kc-preview">
            <table className="tbl">
              <thead>
                <tr><th>Nama</th><th>WhatsApp</th><th>Email</th></tr>
              </thead>
              <tbody>
                {rows.slice(0, 50).map((r, i) => (
                  <tr key={i}>
                    <td data-label="Nama">{r.name}</td>
                    <td data-label="WhatsApp">{r.whatsapp || <span className="muted">—</span>}</td>
                    <td data-label="Email">{r.email || <span className="muted">—</span>}</td>
                  </tr>
                ))}
                {rows.length > 50 && (
                  <tr><td colSpan={3} className="muted">… dan {rows.length - 50} lainnya</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      <form action={importOfflineRecipients} onSubmit={() => setPending(true)} className="kc-submit">
        <input type="hidden" name="programId" value={programId} />
        <input type="hidden" name="recipients" value={JSON.stringify(rows)} />
        <button className="btn btn-purple" disabled={pending || rows.length === 0}>
          {pending ? "Menerbitkan…" : rows.length > 0 ? `Terbitkan ${rows.length} sertifikat` : "Terbitkan sertifikat"}
        </button>
        <span className="muted" style={{ fontSize: ".8rem" }}>
          {rows.length === 0
            ? "Upload file dulu. Sudah punya sertifikat? Lanjut langsung ke langkah Kirim."
            : "Setelah terbit, Anda diarahkan ke langkah Kirim."}
        </span>
      </form>
    </>
  );
}
