import { describe, it, expect } from "vitest";
import { sanitizeHtml, normalizeListContinuation } from "@/lib/sanitize";

describe("List Continuation & Sanitization", () => {
  it("preserves start and value attributes in sanitizeHtml", async () => {
    const html = '<ol start="2"><li>Langkah 2</li></ol>';
    const sanitized = await sanitizeHtml(html);
    expect(sanitized).toContain('start="2"');
  });

  it("automatically continues list numbering across images and paragraphs", () => {
    const input = [
      "<ol><li>Langkah 1</li></ol>",
      '<p><img src="/img/test.webp" alt="Screenshot"></p>',
      "<ol><li>Pergi ke setting seperti pada gambar</li></ol>",
    ].join("");

    const normalized = normalizeListContinuation(input);
    expect(normalized).toContain('<ol start="2"><li>Pergi ke setting seperti pada gambar</li></ol>');
  });

  it("continues sequence for multiple steps with images in between", () => {
    const input = [
      "<ol><li>Langkah 1</li></ol>",
      '<p><img src="/img/1.webp"></p>',
      "<ol><li>Langkah 2</li></ol>",
      "<p>Catatan tambahan</p>",
      "<ol><li>Langkah 3</li><li>Langkah 4</li></ol>",
    ].join("");

    const normalized = normalizeListContinuation(input);
    expect(normalized).toContain('<ol start="2"><li>Langkah 2</li></ol>');
    expect(normalized).toContain('<ol start="3"><li>Langkah 3</li><li>Langkah 4</li></ol>');
  });

  it("resets list numbering after a heading (h1-h6) or hr", () => {
    const input = [
      "<ol><li>Langkah 1</li><li>Langkah 2</li></ol>",
      "<h2>Bagian Selanjutnya</h2>",
      "<ol><li>Langkah baru mulai dari satu</li></ol>",
    ].join("");

    const normalized = normalizeListContinuation(input);
    // Heading resets flow, so second ol starts fresh at 1 (no start attribute or start="1")
    expect(normalized).not.toContain('<ol start="3">');
  });

  it("respects explicit start=1 or ql-list-reset class to restart numbering", () => {
    const input = [
      "<ol><li>Langkah 1</li></ol>",
      "<p>Pilihan lain:</p>",
      '<ol class="ql-list-reset"><li>Opsi 1 baru</li></ol>',
    ].join("");

    const normalized = normalizeListContinuation(input);
    expect(normalized).not.toContain('start="2"');
  });
});
