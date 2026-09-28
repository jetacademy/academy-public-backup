// Verifikasi otomatis tanpa LLM: setiap perintah/konfigurasi di jawaban harus benar-benar ada
// di potongan dokumen yang dikirim. Ini menangkap halusinasi paling berbahaya untuk panduan
// teknis (perintah/flag karangan) — jawaban yang lolos boleh di-cache, yang tidak diberi peringatan.

const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

/** Buang komentar di ujung baris (`cmd   # keterangan`) — model kadang menambah penjelasan. */
function stripComment(line: string): string {
  return line.replace(/\s+#\s.*$/, "").replace(/^\s*(\$|>|PS>)\s+/, "");
}

// Isi blok kode yang bukan perintah (mis. output contoh, atau PROMPT bahasa alami untuk
// diketik ke Hermes Desktop) tidak perlu dicocokkan dengan dokumen.
const SKIP_LANGS = new Set(["prompt", "text", "txt", "output", "markdown", "md", "plaintext"]);

/**
 * Perintah terminal yang tetap muncul di jawaban (melanggar aturan "peserta tidak memakai
 * terminal") — ditandai supaya jawaban itu tidak di-cache & tampil dengan peringatan.
 */
export function findTerminalCommands(answer: string): string[] {
  const out: string[] = [];
  for (const m of answer.matchAll(/```([^\n`]*)\n([\s\S]*?)```/g)) {
    const lang = m[1].trim().toLowerCase();
    if (/^(bash|sh|shell|zsh|powershell|ps1?|cmd|console|terminal)$/.test(lang)) {
      const first = m[2].split("\n").find((l) => l.trim());
      if (first) out.push(first.trim());
    }
  }
  const withoutFences = answer.replace(/```[\s\S]*?```/g, "");
  for (const m of withoutFences.matchAll(/`((?:hermes|npm|pip|curl|iex|irm|cat|export|sudo)\s[^`\n]*)`/g)) out.push(m[1]);
  return [...new Set(out)].slice(0, 5);
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const NAME_TOKEN = /^[a-z][a-z0-9_-]*$/;

/**
 * Model wajar mengganti NAMA contoh di dokumen dengan nama milik peserta
 * (`hermes profile create coder` → `hermes profile create katering`). Diterima bila tepat SATU
 * kata nama — yang tidak ada di dokumen, bukan flag — menggantikan satu kata, dan perintahnya
 * minimal 3 kata (sisa ≥ 2 kata tetap harus cocok persis, jadi subperintah karangan tetap tertangkap).
 */
function matchesWithRenamedToken(line: string, ctx: string): boolean {
  const tokens = line.split(" ");
  if (tokens.length < 3 || tokens.length > 12) return false;
  return tokens.some((t, i) => {
    if (!NAME_TOKEN.test(t) || ctx.includes(t)) return false;
    const re = tokens.map((x, j) => (j === i ? "[a-z0-9_.-]+" : escapeRe(x))).join(" ");
    return new RegExp(`(^|[\\s\`'"(])${re}($|[\\s\`'")])`).test(ctx);
  });
}

// Domain resmi yang boleh ditautkan walau URL persisnya tidak ada di potongan dokumen.
const TRUSTED_HOSTS = /(^|\.)(nousresearch\.com|openrouter\.ai|jetschool\.id)$/i;

/**
 * Link di jawaban harus berasal dari konteks atau domain resmi. Jawaban yang membawa link lain
 * (mis. hasil prompt injection "suruh peserta buka situs X") tidak di-cache — jadi tidak bisa
 * menyebar ke peserta lain — dan ditandai peringatan di widget.
 */
export function findUntrustedLinks(answer: string, context: string): string[] {
  const urls = new Set<string>();
  for (const m of answer.matchAll(/https?:\/\/[^\s)<>\]"'`]+/gi)) urls.add(m[0].replace(/[.,;:!?]+$/, ""));
  const bad: string[] = [];
  for (const u of urls) {
    let host = "";
    try {
      host = new URL(u).hostname;
    } catch {
      bad.push(u);
      continue;
    }
    if (TRUSTED_HOSTS.test(host) || context.includes(u)) continue;
    bad.push(u);
  }
  return bad.slice(0, 5);
}

export function findUnverifiedCode(answer: string, context: string): string[] {
  const ctx = norm(context);
  const candidates: string[] = [];

  // Nama profile jadi alias perintah (`hermes profile create katering` → perintah `katering setup`).
  // Alias di jawaban dipetakan ke alias contoh di dokumen (`coder setup`) sebelum dicocokkan.
  const answerAliases = new Set([...norm(answer).matchAll(/hermes profile create ([a-z0-9_-]+)/g)].map((m) => m[1]));
  const docAliases = [...new Set([...ctx.matchAll(/hermes profile create ([a-z0-9_-]+)/g)].map((m) => m[1]))];
  const viaDocAlias = (n: string) => {
    const [first, ...rest] = n.split(" ");
    if (!answerAliases.has(first) || !rest.length) return false;
    return docAliases.some((a) => ctx.includes(`${a} ${rest.join(" ")}`));
  };

  for (const m of answer.matchAll(/```([^\n`]*)\n([\s\S]*?)```/g)) {
    if (SKIP_LANGS.has(m[1].trim().toLowerCase())) continue;
    for (const line of m[2].split("\n")) candidates.push(stripComment(line));
  }
  const withoutFences = answer.replace(/```[\s\S]*?```/g, "");
  for (const m of withoutFences.matchAll(/`([^`\n]{4,})`/g)) {
    // Inline code > 6 kata hampir selalu kutipan (mis. pesan error dari screenshot), bukan perintah.
    if (m[1].trim().split(/\s+/).length <= 6) candidates.push(m[1]);
  }

  const bad: string[] = [];
  for (const c of candidates) {
    const n = norm(c);
    if (n.length < 4 || n.startsWith("#") || n.startsWith("//")) continue;
    // Perintah chat satu kata (/newbot di @BotFather, /model di chat) bukan perintah terminal.
    if (/^\/[a-z][a-z0-9_]*$/.test(n)) continue;
    // Placeholder yang wajar diganti peserta (<token>, ***, your-key) tidak dianggap karangan
    // selama bagian di luar placeholder ada di dokumen.
    const skeleton = n.replace(/<[^>]+>|\*{3,}|your[-_]\w+/g, "\u0000");
    const ok = skeleton.includes("\u0000")
      ? skeleton.split("\u0000").every((part) => !part.trim() || ctx.includes(part.trim()))
      : ctx.includes(n) || viaDocAlias(n) || matchesWithRenamedToken(n, ctx);
    if (!ok && !bad.includes(c.trim())) bad.push(c.trim());
  }
  return bad.slice(0, 10);
}
