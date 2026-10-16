"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { suffix: "", label: "Info Program", icon: "⚙️" },
  { suffix: "/konten", label: "Editor Halaman", icon: "📄" },
  { suffix: "/batch", label: "Jadwal & Batch", icon: "📅" },
  { suffix: "/lms", label: "Kurikulum (LMS)", icon: "📚" },
  { suffix: "/media", label: "Media & Aset", icon: "🖼️" },
  { suffix: "/kelulusan", label: "Kelulusan", icon: "🏆" },
  { suffix: "/cert", label: "Sertifikat", icon: "🎓" },
];

export default function ProgramSubTabs({ programId }: { programId: string }) {
  const path = usePathname();
  const base = `/webadmin/program/${programId}`;

  return (
    <nav
      className="prog-tabs"
      style={{
        display: "flex",
        gap: "0.4rem",
        padding: "0.4rem 0.2rem",
        borderBottom: "1px solid var(--border)",
        overflowX: "auto",
        scrollbarWidth: "none",
        msOverflowStyle: "none",
      }}
    >
      {TABS.map((t) => {
        const href = `${base}${t.suffix}`;
        const on = t.suffix === "" ? path === base : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={on ? "on" : ""}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              padding: "0.55rem 0.95rem",
              borderRadius: "999px",
              fontSize: "0.82rem",
              fontWeight: 700,
              color: on ? "var(--purple-deep)" : "var(--ink-soft)",
              background: on ? "var(--purple-soft)" : "transparent",
              border: on ? "1px solid rgba(108, 92, 231, 0.25)" : "1px solid transparent",
              whiteSpace: "nowrap",
              transition: "all 0.15s ease",
              boxShadow: on ? "0 2px 6px rgba(108, 92, 231, 0.12)" : "none",
            }}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </Link>
        );
      })}

      {/* Peserta bukan bagian dari editor program — arahkan ke daftar pendaftar global, sudah difilter ke program ini */}
      <Link
        href={`/webadmin/pendaftar?program=${programId}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.4rem",
          padding: "0.55rem 0.95rem",
          borderRadius: "999px",
          fontSize: "0.82rem",
          fontWeight: 700,
          color: "var(--ink-soft)",
          background: "transparent",
          border: "1px solid transparent",
          whiteSpace: "nowrap",
          transition: "all 0.15s ease",
        }}
      >
        <span>👥</span>
        <span>Peserta</span>
      </Link>
    </nav>
  );
}
