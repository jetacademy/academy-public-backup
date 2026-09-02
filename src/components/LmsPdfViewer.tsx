"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Multi-tier PDF.js Worker Configuration
if (typeof window !== "undefined" && !pdfjs.GlobalWorkerOptions.workerSrc) {
  // Try local synced worker first with fallback to unpkg CDN matching the exact pdfjs version (5.4.296)
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
}

interface LmsPdfViewerProps {
  fileUrl: string;
  title: string;
  allowDownload?: boolean;
}

type ReaderEngine = "canvas" | "native" | "gdocs";

export default function LmsPdfViewer({ fileUrl, title, allowDownload = false }: LmsPdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [jumpPageInput, setJumpPageInput] = useState("1");
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string>("");
  const [containerWidth, setContainerWidth] = useState(800);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoomScale, setZoomScale] = useState(1.0);
  const [rotation, setRotation] = useState<number>(0);
  const [viewMode, setViewMode] = useState<"single" | "scroll">("single");
  const [readerEngine, setReaderEngine] = useState<ReaderEngine>("canvas");
  const [retryCount, setRetryCount] = useState(0);
  const [useProxy, setUseProxy] = useState(false);
  const [workerSourceTier, setWorkerSourceTier] = useState<number>(0);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasAreaRef = useRef<HTMLDivElement>(null);

  // Worker tier list for progressive fallback on worker failure
  const workerUrls = useMemo(
    () => [
      `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`,
      `/pdfjs/pdf.worker.min.mjs?v=${pdfjs.version}`,
      `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`,
    ],
    []
  );

  // Update worker src when tier changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrls[workerSourceTier % workerUrls.length];
    }
  }, [workerSourceTier, workerUrls]);

  // Compute active document URL (direct vs proxied)
  const activePdfUrl = useMemo(() => {
    if (!fileUrl) return "";
    if (useProxy) {
      return `/api/pdf-proxy?url=${encodeURIComponent(fileUrl)}`;
    }
    return fileUrl;
  }, [fileUrl, useProxy]);

  // Observe container width
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      const ro = new ResizeObserver(([entry]) => {
        if (entry?.contentRect?.width) {
          setContainerWidth(Math.floor(entry.contentRect.width));
        }
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
      withCredentials: false,
    }),
    []
  );

  function onDocumentLoadSuccess({ numPages: loadedPages }: { numPages: number }) {
    setNumPages(loadedPages);
    setLoading(false);
    setError(null);
    setErrorDetails("");
    setLoadingProgress(100);
  }

  function onDocumentLoadError(err: Error) {
    console.error("[LMS PDF Load Error]:", err);
    setLoading(false);

    const errMsg = err?.message || String(err);
    setErrorDetails(errMsg);

    // If fetch failed due to CORS / remote origin, try auto-proxying once
    const isNetworkOrCors =
      errMsg.toLowerCase().includes("failed to fetch") ||
      errMsg.toLowerCase().includes("cors") ||
      errMsg.toLowerCase().includes("networkerror") ||
      errMsg.toLowerCase().includes("cross-origin");

    if (isNetworkOrCors && !useProxy) {
      console.warn("[LMS PDF Viewer] Mencoba memuat ulang melalui Server Proxy anti-CORS...");
      setUseProxy(true);
      setError(null);
      setLoading(true);
      setRetryCount((c) => c + 1);
      return;
    }

    // If worker initialization failed, advance worker fallback tier
    if (errMsg.toLowerCase().includes("worker") && workerSourceTier < workerUrls.length - 1) {
      console.warn("[LMS PDF Viewer] Mencoba worker fallback tier berikutnya...");
      setWorkerSourceTier((t) => t + 1);
      setError(null);
      setLoading(true);
      setRetryCount((c) => c + 1);
      return;
    }

    setError("Tidak dapat merender canvas PDF secara langsung.");
  }

  function handleRetry() {
    setError(null);
    setErrorDetails("");
    setLoading(true);
    setLoadingProgress(0);
    setRetryCount((c) => c + 1);
  }

  function handleToggleProxy() {
    setError(null);
    setLoading(true);
    setLoadingProgress(0);
    setUseProxy((p) => !p);
    setRetryCount((c) => c + 1);
  }

  function prevPage() {
    setPageNumber((p) => {
      const nextP = Math.max(1, p - 1);
      setJumpPageInput(String(nextP));
      return nextP;
    });
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
    setZoomScale((z) => Math.max(0.5, +(z - 0.2).toFixed(2)));
  }

  function resetZoom() {
    setZoomScale(1.0);
  }

  function fitWidth() {
    setZoomScale(1.2);
  }

  function rotateClockwise() {
    setRotation((r) => (r + 90) % 360);
  }

  // Keyboard navigation untuk Fullscreen & standar
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      } else if (e.key === "ArrowLeft" && viewMode === "single" && readerEngine === "canvas") {
        setPageNumber((p) => {
          const nextP = Math.max(1, p - 1);
          setJumpPageInput(String(nextP));
          return nextP;
        });
      } else if (e.key === "ArrowRight" && viewMode === "single" && readerEngine === "canvas" && numPages > 0) {
        setPageNumber((p) => {
          const nextP = Math.min(numPages, p + 1);
          setJumpPageInput(String(nextP));
          return nextP;
        });
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen, numPages, viewMode, readerEngine]);

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
      ? Math.min(typeof window !== "undefined" ? window.innerWidth - 48 : 1200, 1200)
      : Math.min(effectiveContainerWidth - 32, 960)) * zoomScale
  );

  const devicePixelRatio = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1;

  // Google Docs viewer URL for external fallback
  const gdocsUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(
    fileUrl.startsWith("http") ? fileUrl : (typeof window !== "undefined" ? `${window.location.origin}${fileUrl}` : fileUrl)
  )}&embedded=true`;

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
          {useProxy && (
            <span
              style={{
                fontSize: "0.68rem",
                padding: "0.15rem 0.4rem",
                borderRadius: "4px",
                background: "rgba(108, 92, 231, 0.15)",
                color: "var(--purple)",
                fontWeight: 700,
              }}
              title="Memuat melalui Server Proxy anti-CORS"
            >
              🛡️ Proxy Aktif
            </span>
          )}
        </div>

        {/* Engine Switcher + Action Controls */}
        <div className="lms-pdf-header-actions">
          {/* Reader Engine Switcher (Canvas / Native / GDocs) */}
          <div
            className="lms-pdf-engine-selector"
            style={{
              display: "inline-flex",
              background: "rgba(0,0,0,0.06)",
              borderRadius: "var(--r-sm, 6px)",
              padding: "2px",
              gap: "2px",
            }}
          >
            <button
              type="button"
              className={`lms-pdf-btn-icon ${readerEngine === "canvas" ? "active" : ""}`}
              style={{
                fontSize: "0.72rem",
                padding: "0.25rem 0.5rem",
                width: "auto",
                height: "auto",
                background: readerEngine === "canvas" ? "var(--white, #fff)" : "transparent",
                fontWeight: readerEngine === "canvas" ? 700 : 500,
                boxShadow: readerEngine === "canvas" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                borderRadius: "4px",
              }}
              onClick={() => {
                setReaderEngine("canvas");
                if (error) handleRetry();
              }}
              title="Mode Pembaca Canvas Interaktif (Default)"
            >
              🎨 Canvas
            </button>
            <button
              type="button"
              className={`lms-pdf-btn-icon ${readerEngine === "native" ? "active" : ""}`}
              style={{
                fontSize: "0.72rem",
                padding: "0.25rem 0.5rem",
                width: "auto",
                height: "auto",
                background: readerEngine === "native" ? "var(--white, #fff)" : "transparent",
                fontWeight: readerEngine === "native" ? 700 : 500,
                boxShadow: readerEngine === "native" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                borderRadius: "4px",
              }}
              onClick={() => setReaderEngine("native")}
              title="Mode Penampil Bawaan Browser (Iframe / Native)"
            >
              🌐 Native
            </button>
            <button
              type="button"
              className={`lms-pdf-btn-icon ${readerEngine === "gdocs" ? "active" : ""}`}
              style={{
                fontSize: "0.72rem",
                padding: "0.25rem 0.5rem",
                width: "auto",
                height: "auto",
                background: readerEngine === "gdocs" ? "var(--white, #fff)" : "transparent",
                fontWeight: readerEngine === "gdocs" ? 700 : 500,
                boxShadow: readerEngine === "gdocs" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                borderRadius: "4px",
              }}
              onClick={() => setReaderEngine("gdocs")}
              title="Mode Penampil Cloud Google Docs"
            >
              ☁️ Cloud
            </button>
          </div>

          {/* Mode Switcher: Single vs Continuous (Canvas Mode Only) */}
          {readerEngine === "canvas" && !error && numPages > 1 && (
            <div
              className="lms-pdf-mode-toggle"
              style={{
                display: "inline-flex",
                gap: "2px",
                background: "rgba(0,0,0,0.06)",
                borderRadius: "var(--r-sm, 6px)",
                padding: "2px",
              }}
            >
              <button
                type="button"
                className={`lms-pdf-btn-icon ${viewMode === "single" ? "active" : ""}`}
                style={{
                  fontSize: "0.72rem",
                  padding: "0.25rem 0.5rem",
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
                  fontSize: "0.72rem",
                  padding: "0.25rem 0.5rem",
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
                Gulir
              </button>
            </div>
          )}

          {/* Rotation Button (Canvas Mode Only) */}
          {readerEngine === "canvas" && !loading && !error && (
            <button
              type="button"
              className="lms-pdf-btn-icon"
              onClick={rotateClockwise}
              title="Putar Dokumen 90°"
              style={{ fontSize: "0.85rem" }}
            >
              ↻
            </button>
          )}

          {/* Zoom controls (Canvas Mode Only) */}
          {readerEngine === "canvas" && !loading && !error && (
            <div className="lms-pdf-zoom-group">
              <button
                type="button"
                className="lms-pdf-btn-icon"
                onClick={zoomOut}
                title="Perkecil (-)"
                disabled={zoomScale <= 0.5}
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

          {/* Download button if allowed */}
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

      {/* Loading state for Canvas Mode */}
      {readerEngine === "canvas" && loading && (
        <div className="lms-pdf-loading">
          <div className="lms-pdf-spinner" />
          <div style={{ textAlign: "center" }}>
            <span style={{ fontWeight: 600, color: "var(--ink-soft)", display: "block", marginBottom: "0.25rem" }}>
              Menyiapkan dokumen PDF… {loadingProgress > 0 ? `${loadingProgress}%` : ""}
            </span>
            <span style={{ fontSize: "0.78rem", color: "var(--ink-muted)" }}>
              {useProxy ? "Memuat via Server Proxy..." : "Menginisialisasi canvas viewer..."}
            </span>
          </div>
        </div>
      )}

      {/* Error State with Comprehensive Diagnostics & Recovery Options */}
      {readerEngine === "canvas" && error && (
        <div
          className="lms-pdf-error"
          style={{
            padding: "2.5rem 1.5rem",
            background: "rgba(229, 72, 77, 0.04)",
            borderBottom: "1px solid rgba(229, 72, 77, 0.15)",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "2.2rem", marginBottom: "0.5rem" }}>🛡️</div>
          <h4 style={{ fontWeight: 700, color: "var(--red, #e5484d)", marginBottom: "0.4rem" }}>
            {error}
          </h4>
          <p style={{ color: "var(--ink-soft)", fontSize: "0.88rem", maxWidth: "34rem", margin: "0 auto 1.25rem" }}>
            {errorDetails ? `Catatan teknis: ${errorDetails}. ` : ""}
            Anda dapat mencoba memuat ulang dengan Server Proxy atau beralih ke salah satu penampil cadangan berikut:
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
              onClick={handleToggleProxy}
              className="btn btn-sm btn-line"
              style={{ fontWeight: 700, background: useProxy ? "rgba(108,92,231,0.08)" : undefined }}
            >
              {useProxy ? "🔓 Coba Jalur Langsung" : "🛡️ Muat via Server Proxy"}
            </button>

            <button
              type="button"
              onClick={() => setReaderEngine("native")}
              className="btn btn-sm btn-line"
              style={{ fontWeight: 700 }}
            >
              🌐 Buka Mode Native Browser
            </button>

            <button
              type="button"
              onClick={() => setReaderEngine("gdocs")}
              className="btn btn-sm btn-line"
              style={{ fontWeight: 700 }}
            >
              ☁️ Buka via Google Docs Cloud
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

      {/* Engine 2: Native PDF Viewer (Iframe / Browser Plugin) */}
      {readerEngine === "native" && (
        <div
          style={{
            width: "100%",
            height: isFullscreen ? "calc(100vh - 65px)" : "680px",
            background: "#222",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              padding: "0.45rem 1rem",
              background: "#18181c",
              color: "#ccc",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "0.8rem",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <span>🌐 Mode Penampil Bawaan Browser (Native Iframe)</span>
            <button
              type="button"
              onClick={() => setReaderEngine("canvas")}
              className="btn btn-sm btn-line"
              style={{
                color: "#fff",
                borderColor: "rgba(255,255,255,0.25)",
                padding: "0.2rem 0.6rem",
                fontSize: "0.75rem",
              }}
            >
              Kembali ke Reader Canvas 🎨
            </button>
          </div>
          <iframe
            src={activePdfUrl}
            title={title}
            width="100%"
            height="100%"
            style={{ border: "none", flex: 1, background: "#fff" }}
          />
        </div>
      )}

      {/* Engine 3: Google Docs Cloud PDF Viewer */}
      {readerEngine === "gdocs" && (
        <div
          style={{
            width: "100%",
            height: isFullscreen ? "calc(100vh - 65px)" : "680px",
            background: "#222",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              padding: "0.45rem 1rem",
              background: "#18181c",
              color: "#ccc",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "0.8rem",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <span>☁️ Mode Penampil Cloud Google Docs</span>
            <button
              type="button"
              onClick={() => setReaderEngine("canvas")}
              className="btn btn-sm btn-line"
              style={{
                color: "#fff",
                borderColor: "rgba(255,255,255,0.25)",
                padding: "0.2rem 0.6rem",
                fontSize: "0.75rem",
              }}
            >
              Kembali ke Reader Canvas 🎨
            </button>
          </div>
          <iframe
            src={gdocsUrl}
            title={title}
            width="100%"
            height="100%"
            style={{ border: "none", flex: 1, background: "#fff" }}
          />
        </div>
      )}

      {/* Engine 1: Main Canvas Scroll Area */}
      {readerEngine === "canvas" && (
        <div
          ref={(node) => {
            containerRef(node);
            canvasAreaRef.current = node;
          }}
          className="lms-pdf-canvas-area"
          style={{ display: loading || error ? "none" : "flex" }}
        >
          <Document
            key={`doc_${activePdfUrl}_${retryCount}_${workerSourceTier}`}
            file={activePdfUrl}
            options={documentOptions}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            onLoadProgress={({ loaded, total }: { loaded: number; total: number }) => {
              if (total > 0) {
                setLoadingProgress(Math.min(99, Math.round((loaded / total) * 100)));
              }
            }}
            loading={null}
            noData={
              <div style={{ padding: "3rem", textAlign: "center", color: "#aaa" }}>
                Tidak ada data dokumen ditemukan.
              </div>
            }
          >
            {viewMode === "single" ? (
              <Page
                key={`page_${pageNumber}_zoom_${zoomScale}_rot_${rotation}_fs_${isFullscreen}`}
                pageNumber={pageNumber}
                width={targetWidth}
                rotate={rotation}
                devicePixelRatio={devicePixelRatio}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                onRenderError={(err) => {
                  // Non-fatal page render error (e.g. rapid zoom cancellation)
                  console.warn("[PDF Page Render Warning]:", err);
                }}
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
                    rotate={rotation}
                    devicePixelRatio={devicePixelRatio}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                    onRenderError={(err) => {
                      console.warn(`[PDF Page ${index + 1} Render Warning]:`, err);
                    }}
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

      {/* Bottom Navigation Toolbar (Single Mode - Canvas Engine) */}
      {readerEngine === "canvas" && !loading && !error && viewMode === "single" && numPages > 0 && (
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

      {/* Bottom Floating Indicator (Scroll Mode - Canvas Engine) */}
      {readerEngine === "canvas" && !loading && !error && viewMode === "scroll" && numPages > 0 && (
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
