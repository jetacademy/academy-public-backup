"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";

/**
 * Navbar 2 mode:
 * - full    : beranda — 2 tautan + 1 CTA
 * - minimal : halaman iklan — hanya logo + 1 CTA (fokus closing)
 */
export default function Navbar({ minimal = false, ctaHref = "/program", ctaLabel = "Lihat Program" }: {
  minimal?: boolean;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  // Sync read — cegah re-render & hydration delay dari useEffect + setTimeout.
  // [FIX] jsa_member itu httpOnly (sengaja, demi keamanan) jadi TIDAK PERNAH
  // kebaca lewat document.cookie — makanya dulu isLoggedIn selalu false walau
  // user sudah login. jsa_member_ui adalah cookie pendamping non-httpOnly yang
  // cuma berisi flag boolean, dipasang/dihapus bareng session asli.
  const [isLoggedIn] = useState(() =>
    typeof document !== "undefined" && document.cookie.includes("jsa_member_ui=")
  );

  return (
    <header className="nav">
      <div className="container nav-inner">
        <Link href="/" className="brand">
          <Image
            src="/iconjetschool academy.png"
            alt="Jetschool Academy"
            width={44}
            height={44}
            style={{ objectFit: "contain" }}
          />
          Jetschool <span className="nav-brand-suffix" style={{ color: "var(--purple)" }}>Academy</span>
        </Link>

        {!minimal && (
          <nav className={`nav-links${open ? " open" : ""}`} onClick={() => setOpen(false)}>
            <Link href="/program">Program</Link>
            <Link href="/#cara">Cara Kerja</Link>
            <Link href="/artikel">Artikel</Link>
            <Link href="/daftar">Daftar</Link>
            <Link href="/member/login">Masuk</Link>
            <Link href="/#faq">FAQ</Link>
          </nav>
        )}

        <div className="nav-actions" style={{ display: "flex", alignItems: "center", gap: ".8rem" }}>
          {/* Instagram link */}
          <a
            href="https://instagram.com/jetschool.id"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram Jetschool Academy"
            title="Ikuti kami di Instagram"
            className="nav-social-btn"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 38,
              height: 38,
              borderRadius: 8,
              color: "var(--purple)",
              transition: "background 0.18s ease, transform 0.18s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(225, 48, 108, 0.08)";
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.transform = "none";
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
              <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
            </svg>
          </a>

          {isLoggedIn ? (
            <Link
              href="/member"
              title="Akses LMS & Dashboard Peserta"
              className="nav-user-btn"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              <span className="nav-user-label">LMS</span>
            </Link>
          ) : (
            <Link href="/member/login" className="btn btn-line btn-sm" style={{ fontSize: ".85rem" }}>
              Masuk
            </Link>
          )}

          <Link href={ctaHref} className="btn btn-purple">
            <span className="btn-text-desktop">{ctaLabel}</span>
            <span className="btn-text-mobile">Program</span>
          </Link>
          {!minimal && (
            <button className="nav-burger" aria-label="Buka menu" onClick={() => setOpen(!open)}>☰</button>
          )}
        </div>
      </div>
    </header>
  );
}
