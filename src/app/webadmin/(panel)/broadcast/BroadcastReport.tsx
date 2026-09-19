"use client";

import { useState } from "react";
import { retryBroadcastFailures } from "../../actions";
import { BroadcastReport as BroadcastReportType } from "@/lib/broadcast-store";

export default function BroadcastReport({ report }: { report: BroadcastReportType }) {
  const [copied, setCopied] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const hasFailures = report.failures && report.failures.length > 0;

  const copyFailedNumbers = () => {
    const list = report.failures
      .map((f) => `${f.name}: ${f.whatsapp} (${f.reason})`)
      .join("\n");
    navigator.clipboard.writeText(list);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: `1px solid ${hasFailures ? "#fca5a5" : "#86efac"}`,
        borderRadius: 12,
        padding: "1.4rem",
        marginBottom: "1.6rem",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.8rem",
          marginBottom: "1rem",
        }}
      >
        <div>
          <h3 style={{ margin: "0 0 0.25rem", fontSize: "1.05rem" }}>
            📊 Laporan Hasil Broadcast: {report.target}
          </h3>
          <p className="muted" style={{ margin: 0, fontSize: "0.82rem" }}>
            Waktu: {new Date(report.createdAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })} &middot; Tipe: {report.messageType.toUpperCase()}
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          <span
            style={{
              padding: "0.3rem 0.75rem",
              background: "#dcfce7",
              color: "#166534",
              borderRadius: 999,
              fontWeight: 700,
              fontSize: "0.82rem",
            }}
          >
            ✅ {report.sent} Terkirim
          </span>
          {report.failed > 0 ? (
            <span
              style={{
                padding: "0.3rem 0.75rem",
                background: "#fee2e2",
                color: "#991b1b",
                borderRadius: 999,
                fontWeight: 700,
                fontSize: "0.82rem",
              }}
            >
              ❌ {report.failed} Gagal
            </span>
          ) : (
            <span
              style={{
                padding: "0.3rem 0.75rem",
                background: "#f0fdf4",
                color: "#15803d",
                borderRadius: 999,
                fontWeight: 600,
                fontSize: "0.82rem",
              }}
            >
              100% Berhasil
            </span>
          )}
        </div>
      </div>

      {hasFailures ? (
        <>
          <div
            style={{
              background: "#fff1f2",
              border: "1px solid #fecdd3",
              borderRadius: 8,
              padding: "0.8rem 1rem",
              marginBottom: "1rem",
              fontSize: "0.86rem",
              color: "#9f1239",
            }}
          >
            ⚠️ Ditemukan <strong>{report.failures.length} peserta</strong> yang gagal menerima pesan broadcast. Periksa format nomor di bawah atau klik tombol kirim ulang.
          </div>

          <div style={{ overflowX: "auto", marginBottom: "1.2rem" }}>
            <table style={{ width: "100%", fontSize: "0.85rem", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border)", textAlign: "left" }}>
                  <th style={{ padding: "0.5rem", width: 40 }}>#</th>
                  <th style={{ padding: "0.5rem" }}>Nama Peserta</th>
                  <th style={{ padding: "0.5rem" }}>Nomor WhatsApp</th>
                  <th style={{ padding: "0.5rem" }}>Penyebab Kegagalan</th>
                </tr>
              </thead>
              <tbody>
                {report.failures.map((f, idx) => (
                  <tr
                    key={f.id || idx}
                    style={{
                      borderBottom: "1px solid var(--border)",
                      background: idx % 2 === 0 ? "transparent" : "var(--bg-soft)",
                    }}
                  >
                    <td style={{ padding: "0.5rem", color: "var(--ink-soft)" }}>{idx + 1}</td>
                    <td style={{ padding: "0.5rem", fontWeight: 600 }}>{f.name}</td>
                    <td style={{ padding: "0.5rem", fontFamily: "monospace" }}>{f.whatsapp}</td>
                    <td style={{ padding: "0.5rem", color: "#dc2626" }}>
                      <span
                        style={{
                          background: "#fee2e2",
                          padding: "0.2rem 0.5rem",
                          borderRadius: 4,
                          fontSize: "0.8rem",
                          fontWeight: 500,
                        }}
                      >
                        {f.reason}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", gap: "0.8rem", flexWrap: "wrap", alignItems: "center" }}>
            <form
              action={retryBroadcastFailures}
              onSubmit={() => setRetrying(true)}
              style={{ display: "inline" }}
            >
              <input type="hidden" name="reportId" value={report.id} />
              <button
                type="submit"
                className="btn btn-yellow btn-sm"
                disabled={retrying}
                style={{ fontWeight: 600 }}
              >
                {retrying ? "Sedang Mengirim Ulang..." : `🔄 Kirim Ulang ke yang Gagal (${report.failures.length})`}
              </button>
            </form>

            <button
              type="button"
              className="btn btn-sm"
              onClick={copyFailedNumbers}
              style={{ fontSize: "0.85rem" }}
            >
              {copied ? "✅ Berhasil Disalin!" : "📋 Salin Daftar Nomor Gagal"}
            </button>
          </div>
        </>
      ) : (
        <p style={{ margin: 0, fontSize: "0.9rem", color: "#15803d" }}>
          🎉 Seluruh pesan broadcast berhasil terkirim ke seluruh {report.total} penerima tanpa kendala.
        </p>
      )}
    </div>
  );
}
