"use client";

import { useState } from "react";

/**
 * Iframe player (Bunny Stream / YouTube / Vimeo) dengan facade pattern:
 * iframe pihak ketiga (~ratusan KB script player) TIDAK dimuat sampai peserta
 * mengklik tombol play. Mengurangi beban jaringan & Time-to-Interactive di mobile.
 * Skeleton loading tetap tampil setelah klik, sebelum player siap.
 */
export default function LessonVideoPlayer({ src, title }: { src: string; title: string }) {
  const [activated, setActivated] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (!activated) {
    return (
      <div className="lms-video-frame">
        <button
          type="button"
          className="lms-video-skeleton lms-video-facade"
          onClick={() => setActivated(true)}
          aria-label={`Putar video: ${title}`}
          style={{ cursor: "pointer", border: "none", width: "100%" }}
        >
          <span className="lms-video-play-btn" aria-hidden="true">
            ▶
          </span>
          <span>Klik untuk memutar video</span>
        </button>
      </div>
    );
  }

  return (
    <div className="lms-video-frame">
      {!loaded && (
        <div className="lms-video-skeleton">
          <div className="lms-video-spinner" />
          <span>Memuat video…</span>
        </div>
      )}
      <iframe
        key={src}
        src={src}
        title={title}
        style={{ opacity: loaded ? 1 : 0 }}
        onLoad={() => setLoaded(true)}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    </div>
  );
}
