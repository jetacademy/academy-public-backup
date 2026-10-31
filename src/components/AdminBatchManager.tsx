"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { formatJadwal, toWIBInput } from "@/lib/format";
import ConfirmButton from "@/components/ConfirmButton";
import {
  createBatch,
  toggleBatch,
  deleteBatch,
  updateBatchLinks,
  toggleBatchCertPublish,
  sendBatchCertWaAction,
  retryBroadcastFailures,
} from "@/app/webadmin/actions";
import type { BroadcastReport as BroadcastReportType } from "@/lib/broadcast-store";

export type SerializedBatch = {
  id: string;
  programId: string;
  name: string | null;
  batchType: string;
  scheduleAt: string;
  seatsLeft: number | null;
  isActive: boolean;
  certPublished: boolean;
  hasOffline: boolean;
  offlineVenue: string | null;
  offlineMapUrl: string | null;
  offlineScheduleAt: string | null;
  offlineSeatsMax: number | null;
  priceOffline: number | null;
  priceOfflineEb: number | null;
  quotaOfflineEb: number | null;
  priceOnline: number | null;
  priceOnlineEb: number | null;
  quotaOnlineEb: number | null;
  zoomLink: string | null;
  waGroupLink: string | null;
  recordingLink: string | null;
  createdAt: string;
  _count: {
    registrations: number;
  };
};

export default function AdminBatchManager({
  program,
  batches,
  alerts,
  report,
}: {
  program: {
    id: string;
    title: string;
    slug: string;
    type: string;
  };
  batches: SerializedBatch[];
  alerts: {
    ok?: string;
    e?: string;
    deleted?: string;
    cert?: string;
    issued?: string;
    waSent?: string;
    waFailed?: string;
    reportId?: string;
  };
  report?: BroadcastReportType | null;
}) {
  // State UI
  const [showAddForm, setShowAddForm] = useState(false);
  const [addFormat, setAddFormat] = useState<"ONLINE" | "OFFLINE">("ONLINE");
  const [editBatch, setEditBatch] = useState<SerializedBatch | null>(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedFailures, setCopiedFailures] = useState(false);
  const [formatFilter, setFormatFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [timeFilter, setTimeFilter] = useState<string>("ALL");

  // Sort State (Default: Newest first "yang terbaru di atas")
  const [sortBy, setSortBy] = useState<"schedule_desc" | "schedule_asc" | "regs_desc" | "regs_asc" | "name_asc" | "name_desc" | "status_active">("schedule_desc");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);

  const now = new Date();

  // Statistics calculation
  const totalBatches = batches.length;
  const activeBatches = batches.filter((b) => b.isActive).length;
  const upcomingBatches = batches.filter((b) => new Date(b.scheduleAt) >= now).length;
  const totalRegistrations = batches.reduce((sum, b) => sum + (b._count?.registrations || 0), 0);

  // Filter & Search
  const filteredBatches = useMemo(() => {
    return batches.filter((b) => {
      const bDate = new Date(b.scheduleAt);
      const isPast = bDate < now;
      const isOffline = b.batchType === "OFFLINE";

      // Search term
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = (b.name || "").toLowerCase().includes(q);
        const formatMatch = isOffline ? "offline".includes(q) : "online".includes(q);
        const venueMatch = (b.offlineVenue || "").toLowerCase().includes(q);
        const linkMatch = (b.zoomLink || "").toLowerCase().includes(q) || (b.waGroupLink || "").toLowerCase().includes(q);
        if (!nameMatch && !formatMatch && !venueMatch && !linkMatch) return false;
      }

      // Format filter
      if (formatFilter === "ONLINE" && isOffline) return false;
      if (formatFilter === "OFFLINE" && !isOffline) return false;

      // Status filter
      if (statusFilter === "ACTIVE" && !b.isActive) return false;
      if (statusFilter === "INACTIVE" && b.isActive) return false;

      // Time filter
      if (timeFilter === "UPCOMING" && isPast) return false;
      if (timeFilter === "PAST" && !isPast) return false;

      return true;
    });
  }, [batches, searchQuery, formatFilter, statusFilter, timeFilter, now]);

  // Sort logic
  const sortedBatches = useMemo(() => {
    return [...filteredBatches].sort((a, b) => {
      const dateA = new Date(a.scheduleAt).getTime();
      const dateB = new Date(b.scheduleAt).getTime();

      switch (sortBy) {
        case "schedule_desc":
          return dateB - dateA; // Newest first
        case "schedule_asc":
          return dateA - dateB; // Oldest first
        case "regs_desc":
          return (b._count?.registrations || 0) - (a._count?.registrations || 0);
        case "regs_asc":
          return (a._count?.registrations || 0) - (b._count?.registrations || 0);
        case "name_asc":
          return (a.name || "").localeCompare(b.name || "");
        case "name_desc":
          return (b.name || "").localeCompare(a.name || "");
        case "status_active":
          if (a.isActive === b.isActive) return dateB - dateA;
          return a.isActive ? -1 : 1;
        default:
          return dateB - dateA;
      }
    });
  }, [filteredBatches, sortBy]);

  // Pagination calculation
  const totalItems = sortedBatches.length;
  const effectivePageSize = pageSize === -1 ? totalItems || 1 : pageSize;
  const totalPages = Math.max(1, Math.ceil(totalItems / effectivePageSize));
  const validPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedBatches = useMemo(() => {
    if (pageSize === -1) return sortedBatches;
    const start = (validPage - 1) * pageSize;
    return sortedBatches.slice(start, start + pageSize);
  }, [sortedBatches, validPage, pageSize]);

  // Handle header sort click
  const toggleHeaderSort = (field: "schedule" | "regs" | "name") => {
    setCurrentPage(1);
    if (field === "schedule") {
      setSortBy(sortBy === "schedule_desc" ? "schedule_asc" : "schedule_desc");
    } else if (field === "regs") {
      setSortBy(sortBy === "regs_desc" ? "regs_asc" : "regs_desc");
    } else if (field === "name") {
      setSortBy(sortBy === "name_asc" ? "name_desc" : "name_asc");
    }
  };

  const resetFilters = () => {
    setSearchQuery("");
    setFormatFilter("ALL");
    setStatusFilter("ALL");
    setTimeFilter("ALL");
    setSortBy("schedule_desc");
    setCurrentPage(1);
  };

  const isFiltered = searchQuery !== "" || formatFilter !== "ALL" || statusFilter !== "ALL" || timeFilter !== "ALL";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.4rem" }}>
      {/* Alert Messages */}
      {alerts.ok === "1" && <div className="adm-alert ok">Perubahan data batch berhasil disimpan.</div>}
      {alerts.deleted === "1" && <div className="adm-alert ok">Batch jadwal berhasil dihapus.</div>}
      {alerts.cert === "published" && !report && (
        <div className="adm-alert ok">
          Sertifikat batch dipublikasikan.{" "}
          {alerts.issued && Number(alerts.issued) > 0
            ? `${alerts.issued} peserta lunas langsung diterbitkan sertifikatnya.`
            : "Sertifikat akan otomatis terbit saat jadwal batch selesai & peserta lunas."}
        </div>
      )}
      {alerts.cert === "unpublished" && (
        <div className="adm-alert warn">
          Rilis sertifikat batch dibatalkan. Sertifikat baru tidak akan terbit ke peserta batch ini sampai dipublikasikan kembali.
        </div>
      )}
      {alerts.e === "lengkapi" && <div className="adm-alert err">Tanggal jadwal wajib diisi.</div>}
      {alerts.e === "tanggal" && <div className="adm-alert err">Format tanggal tidak valid.</div>}
      {alerts.e === "no_certs_to_send" && <div className="adm-alert warn">Tidak ada sertifikat yang perlu dikirim untuk batch ini.</div>}

      {/* Delivery Report Box */}
      {report && (
        <div
          style={{
            background: "var(--white, #fff)",
            border: `1px solid ${report.failed > 0 ? "#fca5a5" : "#86efac"}`,
            borderRadius: 12,
            padding: "1.2rem 1.4rem",
            boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "0.8rem",
              marginBottom: report.failures?.length > 0 ? "1rem" : 0,
            }}
          >
            <div>
              <h3 style={{ margin: "0 0 0.2rem", fontSize: "1.05rem", fontWeight: 800 }}>
                📊 Laporan Rilis Sertifikat &amp; WA: {report.target}
              </h3>
              <p className="muted" style={{ margin: 0, fontSize: "0.82rem" }}>
                Waktu: {new Date(report.createdAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })} &middot; Total: {report.total} peserta
              </p>
            </div>

            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
              <span
                style={{
                  padding: "0.35rem 0.85rem",
                  background: "#dcfce7",
                  color: "#166534",
                  borderRadius: 999,
                  fontWeight: 700,
                  fontSize: "0.82rem",
                }}
              >
                ✅ {report.sent} WA Terkirim
              </span>
              {report.failed > 0 ? (
                <span
                  style={{
                    padding: "0.35rem 0.85rem",
                    background: "#fee2e2",
                    color: "#991b1b",
                    borderRadius: 999,
                    fontWeight: 700,
                    fontSize: "0.82rem",
                  }}
                >
                  ❌ {report.failed} WA Gagal
                </span>
              ) : (
                <span
                  style={{
                    padding: "0.35rem 0.85rem",
                    background: "#f0fdf4",
                    color: "#15803d",
                    borderRadius: 999,
                    fontWeight: 700,
                    fontSize: "0.82rem",
                  }}
                >
                  🎉 100% Terkirim
                </span>
              )}
            </div>
          </div>

          {report.failures && report.failures.length > 0 && (
            <div
              style={{
                background: "#fff1f2",
                border: "1px solid #fecdd3",
                borderRadius: 8,
                padding: "1rem",
                marginTop: "0.8rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "0.5rem",
                  marginBottom: "0.8rem",
                }}
              >
                <strong style={{ fontSize: "0.88rem", color: "#991b1b" }}>
                  ⚠️ Rincian {report.failures.length} Nomor Gagal Dikirim:
                </strong>
                <div style={{ display: "flex", gap: "0.4rem" }}>
                  <button
                    type="button"
                    onClick={() => {
                      const list = report.failures
                        .map((f) => `${f.name}: ${f.whatsapp} (${f.reason})`)
                        .join("\n");
                      navigator.clipboard.writeText(list);
                      setCopiedFailures(true);
                      setTimeout(() => setCopiedFailures(false), 2500);
                    }}
                    className="btn btn-sm"
                    style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem" }}
                  >
                    {copiedFailures ? "✓ Tersalin!" : "📋 Salin Daftar Gagal"}
                  </button>
                  <form action={retryBroadcastFailures}>
                    <input type="hidden" name="reportId" value={report.id} />
                    <input type="hidden" name="returnUrl" value={`/webadmin/program/${program.id}/batch`} />
                    <ConfirmButton
                      className="btn btn-sm btn-purple"
                      style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem" }}
                      message={`Kirim ulang pesan WhatsApp sertifikat ke ${report.failures.length} peserta yang gagal?`}
                    >
                      🔄 Kirim Ulang ke yang Gagal
                    </ConfirmButton>
                  </form>
                </div>
              </div>

              <div style={{ maxHeight: "200px", overflowY: "auto" }}>
                <table style={{ width: "100%", fontSize: "0.82rem", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ textAlign: "left", color: "#881337", borderBottom: "1px solid #fecdd3" }}>
                      <th style={{ padding: "0.3rem 0.5rem" }}>Nama</th>
                      <th style={{ padding: "0.3rem 0.5rem" }}>WhatsApp</th>
                      <th style={{ padding: "0.3rem 0.5rem" }}>Alasan Gagal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.failures.map((f, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #ffe4e6" }}>
                        <td style={{ padding: "0.35rem 0.5rem", fontWeight: 600 }}>{f.name}</td>
                        <td style={{ padding: "0.35rem 0.5rem", fontFamily: "monospace" }}>{f.whatsapp || "-"}</td>
                        <td style={{ padding: "0.35rem 0.5rem", color: "#dc2626" }}>{f.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Header Info & Actions */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <h2 style={{ fontSize: "1.3rem", fontWeight: 800, margin: 0, color: "var(--ink)" }}>
              Jadwal &amp; Batch Angkatan
            </h2>
            <span className="badge y" style={{ fontSize: "0.7rem" }}>
              {totalBatches} Batch
            </span>
          </div>
          <p className="adm-note" style={{ margin: "0.35rem 0 0", maxWidth: "680px", lineHeight: "1.45" }}>
            Atur batch berulang untuk program ini. Peserta akan memilih batch saat checkout; histori peserta, link grup WA,
            link Zoom/venue, dan rilis sertifikat dikelola mandiri per batch.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddForm(!showAddForm)}
          className="btn btn-purple"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.65rem 1.25rem",
            fontWeight: 700,
            boxShadow: "0 4px 14px rgba(108, 92, 231, 0.25)",
            cursor: "pointer",
          }}
        >
          {showAddForm ? "✕ Tutup Form" : "+ Tambah Batch Baru"}
        </button>
      </div>

      {/* Metric Stat Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: "1rem",
        }}
      >
        <div
          style={{
            background: "var(--white)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md)",
            padding: "1.1rem 1.25rem",
            boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem",
          }}
        >
          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Total Batch
          </span>
          <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
            <span style={{ fontSize: "1.75rem", fontWeight: 900, color: "var(--ink)" }}>{totalBatches}</span>
            <span style={{ fontSize: "0.8rem", color: "var(--ink-soft)" }}>angkatan</span>
          </div>
        </div>

        <div
          style={{
            background: "var(--white)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md)",
            padding: "1.1rem 1.25rem",
            boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem",
          }}
        >
          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Batch Mendatang
          </span>
          <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
            <span style={{ fontSize: "1.75rem", fontWeight: 900, color: "#00b894" }}>{upcomingBatches}</span>
            <span style={{ fontSize: "0.8rem", color: "var(--ink-soft)" }}>sesi aktif mendatang</span>
          </div>
        </div>

        <div
          style={{
            background: "var(--white)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md)",
            padding: "1.1rem 1.25rem",
            boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem",
          }}
        >
          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Total Peserta
          </span>
          <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
            <span style={{ fontSize: "1.75rem", fontWeight: 900, color: "var(--purple)" }}>{totalRegistrations}</span>
            <span style={{ fontSize: "0.8rem", color: "var(--ink-soft)" }}>orang terdaftar</span>
          </div>
        </div>

        <div
          style={{
            background: "var(--white)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md)",
            padding: "1.1rem 1.25rem",
            boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem",
          }}
        >
          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Status Publikasi
          </span>
          <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
            <span style={{ fontSize: "1.75rem", fontWeight: 900, color: "#0984e3" }}>{activeBatches}</span>
            <span style={{ fontSize: "0.8rem", color: "var(--ink-soft)" }}>aktif publik / {totalBatches - activeBatches} draft</span>
          </div>
        </div>
      </div>

      {/* Collapsible Form Tambah Batch */}
      {showAddForm && (
        <div
          style={{
            background: "var(--white)",
            border: "2px solid var(--purple)",
            borderRadius: "var(--r-md)",
            boxShadow: "0 8px 24px rgba(108, 92, 231, 0.12)",
            overflow: "hidden",
            animation: "fadeIn 0.2s ease-in-out",
          }}
        >
          <div
            style={{
              padding: "1rem 1.5rem",
              background: "linear-gradient(90deg, #f8f7ff 0%, #ffffff 100%)",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "var(--ink)" }}>
                Buat Batch / Jadwal Baru
              </h3>
              <p style={{ margin: "0.2rem 0 0", fontSize: "0.8rem", color: "var(--ink-soft)" }}>
                Tentukan format pelatihan, jadwal waktu, harga normal, dan kuota early bird.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              style={{
                background: "none",
                border: "none",
                fontSize: "1.2rem",
                cursor: "pointer",
                color: "var(--ink-soft)",
              }}
            >
              ✕
            </button>
          </div>

          <form action={createBatch} style={{ padding: "1.5rem" }}>
            <input type="hidden" name="programId" value={program.id} />

            {/* Format Pelatihan Switch */}
            <div style={{ marginBottom: "1.4rem" }}>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, marginBottom: "0.5rem", color: "var(--ink)" }}>
                Pilih Format Pelatihan:
              </label>
              <div style={{ display: "flex", gap: "0.8rem", flexWrap: "wrap" }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.6rem",
                    padding: "0.65rem 1.1rem",
                    borderRadius: "var(--r-sm)",
                    border: addFormat === "ONLINE" ? "2px solid var(--purple)" : "1px solid var(--border)",
                    background: addFormat === "ONLINE" ? "var(--purple-soft)" : "var(--white)",
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: "0.88rem",
                    transition: "all 0.15s ease",
                  }}
                >
                  <input
                    type="radio"
                    name="batchType"
                    value="ONLINE"
                    checked={addFormat === "ONLINE"}
                    onChange={() => setAddFormat("ONLINE")}
                  />
                  💻 Online (Zoom / Google Meet)
                </label>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.6rem",
                    padding: "0.65rem 1.1rem",
                    borderRadius: "var(--r-sm)",
                    border: addFormat === "OFFLINE" ? "2px solid #e17055" : "1px solid var(--border)",
                    background: addFormat === "OFFLINE" ? "rgba(225, 112, 85, 0.1)" : "var(--white)",
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: "0.88rem",
                    transition: "all 0.15s ease",
                  }}
                >
                  <input
                    type="radio"
                    name="batchType"
                    value="OFFLINE"
                    checked={addFormat === "OFFLINE"}
                    onChange={() => setAddFormat("OFFLINE")}
                  />
                  🏢 Offline (Tatap Muka di Lokasi / Bekasi)
                </label>
              </div>
            </div>

            {/* Form Fields Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: "1.2rem",
                marginBottom: "1.4rem",
              }}
            >
              <div className="field">
                <label style={{ fontSize: "0.82rem", fontWeight: 700 }}>Label / Nama Batch</label>
                <input
                  name="name"
                  placeholder={addFormat === "ONLINE" ? "mis. Batch 8 (Online)" : "mis. Batch 2 (Offline Bekasi)"}
                  style={{ width: "100%", padding: "0.65rem 0.8rem", borderRadius: "var(--r-sm)", border: "1px solid var(--border)" }}
                />
                <span className="adm-note">Opsional, jika kosong akan dinamai otomatis.</span>
              </div>

              <div className="field">
                <label style={{ fontSize: "0.82rem", fontWeight: 700 }}>Tanggal &amp; Waktu Mulai (WIB) *</label>
                <input
                  type="datetime-local"
                  name="scheduleAt"
                  required
                  style={{ width: "100%", padding: "0.65rem 0.8rem", borderRadius: "var(--r-sm)", border: "1px solid var(--border)" }}
                />
                <span className="adm-note">Waktu pelaksanaan sesi pembelajaran.</span>
              </div>

              <div className="field">
                <label style={{ fontSize: "0.82rem", fontWeight: 700 }}>Harga Normal (Rp)</label>
                <input
                  name="normalPrice"
                  inputMode="numeric"
                  defaultValue={addFormat === "ONLINE" ? 490000 : 1400000}
                  placeholder={addFormat === "ONLINE" ? "490000" : "1400000"}
                  style={{ width: "100%", padding: "0.65rem 0.8rem", borderRadius: "var(--r-sm)", border: "1px solid var(--border)" }}
                />
              </div>

              <div className="field">
                <label style={{ fontSize: "0.82rem", fontWeight: 700 }}>Harga Early Bird (Rp)</label>
                <input
                  name="ebPrice"
                  inputMode="numeric"
                  defaultValue={addFormat === "ONLINE" ? 225000 : 750000}
                  placeholder={addFormat === "ONLINE" ? "225000" : "750000"}
                  style={{ width: "100%", padding: "0.65rem 0.8rem", borderRadius: "var(--r-sm)", border: "1px solid var(--border)" }}
                />
              </div>

              <div className="field">
                <label style={{ fontSize: "0.82rem", fontWeight: 700 }}>Kuota Early Bird (orang)</label>
                <input
                  name="ebQuota"
                  inputMode="numeric"
                  defaultValue={addFormat === "ONLINE" ? 20 : 10}
                  placeholder={addFormat === "ONLINE" ? "20" : "10"}
                  style={{ width: "100%", padding: "0.65rem 0.8rem", borderRadius: "var(--r-sm)", border: "1px solid var(--border)" }}
                />
                <span className="adm-note">Jumlah pendaftar pertama yang berhak dapat harga EB.</span>
              </div>

              {addFormat === "OFFLINE" ? (
                <>
                  <div className="field">
                    <label style={{ fontSize: "0.82rem", fontWeight: 700 }}>Kapasitas Kursi Ruangan (Offline)</label>
                    <input
                      name="seatsLeft"
                      inputMode="numeric"
                      defaultValue={20}
                      placeholder="20"
                      style={{ width: "100%", padding: "0.65rem 0.8rem", borderRadius: "var(--r-sm)", border: "1px solid var(--border)" }}
                    />
                  </div>

                  <div className="field" style={{ gridColumn: "1 / -1" }}>
                    <label style={{ fontSize: "0.82rem", fontWeight: 700 }}>Alamat / Nama Venue (Offline Bekasi)</label>
                    <input
                      name="offlineVenue"
                      placeholder="mis. Coworking Space Kota Bekasi / Ruang Serbaguna lt 3"
                      style={{ width: "100%", padding: "0.65rem 0.8rem", borderRadius: "var(--r-sm)", border: "1px solid var(--border)" }}
                    />
                  </div>
                </>
              ) : (
                <div className="field">
                  <label style={{ fontSize: "0.82rem", fontWeight: 700 }}>Link Zoom (Online)</label>
                  <input
                    name="zoomLink"
                    placeholder="https://zoom.us/j/... (bisa diisi nanti)"
                    style={{ width: "100%", padding: "0.65rem 0.8rem", borderRadius: "var(--r-sm)", border: "1px solid var(--border)" }}
                  />
                  <span className="adm-note">Dapat ditambahkan sekarang atau nanti di pengaturan batch.</span>
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.8rem", borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="btn btn-sm"
                style={{ padding: "0.6rem 1.2rem" }}
              >
                Batal
              </button>
              <button
                type="submit"
                className="btn btn-purple"
                style={{ padding: "0.6rem 1.4rem", fontWeight: 700 }}
              >
                Simpan &amp; Terbitkan Batch
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Toolbar: Search, Filter, Sort, Page Size */}
      <div
        style={{
          background: "var(--white)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-md)",
          padding: "1rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.8rem",
          boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            flexWrap: "wrap",
          }}
        >
          {/* Search Box */}
          <div style={{ position: "relative", flex: "1 1 240px", minWidth: "200px" }}>
            <span
              style={{
                position: "absolute",
                left: "0.8rem",
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--ink-faint)",
                fontSize: "0.9rem",
              }}
            >
              🔍
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Cari nama batch, venue, zoom link..."
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
                  padding: "0.2rem",
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Filter Format */}
          <select
            value={formatFilter}
            onChange={(e) => {
              setFormatFilter(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              padding: "0.55rem 0.8rem",
              borderRadius: "var(--r-sm)",
              border: "1px solid var(--border)",
              fontSize: "0.85rem",
              background: "var(--white)",
              fontWeight: 600,
            }}
          >
            <option value="ALL">Semua Format</option>
            <option value="ONLINE">💻 Online (Zoom)</option>
            <option value="OFFLINE">🏢 Offline (Bekasi)</option>
          </select>

          {/* Filter Status */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              padding: "0.55rem 0.8rem",
              borderRadius: "var(--r-sm)",
              border: "1px solid var(--border)",
              fontSize: "0.85rem",
              background: "var(--white)",
              fontWeight: 600,
            }}
          >
            <option value="ALL">Semua Status</option>
            <option value="ACTIVE">🟢 Aktif</option>
            <option value="INACTIVE">⚪ Nonaktif</option>
          </select>

          {/* Filter Jadwal */}
          <select
            value={timeFilter}
            onChange={(e) => {
              setTimeFilter(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              padding: "0.55rem 0.8rem",
              borderRadius: "var(--r-sm)",
              border: "1px solid var(--border)",
              fontSize: "0.85rem",
              background: "var(--white)",
              fontWeight: 600,
            }}
          >
            <option value="ALL">Semua Jadwal</option>
            <option value="UPCOMING">📅 Mendatang</option>
            <option value="PAST">⏳ Sudah Lewat</option>
          </select>

          {/* Sort Selector ("short di tabel") */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--ink-soft)" }}>Urut:</span>
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as any);
                setCurrentPage(1);
              }}
              style={{
                padding: "0.55rem 0.8rem",
                borderRadius: "var(--r-sm)",
                border: "1px solid var(--border)",
                fontSize: "0.85rem",
                background: "var(--white)",
                fontWeight: 600,
              }}
            >
              <option value="schedule_desc">🕒 Jadwal Terbaru (Di Atas)</option>
              <option value="schedule_asc">🕒 Jadwal Terlama</option>
              <option value="regs_desc">👥 Peserta Terbanyak</option>
              <option value="regs_asc">👥 Peserta Tersedikit</option>
              <option value="name_asc">🔤 Nama Batch (A - Z)</option>
              <option value="name_desc">🔤 Nama Batch (Z - A)</option>
              <option value="status_active">🟢 Status Aktif Duluan</option>
            </select>
          </div>

          {/* Page size */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginLeft: "auto" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--ink-soft)" }}>Tampil:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              style={{
                padding: "0.55rem 0.6rem",
                borderRadius: "var(--r-sm)",
                border: "1px solid var(--border)",
                fontSize: "0.85rem",
                background: "var(--white)",
              }}
            >
              <option value={5}>5 baris</option>
              <option value={10}>10 baris</option>
              <option value={20}>20 baris</option>
              <option value={50}>50 baris</option>
              <option value={-1}>Semua</option>
            </select>
          </div>
        </div>

        {/* Status Info & Reset Filter */}
        {isFiltered && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: "0.8rem",
              color: "var(--ink-soft)",
              paddingTop: "0.4rem",
              borderTop: "1px dashed var(--border)",
            }}
          >
            <span>
              Menemukan <strong>{totalItems}</strong> batch sesuai filter.
            </span>
            <button
              type="button"
              onClick={resetFilters}
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
              ✕ Reset Semua Filter
            </button>
          </div>
        )}
      </div>

      {/* Main Batch Table */}
      <div className="tbl-wrap" style={{ borderRadius: "var(--r-md)", border: "1px solid var(--border)" }}>
        <table className="tbl">
          <thead>
            <tr>
              <th
                onClick={() => toggleHeaderSort("name")}
                style={{ cursor: "pointer", userSelect: "none" }}
                title="Klik untuk mengurutkan nama"
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                  <span>Batch &amp; Format</span>
                  <span style={{ fontSize: "0.75rem", opacity: sortBy.includes("name") ? 1 : 0.4 }}>
                    {sortBy === "name_asc" ? "▲" : sortBy === "name_desc" ? "▼" : "⇅"}
                  </span>
                </div>
              </th>

              <th
                onClick={() => toggleHeaderSort("schedule")}
                style={{ cursor: "pointer", userSelect: "none" }}
                title="Klik untuk mengurutkan jadwal"
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                  <span>Jadwal Pelaksanaan</span>
                  <span style={{ fontSize: "0.75rem", opacity: sortBy.includes("schedule") ? 1 : 0.4 }}>
                    {sortBy === "schedule_desc" ? "▼" : sortBy === "schedule_asc" ? "▲" : "⇅"}
                  </span>
                </div>
              </th>

              <th>Harga &amp; Kuota</th>

              <th
                onClick={() => toggleHeaderSort("regs")}
                style={{ cursor: "pointer", userSelect: "none" }}
                title="Klik untuk mengurutkan pendaftar"
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                  <span>Pendaftar</span>
                  <span style={{ fontSize: "0.75rem", opacity: sortBy.includes("regs") ? 1 : 0.4 }}>
                    {sortBy === "regs_desc" ? "▼" : sortBy === "regs_asc" ? "▲" : "⇅"}
                  </span>
                </div>
              </th>

              <th>Status Batch</th>
              <th>Sertifikat</th>
              <th style={{ textAlign: "right" }}>Aksi</th>
            </tr>
          </thead>

          <tbody>
            {paginatedBatches.map((b) => {
              const bDate = new Date(b.scheduleAt);
              const past = bDate < now;
              const isOffline = b.batchType === "OFFLINE";
              const currentNormalPrice = (isOffline ? b.priceOffline : b.priceOnline) ?? (isOffline ? 1400000 : 490000);
              const currentEbPrice = (isOffline ? b.priceOfflineEb : b.priceOnlineEb) ?? (isOffline ? 750000 : 225000);
              const currentEbQuota = (isOffline ? b.quotaOfflineEb : b.quotaOnlineEb) ?? (isOffline ? 10 : 20);

              return (
                <tr key={b.id} style={{ opacity: b.isActive ? 1 : 0.75 }}>
                  {/* Format & Name */}
                  <td data-label="Batch">
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", alignItems: "flex-start" }}>
                      <span
                        className="badge"
                        style={{
                          fontWeight: 800,
                          background: isOffline ? "rgba(225, 112, 85, 0.15)" : "var(--purple-soft)",
                          color: isOffline ? "#d63031" : "var(--purple-deep)",
                        }}
                      >
                        {isOffline ? "🏢 Offline Bekasi" : "💻 Online (Zoom)"}
                      </span>
                      <strong style={{ fontSize: "0.95rem", color: "var(--ink)" }}>
                        {b.name || (isOffline ? "Batch Offline" : "Batch Online")}
                      </strong>
                      {isOffline && b.offlineVenue && (
                        <div style={{ fontSize: "0.75rem", color: "var(--ink-soft)" }}>
                          📍 {b.offlineVenue}
                        </div>
                      )}
                      {!isOffline && b.zoomLink && (
                        <div style={{ fontSize: "0.75rem", color: "#0984e3", display: "flex", alignItems: "center", gap: "0.2rem" }}>
                          🔗 Zoom siap
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Jadwal */}
                  <td data-label="Jadwal" className="c-mid">
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                      <strong style={{ fontSize: "0.85rem" }}>{formatJadwal(bDate)}</strong>
                      <div>
                        {past ? (
                          <span
                            className="badge dim"
                            style={{ fontSize: "0.65rem", padding: "0.2em 0.6em", background: "#f1f2f6", color: "#747d8c" }}
                          >
                            ⏳ Selesai
                          </span>
                        ) : (
                          <span
                            className="badge g"
                            style={{ fontSize: "0.65rem", padding: "0.2em 0.6em" }}
                          >
                            🟢 Mendatang
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Harga & Kuota */}
                  <td data-label="Harga &amp; Kuota" className="c-mid">
                    <div style={{ fontSize: "0.8rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                      <div>
                        <span className="muted">Normal:</span> <strong>Rp {currentNormalPrice.toLocaleString("id-ID")}</strong>
                      </div>
                      <div>
                        <span className="muted">Early Bird:</span>{" "}
                        <strong style={{ color: "#00b894" }}>Rp {currentEbPrice.toLocaleString("id-ID")}</strong>
                      </div>
                      <div className="muted" style={{ fontSize: "0.75rem" }}>
                        Kuota EB: {currentEbQuota} org {isOffline ? `| Ruang: ${b.seatsLeft ?? 20} kursi` : ""}
                      </div>
                    </div>
                  </td>

                  {/* Pendaftar */}
                  <td data-label="Pendaftar">
                    {b._count.registrations > 0 ? (
                      <Link
                        href={`/webadmin/pendaftar?batchId=${b.id}`}
                        className="btn btn-sm"
                        style={{
                          fontWeight: 700,
                          background: "var(--purple-soft)",
                          color: "var(--purple-deep)",
                          border: "1px solid rgba(108, 92, 231, 0.2)",
                        }}
                      >
                        👥 {b._count.registrations} peserta →
                      </Link>
                    ) : (
                      <span className="muted" style={{ fontSize: "0.85rem" }}>
                        0 peserta
                      </span>
                    )}
                  </td>

                  {/* Status Batch */}
                  <td data-label="Status">
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", alignItems: "flex-start" }}>
                      <span className={`badge ${b.isActive ? "g" : "dim"}`}>
                        {b.isActive ? "Aktif" : "Nonaktif"}
                      </span>
                      <form action={toggleBatch}>
                        <input type="hidden" name="id" value={b.id} />
                        <input type="hidden" name="programId" value={program.id} />
                        <button
                          type="submit"
                          className="btn btn-sm"
                          style={{ fontSize: "0.7rem", padding: "0.25rem 0.6rem" }}
                        >
                          {b.isActive ? "Nonaktifkan" : "Aktifkan"}
                        </button>
                      </form>
                    </div>
                  </td>

                  {/* Status Sertifikat */}
                  <td data-label="Sertifikat">
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", alignItems: "flex-start" }}>
                      <span className={`badge ${b.certPublished ? "g" : "dim"}`}>
                        {b.certPublished ? "Rilis" : "Ditahan"}
                      </span>
                      <form action={toggleBatchCertPublish}>
                        <input type="hidden" name="id" value={b.id} />
                        <input type="hidden" name="programId" value={program.id} />
                        <button
                          type="submit"
                          className={`btn btn-sm ${b.certPublished ? "btn-danger" : "btn-purple"}`}
                          style={{ fontSize: "0.7rem", padding: "0.25rem 0.6rem" }}
                        >
                          {b.certPublished ? "Batalkan" : "Rilis Sertifikat"}
                        </button>
                      </form>
                      {b.certPublished && (
                        <form action={sendBatchCertWaAction} style={{ marginTop: "0.15rem" }}>
                          <input type="hidden" name="batchId" value={b.id} />
                          <input type="hidden" name="programId" value={program.id} />
                          <input type="hidden" name="mode" value="unsent_only" />
                          <ConfirmButton
                            className="btn btn-sm btn-line"
                            style={{ fontSize: "0.68rem", padding: "0.2rem 0.5rem", whiteSpace: "nowrap" }}
                            message={`Kirim pesan WhatsApp sertifikat ke peserta batch ${b.name || ""} yang belum terkirim?`}
                          >
                            📲 Kirim WA Tertunda
                          </ConfirmButton>
                        </form>
                      )}
                    </div>
                  </td>

                  {/* Aksi */}
                  <td data-label="Aksi" style={{ textAlign: "right" }}>
                    <div style={{ display: "flex", gap: "0.4rem", justifyContent: "flex-end", flexWrap: "wrap" }}>
                      {/* Tombol Edit Modal */}
                      <button
                        type="button"
                        onClick={() => setEditBatch(b)}
                        className="btn btn-sm btn-purple"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.3rem",
                          fontWeight: 700,
                        }}
                      >
                        ✏️ Edit Batch
                      </button>

                      {/* Tombol Hapus */}
                      <form action={deleteBatch} style={{ display: "inline-block" }}>
                        <input type="hidden" name="id" value={b.id} />
                        <input type="hidden" name="programId" value={program.id} />
                        <ConfirmButton
                          className="btn btn-sm btn-danger"
                          message={`Apakah Anda yakin ingin menghapus "${b.name || "Batch ini"}"?`}
                          disabled={b._count.registrations > 0}
                          title={
                            b._count.registrations > 0
                              ? "Tidak bisa dihapus — sudah ada pendaftar. Nonaktifkan saja."
                              : "Hapus batch"
                          }
                        >
                          Hapus
                        </ConfirmButton>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}

            {paginatedBatches.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--ink-faint)" }}>
                  <div style={{ fontSize: "1.8rem", marginBottom: "0.5rem" }}>🔍</div>
                  <strong>Tidak ada batch yang ditemukan</strong>
                  <p style={{ margin: "0.3rem 0 0.8rem", fontSize: "0.85rem" }}>
                    {isFiltered
                      ? "Coba ubah kata kunci pencarian atau bersihkan filter."
                      : "Belum ada batch yang dibuat untuk program ini."}
                  </p>
                  {isFiltered && (
                    <button type="button" onClick={resetFilters} className="btn btn-sm">
                      Bersihkan Filter
                    </button>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "1rem",
            padding: "0.5rem 0",
          }}
        >
          <div style={{ fontSize: "0.85rem", color: "var(--ink-soft)", fontWeight: 600 }}>
            Menampilkan{" "}
            <strong>
              {(validPage - 1) * effectivePageSize + 1}–
              {Math.min(validPage * effectivePageSize, totalItems)}
            </strong>{" "}
            dari <strong>{totalItems}</strong> batch
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={validPage === 1}
              className="btn btn-sm"
              style={{ opacity: validPage === 1 ? 0.5 : 1 }}
            >
              ← Sebelum
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
              // Only show nearby pages if totalPages is large
              if (
                totalPages > 7 &&
                p !== 1 &&
                p !== totalPages &&
                Math.abs(p - validPage) > 1
              ) {
                if (p === 2 || p === totalPages - 1) {
                  return (
                    <span key={p} style={{ padding: "0 0.3rem", color: "var(--ink-faint)" }}>
                      ...
                    </span>
                  );
                }
                return null;
              }

              const isCurrent = p === validPage;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setCurrentPage(p)}
                  className={`btn btn-sm ${isCurrent ? "btn-purple" : ""}`}
                  style={{
                    fontWeight: isCurrent ? 800 : 500,
                    minWidth: "2rem",
                    padding: "0.45rem 0.65rem",
                  }}
                >
                  {p}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={validPage === totalPages}
              className="btn btn-sm"
              style={{ opacity: validPage === totalPages ? 0.5 : 1 }}
            >
              Sesudah →
            </button>
          </div>
        </div>
      )}

      {/* Edit Batch Modal */}
      {editBatch && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.55)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "1rem",
            overflowY: "auto",
          }}
          onClick={() => setEditBatch(null)}
        >
          <div
            style={{
              background: "var(--white)",
              borderRadius: "var(--r-md)",
              maxWidth: "680px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 16px 40px rgba(0, 0, 0, 0.25)",
              border: "1px solid var(--border)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "1.2rem 1.5rem",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "linear-gradient(90deg, #f8f7ff 0%, #ffffff 100%)",
              }}
            >
              <div>
                <span
                  className="badge"
                  style={{
                    marginBottom: "0.25rem",
                    background: editBatch.batchType === "OFFLINE" ? "rgba(225, 112, 85, 0.15)" : "var(--purple-soft)",
                    color: editBatch.batchType === "OFFLINE" ? "#d63031" : "var(--purple-deep)",
                  }}
                >
                  {editBatch.batchType === "OFFLINE" ? "🏢 Offline Bekasi" : "💻 Online (Zoom)"}
                </span>
                <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800, color: "var(--ink)" }}>
                  Edit Pengaturan: {editBatch.name || "Batch Angkatan"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditBatch(null)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "1.4rem",
                  cursor: "pointer",
                  color: "var(--ink-soft)",
                  padding: "0.2rem",
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body: Update Form */}
            <form action={updateBatchLinks} style={{ padding: "1.5rem" }}>
              <input type="hidden" name="id" value={editBatch.id} />
              <input type="hidden" name="programId" value={program.id} />

              <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
                {/* Bagian 1: Identitas & Jadwal */}
                <div
                  style={{
                    background: "var(--chip)",
                    padding: "1rem",
                    borderRadius: "var(--r-sm)",
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "1rem",
                  }}
                >
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, marginBottom: "0.3rem" }}>
                      Nama / Label Batch
                    </label>
                    <input
                      name="name"
                      defaultValue={editBatch.name ?? ""}
                      placeholder="mis. Batch 8 (Online Weekend)"
                      style={{
                        width: "100%",
                        padding: "0.55rem 0.75rem",
                        borderRadius: "var(--r-sm)",
                        border: "1px solid var(--border)",
                        background: "var(--white)",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, marginBottom: "0.3rem" }}>
                      Format Pelatihan
                    </label>
                    <select
                      name="batchType"
                      defaultValue={editBatch.batchType}
                      style={{
                        width: "100%",
                        padding: "0.55rem 0.75rem",
                        borderRadius: "var(--r-sm)",
                        border: "1px solid var(--border)",
                        background: "var(--white)",
                        fontWeight: 600,
                      }}
                    >
                      <option value="ONLINE">💻 Online (Zoom)</option>
                      <option value="OFFLINE">🏢 Offline (Bekasi)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, marginBottom: "0.3rem" }}>
                      Jadwal Pelaksanaan (WIB)
                    </label>
                    <input
                      type="datetime-local"
                      name="scheduleAt"
                      defaultValue={toWIBInput(new Date(editBatch.scheduleAt))}
                      style={{
                        width: "100%",
                        padding: "0.55rem 0.75rem",
                        borderRadius: "var(--r-sm)",
                        border: "1px solid var(--border)",
                        background: "var(--white)",
                      }}
                    />
                  </div>
                </div>

                {/* Bagian 2: Harga & Kuota */}
                <div>
                  <h4 style={{ margin: "0 0 0.6rem", fontSize: "0.9rem", fontWeight: 800, color: "var(--ink)" }}>
                    Harga &amp; Kuota Peserta
                  </h4>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.8rem" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, marginBottom: "0.25rem" }}>
                        Harga Normal (Rp)
                      </label>
                      <input
                        name={editBatch.batchType === "OFFLINE" ? "priceOffline" : "priceOnline"}
                        defaultValue={
                          (editBatch.batchType === "OFFLINE" ? editBatch.priceOffline : editBatch.priceOnline) ??
                          (editBatch.batchType === "OFFLINE" ? 1400000 : 490000)
                        }
                        style={{
                          width: "100%",
                          padding: "0.55rem 0.7rem",
                          borderRadius: "var(--r-sm)",
                          border: "1px solid var(--border)",
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, marginBottom: "0.25rem" }}>
                        Early Bird (Rp)
                      </label>
                      <input
                        name={editBatch.batchType === "OFFLINE" ? "priceOfflineEb" : "priceOnlineEb"}
                        defaultValue={
                          (editBatch.batchType === "OFFLINE" ? editBatch.priceOfflineEb : editBatch.priceOnlineEb) ??
                          (editBatch.batchType === "OFFLINE" ? 750000 : 225000)
                        }
                        style={{
                          width: "100%",
                          padding: "0.55rem 0.7rem",
                          borderRadius: "var(--r-sm)",
                          border: "1px solid var(--border)",
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, marginBottom: "0.25rem" }}>
                        Kuota EB (orang)
                      </label>
                      <input
                        name={editBatch.batchType === "OFFLINE" ? "quotaOfflineEb" : "quotaOnlineEb"}
                        defaultValue={
                          (editBatch.batchType === "OFFLINE" ? editBatch.quotaOfflineEb : editBatch.quotaOnlineEb) ??
                          (editBatch.batchType === "OFFLINE" ? 10 : 20)
                        }
                        style={{
                          width: "100%",
                          padding: "0.55rem 0.7rem",
                          borderRadius: "var(--r-sm)",
                          border: "1px solid var(--border)",
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Bagian 3: Akses, Link & Lokasi */}
                <div>
                  <h4 style={{ margin: "0 0 0.6rem", fontSize: "0.9rem", fontWeight: 800, color: "var(--ink)" }}>
                    Akses Materi, Grup &amp; Lokasi
                  </h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
                    {editBatch.batchType === "ONLINE" ? (
                      <div>
                        <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, marginBottom: "0.25rem" }}>
                          Link Zoom / Google Meet
                        </label>
                        <input
                          name="zoomLink"
                          defaultValue={editBatch.zoomLink ?? ""}
                          placeholder="https://zoom.us/j/..."
                          style={{
                            width: "100%",
                            padding: "0.55rem 0.75rem",
                            borderRadius: "var(--r-sm)",
                            border: "1px solid var(--border)",
                          }}
                        />
                      </div>
                    ) : (
                      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "0.8rem" }}>
                        <div>
                          <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, marginBottom: "0.25rem" }}>
                            Alamat / Venue Offline (Bekasi)
                          </label>
                          <input
                            name="offlineVenue"
                            defaultValue={editBatch.offlineVenue ?? ""}
                            placeholder="Alamat venue pelaksanaan di Bekasi"
                            style={{
                              width: "100%",
                              padding: "0.55rem 0.75rem",
                              borderRadius: "var(--r-sm)",
                              border: "1px solid var(--border)",
                            }}
                          />
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, marginBottom: "0.25rem" }}>
                            Sisa Kursi Ruangan
                          </label>
                          <input
                            name="seatsLeft"
                            defaultValue={editBatch.seatsLeft ?? 20}
                            placeholder="20"
                            style={{
                              width: "100%",
                              padding: "0.55rem 0.75rem",
                              borderRadius: "var(--r-sm)",
                              border: "1px solid var(--border)",
                            }}
                          />
                        </div>
                      </div>
                    )}

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.8rem" }}>
                      <div>
                        <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, marginBottom: "0.25rem" }}>
                          Link Grup WhatsApp Peserta
                        </label>
                        <input
                          name="waGroupLink"
                          defaultValue={editBatch.waGroupLink ?? ""}
                          placeholder="https://chat.whatsapp.com/..."
                          style={{
                            width: "100%",
                            padding: "0.55rem 0.75rem",
                            borderRadius: "var(--r-sm)",
                            border: "1px solid var(--border)",
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, marginBottom: "0.25rem" }}>
                          Link Rekaman Video / LMS
                        </label>
                        <input
                          name="recordingLink"
                          defaultValue={editBatch.recordingLink ?? ""}
                          placeholder="Link Google Drive / YouTube unlisted"
                          style={{
                            width: "100%",
                            padding: "0.55rem 0.75rem",
                            borderRadius: "var(--r-sm)",
                            border: "1px solid var(--border)",
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "0.8rem",
                  marginTop: "1.5rem",
                  paddingTop: "1rem",
                  borderTop: "1px solid var(--border)",
                }}
              >
                <button
                  type="button"
                  onClick={() => setEditBatch(null)}
                  className="btn btn-sm"
                  style={{ padding: "0.6rem 1.2rem" }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-purple"
                  style={{ padding: "0.6rem 1.4rem", fontWeight: 700 }}
                >
                  Simpan Perubahan Batch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
