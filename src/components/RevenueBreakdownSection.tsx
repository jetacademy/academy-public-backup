"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { DailyRevenueItem, MonthlyRevenueItem, BatchRevenueItem } from "@/lib/revenue";

function rupiah(n: number): string {
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}

type TabType = "daily" | "monthly" | "batch";
const DAY_RANGES = [7, 14, 30, 90] as const;
type DayRange = (typeof DAY_RANGES)[number];

interface Props {
  dailyData: DailyRevenueItem[];
  monthlyData: MonthlyRevenueItem[];
  batchData: BatchRevenueItem[];
}

export default function RevenueBreakdownSection({
  dailyData,
  monthlyData,
  batchData,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabType>("daily");
  const [dayRange, setDayRange] = useState<DayRange>(30);
  const [dailyPage, setDailyPage] = useState(1);
  const [batchPage, setBatchPage] = useState(1);
  const [batchSearch, setBatchSearch] = useState("");
  const [batchFormatFilter, setBatchFormatFilter] = useState<"ALL" | "ONLINE" | "OFFLINE">("ALL");
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);

  // ─── TAB 1: PER HARI (In-memory sliced by selected range) ───
  const currentDailyData = useMemo(() => {
    return dailyData.slice(-dayRange);
  }, [dailyData, dayRange]);

  const dailyTotal = useMemo(() => {
    return currentDailyData.reduce((acc, d) => acc + d.amount, 0);
  }, [currentDailyData]);

  const dailyTotalTrx = useMemo(() => {
    return currentDailyData.reduce((acc, d) => acc + d.paidCount, 0);
  }, [currentDailyData]);

  const dailyAvg = useMemo(() => {
    return currentDailyData.length > 0 ? Math.round(dailyTotal / currentDailyData.length) : 0;
  }, [dailyTotal, currentDailyData.length]);

  const dailyPeak = useMemo(() => {
    if (currentDailyData.length === 0) return null;
    return currentDailyData.reduce(
      (best, d) => (d.amount > best.amount ? d : best),
      currentDailyData[0]
    );
  }, [currentDailyData]);

  // Daily table: newest to oldest
  const dailyReversed = useMemo(() => {
    return [...currentDailyData].reverse();
  }, [currentDailyData]);

  const dailyPerPage = 10;
  const dailyTotalPages = Math.ceil(dailyReversed.length / dailyPerPage) || 1;
  const currentDailyPageItems = useMemo(() => {
    const start = (dailyPage - 1) * dailyPerPage;
    return dailyReversed.slice(start, start + dailyPerPage);
  }, [dailyReversed, dailyPage]);

  // Max for chart bar scaling
  const dailyMax = useMemo(() => {
    return Math.max(1, ...currentDailyData.map((d) => d.amount));
  }, [currentDailyData]);

  const peakBarIndex = useMemo(() => {
    return currentDailyData.reduce(
      (best, d, i) => (d.amount > currentDailyData[best].amount ? i : best),
      0
    );
  }, [currentDailyData]);

  // ─── TAB 2: PER BULAN ───
  const monthlyTotal = useMemo(() => {
    return monthlyData.reduce((acc, m) => acc + m.amount, 0);
  }, [monthlyData]);

  const monthlyTotalTrx = useMemo(() => {
    return monthlyData.reduce((acc, m) => acc + m.paidCount, 0);
  }, [monthlyData]);

  const monthlyAvg = useMemo(() => {
    return monthlyData.length > 0 ? Math.round(monthlyTotal / monthlyData.length) : 0;
  }, [monthlyTotal, monthlyData.length]);

  const monthlyPeak = useMemo(() => {
    if (monthlyData.length === 0) return null;
    return monthlyData.reduce((best, m) => (m.amount > best.amount ? m : best), monthlyData[0]);
  }, [monthlyData]);

  // ─── TAB 3: PER BATCH ───
  const filteredBatches = useMemo(() => {
    return batchData.filter((b) => {
      if (batchFormatFilter !== "ALL" && b.batchType !== batchFormatFilter) {
        return false;
      }
      if (batchSearch.trim()) {
        const q = batchSearch.toLowerCase();
        const matchTitle = b.programTitle.toLowerCase().includes(q);
        const matchBatch = b.batchName.toLowerCase().includes(q);
        if (!matchTitle && !matchBatch) return false;
      }
      return true;
    });
  }, [batchData, batchSearch, batchFormatFilter]);

  const batchTotalIncome = useMemo(() => {
    return filteredBatches.reduce((acc, b) => acc + b.totalRevenue, 0);
  }, [filteredBatches]);

  const batchTotalPaid = useMemo(() => {
    return filteredBatches.reduce((acc, b) => acc + b.paidRegs, 0);
  }, [filteredBatches]);

  const batchTotalRegs = useMemo(() => {
    return filteredBatches.reduce((acc, b) => acc + b.totalRegs, 0);
  }, [filteredBatches]);

  const batchAvgConversion = useMemo(() => {
    return batchTotalRegs > 0 ? Math.round((batchTotalPaid / batchTotalRegs) * 100) : 0;
  }, [batchTotalPaid, batchTotalRegs]);

  const batchPerPage = 10;
  const batchTotalPages = Math.ceil(filteredBatches.length / batchPerPage) || 1;
  const currentBatchPageItems = useMemo(() => {
    const start = (batchPage - 1) * batchPerPage;
    return filteredBatches.slice(start, start + batchPerPage);
  }, [filteredBatches, batchPage]);

  // Sumbu-x label chart helper
  const shouldShowLabel = (index: number, total: number) => {
    if (total <= 14) return true;
    const step = total <= 31 ? 3 : 7;
    return index % step === 0 || index === total - 1;
  };

  return (
    <div className="rev-section" style={{ marginTop: "2.4rem" }}>
      {/* Header Utama + Tab Switcher */}
      <div className="adm-head" style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <h2 style={{ fontSize: "1.25rem", margin: 0 }}>Laporan Pendapatan</h2>
          <span style={{ fontSize: "0.76rem", color: "var(--ink-faint)", fontWeight: 600 }}>
            Ringkasan akurat &amp; instan
          </span>
        </div>

        {/* Tab Buttons (0ms client-side switch) */}
        <div className="rev-tabs" role="tablist" aria-label="Pilihan tampilan pendapatan">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "daily"}
            className={`rev-tab-btn${activeTab === "daily" ? " active" : ""}`}
            onClick={() => setActiveTab("daily")}
          >
            📅 Per Hari
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "monthly"}
            className={`rev-tab-btn${activeTab === "monthly" ? " active" : ""}`}
            onClick={() => setActiveTab("monthly")}
          >
            📆 Per Bulan
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "batch"}
            className={`rev-tab-btn${activeTab === "batch" ? " active" : ""}`}
            onClick={() => {
              setActiveTab("batch");
              setBatchPage(1);
            }}
          >
            🏷️ Per Batch
          </button>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          KONTEN TAB 1: PENDAPATAN PER HARI
         ════════════════════════════════════════════════════════ */}
      {activeTab === "daily" && (
        <div className="tbl-wrap" style={{ padding: "1.4rem" }}>
          {/* Header Periode & Switcher Rentang */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "0.8rem",
              marginBottom: "1.2rem",
            }}
          >
            <div>
              <span className="muted" style={{ fontSize: "0.78rem" }}>
                Total pendapatan ({dayRange} hari terakhir)
              </span>
              <div style={{ fontSize: "1.45rem", fontWeight: 800, color: "var(--ink)" }}>
                {rupiah(dailyTotal)}
              </div>
            </div>

            {/* Pill range tanpa reload page */}
            <div style={{ display: "flex", gap: "0.35rem", alignItems: "center" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--ink-faint)", marginRight: "0.2rem" }}>
                Rentang:
              </span>
              {DAY_RANGES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    setDayRange(r);
                    setDailyPage(1);
                  }}
                  className={`btn btn-sm ${dayRange === r ? "btn-purple" : ""}`}
                  style={{
                    padding: "0.25rem 0.65rem",
                    fontSize: "0.76rem",
                    fontWeight: 700,
                  }}
                >
                  {r} Hari
                </button>
              ))}
            </div>
          </div>

          {/* 3 Mini Stat Boxes */}
          <div className="rev-summary-grid">
            <div className="rev-summary-box">
              <span className="muted">Transaksi Lunas</span>
              <b style={{ fontSize: "1.1rem", color: "var(--ink)" }}>{dailyTotalTrx} trx</b>
              <span style={{ fontSize: "0.72rem", color: "var(--ink-faint)" }}>
                Rata-rata: {dailyTotalTrx > 0 ? rupiah(dailyTotal / dailyTotalTrx) : "Rp 0"} / trx
              </span>
            </div>
            <div className="rev-summary-box">
              <span className="muted">Rata-rata Harian</span>
              <b style={{ fontSize: "1.1rem", color: "var(--ink)" }}>{rupiah(dailyAvg)}</b>
              <span style={{ fontSize: "0.72rem", color: "var(--ink-faint)" }}>
                per hari dalam periode ini
              </span>
            </div>
            <div className="rev-summary-box">
              <span className="muted">Hari Puncak</span>
              <b style={{ fontSize: "1.1rem", color: "var(--purple)" }}>
                {dailyPeak && dailyPeak.amount > 0 ? rupiah(dailyPeak.amount) : "Rp 0"}
              </b>
              <span style={{ fontSize: "0.72rem", color: "var(--ink-faint)" }}>
                {dailyPeak && dailyPeak.amount > 0 ? dailyPeak.fullDate : "Belum ada transaksi"}
              </span>
            </div>
          </div>

          {/* Bar Chart Visual */}
          <div style={{ marginTop: "1.2rem", marginBottom: "1.8rem" }}>
            <div
              role="img"
              aria-label={`Grafik pendapatan harian, total ${rupiah(dailyTotal)} dalam ${currentDailyData.length} hari`}
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: "3px",
                height: "8.5rem",
                borderBottom: "1px solid var(--line)",
                padding: "0 2px",
              }}
            >
              {currentDailyData.map((d, i) => {
                const heightPct = Math.max(3, Math.round((d.amount / dailyMax) * 100));
                const isHovered = hoveredBarIndex === i;
                const isPeak = i === peakBarIndex && d.amount > 0;

                return (
                  <div
                    key={d.date}
                    onMouseEnter={() => setHoveredBarIndex(i)}
                    onMouseLeave={() => setHoveredBarIndex(null)}
                    title={`${d.dayName}, ${d.fullDate}: ${rupiah(d.amount)} (${d.paidCount} trx)`}
                    style={{
                      flex: 1,
                      minWidth: "2px",
                      height: `${heightPct}%`,
                      background: isHovered
                        ? "var(--orange, #f39c12)"
                        : isPeak
                        ? "var(--purple-deep, #1a1854)"
                        : "var(--purple)",
                      opacity: d.amount === 0 ? 0.15 : 1,
                      borderRadius: "3px 3px 0 0",
                      cursor: "pointer",
                      position: "relative",
                      transition: "background 0.12s ease",
                    }}
                  >
                    {isPeak && (
                      <span
                        style={{
                          position: "absolute",
                          top: "-1.35rem",
                          left: "50%",
                          transform: "translateX(-50%)",
                          fontSize: "0.66rem",
                          fontWeight: 800,
                          color: "var(--ink)",
                          whiteSpace: "nowrap",
                          background: "var(--white)",
                          padding: "1px 4px",
                          borderRadius: "4px",
                          boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
                        }}
                      >
                        {rupiah(d.amount)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* X-axis date labels */}
            <div style={{ display: "flex", gap: "3px", padding: "0 2px", marginTop: "0.35rem" }}>
              {currentDailyData.map((d, i) => (
                <div key={d.date} style={{ flex: 1, minWidth: "2px", textAlign: "center" }}>
                  {shouldShowLabel(i, currentDailyData.length) && (
                    <span style={{ fontSize: "0.64rem", color: "var(--ink-faint)" }}>
                      {d.label}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Hover tooltip bar */}
            <div style={{ minHeight: "1.4rem", marginTop: "0.5rem", textAlign: "right" }}>
              {hoveredBarIndex !== null && currentDailyData[hoveredBarIndex] && (
                <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--ink)" }}>
                  {currentDailyData[hoveredBarIndex].dayName},{" "}
                  {currentDailyData[hoveredBarIndex].fullDate}:{" "}
                  <span style={{ color: "var(--purple)" }}>
                    {rupiah(currentDailyData[hoveredBarIndex].amount)}
                  </span>{" "}
                  ({currentDailyData[hoveredBarIndex].paidCount} transaksi)
                </span>
              )}
            </div>
          </div>

          {/* TABEL PENDAPATAN PER HARI */}
          <div style={{ marginTop: "1rem" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "0.6rem",
              }}
            >
              <h3 style={{ fontSize: "0.95rem", margin: 0, fontWeight: 700 }}>
                Tabel Rincian Harian ({dayRange} Hari)
              </h3>
              <span className="muted" style={{ fontSize: "0.75rem" }}>
                Halaman {dailyPage} dari {dailyTotalPages}
              </span>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table className="tbl" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th>Tanggal &amp; Hari</th>
                    <th style={{ textAlign: "center" }}>Transaksi Lunas</th>
                    <th style={{ textAlign: "right" }}>Rata-rata / Trx</th>
                    <th style={{ textAlign: "right" }}>Total Pendapatan</th>
                  </tr>
                </thead>
                <tbody>
                  {currentDailyPageItems.map((d) => {
                    const hasIncome = d.amount > 0;
                    return (
                      <tr
                        key={d.date}
                        style={{
                          background: hasIncome ? "rgba(108, 92, 231, 0.02)" : "transparent",
                        }}
                      >
                        <td data-label="Tanggal & Hari">
                          <strong style={{ color: hasIncome ? "var(--ink)" : "var(--ink-soft)" }}>
                            {d.dayName}, {d.fullDate}
                          </strong>
                        </td>
                        <td data-label="Transaksi Lunas" style={{ textAlign: "center" }}>
                          {d.paidCount > 0 ? (
                            <span className="badge g" style={{ fontWeight: 700 }}>
                              {d.paidCount} transaksi
                            </span>
                          ) : (
                            <span className="muted">0</span>
                          )}
                        </td>
                        <td data-label="Rata-rata / Trx" style={{ textAlign: "right" }}>
                          {d.paidCount > 0 ? (
                            <span className="muted">{rupiah(d.amount / d.paidCount)}</span>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                        <td data-label="Total Pendapatan" style={{ textAlign: "right" }}>
                          <strong
                            style={{
                              color: hasIncome ? "var(--purple)" : "var(--ink-faint)",
                              fontSize: hasIncome ? "0.92rem" : "0.85rem",
                            }}
                          >
                            {rupiah(d.amount)}
                          </strong>
                        </td>
                      </tr>
                    );
                  })}
                  {currentDailyPageItems.length === 0 && (
                    <tr>
                      <td colSpan={4} className="muted" style={{ textAlign: "center", padding: "1.5rem" }}>
                        Tidak ada data pendapatan untuk periode ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {dailyTotalPages > 1 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "0.4rem",
                  marginTop: "0.85rem",
                  alignItems: "center",
                }}
              >
                <button
                  type="button"
                  disabled={dailyPage <= 1}
                  onClick={() => setDailyPage((p) => Math.max(1, p - 1))}
                  className="btn btn-sm"
                  style={{ fontSize: "0.75rem" }}
                >
                  ← Sebelumnya
                </button>
                <span style={{ fontSize: "0.78rem", color: "var(--ink-soft)", margin: "0 0.3rem" }}>
                  {dailyPage} / {dailyTotalPages}
                </span>
                <button
                  type="button"
                  disabled={dailyPage >= dailyTotalPages}
                  onClick={() => setDailyPage((p) => Math.min(dailyTotalPages, p + 1))}
                  className="btn btn-sm"
                  style={{ fontSize: "0.75rem" }}
                >
                  Berikutnya →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          KONTEN TAB 2: PENDAPATAN PER BULAN
         ════════════════════════════════════════════════════════ */}
      {activeTab === "monthly" && (
        <div className="tbl-wrap" style={{ padding: "1.4rem" }}>
          {/* Header & Total Omzet Bulanan */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              flexWrap: "wrap",
              gap: "0.8rem",
              marginBottom: "1.2rem",
            }}
          >
            <div>
              <span className="muted" style={{ fontSize: "0.78rem" }}>
                Total omzet ({monthlyData.length} bulan tercatat)
              </span>
              <div style={{ fontSize: "1.45rem", fontWeight: 800, color: "var(--ink)" }}>
                {rupiah(monthlyTotal)}
              </div>
            </div>
            <span className="muted" style={{ fontSize: "0.78rem" }}>
              Total Transaksi: <strong>{monthlyTotalTrx} transaksi</strong>
            </span>
          </div>

          {/* 3 Mini Stat Boxes */}
          <div className="rev-summary-grid">
            <div className="rev-summary-box">
              <span className="muted">Total Transaksi</span>
              <b style={{ fontSize: "1.1rem", color: "var(--ink)" }}>{monthlyTotalTrx} trx</b>
              <span style={{ fontSize: "0.72rem", color: "var(--ink-faint)" }}>
                dari seluruh transaksi lunas
              </span>
            </div>
            <div className="rev-summary-box">
              <span className="muted">Rata-rata Bulanan</span>
              <b style={{ fontSize: "1.1rem", color: "var(--ink)" }}>{rupiah(monthlyAvg)}</b>
              <span style={{ fontSize: "0.72rem", color: "var(--ink-faint)" }}>
                per bulan
              </span>
            </div>
            <div className="rev-summary-box">
              <span className="muted">Bulan Terbaik</span>
              <b style={{ fontSize: "1.1rem", color: "var(--purple)" }}>
                {monthlyPeak ? rupiah(monthlyPeak.amount) : "Rp 0"}
              </b>
              <span style={{ fontSize: "0.72rem", color: "var(--ink-faint)" }}>
                {monthlyPeak ? monthlyPeak.label : "—"}
              </span>
            </div>
          </div>

          {/* TABEL PENDAPATAN BULANAN */}
          <div style={{ marginTop: "1.2rem", overflowX: "auto" }}>
            <table className="tbl" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th>Bulan &amp; Tahun</th>
                  <th style={{ textAlign: "center" }}>Transaksi Lunas</th>
                  <th style={{ textAlign: "right" }}>Rata-rata / Trx</th>
                  <th style={{ textAlign: "right" }}>Total Pendapatan</th>
                  <th style={{ minWidth: "10rem" }}>Kontribusi Omzet</th>
                </tr>
              </thead>
              <tbody>
                {monthlyData.map((m) => {
                  const pct = monthlyTotal > 0 ? (m.amount / monthlyTotal) * 100 : 0;
                  const isPeak = monthlyPeak?.monthKey === m.monthKey && m.amount > 0;

                  return (
                    <tr key={m.monthKey}>
                      <td data-label="Bulan & Tahun">
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <strong style={{ fontSize: "0.92rem", color: "var(--ink)" }}>
                            {m.label}
                          </strong>
                          {isPeak && (
                            <span className="badge y" style={{ fontSize: "0.68rem" }}>
                              Terbaik ⭐
                            </span>
                          )}
                        </div>
                      </td>
                      <td data-label="Transaksi Lunas" style={{ textAlign: "center" }}>
                        <span className="badge g" style={{ fontWeight: 700 }}>
                          {m.paidCount} transaksi
                        </span>
                      </td>
                      <td data-label="Rata-rata / Trx" style={{ textAlign: "right" }}>
                        <span className="muted">{rupiah(m.avgAmount)}</span>
                      </td>
                      <td data-label="Total Pendapatan" style={{ textAlign: "right" }}>
                        <strong style={{ color: "var(--purple)", fontSize: "0.95rem" }}>
                          {rupiah(m.amount)}
                        </strong>
                      </td>
                      <td data-label="Kontribusi Omzet">
                        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                          <div
                            style={{
                              flex: 1,
                              height: "6px",
                              background: "var(--chip)",
                              borderRadius: "99px",
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                width: `${Math.min(100, Math.max(3, pct))}%`,
                                height: "100%",
                                background: isPeak ? "var(--orange, #f39c12)" : "var(--purple)",
                                borderRadius: "99px",
                              }}
                            />
                          </div>
                          <span
                            style={{
                              fontSize: "0.76rem",
                              fontWeight: 700,
                              color: "var(--ink-soft)",
                              minWidth: "3rem",
                              textAlign: "right",
                            }}
                          >
                            {pct.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {monthlyData.length === 0 && (
                  <tr>
                    <td colSpan={5} className="muted" style={{ textAlign: "center", padding: "1.5rem" }}>
                      Belum ada transaksi pembayaran lunas tercatat.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          KONTEN TAB 3: PENDAPATAN PER BATCH
         ════════════════════════════════════════════════════════ */}
      {activeTab === "batch" && (
        <div className="tbl-wrap" style={{ padding: "1.4rem" }}>
          {/* Header & Total Batch */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              flexWrap: "wrap",
              gap: "0.8rem",
              marginBottom: "1.2rem",
            }}
          >
            <div>
              <span className="muted" style={{ fontSize: "0.78rem" }}>
                Total omzet batch ({filteredBatches.length} batch ditemukan)
              </span>
              <div style={{ fontSize: "1.45rem", fontWeight: 800, color: "var(--ink)" }}>
                {rupiah(batchTotalIncome)}
              </div>
            </div>
            <span className="muted" style={{ fontSize: "0.78rem" }}>
              Peserta Lunas: <strong>{batchTotalPaid} orang</strong> dari {batchTotalRegs} pendaftar
            </span>
          </div>

          {/* 3 Mini Stat Boxes */}
          <div className="rev-summary-grid">
            <div className="rev-summary-box">
              <span className="muted">Total Peserta Lunas</span>
              <b style={{ fontSize: "1.1rem", color: "var(--ink)" }}>{batchTotalPaid} orang</b>
              <span style={{ fontSize: "0.72rem", color: "var(--ink-faint)" }}>
                dari {batchTotalRegs} pendaftar
              </span>
            </div>
            <div className="rev-summary-box">
              <span className="muted">Konversi Rata-rata</span>
              <b style={{ fontSize: "1.1rem", color: "var(--purple)" }}>{batchAvgConversion}%</b>
              <span style={{ fontSize: "0.72rem", color: "var(--ink-faint)" }}>
                pendaftar menjadi pembeli
              </span>
            </div>
            <div className="rev-summary-box">
              <span className="muted">Rata-rata Omzet / Batch</span>
              <b style={{ fontSize: "1.1rem", color: "var(--ink)" }}>
                {filteredBatches.length > 0
                  ? rupiah(batchTotalIncome / filteredBatches.length)
                  : "Rp 0"}
              </b>
              <span style={{ fontSize: "0.72rem", color: "var(--ink-faint)" }}>
                per angkatan/batch
              </span>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="rev-search-bar" style={{ marginTop: "1rem" }}>
            <div style={{ flex: 1, minWidth: "14rem" }}>
              <input
                type="search"
                placeholder="🔍 Cari nama program atau nama batch..."
                value={batchSearch}
                onChange={(e) => {
                  setBatchSearch(e.target.value);
                  setBatchPage(1);
                }}
                style={{
                  width: "100%",
                  padding: "0.45rem 0.8rem",
                  fontSize: "0.82rem",
                  border: "1px solid var(--border)",
                  borderRadius: "6px",
                  background: "var(--white)",
                  color: "var(--ink)",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: "0.3rem" }}>
              <button
                type="button"
                onClick={() => {
                  setBatchFormatFilter("ALL");
                  setBatchPage(1);
                }}
                className={`btn btn-sm ${batchFormatFilter === "ALL" ? "btn-purple" : ""}`}
                style={{ fontSize: "0.75rem", padding: "0.3rem 0.65rem" }}
              >
                Semua Format
              </button>
              <button
                type="button"
                onClick={() => {
                  setBatchFormatFilter("ONLINE");
                  setBatchPage(1);
                }}
                className={`btn btn-sm ${batchFormatFilter === "ONLINE" ? "btn-purple" : ""}`}
                style={{ fontSize: "0.75rem", padding: "0.3rem 0.65rem" }}
              >
                💻 Online
              </button>
              <button
                type="button"
                onClick={() => {
                  setBatchFormatFilter("OFFLINE");
                  setBatchPage(1);
                }}
                className={`btn btn-sm ${batchFormatFilter === "OFFLINE" ? "btn-purple" : ""}`}
                style={{ fontSize: "0.75rem", padding: "0.3rem 0.65rem" }}
              >
                🏢 Offline
              </button>
            </div>
          </div>

          {/* TABEL PENDAPATAN PER BATCH */}
          <div style={{ marginTop: "0.8rem", overflowX: "auto" }}>
            <table className="tbl" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th>Program &amp; Batch</th>
                  <th>Format</th>
                  <th>Jadwal Pelaksanaan</th>
                  <th style={{ textAlign: "center" }}>Pendaftar &amp; Lunas</th>
                  <th style={{ textAlign: "center" }}>Konversi</th>
                  <th style={{ textAlign: "right" }}>Total Pendapatan</th>
                  <th style={{ textAlign: "center" }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {currentBatchPageItems.map((b) => {
                  const isOffline = b.batchType === "OFFLINE";

                  return (
                    <tr key={b.batchId}>
                      <td data-label="Program & Batch">
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
                          <Link
                            href={`/webadmin/program/${b.programId}`}
                            style={{
                              fontWeight: 700,
                              color: "var(--ink)",
                              textDecoration: "none",
                              fontSize: "0.88rem",
                            }}
                          >
                            {b.programTitle}
                          </Link>
                          <span style={{ fontSize: "0.78rem", color: "var(--purple)", fontWeight: 600 }}>
                            {b.batchName}
                          </span>
                        </div>
                      </td>
                      <td data-label="Format">
                        <span className={`badge ${isOffline ? "warn" : "b"}`} style={{ fontWeight: 700 }}>
                          {isOffline ? "🏢 Offline" : "💻 Online"}
                        </span>
                      </td>
                      <td data-label="Jadwal Pelaksanaan">
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
                          <span style={{ fontSize: "0.82rem", color: "var(--ink-soft)" }}>
                            {b.scheduleFormatted}
                          </span>
                          <span style={{ fontSize: "0.68rem" }}>
                            {b.isPast ? (
                              <span style={{ color: "var(--ink-faint)" }}>✅ Selesai</span>
                            ) : (
                              <span style={{ color: "#27ae60", fontWeight: 700 }}>🟢 Mendatang</span>
                            )}
                          </span>
                        </div>
                      </td>
                      <td data-label="Pendaftar & Lunas" style={{ textAlign: "center" }}>
                        <strong style={{ color: "var(--ink)" }}>{b.paidRegs}</strong>
                        <span className="muted" style={{ fontSize: "0.78rem" }}>
                          {" "}
                          / {b.totalRegs}
                        </span>
                      </td>
                      <td data-label="Konversi" style={{ textAlign: "center" }}>
                        <span
                          className={`badge ${
                            b.conversionRate >= 50
                              ? "g"
                              : b.conversionRate >= 20
                              ? "y"
                              : "dim"
                          }`}
                          style={{ fontWeight: 700 }}
                        >
                          {b.conversionRate}%
                        </span>
                      </td>
                      <td data-label="Total Pendapatan" style={{ textAlign: "right" }}>
                        <strong
                          style={{
                            color: b.totalRevenue > 0 ? "var(--purple)" : "var(--ink-faint)",
                            fontSize: "0.92rem",
                          }}
                        >
                          {rupiah(b.totalRevenue)}
                        </strong>
                      </td>
                      <td data-label="Aksi" style={{ textAlign: "center" }}>
                        {b.batchId.startsWith("nobatch_") ? (
                          <Link
                            href={`/webadmin/program/${b.programId}`}
                            className="btn btn-sm"
                            style={{ fontSize: "0.72rem", padding: "0.2rem 0.5rem" }}
                          >
                            Detail Program
                          </Link>
                        ) : (
                          <Link
                            href={`/webadmin/program/${b.programId}/batch`}
                            className="btn btn-sm"
                            style={{ fontSize: "0.72rem", padding: "0.2rem 0.5rem" }}
                          >
                            Kelola Batch →
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {currentBatchPageItems.length === 0 && (
                  <tr>
                    <td colSpan={7} className="muted" style={{ textAlign: "center", padding: "1.5rem" }}>
                      Tidak ada data batch yang cocok dengan pencarian/filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {batchTotalPages > 1 && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: "1rem",
                flexWrap: "wrap",
                gap: "0.5rem",
              }}
            >
              <span className="muted" style={{ fontSize: "0.75rem" }}>
                Menampilkan {(batchPage - 1) * batchPerPage + 1} -{" "}
                {Math.min(batchPage * batchPerPage, filteredBatches.length)} dari{" "}
                {filteredBatches.length} batch
              </span>
              <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                <button
                  type="button"
                  disabled={batchPage <= 1}
                  onClick={() => setBatchPage((p) => Math.max(1, p - 1))}
                  className="btn btn-sm"
                  style={{ fontSize: "0.75rem" }}
                >
                  ← Sebelumnya
                </button>
                <span style={{ fontSize: "0.78rem", color: "var(--ink-soft)", margin: "0 0.3rem" }}>
                  {batchPage} / {batchTotalPages}
                </span>
                <button
                  type="button"
                  disabled={batchPage >= batchTotalPages}
                  onClick={() => setBatchPage((p) => Math.min(batchTotalPages, p + 1))}
                  className="btn btn-sm"
                  style={{ fontSize: "0.75rem" }}
                >
                  Berikutnya →
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
