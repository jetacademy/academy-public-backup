// ─── DOMPurify singleton (inisialisasi sekali di module level) ────
// Dipakai admin server actions (webadmin/actions.ts) & API tulis (/api/v1/*)
// utk membersihkan HTML dari rich text editor sebelum disimpan.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let purifyInstance: any = null;

async function getPurify() {
  if (purifyInstance) return purifyInstance;
  const { JSDOM } = await import("jsdom");
  const dom = new JSDOM("");
  const createDOMPurify = await import("isomorphic-dompurify");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  purifyInstance = createDOMPurify.default(dom.window as any);
  // Hook: bersihkan javascript: dan data: dari href
  purifyInstance.addHook("afterSanitizeAttributes", function (node: Element) {
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
  return purifyInstance;
}

/** Sanitasi HTML dari rich text editor / input eksternal (API) — pakai DOMPurify singleton di atas. */
export async function sanitizeHtml(html: string | null): Promise<string | null> {
  if (!html) return null;
  const purify = await getPurify();
  const cleaned = purify.sanitize(html, {
    ALLOWED_TAGS: [
      "p", "br", "b", "i", "u", "s", "strike", "strong", "em", "a", "ul", "ol", "li",
      "h1", "h2", "h3", "h4", "h5", "h6", "img", "iframe", "hr", "blockquote",
      "pre", "code", "span", "div", "table", "thead", "tbody", "tr", "th", "td",
    ],
    ALLOWED_ATTR: ["href", "src", "alt", "target", "rel", "class", "style", "allow", "allowfullscreen", "frameborder", "width", "height"],
    ALLOW_DATA_ATTR: false,
  });
  const trimmed = cleaned.trim();
  const textOnly = trimmed.replace(/<[^>]*>/g, "").trim();
  return textOnly.length > 0 || /<(img|iframe)\b/i.test(trimmed) ? trimmed : null;
}
