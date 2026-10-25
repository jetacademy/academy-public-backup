"use client";

import type { ReactNode } from "react";

/** Tombol kartu harga (langkah 1): set tiket di RegisterForm lalu scroll ke #daftar (langkah 2). */
export default function ZhcTicketButton({ ticket, className, children }: {
  ticket: "ONLINE" | "OFFLINE";
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      href="#daftar"
      className={className}
      onClick={() => window.dispatchEvent(new CustomEvent("jsa:select-ticket", { detail: ticket }))}
    >
      {children}
    </a>
  );
}
