"use client";

// Renderer markdown mini untuk jawaban Raka (Jetschool Assistant). Membangun elemen React langsung
// (tanpa dangerouslySetInnerHTML) → teks dari model tidak pernah bisa menyisipkan HTML/script.
// Mendukung: paragraf, **tebal**, _miring_, `kode`, blok kode + tombol salin, daftar, tabel,
// link http(s), dan sitasi [n] yang menaut ke sumber dokumentasi.

import { useState, type ReactNode } from "react";

type Source = { n: number; url: string; title: string };

function safeUrl(url: string): string | null {
  return /^https?:\/\//i.test(url) || url.startsWith("/member/") ? url : null;
}

/** Link materi LMS dibuka di tab yang sama; dokumentasi eksternal di tab baru. */
export function linkProps(url: string) {
  return url.startsWith("/") ? {} : { target: "_blank", rel: "noopener noreferrer" };
}

function inline(text: string, sources: Source[], keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  // urutan alternatif penting: kode dulu supaya isinya tidak ikut diparse
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\[([^\]]+)\]\(([^)\s]+)\))|(\[(\d{1,2})\])|(https?:\/\/[^\s)<>\]]+)|(_[^_\s][^_]*_)|(\*[^*\s][^*]*\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = `${keyBase}-${i++}`;
    if (m[1]) out.push(<code key={k}>{m[1].slice(1, -1)}</code>);
    else if (m[2]) out.push(<strong key={k}>{inline(m[2].slice(2, -2), sources, k)}</strong>);
    else if (m[3]) {
      const href = safeUrl(m[5]);
      out.push(href ? <a key={k} href={href} {...linkProps(href)}>{m[4]}</a> : m[4]);
    } else if (m[6]) {
      const src = sources.find((s) => s.n === Number(m![7]));
      out.push(
        src ? (
          <a key={k} className="hh-cite" href={src.url} {...linkProps(src.url)} title={src.title}>
            {src.n}
          </a>
        ) : (
          m[6]
        ),
      );
    } else if (m[8]) {
      const url = m[8].replace(/[.,;:]+$/, "");
      out.push(<a key={k} href={url} target="_blank" rel="noopener noreferrer">{url}</a>);
      if (url.length < m[8].length) out.push(m[8].slice(url.length));
    } else if (m[9]) out.push(<em key={k}>{m[9].slice(1, -1)}</em>);
    else if (m[10]) out.push(<em key={k}>{m[10].slice(1, -1)}</em>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  return (
    <div className="hh-code">
      <div className="hh-code-bar">
        <span>{lang || "kode"}</span>
        <button type="button" onClick={copy}>{copied ? "Tersalin" : "Salin"}</button>
      </div>
      <pre><code>{code}</code></pre>
    </div>
  );
}

type Block =
  | { type: "code"; lang: string; code: string }
  | { type: "list"; ordered: boolean; start: number; items: { text: string; sub: string[] }[] }
  | { type: "table"; rows: string[][] }
  | { type: "heading"; text: string }
  | { type: "p"; text: string };

function parseBlocks(md: string): Block[] {
  const lines = md.replace(/\r/g, "").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const fence = /^\s*(```|~~~)\s*([\w+-]*)/.exec(line);
    if (fence) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(fence[1])) body.push(lines[i++]);
      i++; // penutup (atau akhir teks saat masih streaming)
      blocks.push({ type: "code", lang: fence[2], code: body.join("\n") });
      continue;
    }
    if (!line.trim()) {
      i++;
      continue;
    }
    const heading = /^\s*#{1,6}\s+(.+)$/.exec(line);
    if (heading) {
      blocks.push({ type: "heading", text: heading[1] });
      i++;
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(line)) {
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        if (!/^\s*\|[\s:|-]+\|\s*$/.test(lines[i])) {
          rows.push(lines[i].trim().slice(1, -1).split("|").map((c) => c.trim()));
        }
        i++;
      }
      blocks.push({ type: "table", rows });
      continue;
    }
    const item = /^(\s*)([-*•]|\d+[.)])\s+(.*)$/.exec(line);
    if (item && item[1].length < 2) {
      const ordered = /\d/.test(item[2]);
      // Nomor asli dipertahankan: "1. …", blok kode, "2. …" tidak boleh jadi 1 lagi.
      const start = ordered ? parseInt(item[2], 10) || 1 : 1;
      const items: { text: string; sub: string[] }[] = [];
      while (i < lines.length) {
        const it = /^(\s*)([-*•]|\d+[.)])\s+(.*)$/.exec(lines[i]);
        if (it && it[1].length < 2) items.push({ text: it[3], sub: [] });
        else if (it && items.length) items[items.length - 1].sub.push(it[3]);
        else if (lines[i].trim() && /^\s{2,}/.test(lines[i]) && items.length && !/^\s*(```|~~~)/.test(lines[i])) {
          items[items.length - 1].text += " " + lines[i].trim();
        } else break;
        i++;
      }
      blocks.push({ type: "list", ordered, start, items });
      continue;
    }
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^\s*(```|~~~|#{1,6}\s|\|)/.test(lines[i]) &&
      !/^\s*([-*•]|\d+[.)])\s+/.test(lines[i])
    ) {
      para.push(lines[i++].trim());
    }
    if (para.length) blocks.push({ type: "p", text: para.join("\n") });
    else i++;
  }
  return blocks;
}

export default function HermesChatMarkdown({ text, sources }: { text: string; sources: Source[] }) {
  return (
    <div className="hh-md">
      {parseBlocks(text).map((b, bi) => {
        const k = `b${bi}`;
        switch (b.type) {
          case "code":
            return <CodeBlock key={k} code={b.code} lang={b.lang} />;
          case "heading":
            return <p key={k} className="hh-md-h">{inline(b.text, sources, k)}</p>;
          case "table":
            return (
              <div key={k} className="hh-table-wrap">
                <table>
                  <tbody>
                    {b.rows.map((r, ri) => (
                      <tr key={ri}>
                        {r.map((c, ci) => (ri === 0 ? <th key={ci}>{inline(c, sources, `${k}-${ri}-${ci}`)}</th> : <td key={ci}>{inline(c, sources, `${k}-${ri}-${ci}`)}</td>))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "list": {
            const items = b.items.map((it, ii) => (
              <li key={ii}>
                {inline(it.text, sources, `${k}-${ii}`)}
                {it.sub.length > 0 && (
                  <ul>
                    {it.sub.map((s, si) => <li key={si}>{inline(s, sources, `${k}-${ii}-${si}`)}</li>)}
                  </ul>
                )}
              </li>
            ));
            return b.ordered ? <ol key={k} start={b.start}>{items}</ol> : <ul key={k}>{items}</ul>;
          }
          default:
            return (
              <p key={k}>
                {b.text.split("\n").map((ln, li) => (
                  <span key={li}>
                    {li > 0 && <br />}
                    {inline(ln, sources, `${k}-${li}`)}
                  </span>
                ))}
              </p>
            );
        }
      })}
    </div>
  );
}
