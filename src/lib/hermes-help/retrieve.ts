// Pemilihan konteks untuk satu pertanyaan. Murni (tanpa I/O) — dipakai assistant.ts dan
// bisa dijalankan langsung oleh skrip uji terhadap dokumentasi asli.

import { Bm25Index, tokenize, type SearchDoc, type SearchHit } from "./search";
import { BUSINESS_ANCHORS, docWeight, isDesktopDoc, pickContext, type Intent } from "./prompts";

const MAX_DOCS = 6;
const MAX_DOCS_BUSINESS = 8; // 4 anchor metode kelas + kanal/tools
const BUDGET = 9000;

// Kata yang muncul di hampir semua materi kursus Hermes — tidak menandakan relevansi.
const GENERIC_TERMS = new Set(["hermes", "agent", "desktop", "app", "aplikasi", "ai", "nous", "research"]);

/**
 * Pilih potongan materi LMS yang BENAR-BENAR relevan. Skor BM25 di korpus sekecil ini tidak bisa
 * dibandingkan secara absolut, jadi dipakai cakupan kata: minimal 2 kata penting dari
 * pertanyaan (atau salah satu query rewrite) muncul, dan ≥ 40% dari kata pentingnya.
 */
export function selectLmsHits(hits: SearchHit<SearchDoc>[], queries: string[], max = 2): SearchDoc[] {
  const querySets = queries
    .map((q) => new Set(tokenize(q).filter((t) => !GENERIC_TERMS.has(t))))
    .filter((s) => s.size > 0);
  const out: SearchDoc[] = [];
  for (const { doc } of hits) {
    const docTokens = new Set(tokenize(`${doc.title} ${doc.heading} ${doc.content}`));
    const relevant = querySets.some((qs) => {
      let matched = 0;
      for (const t of qs) if (docTokens.has(t)) matched++;
      return matched >= 2 && matched / qs.size >= 0.4;
    });
    if (relevant) out.push(doc);
    if (out.length >= max) break;
  }
  return out;
}

/** Potongan terbaik dari halaman yang diharapkan (fallback: hasil teratas query itu). */
function bestFromPage(index: Bm25Index<SearchDoc>, query: string, page: RegExp, exclude: Set<string>): SearchDoc | null {
  const hits = index.search([query], 40, docWeight).filter((h) => !exclude.has(h.doc.id));
  return (hits.find((h) => page.test(h.doc.url)) ?? hits[0])?.doc ?? null;
}

export function selectContext(args: {
  docsIndex: Bm25Index<SearchDoc>;
  lmsIndex: Bm25Index<SearchDoc> | null;
  question: string;
  queries: string[];
  intent: Intent;
}): SearchDoc[] {
  const { docsIndex, lmsIndex, question, queries, intent } = args;
  const business = intent === "business";
  const maxDocs = business ? MAX_DOCS_BUSINESS : MAX_DOCS;

  // 1. Materi kelas (bahasa Indonesia): maks 2 potongan relevan, ditaruh paling depan.
  const allQueries = [question, ...queries];
  const lmsPicked = lmsIndex ? selectLmsHits(lmsIndex.search(allQueries, 6), allQueries) : [];
  const lmsChars = lmsPicked.reduce((n, d) => n + d.content.length, 0);

  // 2. Konsultasi bisnis: satu potongan per langkah METODE KELAS (profile, skills, multi-agent).
  const anchors: SearchDoc[] = [];
  if (business) {
    const taken = new Set<string>();
    for (const a of BUSINESS_ANCHORS) {
      const d = bestFromPage(docsIndex, a.query, a.page, taken);
      if (d) {
        anchors.push(d);
        taken.add(d.id);
      }
    }
  }

  // 3. Dokumentasi resmi untuk query rewrite + pertanyaan asli.
  const slots = maxDocs - lmsPicked.length - anchors.length;
  const anchorIds = new Set(anchors.map((d) => d.id));
  const hits = docsIndex.search([...queries, question], 20, docWeight).filter((h) => !anchorIds.has(h.doc.id));
  const docPicked = pickContext(hits, Math.max(1, slots), Math.max(3000, BUDGET - lmsChars - anchors.reduce((n, d) => n + d.content.length, 0)));

  // 4. Peserta memakai Hermes Desktop: bila rewrite membuat query Desktop tapi belum ada potongan
  // Hermes Desktop yang terpilih (kalah skor dari halaman CLI), sisipkan maks 2 dari panduan utamanya
  // — satu bagian sering terpecah (mis. "Settings & onboarding" = 3 potongan).
  const desktopQuery = queries.find((q) => /desktop/i.test(q));
  if (!business && desktopQuery && !docPicked.some(isDesktopDoc)) {
    const candidates = docsIndex.search([desktopQuery], 60, docWeight).filter((h) => isDesktopDoc(h.doc)).slice(0, 6);
    const main = candidates.filter((h) => /\/docs\/user-guide\/desktop(#|$)/.test(h.doc.url));
    const chosen = (main.length ? main : candidates).slice(0, 2).map((h) => h.doc);
    while (docPicked.length > 0 && docPicked.length + chosen.length > Math.max(1, slots)) docPicked.pop();
    docPicked.push(...chosen);
  }

  return [...lmsPicked, ...anchors, ...docPicked];
}
