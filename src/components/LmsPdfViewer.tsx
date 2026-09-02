"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Setup worker pdf.js. Menggunakan worker lokal yang disinkronkan dengan versi react-pdf (5.4.296)
if (typeof window !== "undefined" && !pdfjs.GlobalWorkerOptions.workerSrc) {
  pdfjs.GlobalWorkerOptions.workerSrc = `/pdfjs/pdf.worker.min.mjs?v=${pdfjs.version}`;
}

interface LmsPdfViewerProps {
  fileUrl: string;
  title: string;
  allowDownload?: boolean;
}

export default function LmsPdfViewer({ fileUrl, title, allowDownload = false }: LmsPdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [jumpPageInput, setJumpPageInput] = useState("1");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState(800);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoomScale, setZoomScale] = useState(1.0);
  const [viewMode, setViewMode] = useState<"single" | "scroll">("single");
  const [useFallbackEmbed, setUseFallbackEmbed] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasAreaRef = useRef<HTMLDivElement>(null);

  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      const ro = new ResizeObserver(([entry]) => {
        setContainerWidth(Math.floor(entry.contentRect.width));
      });
      ro.observe(node);
    }
  }, []);

  // Memoize options to prevent unnecessary re-renders in Document
  const documentOptions = useMemo(
    () => ({
      cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/standard_fonts/`,
    }),
    []
  );

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setLoading(false);
    setError(null);
  }

  function onDocumentLoadError(err: Error) {
    console.error("[LMS PDF Load Error]:", err);
    setLoading(false);
    setError("Gagal memuat dokumen PDF melalui pembaca canvas bawaan.");
  }

  function handleRetry() {
    setError(null);
    setLoading(true);
    setRetryCount((c) => c + 1);
  }

  function prevPage() {
    setPageNumber((p) => {
      const nextP = Math.max(1, p - 1);
      setJumpPageInput(String(nextP));
      return nextP;
    });
    // Scroll to top of canvas area
    if (canvasAreaRef.current) {
      canvasAreaRef.current.scrollTop = 0;
    }
  }

  function nextPage() {
    setPageNumber((p) => {
      const nextP = Math.min(numPages, p + 1);
      setJumpPageInput(String(nextP));
      return nextP;
    });
    // Scroll to top of canvas area
    if (canvasAreaRef.current) {
      canvasAreaRef.current.scrollTop = 0;
    }
  }

  function handleJumpSubmit(e: React.FormEvent) {
    e.preventDefault();
    const p = parseInt(jumpPageInput, 10);
    if (!isNaN(p) && p >= 1 && p <= numPages) {
      setPageNumber(p);
      if (canvasAreaRef.current) {
        canvasAreaRef.current.scrollTop = 0;
      }
    } else {
      setJumpPageInput(String(pageNumber));
    }
  }

  function handleContextMenu(e: React.MouseEvent) {
    if (!allowDownload) {
      e.preventDefault();
    }
  }

  function toggleFullscreen() {
    setIsFullscreen((prev) => !prev);
  }

  function zoomIn() {
    setZoomScale((z) => Math.min(2.5, +(z + 0.2).toFixed(2)));
  }

  function zoomOut() {
    setZoomScale((z) => Math.max(0.6, +(z - 0.2).toFixed(2)));
  }

  function resetZoom() {
    setZoomScale(1.0);
  }

  function fitWidth() {
    setZoomScale(1.15);
  }

  // Keyboard navigation untuk Fullscreen & standar
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      } else if (e.key === "ArrowLeft" && viewMode === "single") {
        setPageNumber((p) => {
          const nextP = Math.max(1, p - 1);
          setJumpPageInput(String(nextP));
          return nextP;
        });
      } else if (e.key === "ArrowRight" && viewMode === "single" && numPages > 0) {
        setPageNumber((p) => {
          const nextP = Math.min(numPages, p + 1);
          setJumpPageInput(String(nextP));
          return nextP;
        });
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen, numPages, viewMode]);

  // Lock body scroll saat Fullscreen mode
  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isFullscreen]);

  const effectiveContainerWidth = Math.max(containerWidth, 320);
  const targetWidth = Math.floor(
    (isFullscreen
      ? Math.min(window.innerWidth - 48, 1200)
      : Math.min(effectiveContainerWidth - 32, 960)) * zoomScale
  );

  return (
    <div
      ref={wrapperRef}
      className={`lms-pdf-wrapper${isFullscreen ? " is-fullscreen" : ""}`}
      onContextMenu={handleContextMenu}
      style={{ userSelect: allowDownload ? "auto" : "none" }}
    >
      {/* PDF Header Bar */}
      <div className="lms-pdf-header">
        <div className="lms-pdf-header-title">
          <span style={{ fontSize: "1.2rem" }}>📄</span>
          <span className="lms-pdf-title-text" title={title}>
            {title}
          </span>
          <span className="lms-pdf-shield">
            {allowDownload ? "📥 Bisa Diunduh" : "🔒 Mode Baca Aman"}
          </span>
        </div>

        {/* Action Controls: View mode + Zoom + Fullscreen + Download */}
        <div className="lms-pdf-header-actions">
          {/* Mode Switcher: Single vs Continuous */}
          {!error && !useFallbackEmbed && numPages > 1 && (
            <div className="lms-pdf-mode-toggle" style={{ display: "inline-flex", gap: "2px", background: "rgba(0,0,0,0.06)", borderRadius: "var(--r-sm, 6px)", padding: "2px" }}>
              <button
                type="button"
                className={`lms-pdf-btn-icon ${viewMode === "single" ? "active" : ""}`}
                style={{
                  fontSize: "0.75rem",
                  padding: "0.25rem 0.55rem",
                  width: "auto",
                  height: "auto",
                  background: viewMode === "single" ? "var(--white, #fff)" : "transparent",
                  fontWeight: viewMode === "single" ? 700 : 500,
                  boxShadow: viewMode === "single" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                  borderRadius: "4px",
                }}
                onClick={() => setViewMode("single")}
                title="Tampilkan per halaman"
              >
                1 Hlm
              </button>
              <button
                type="button"
                className={`lms-pdf-btn-icon ${viewMode === "scroll" ? "active" : ""}`}
                style={{
                  fontSize: "0.75rem",
                  padding: "0.25rem 0.55rem",
                  width: "auto",
                  height: "auto",
                  background: viewMode === "scroll" ? "var(--white, #fff)" : "transparent",
                  fontWeight: viewMode === "scroll" ? 700 : 500,
                  boxShadow: viewMode === "scroll" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                  borderRadius: "4px",
                }}
                onClick={() => setViewMode("scroll")}
                title="Gulir semua halaman"
              >
                Gulir Semua
              </button>
            </div>
          )}

          {/* Unduh button jika diizinkan */}
          {allowDownload && (
            <a
              href={fileUrl}
              download
              className="lms-pdf-download-btn"
              title="Unduh Dokumen PDF"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Unduh</span>
            </a>
          )}

          {/* Zoom controls (saat dokumen sudah termuat) */}
          {!loading && !error && !useFallbackEmbed && (
            <div className="lms-pdf-zoom-group">
              <button
                type="button"
                className="lms-pdf-btn-icon"
                onClick={zoomOut}
                title="Perkecil (-)"
                disabled={zoomScale <= 0.6}
              >
                −
              </button>
              <button
                type="button"
                className="lms-pdf-btn-zoom-label"
                onClick={resetZoom}
                title="Reset Zoom (100%)"
              >
                {Math.round(zoomScale * 100)}%
              </button>
              <button
                type="button"
                className="lms-pdf-btn-icon"
                onClick={zoomIn}
                title="Perbesar (+)"
                disabled={zoomScale >= 2.5}
              >
                +
              </button>
              <button
                type="button"
                className="lms-pdf-btn-icon"
                onClick={fitWidth}
                title="Pas Lebar Layar"
                style={{ fontSize: "0.72rem", padding: "0 0.35rem", width: "auto" }}
              >
                Lebar
              </button>
            </div>
          )}

          {/* Fullscreen Toggle Button */}
          <button
            type="button"
            className={`lms-pdf-fullscreen-btn${isFullscreen ? " active" : ""}`}
            onClick={toggleFullscreen}
            title={isFullscreen ? "Keluar Layar Penuh (Esc)" : "Mode Baca Layar Penuh"}
          >
            {isFullscreen ? (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                </svg>
                <span>Keluar</span>
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                </svg>
                <span>Layar Penuh</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loading && !useFallbackEmbed && (
        <div className="lms-pdf-loading">
          <div className="lms-pdf-spinner" />
          <span style={{ fontWeight: 600, color: "var(--ink-soft)" }}>Memuat dokumen PDF…</span>
        </div>
      )}

      {/* Error state with fallback options */}
      {error && !useFallbackEmbed && (
        <div
          className="lms-pdf-error"
          style={{
            padding: "2.5rem 1.5rem",
            background: "rgba(229, 72, 77, 0.04)",
            borderBottom: "1px solid rgba(229, 72, 77, 0.15)",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>⚠️</div>
          <h4 style={{ fontWeight: 700, color: "var(--red, #e5484d)", marginBottom: "0.4rem" }}>
            Tidak dapat merender canvas PDF
          </h4>
          <p style={{ color: "var(--ink-soft)", fontSize: "0.88rem", maxWidth: "28rem", margin: "0 auto 1.25rem" }}>
            {error} Anda dapat mencoba memuat ulang atau beralih ke penampil alternatif di bawah.
          </p>
          <div style={{ display: "flex", gap: "0.6rem", justifyContent: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={handleRetry}
              className="btn btn-sm btn-purple"
              style={{ fontWeight: 700 }}
            >
              🔄 Coba Muat Ulang
            </button>
            <button
              type="button"
              onClick={() => setUseFallbackEmbed(true)}
              className="btn btn-sm btn-line"
              style={{ fontWeight: 700 }}
            >
              📑 Buka Mode Penampil Alternatif
            </button>
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-sm btn-line"
              style={{ fontWeight: 700 }}
            >
              🔗 Buka di Tab Baru
            </a>
          </div>
        </div>
      )}

      {/* Fallback Embed Viewer (Iframe / Native PDF) */}
      {useFallbackEmbed && (
        <div style={{ width: "100%", height: isFullscreen ? "calc(100vh - 100px)" : "680px", background: "#333", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "0.5rem 1rem", background: "#222", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.82rem" }}>
            <span>Menampilkan dokumen via Penampil Web Alternatif</span>
            <button
              type="button"
              onClick={() => setUseFallbackEmbed(false)}
              className="btn btn-sm btn-line"
              style={{ color: "#fff", borderColor: "rgba(255,255,255,0.3)", padding: "0.2rem 0.6rem", fontSize: "0.75rem" }}
            >
              Kembali ke Reader Canvas
            </button>
          </div>
          <iframe
            src={fileUrl}
            title={title}
            width="100%"
            height="100%"
            style={{ border: "none", flex: 1 }}
          />
        </div>
      )}

      {/* Main Canvas Scroll Area */}
      {!useFallbackEmbed && (
        <div
          ref={(node) => {
            containerRef(node);
            canvasAreaRef.current = node;
          }}
          className="lms-pdf-canvas-area"
          style={{ display: loading || error ? "none" : "flex" }}
        >
          <Document
            key={`doc_${fileUrl}_${retryCount}`}
            file={fileUrl}
            options={documentOptions}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={null}
            noData={null}
          >
            {viewMode === "single" ? (
              <Page
                key={`page_${pageNumber}_zoom_${zoomScale}_fs_${isFullscreen}`}
                pageNumber={pageNumber}
                width={targetWidth}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                loading={
                  <div style={{ padding: "3rem", textAlign: "center", color: "#ccc", fontSize: "0.85rem" }}>
                    Menyiapkan halaman {pageNumber}…
                  </div>
                }
              />
            ) : (
              // Continuous scroll of all pages
              Array.from(new Array(numPages), (_, index) => (
                <div key={`page_container_${index + 1}`} style={{ marginBottom: "1.25rem" }}>
                  <Page
                    pageNumber={index + 1}
                    width={targetWidth}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                    loading={
                      <div style={{ padding: "2rem", textAlign: "center", color: "#ccc", fontSize: "0.8rem" }}>
                        Halaman {index + 1}…
                      </div>
                    }
                  />
                  <div style={{ textAlign: "center", color: "#aaa", fontSize: "0.75rem", marginTop: "0.4rem" }}>
                    Halaman {index + 1} dari {numPages}
                  </div>
                </div>
              ))
            )}
          </Document>
        </div>
      )}

      {/* Bottom Navigation Toolbar (Single Mode) */}
      {!loading && !error && !useFallbackEmbed && viewMode === "single" && numPages > 0 && (
        <div className="lms-pdf-footer">
          <button
            type="button"
            className="lms-pdf-nav-btn"
            onClick={() => {
              setPageNumber(1);
              setJumpPageInput("1");
              if (canvasAreaRef.current) canvasAreaRef.current.scrollTop = 0;
            }}
            disabled={pageNumber <= 1}
            title="Halaman Pertama"
            style={{ padding: "0.4rem 0.6rem" }}
          >
            ⇤ Awal
          </button>

          <button
            type="button"
            className="lms-pdf-nav-btn"
            onClick={prevPage}
            disabled={pageNumber <= 1}
            title="Halaman Sebelumnya (Panah Kiri)"
          >
            ← Sebelumnya
          </button>

          <form onSubmit={handleJumpSubmit} style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
            <span style={{ fontSize: "0.82rem", fontWeight: 700, color: isFullscreen ? "#fff" : "var(--ink-main)" }}>
              Halaman
            </span>
            <input
              type="number"
              min={1}
              max={numPages}
              value={jumpPageInput}
              onChange={(e) => setJumpPageInput(e.target.value)}
              onBlur={() => setJumpPageInput(String(pageNumber))}
              style={{
                width: "3.2rem",
                textAlign: "center",
                padding: "0.25rem 0.3rem",
                fontSize: "0.82rem",
                fontWeight: 700,
                borderRadius: "4px",
                border: "1px solid var(--border)",
                background: isFullscreen ? "#222" : "var(--white)",
                color: isFullscreen ? "#fff" : "var(--ink-main)",
              }}
            />
            <span style={{ fontSize: "0.82rem", fontWeight: 700, color: isFullscreen ? "#fff" : "var(--ink-main)" }}>
              / {numPages}
            </span>
          </form>

          <button
            type="button"
            className="lms-pdf-nav-btn next"
            onClick={nextPage}
            disabled={pageNumber >= numPages}
            title="Halaman Berikutnya (Panah Kanan)"
          >
            Berikutnya →
          </button>

          <button
            type="button"
            className="lms-pdf-nav-btn"
            onClick={() => {
              setPageNumber(numPages);
              setJumpPageInput(String(numPages));
              if (canvasAreaRef.current) canvasAreaRef.current.scrollTop = 0;
            }}
            disabled={pageNumber >= numPages}
            title="Halaman Terakhir"
            style={{ padding: "0.4rem 0.6rem" }}
          >
            Akhir ⇥
          </button>
        </div>
      )}

      {/* Bottom Floating Indicator (Scroll Mode) */}
      {!loading && !error && !useFallbackEmbed && viewMode === "scroll" && numPages > 0 && (
        <div className="lms-pdf-footer">
          <span className="lms-pdf-page-indicator">
            Total {numPages} Halaman (Mode Gulir Penuh)
          </span>
          <button
            type="button"
            className="lms-pdf-nav-btn"
            onClick={() => {
              if (canvasAreaRef.current) canvasAreaRef.current.scrollTop = 0;
            }}
          >
            ↑ Kembali ke Atas
          </button>
        </div>
      )}
    </div>
  );
}
