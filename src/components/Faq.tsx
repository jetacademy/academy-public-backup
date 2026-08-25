"use client";

import { useState } from "react";

export type FaqEntry = { q: string; a: string };

export default function Faq({ items }: { items: FaqEntry[] }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <div className="faq">
      {items.map((item, i) => {
        const isOpen = openIdx === i;
        const answerId = `faq-a-${i}`;
        return (
          <div key={i} className={`faq-item${isOpen ? " open" : ""}`}>
            <button
              className="faq-q"
              onClick={() => setOpenIdx(isOpen ? null : i)}
              aria-expanded={isOpen}
              aria-controls={answerId}
            >
              {item.q} <span className="chev">+</span>
            </button>
            {/* Konten tetap dirender untuk animasi grid; disembunyikan dari a11y tree saat tertutup */}
            <div
              className="faq-a"
              id={answerId}
              role="region"
              aria-hidden={!isOpen}
              style={{ visibility: isOpen ? "visible" : "hidden" }}
            >
              <div><div>{item.a}</div></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
