"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";

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
  // jsa_member_ui adalah cookie pendamping non-httpOnly.
  // Inisialisasi false untuk mencegah hydration mismatch antara SSR & Client render,
  // lalu sinkronkan di useEffect saat komponen mount.
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    if (typeof document !== "undefined" && document.cookie.includes("jsa_member_ui=")) {
      setIsLoggedIn(true);
    }
  }, []);

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
