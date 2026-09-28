// Verifikasi otomatis tanpa LLM: setiap perintah/konfigurasi di jawaban harus benar-benar ada
// di potongan dokumen yang dikirim. Ini menangkap halusinasi paling berbahaya untuk panduan
// teknis (perintah/flag karangan) — jawaban yang lolos boleh di-cache, yang tidak diberi peringatan.

const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

/** Buang komentar di ujung baris (`cmd   # keterangan`) — model kadang menambah penjelasan. */
function stripComment(line: string): string {
  return line.replace(/\s+#\s.*$/, "").replace(/^\s*(\$|>|PS>)\s+/, "");
}

// Isi blok kode yang bukan perintah (mis. output contoh) tidak perlu dicek.
const SKIP_LANGS = new Set(["text", "txt", "output", "markdown", "md", "plaintext"]);

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
