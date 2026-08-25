"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Worker pdf.js di-self-host dari /public (bukan CDN unpkg) — lebih cepat, tanpa
// dependensi pihak ketiga, dan tidak akan diblokir CSP. Sinkronkan versi dengan
// react-pdf saat upgrade: salin node_modules/pdfjs-dist/build/pdf.worker.min.mjs
// ke public/pdfjs/.
pdfjs.GlobalWorkerOptions.workerSrc = `/pdfjs/pdf.worker.min.mjs?v=${pdfjs.version}`;

interface LmsPdfViewerProps {
  fileUrl: string;
  title: string;
  allowDownload?: boolean;
}

export default function LmsPdfViewer({ fileUrl, title, allowDownload = false }: LmsPdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState(750);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoomScale, setZoomScale] = useState(1.0);

  const wrapperRef = useRef<HTMLDivElement>(null);

  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      const ro = new ResizeObserver(([entry]) => {
        setContainerWidth(Math.floor(entry.contentRect.width));
      });
      ro.observe(node);
    }
  }, []);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setLoading(false);
  }

  function onDocumentLoadError() {
    setLoading(false);
    setError("Gagal memuat dokumen PDF. Silakan coba lagi.");
  }

  function prevPage() {
    setPageNumber((p) => Math.max(1, p - 1));
  }

  function nextPage() {
    setPageNumber((p) => Math.min(numPages, p + 1));
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
  }

  function toggleFullscreen() {
    setIsFullscreen((prev) => !prev);
  }

  function zoomIn() {
    setZoomScale((z) => Math.min(2.5, z + 0.25));
  }

  function zoomOut() {
    setZoomScale((z) => Math.max(0.6, z - 0.25));
  }

  function resetZoom() {
    setZoomScale(1.0);
  }

  // Keyboard navigation untuk Fullscreen & standar
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      } else if (e.key === "ArrowLeft") {
        setPageNumber((p) => Math.max(1, p - 1));
      } else if (e.key === "ArrowRight" && numPages > 0) {
        setPageNumber((p) => Math.min(numPages, p + 1));
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen, numPages]);

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

  const targetWidth = Math.floor(
    (isFullscreen ? Math.min(window.innerWidth - 40, 1100) : Math.min(containerWidth - 32, 900)) * zoomScale
  );

  return (
    <div
      ref={wrapperRef}
      className={`lms-pdf-wrapper${isFullscreen ? " is-fullscreen" : ""}`}
      onContextMenu={handleContextMenu}
      style={{ userSelect: "none" }}
    >
      {/* PDF Header Bar */}
      <div className="lms-pdf-header">
        <div className="lms-pdf-header-title">
          <span>📄</span>
          <span className="lms-pdf-title-text" title={title}>
            {title}
          </span>
          <span className="lms-pdf-shield">{allowDownload ? "📥 Bisa Diunduh" : "🔒 Hanya Baca"}</span>
        </div>

        {/* Action Controls: Zoom + Fullscreen + Download */}
        <div className="lms-pdf-header-actions">
          {allowDownload && (
            <a
              href={fileUrl}
              download
              className="lms-pdf-download-btn"
              title="Unduh PDF"
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
          {!loading && !error && (
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
      {loading && (
        <div className="lms-pdf-loading">
          <div className="lms-pdf-spinner" />
          <span>Memuat dokumen PDF…</span>
        </div>
      )}

      {/* Error state */}
      {error && <div className="lms-pdf-error">⚠️ {error}</div>}

      {/* Canvas Scroll Area */}
      <div
        ref={containerRef}
        className="lms-pdf-canvas-area"
        style={{ display: loading || error ? "none" : "flex" }}
      >
        <Document
          file={fileUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={null}
          noData={null}
        >
          <Page
            key={`page_${pageNumber}_zoom_${zoomScale}_fs_${isFullscreen}`}
            pageNumber={pageNumber}
            width={targetWidth}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            loading={null}
          />
        </Document>
      </div>

      {/* Bottom Floating Navigation Toolbar */}
      {!loading && !error && numPages > 0 && (
        <div className="lms-pdf-footer">
          <button
            type="button"
            className="lms-pdf-nav-btn"
            onClick={prevPage}
            disabled={pageNumber <= 1}
          >
            ← Sebelumnya
          </button>

          <span className="lms-pdf-page-indicator">
            Halaman {pageNumber} dari {numPages}
          </span>

          <button
            type="button"
            className="lms-pdf-nav-btn next"
            onClick={nextPage}
            disabled={pageNumber >= numPages}
          >
            Berikutnya →
          </button>
        </div>
      )}
    </div>
  );
}
