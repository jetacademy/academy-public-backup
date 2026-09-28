// Pencarian BM25 in-memory atas potongan dokumentasi Hermes. Murni (tanpa I/O).
// Sengaja tidak memakai FULLTEXT MySQL: perilakunya beda antara MySQL lokal & MariaDB
// produksi (min token size, stopword), dan korpusnya kecil (±beberapa ribu potongan)
// sehingga indeks di memori cuma butuh beberapa MB dan query < 10 ms.

export type SearchDoc = {
  id: string;
  url: string;
  section: string;
  title: string;
  heading: string;
  content: string;
};

export type SearchHit<T extends SearchDoc = SearchDoc> = { doc: T; score: number };

const STOPWORDS = new Set(
  (
    // Inggris
    "a an and are as at be but by can do does for from how i if in into is it its me my of on or " +
    "so than that the their then there these this to up use using was we what when where which who " +
    "why will with you your yours about after all also any been before being both did each get got " +
    "had has have here just more most not now only other our out over same should some such them " +
    "they those through too under until very would want need make like able let " +
    // Indonesia (kalau query mentah ikut dicari)
    "apa apakah bagaimana gimana cara caranya yang dan di ke dari untuk dengan ini itu ada adalah " +
    "saya aku kamu anda kak min mas mbak tolong mau ingin bisa tidak nggak gak ga ya dong sih kah " +
    "nya pakai pake buat bikin jadi kalau kalo agar supaya biar sudah udah belum lagi juga atau " +
    "tapi kenapa mengapa dimana kapan"
  ).split(/\s+/),
);

/** Stemmer ringan bahasa Inggris — cukup untuk menyamakan install/installing/installed. */
function stem(t: string): string {
  if (t.length <= 4 || /\d/.test(t)) return t;
  if (t.endsWith("ies")) return t.slice(0, -3) + "y";
  if (t.endsWith("ing") && t.length > 6) return t.slice(0, -3);
  if (t.endsWith("ed") && t.length > 5) return t.slice(0, -2);
  if (t.endsWith("es") && /(sh|ch|x|ss)es$/.test(t)) return t.slice(0, -2);
  if (t.endsWith("s") && !t.endsWith("ss")) return t.slice(0, -1);
  return t;
}

/**
 * Token: kata alfanumerik + bentuk majemuk teknis utuh (config.yaml, hermes-gateway,
 * OPENROUTER_API_KEY) supaya pencarian persis nama perintah/berkas tetap kuat.
 */
export function tokenize(text: string): string[] {
  const out: string[] = [];
  const lower = text.toLowerCase();
  for (const raw of lower.match(/[\p{L}\p{N}][\p{L}\p{N}._\-/]*[\p{L}\p{N}]|[\p{L}\p{N}]/gu) ?? []) {
    const parts = raw.split(/[._\-/]+/).filter(Boolean);
    if (parts.length > 1 && raw.length <= 40) out.push(raw);
    for (const p of parts) {
      if (p.length < 2 || STOPWORDS.has(p)) continue;
      out.push(stem(p));
    }
  }
  return out;
}

type Posting = { i: number; tf: number };

export class Bm25Index<T extends SearchDoc = SearchDoc> {
  private postings = new Map<string, Posting[]>();
  private lengths: number[] = [];
  private avgLen = 0;
  private k1 = 1.2;
  private b = 0.75;
  readonly docs: T[];

  // Judul & heading diberi bobot lebih: kata di sana adalah ringkasan isi potongan.
  constructor(docs: T[]) {
    this.docs = docs;
    let total = 0;
    docs.forEach((d, i) => {
      const tokens = [
        ...tokenize(d.title), ...tokenize(d.title),
        ...tokenize(d.heading), ...tokenize(d.heading), ...tokenize(d.heading),
        ...tokenize(d.content),
      ];
      this.lengths[i] = tokens.length;
      total += tokens.length;
      const tf = new Map<string, number>();
      for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
      for (const [t, n] of tf) {
        let list = this.postings.get(t);
        if (!list) this.postings.set(t, (list = []));
        list.push({ i, tf: n });
      }
    });
    this.avgLen = docs.length ? total / docs.length : 0;
  }

  /** Skor BM25 per dokumen untuk satu query. */
  scoreQuery(query: string): Map<number, number> {
    const scores = new Map<number, number>();
    const N = this.docs.length;
    for (const term of new Set(tokenize(query))) {
      const list = this.postings.get(term);
      if (!list) continue;
      const idf = Math.log(1 + (N - list.length + 0.5) / (list.length + 0.5));
      for (const { i, tf } of list) {
        const norm = tf + this.k1 * (1 - this.b + (this.b * this.lengths[i]) / this.avgLen);
        scores.set(i, (scores.get(i) ?? 0) + (idf * tf * (this.k1 + 1)) / norm);
      }
    }
    return scores;
  }

  /**
   * Gabungkan beberapa query (hasil rewrite + pertanyaan asli) dengan Reciprocal Rank Fusion
   * — query yang skornya besar secara absolut tidak mendominasi query lain.
   * `weight` mengalikan skor per dokumen (mis. prioritas panduan Hermes Desktop).
   */
  search(queries: string[], limit = 20, weight?: (doc: T) => number): SearchHit<T>[] {
    const fused = new Map<number, number>();
    const best = new Map<number, number>();
    for (const q of queries) {
      const ranked = [...this.scoreQuery(q)].sort((a, b) => b[1] - a[1]).slice(0, 60);
      ranked.forEach(([i, s], rank) => {
        fused.set(i, (fused.get(i) ?? 0) + 1 / (60 + rank));
        best.set(i, Math.max(best.get(i) ?? 0, s));
      });
    }
    return [...fused]
      .map(([i, f]) => ({ i, f: f * (weight?.(this.docs[i]) ?? 1) }))
      .sort((a, b) => b.f - a.f)
      .slice(0, limit)
      .map(({ i }) => ({ doc: this.docs[i], score: best.get(i) ?? 0 }));
  }
}
