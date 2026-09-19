import DOMPurify from "isomorphic-dompurify";

// Inisialisasi hook sekali
let hooksInitialized = false;
function initPurifyHooks() {
  if (hooksInitialized) return;
  hooksInitialized = true;

  // Hook: bersihkan javascript: dan data: dari href & src, validasi iframe video
  DOMPurify.addHook("afterSanitizeAttributes", function (node: Element) {
    if (node.tagName === "A" && node.getAttribute("href")) {
      const href = node.getAttribute("href")!;
      if (/^\s*(javascript|data|vbscript):/i.test(href)) {
        node.setAttribute("href", "#");
      }
    }
    if (node.tagName === "IMG" && node.getAttribute("src")) {
      const src = node.getAttribute("src")!;
      if (/^\s*(javascript|data):/i.test(src)) {
        node.removeAttribute("src");
      }
    }
    if (node.tagName === "IFRAME") {
      const src = node.getAttribute("src") || "";
      const isAllowedVideo = /^(https?:)?\/\/(www\.)?(youtube\.com|youtube-nocookie\.com|youtu\.be|player\.vimeo\.com|vimeo\.com|iframe\.mediadelivery\.net)/i.test(src);
      if (!isAllowedVideo) {
        node.remove();
      }
    }
  });
}

/**
 * Memastikan penomoran daftar berurutan (<ol>) tetap berlanjut meskipun
 * disisipi gambar (<p><img ...></p>), catatan/paragraf, atau jeda baris.
 * Penomoran hanya di-reset jika ada Heading (<h1>-<h6>) atau <hr> atau reset eksplisit.
 */
export function normalizeListContinuation(html: string): string {
  if (!html || !html.includes("<ol")) return html;

  const blockRegex = /(<(h[1-6]|hr)\b[^>]*>[\s\S]*?<\/\2>|<hr\s*\/?>)|(<ol\b([^>]*)>([\s\S]*?)<\/ol>)/gi;

  let currentCount = 0;
  let hasActiveList = false;

  return html.replace(blockRegex, (match, headingBlock, _headingTag, olBlock, olAttrs, olContent) => {
    // Heading atau HR mereset alur nomor daftar
    if (headingBlock) {
      currentCount = 0;
      hasActiveList = false;
      return match;
    }

    if (olBlock) {
      const attrs = olAttrs || "";
      const content = olContent || "";

      // Hitung elemen <li>
      const liMatches = content.match(/<li\b[^>]*>/gi);
      const liCount = liMatches ? liMatches.length : 1;

      // Cek apakah ada start eksplisit atau kelas reset
      const startMatch = attrs.match(/\bstart=["']?(\d+)["']?/i);
      const isExplicitReset = attrs.includes("ql-list-reset") || content.includes("ql-list-reset");

      if (isExplicitReset || (startMatch && startMatch[1] === "1")) {
        currentCount = 0;
        hasActiveList = true;
      }

      let newAttrs = attrs;
      if (hasActiveList && currentCount > 0 && !startMatch && !isExplicitReset) {
        const nextStart = currentCount + 1;
        newAttrs = `${attrs} start="${nextStart}"`.trim();
      }

      const effectiveStart = startMatch
        ? parseInt(startMatch[1], 10)
        : (hasActiveList && currentCount > 0 && !isExplicitReset ? currentCount + 1 : 1);

      currentCount = effectiveStart + liCount - 1;
      hasActiveList = true;

      return `<ol ${newAttrs}>${content}</ol>`.replace(/\s{2,}/g, " ").replace("<ol >", "<ol>");
    }

    return match;
  });
}

/** Sanitasi HTML dari rich text editor / input eksternal (API) — pakai DOMPurify singleton. */
export async function sanitizeHtml(html: string | null): Promise<string | null> {
  if (!html) return null;
  initPurifyHooks();

  const cleaned = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p", "br", "b", "i", "u", "s", "strike", "strong", "em", "a", "ul", "ol", "li",
      "h1", "h2", "h3", "h4", "h5", "h6", "img", "iframe", "hr", "blockquote",
      "pre", "code", "span", "div", "table", "thead", "tbody", "tr", "th", "td",
    ],
    ALLOWED_ATTR: [
      "href", "src", "alt", "target", "rel", "class", "style", "allow",
      "allowfullscreen", "frameborder", "width", "height", "start", "value",
    ],
    ALLOW_DATA_ATTR: false,
  });

  const normalized = normalizeListContinuation(cleaned);
  const trimmed = normalized.trim();
  const textOnly = trimmed.replace(/<[^>]*>/g, "").trim();
  return textOnly.length > 0 || /<(img|iframe)\b/i.test(trimmed) ? trimmed : null;
}

