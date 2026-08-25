"use client";

import { useState } from "react";

export interface AdminStatItem {
  id?: string;
  label: string;
  value: string | number;
  sublabel?: React.ReactNode;
}

interface AdminStatsProps {
  stats: AdminStatItem[];
  className?: string;
}

export default function AdminStats({ stats, className = "" }: AdminStatsProps) {
  // Semua card default tertutup/tersembunyi (false) saat dibuka
  const [visibleState, setVisibleState] = useState<Record<number, boolean>>({});

  const toggleVisibility = (idx: number) => {
    setVisibleState((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  return (
    <div className={`adm-stats ${className}`}>
      {stats.map((stat, idx) => {
        const isVisible = !!visibleState[idx];
        return (
          <div key={stat.id || idx} className="adm-stat">
            <div className="adm-stat-top">
              <b
                className={`adm-stat-val ${!isVisible ? "masked" : ""}`}
                title={isVisible ? String(stat.value) : "Disembunyikan"}
              >
                {isVisible ? stat.value : "*****"}
                {isVisible && stat.sublabel}
              </b>
              <button
                type="button"
                className="adm-stat-eye-btn"
                onClick={() => toggleVisibility(idx)}
                title={isVisible ? "Sembunyikan angka" : "Lihat angka"}
                aria-label={isVisible ? `Sembunyikan ${stat.label}` : `Lihat ${stat.label}`}
              >
                {isVisible ? (
                  /* Icon Eye Off (slash) */
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                    <line x1="2" y1="2" x2="22" y2="22" />
                  </svg>
                ) : (
                  /* Icon Eye */
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
            <span>{stat.label}</span>
          </div>
        );
      })}
    </div>
  );
}
