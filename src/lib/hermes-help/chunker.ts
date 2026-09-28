// Pemecah dokumentasi Hermes Agent (llms-full.txt) menjadi potongan kecil untuk RAG.
// Murni (tanpa I/O) supaya bisa diuji unit & dipakai ulang oleh script maupun sinkron otomatis.
//
// Format sumber: halaman-halaman markdown yang digabung, tiap halaman diawali penanda
// `<!-- source: website/docs/<path>.md -->`. Heading `#` di dalam blok kode (komentar shell/yaml)
// BUKAN heading — makanya parsing melacak status fence ``` / ~~~.

export const DOCS_BASE_URL = "https://hermes-agent.nousresearch.com/docs";
export const DOCS_FULL_URL = `${DOCS_BASE_URL}/llms-full.txt`;

export type DocChunk = {
  url: string; // URL halaman + #anchor heading
  section: string; // segmen pertama path, mis. "getting-started", "user-guide"
  title: string; // judul halaman
  heading: string; // jalur heading di dalam halaman, mis. "Quick Install > Windows (native)"
  content: string;
  order: number;
};

// ~450 token per potongan: cukup utuh untuk satu langkah/prosedur, cukup kecil untuk hemat konteks.
const MAX_CHARS = 1800;
const MIN_CHARS = 200;

const SOURCE_RE = /^<!--\s*source:\s*(\S+?)\s*-->\s*$/;
const FENCE_RE = /^\s*(```|~~~)/;
const HEADING_RE = /^(#{1,4})\s+(.+?)\s*#*\s*$/;

/** Anchor gaya Docusaurus (github-slugger): huruf kecil, buang tanda baca, spasi → "-". */
export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/`/g, "")
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .trim()
    .replace(/\s/g, "-");
}

/** `website/docs/getting-started/installation.md` → URL halaman publik. */
export function sourceToUrl(source: string): string {
  let p = source.replace(/^website\/docs\//, "").replace(/\.mdx?$/, "");
  p = p.replace(/(^|\/)index$/, "");
  return p ? `${DOCS_BASE_URL}/${p}` : DOCS_BASE_URL;
}

type Page = { source: string; lines: string[] };

function splitPages(text: string): Page[] {
  const pages: Page[] = [];
  let cur: Page | null = null;
  for (const line of text.split(/\r?\n/)) {
    const m = SOURCE_RE.exec(line);
    if (m) {
      cur = { source: m[1], lines: [] };
      pages.push(cur);
    } else if (cur) {
      cur.lines.push(line);
    }
  }
  return pages;
}

type Section = { path: string[]; anchor: string; lines: string[] };

/** Pecah halaman per heading level 2–4 (di luar blok kode). */
function splitSections(lines: string[]): { title: string; sections: Section[] } {
  let title = "";
  const sections: Section[] = [];
  const stack: string[] = []; // index 0 = level 2
  let cur: Section = { path: [], anchor: "", lines: [] };
  sections.push(cur);
  let inFence = false;

  for (const line of lines) {
    if (FENCE_RE.test(line)) inFence = !inFence;
    const h = !inFence ? HEADING_RE.exec(line) : null;
    if (!h) {
      cur.lines.push(line);
      continue;
    }
    const level = h[1].length;
    const text = h[2].replace(/\{#[^}]+\}\s*$/, "").trim();
    if (level === 1) {
      // Judul halaman sering ditulis dua kali berturut-turut — cukup ambil yang pertama.
      if (!title) title = text;
      continue;
    }
    stack.length = level - 2;
    stack[level - 2] = text;
    cur = { path: stack.filter(Boolean), anchor: slugifyHeading(text), lines: [] };
    sections.push(cur);
  }
  return { title, sections };
}

/**
 * Belah satu blok raksasa (tabel / blok kode panjang tanpa baris kosong) per baris.
 * Blok kode ditutup & dibuka lagi dengan fence yang sama, tabel mengulang barisan header,
 * supaya tiap potongan tetap markdown yang utuh dan bisa dipahami berdiri sendiri.
 */
function splitBlockByLines(block: string): string[] {
  const lines = block.split("\n");
  const out: string[] = [];
  let buf: string[] = [];
  let size = 0;
  let fence: string | null = null;
  let tableHeader: string[] | null = null;

  lines.forEach((line, i) => {
    const f = FENCE_RE.exec(line);
    if (f) fence = fence ? null : line.trim();
    if (!tableHeader && /^\s*\|/.test(line) && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1] ?? "")) {
      tableHeader = [line, lines[i + 1]];
    }
    if (size + line.length > MAX_CHARS && buf.length > 3) {
      const openFence: string | null = f ? null : fence;
      if (openFence) buf.push(openFence.replace(/[^`~].*$/, ""));
      out.push(buf.join("\n"));
      buf = openFence ? [openFence] : /^\s*\|/.test(line) && tableHeader ? [...tableHeader] : [];
      size = buf.join("\n").length;
    }
    buf.push(line);
    size += line.length + 1;
  });
  if (buf.length) out.push(buf.join("\n"));
  return out;
}

/** Potong teks panjang di batas paragraf; blok kode tidak dibelah kecuali memang raksasa. */
function splitLong(body: string): string[] {
  if (body.length <= MAX_CHARS) return [body];
  const blocks: string[] = [];
  let buf: string[] = [];
  let inFence = false;
  for (const line of body.split("\n")) {
    if (FENCE_RE.test(line)) inFence = !inFence;
    buf.push(line);
    if (!inFence && line.trim() === "") {
      blocks.push(buf.join("\n"));
      buf = [];
    }
  }
  if (buf.length) blocks.push(buf.join("\n"));
  for (let i = blocks.length - 1; i >= 0; i--) {
    if (blocks[i].length > MAX_CHARS * 1.3) blocks.splice(i, 1, ...splitBlockByLines(blocks[i]));
  }

  const out: string[] = [];
  let acc = "";
  for (const b of blocks) {
    if (acc && acc.length + b.length > MAX_CHARS) {
      out.push(acc);
      acc = "";
    }
    acc += b;
  }
  if (acc.trim()) out.push(acc);
  return out;
}

/** Link relatif antar-halaman (`../x/y.md#anchor`) → URL publik absolut. */
export function resolveLinks(text: string, source: string): string {
  const dir = source.replace(/^website\/docs\//, "").split("/").slice(0, -1);
  return text.replace(/\]\((?!https?:|mailto:|#)([^)\s]+?)\)/g, (whole, href: string) => {
    const [path, hash] = href.split("#");
    if (!path) return whole;
    const parts = path.startsWith("/") ? [] : [...dir];
    for (const seg of path.replace(/^\/(docs\/)?/, "").split("/")) {
      if (seg === "..") parts.pop();
      else if (seg && seg !== ".") parts.push(seg);
    }
    const url = sourceToUrl(`website/docs/${parts.join("/")}`);
    return `](${url}${hash ? `#${hash}` : ""})`;
  });
}

function clean(text: string): string {
  return text
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/^import\s.+from\s.+;?\s*$/gm, "") // import MDX
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function chunkDocs(fullText: string): DocChunk[] {
  const chunks: DocChunk[] = [];
  let order = 0;

  for (const page of splitPages(fullText)) {
    const parts = chunkMarkdown(page.lines, {
      url: sourceToUrl(page.source),
      section: page.source.replace(/^website\/docs\//, "").split("/")[0].replace(/\.mdx?$/, ""),
      fallbackTitle: page.source.split("/").pop()!.replace(/\.mdx?$/, ""),
      anchors: true,
      linkSource: page.source,
    });
    for (const p of parts) chunks.push({ ...p, order: order++ });
  }
  return chunks;
}

// ── Dokumentasi OpenRouter ──────────────────────────────────────────────────
// Format berbeda: tiap halaman diawali `# Judul` lalu `Source: https://openrouter.ai/docs/<path>`.
// Isinya didominasi referensi SDK/API untuk developer — peserta kelas memakai OpenRouter lewat
// Hermes Desktop, jadi hanya bagian yang relevan bagi pengguna yang diindeks.

export const OPENROUTER_FULL_URL = "https://openrouter.ai/docs/llms-full.txt";
export const OPENROUTER_SECTION = "openrouter";

// Yang relevan bagi pengguna: mulai, FAQ (akun/kredit/billing), API key & error, model & varian
// gratis, routing/fallback, privasi, biaya (caching/reasoning), dan integrasi Hermes Agent.
// Sengaja DIKECUALIKAN: client/agent SDK, integrasi observability (Datadog dsb.), server tools,
// guardrails, SCIM/organisasi — isinya untuk developer platform, hanya menambah derau pencarian.
const OPENROUTER_INCLUDE = new RegExp(
  "^(" +
    [
      "quickstart",
      "faq",
      "api_reference/(authentication|limits|errors-and-debugging)",
      "guides/overview/(models|principles|multimodal/(overview|image-understanding|pdfs))",
      "guides/routing/(model-fallbacks|provider-selection|model-variants|routers/(auto-router|free-router))",
      "guides/best-practices/(prompt-caching|reasoning-tokens|uptime-optimization)",
      "guides/privacy",
      "guides/features/(presets|activity|logs|plugins/web-search)",
      "cookbook/get-started/quickstart",
      "cookbook/administration/analytics-cost-control",
      "cookbook/coding-agents/hermes-integration",
    ].join("|") +
    ")(/|$)",
);

export function isOpenRouterPathIncluded(path: string): boolean {
  return OPENROUTER_INCLUDE.test(path);
}

/** Buang komponen MDX (<Tip>, <CodeGroup>, …) & atribut fence (`theme={null}`, `lines`). */
function cleanMdx(lines: string[]): string[] {
  return lines
    .filter((l) => !/^\s*<\/?[A-Z][A-Za-z]*(\s[^>]*)?\/?>\s*$/.test(l))
    .map((l) => l.replace(/^(\s*```)([\w+-]*)[^\n]*$/, "$1$2").replace(/<\/?[A-Z][A-Za-z]*(\s[^>]*)?\/?>/g, ""));
}

export function chunkOpenRouterDocs(fullText: string): DocChunk[] {
  const lines = fullText.split(/\r?\n/);
  const pages: { path: string; lines: string[] }[] = [];
  let cur: { path: string; lines: string[] } | null = null;
  for (let i = 0; i < lines.length; i++) {
    const src = /^Source:\s*https:\/\/openrouter\.ai\/docs\/(\S+?)\/?\s*$/.exec(lines[i + 1] ?? "");
    if (src && /^#\s+/.test(lines[i])) {
      cur = { path: src[1], lines: [lines[i]] };
      pages.push(cur);
      i++; // lewati baris Source
      continue;
    }
    cur?.lines.push(lines[i]);
  }

  const chunks: DocChunk[] = [];
  let order = 0;
  for (const p of pages) {
    if (!isOpenRouterPathIncluded(p.path)) continue;
    const parts = chunkMarkdown(cleanMdx(p.lines), {
      url: `https://openrouter.ai/docs/${p.path}`,
      section: OPENROUTER_SECTION,
      fallbackTitle: p.path.split("/").pop()!,
      anchors: true,
    });
    for (const part of parts) chunks.push({ ...part, title: `OpenRouter: ${part.title}`, order: order++ });
  }
  return chunks;
}

/**
 * Pecah SATU halaman markdown per heading (dipakai dokumentasi Hermes & materi LMS).
 * `anchors: false` untuk halaman yang tidak punya #anchor per heading (mis. halaman materi LMS).
 */
export function chunkMarkdown(
  input: string | string[],
  opts: { url: string; section: string; fallbackTitle: string; anchors: boolean; linkSource?: string },
): Omit<DocChunk, "order">[] {
  const lines = typeof input === "string" ? input.split(/\r?\n/) : input;
  const { title, sections } = splitSections(lines);
  const pageTitle = title || opts.fallbackTitle;
  const out: Omit<DocChunk, "order">[] = [];

  // Gabungkan section yang terlalu pendek ke section sebelumnya supaya tidak ada
  // potongan "yatim" (mis. heading yang cuma berisi satu kalimat pengantar).
  const merged: Section[] = [];
  for (const s of sections) {
    const body = clean(s.lines.join("\n"));
    const prev = merged[merged.length - 1];
    if (prev && body.length < MIN_CHARS && s.path.length > 1) {
      prev.lines.push("", `${"#".repeat(Math.min(s.path.length + 1, 4))} ${s.path[s.path.length - 1]}`, body);
      continue;
    }
    merged.push({ ...s, lines: [body] });
  }

  for (const s of merged) {
    const cleaned = clean(s.lines.join("\n"));
    const body = opts.linkSource ? resolveLinks(cleaned, opts.linkSource) : cleaned;
    if (!body) continue;
    const url = opts.anchors && s.anchor ? `${opts.url}#${s.anchor}` : opts.url;
    const heading = s.path.join(" > ");
    for (const part of splitLong(body)) {
      const content = part.trim();
      if (content.length < 40) continue;
      out.push({ url, section: opts.section, title: pageTitle, heading, content });
    }
  }
  return out;
}
