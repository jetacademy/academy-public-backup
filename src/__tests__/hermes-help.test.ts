import { describe, it, expect } from "vitest";
import { chunkDocs, resolveLinks, slugifyHeading, sourceToUrl } from "@/lib/hermes-help/chunker";
import { Bm25Index, tokenize } from "@/lib/hermes-help/search";
import { buildRewriteInput, normalizeQuestion, parseRewrite, pickContext, trimHistory } from "@/lib/hermes-help/prompts";
import { findUnverifiedCode } from "@/lib/hermes-help/answer-check";
import { startOfTodayWib } from "@/lib/hermes-help/quota";

const SAMPLE = `# Hermes Agent — Full Documentation
Header yang diabaikan.

---

<!-- source: website/docs/getting-started/installation.md -->
# Installation

# Installation

Get Hermes Agent up and running in under two minutes! See [Platform Support](./platform-support.md).

## Quick Install

### Windows (native)

Hermes runs natively on Windows 10 and 11 without WSL, Cygwin or Docker. The installer script sets up
Python, Node.js and the hermes command on your PATH. Run in powershell:
\`\`\`powershell
iex (irm https://hermes-agent.nousresearch.com/install.ps1)
\`\`\`

\`\`\`bash
# ~/.hermes/config.yaml
hermes model
\`\`\`

<!-- source: website/docs/user-guide/messaging/telegram.md -->
# Telegram

Connect Hermes to Telegram so you can chat with your agent from your phone. Create a bot with BotFather,
then set TELEGRAM_BOT_TOKEN in your profile .env file and restart the gateway.

## Quick setup (dashboard and desktop app)

Open Messaging → Telegram and click Create with QR. Scan the QR code with Telegram on your phone and
Hermes writes TELEGRAM_BOT_TOKEN and TELEGRAM_ALLOWED_USERS for you, then restarts the gateway.
`;

describe("chunker", () => {
  const chunks = chunkDocs(SAMPLE);

  it("memecah per halaman & heading, heading di dalam blok kode bukan heading", () => {
    const headings = chunks.map((c) => c.heading);
    expect(headings).toContain("Quick Install > Windows (native)");
    expect(headings.some((h) => h.includes("config.yaml"))).toBe(false);
    const win = chunks.find((c) => c.heading.endsWith("Windows (native)"))!;
    expect(win.content).toContain("hermes model");
    expect(win.url).toBe("https://hermes-agent.nousresearch.com/docs/getting-started/installation#windows-native");
    expect(win.title).toBe("Installation");
    expect(win.section).toBe("getting-started");
  });

  it("subbagian yang sangat pendek digabung ke induknya (tidak ada potongan yatim)", () => {
    const text = `<!-- source: website/docs/user-guide/sessions.md -->\n# Sessions\n\n## Resuming\n\n${"Sessions are stored in SQLite and can be resumed later. ".repeat(6)}\n\n### Tip\n\nUse -c.\n`;
    const parts = chunkDocs(text);
    expect(parts).toHaveLength(1);
    expect(parts[0].heading).toBe("Resuming");
    expect(parts[0].content).toContain("### Tip");
  });

  it("mengubah link relatif menjadi URL absolut", () => {
    const intro = chunks.find((c) => c.title === "Installation" && !c.heading)!;
    expect(intro.content).toContain("](https://hermes-agent.nousresearch.com/docs/getting-started/platform-support)");
  });

  it("helper URL & slug", () => {
    expect(sourceToUrl("website/docs/user-guide/index.md")).toBe("https://hermes-agent.nousresearch.com/docs/user-guide");
    expect(slugifyHeading("Quick setup (dashboard and desktop app)")).toBe("quick-setup-dashboard-and-desktop-app");
    expect(resolveLinks("[x](../integrations/providers.md#anthropic)", "website/docs/getting-started/quickstart.md")).toBe(
      "[x](https://hermes-agent.nousresearch.com/docs/integrations/providers#anthropic)",
    );
  });

  it("blok kode raksasa dibelah tanpa merusak fence", () => {
    const big = "```yaml\n" + Array.from({ length: 400 }, (_, i) => `key_${i}: value number ${i}`).join("\n") + "\n```";
    const text = `<!-- source: website/docs/user-guide/configuration.md -->\n# Configuration\n\n## Full reference\n\n${big}\n`;
    const parts = chunkDocs(text);
    expect(parts.length).toBeGreaterThan(3);
    for (const p of parts) {
      expect((p.content.match(/^```/gm) ?? []).length % 2).toBe(0);
      expect(p.content.length).toBeLessThan(2600);
    }
  });
});

describe("search", () => {
  const chunks = chunkDocs(SAMPLE).map((c, i) => ({ ...c, id: String(i) }));
  const index = new Bm25Index(chunks);

  it("tokenizer menyimpan istilah teknis utuh & membuang stopword", () => {
    const t = tokenize("How to set TELEGRAM_BOT_TOKEN in config.yaml?");
    expect(t).toContain("telegram_bot_token");
    expect(t).toContain("config.yaml");
    expect(t).not.toContain("how");
  });

  it("menemukan halaman yang tepat dari beberapa query", () => {
    const hits = index.search(["connect Hermes to Telegram", "Telegram bot setup"], 5);
    expect(hits[0].doc.title).toBe("Telegram");
    const win = index.search(["install on Windows powershell"], 3);
    expect(win[0].doc.heading).toContain("Windows");
  });

  it("pickContext membatasi potongan per halaman", () => {
    const hits = index.search(["Telegram gateway bot token"], 10);
    const picked = pickContext(hits);
    const perPage = new Map<string, number>();
    for (const d of picked) perPage.set(d.url.split("#")[0], (perPage.get(d.url.split("#")[0]) ?? 0) + 1);
    expect(Math.max(...perPage.values())).toBeLessThanOrEqual(2);
  });
});

describe("prompts", () => {
  it("parseRewrite membaca intent, query, dan reply", () => {
    expect(parseRewrite("INTENT: hermes\nQ: connect Telegram\nQ: telegram bot token")).toEqual({
      intent: "hermes",
      queries: ["connect Telegram", "telegram bot token"],
      reply: null,
    });
    const s = parseRewrite("INTENT: smalltalk\nREPLY: Halo! Ada yang bisa dibantu?");
    expect(s.intent).toBe("smalltalk");
    expect(s.reply).toBe("Halo! Ada yang bisa dibantu?");
    // format rusak → tetap dianggap pertanyaan Hermes (lebih aman daripada menolak)
    expect(parseRewrite("entah apa").intent).toBe("hermes");
  });

  it("buildRewriteInput menyertakan riwayat sebagai teks ringkas", () => {
    expect(buildRewriteInput("halo", [])).toBe("halo");
    const s = buildRewriteInput("kalau di mac gimana?", [
      { role: "user", content: "cara install hermes di windows" },
      { role: "assistant", content: "Jalankan install.ps1 ".repeat(50) },
    ]);
    expect(s).toContain("Student: cara install hermes di windows");
    expect(s).toContain("Latest question (rewrite this one): kalau di mac gimana?");
    expect(s.length).toBeLessThan(800);
  });

  it("trimHistory & normalizeQuestion", () => {
    const h = trimHistory(
      Array.from({ length: 10 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: "x".repeat(2000) }) as const),
    );
    expect(h).toHaveLength(4);
    expect(h[0].content).toHaveLength(1200);
    expect(normalizeQuestion("  Cara Install  Hermes di Windows?? ")).toBe("cara install hermes di windows");
  });
});

describe("answer-check", () => {
  const ctx = "Run `hermes model` to pick a provider.\n```bash\nhermes --continue             # Resume the most recent CLI session\nexport ANTHROPIC_API_KEY=***\n```";

  it("lolos bila perintah ada di dokumen (termasuk komentar tambahan model & placeholder)", () => {
    const ans = "Jalankan:\n```bash\nhermes model\nhermes --continue   # lanjutkan sesi\nexport ANTHROPIC_API_KEY=<api-key-kamu>\n```\nlalu `hermes model`.";
    expect(findUnverifiedCode(ans, ctx)).toEqual([]);
  });

  it("kutipan pesan error panjang di inline code tidak dianggap perintah", () => {
    const ans = "Error-nya: `hermes : The term 'hermes' is not recognized as the name of a cmdlet`.";
    expect(findUnverifiedCode(ans, ctx)).toEqual([]);
  });

  it("menandai perintah karangan", () => {
    const ans = "```bash\nhermes connect telegram --token abc\n```\nAtau `hermes telegram login`.";
    expect(findUnverifiedCode(ans, ctx)).toEqual(["hermes connect telegram --token abc", "hermes telegram login"]);
  });
});

describe("quota", () => {
  it("awal hari WIB", () => {
    // 2026-09-28 18:30 UTC = 29 Sep 01:30 WIB → awal hari = 28 Sep 17:00 UTC
    expect(startOfTodayWib(new Date("2026-09-28T18:30:00Z")).toISOString()).toBe("2026-09-28T17:00:00.000Z");
    expect(startOfTodayWib(new Date("2026-09-28T10:00:00Z")).toISOString()).toBe("2026-09-27T17:00:00.000Z");
  });
});

describe("materi LMS & prioritas Hermes Desktop", () => {
  it("htmlToMarkdown mempertahankan heading, daftar, dan kode", async () => {
    const { htmlToMarkdown } = await import("@/lib/hermes-help/lms-source");
    const md = htmlToMarkdown("<h2>Langkah Awal</h2><p>Buka <strong>Hermes Desktop</strong> &amp; login.</p><ul><li>Klik Settings</li><li>Pilih Providers</li></ul>");
    expect(md).toContain("## Langkah Awal");
    expect(md).toContain("Buka **Hermes Desktop** & login.");
    expect(md).toContain("- Klik Settings");
  });

  it("resolveLmsUrl menerjemahkan URL netral ke LMS milik penanya", async () => {
    const { resolveLmsUrl } = await import("@/lib/hermes-help/lms-source");
    expect(resolveLmsUrl("lms://les1", "reg9")).toBe("/member/lms/reg9?lessonId=les1");
    expect(resolveLmsUrl("https://x.test/a", "reg9")).toBe("https://x.test/a");
  });

  it("selectLmsHits hanya mengambil materi yang benar-benar relevan", async () => {
    const { selectLmsHits } = await import("@/lib/hermes-help/retrieve");
    const docs = [
      { id: "a", url: "lms://a", section: "lms", title: "Setup Provider di Hermes Desktop", heading: "", content: "Buka Hermes Desktop, klik Settings lalu Providers, tempel API key OpenRouter." },
      { id: "b", url: "lms://b", section: "lms", title: "Pengantar Kelas", heading: "", content: "Selamat datang di kelas Zero Human Company. Hermes adalah agen AI." },
    ];
    const idx = new Bm25Index(docs);
    const q = ["cara pasang api key openrouter di hermes desktop"];
    expect(selectLmsHits(idx.search(q, 6), q).map((d) => d.id)).toEqual(["a"]);
    const off = ["cara install di linux server"];
    expect(selectLmsHits(idx.search(off, 6), off)).toEqual([]);
  });

  it("docWeight mendahulukan halaman Hermes Desktop", async () => {
    const { docWeight } = await import("@/lib/hermes-help/prompts");
    const base = { section: "user-guide", url: "https://x/docs/user-guide/cli", title: "CLI Interface", heading: "", content: "" };
    const desk = { ...base, url: "https://x/docs/user-guide/desktop", title: "Hermes Desktop" };
    expect(docWeight(desk)).toBeGreaterThan(docWeight(base));
  });

  it("formatContext menandai materi kelas & menyembunyikan URL internal", async () => {
    const { formatContext, toSourceRefs } = await import("@/lib/hermes-help/prompts");
    const d = { id: "a", url: "lms://a", section: "lms", title: "Setup Provider", heading: "", content: "isi" };
    expect(formatContext([d])).toContain("[1] MATERI KELAS — Setup Provider");
    expect(formatContext([d])).not.toContain("lms://");
    expect(toSourceRefs([d])[0].title).toBe("Materi kelas: Setup Provider");
  });
});

describe("dokumentasi OpenRouter", () => {
  const SAMPLE_OR = `# Quickstart
Source: https://openrouter.ai/docs/quickstart

Get started with OpenRouter. Create an API key at openrouter.ai/keys and buy credits on the Credits page.

<Tip>
  Set a credit limit on every key.
</Tip>

\`\`\`bash title="curl" lines theme={null}
curl https://openrouter.ai/api/v1/chat/completions
\`\`\`

# Python SDK
Source: https://openrouter.ai/docs/client-sdks/python/overview

Install the Python SDK with pip install openrouter and call the chat endpoint from your code base.
`;

  it("hanya mengindeks halaman yang relevan untuk pengguna & membersihkan MDX", async () => {
    const { chunkOpenRouterDocs } = await import("@/lib/hermes-help/chunker");
    const chunks = chunkOpenRouterDocs(SAMPLE_OR);
    expect(chunks.every((c) => c.url.startsWith("https://openrouter.ai/docs/quickstart"))).toBe(true);
    expect(chunks[0].title).toBe("OpenRouter: Quickstart");
    expect(chunks[0].section).toBe("openrouter");
    const all = chunks.map((c) => c.content).join("\n");
    expect(all).not.toContain("<Tip>");
    expect(all).not.toContain("theme={null}");
    expect(all).toContain("```bash");
  });

  it("isDesktopDoc hanya untuk panduan Hermes Desktop", async () => {
    const { isDesktopDoc } = await import("@/lib/hermes-help/prompts");
    expect(isDesktopDoc({ url: "https://h/docs/user-guide/desktop#settings--onboarding", title: "Hermes Desktop", heading: "Settings" })).toBe(true);
    expect(isDesktopDoc({ url: "https://h/docs/user-guide/features/acp#model-picker", title: "ACP Host Integration", heading: "Host setup > Buzz Desktop > Model picker" })).toBe(false);
  });

  it("catatan instruktur bawaan memuat rekomendasi blu BCA & masuk ke prompt", async () => {
    const { buildAnswerPrompt, DEFAULT_INSTRUCTOR_NOTES } = await import("@/lib/hermes-help/prompts");
    expect(DEFAULT_INSTRUCTOR_NOTES).toContain("blu by BCA Digital");
    const p = buildAnswerPrompt("[1] x", DEFAULT_INSTRUCTOR_NOTES);
    expect(p).toContain("CATATAN INSTRUKTUR");
    expect(p).toContain("blu by BCA Digital");
  });
});

describe("answer-check: nama milik peserta", () => {
  const ctx = "```bash\nhermes profile create coder       # creates profile + \"coder\" command alias\ncoder setup\ncoder chat\n```\nRun `hermes gateway setup` then pick WhatsApp.";

  it("menerima nama profile peserta & alias perintahnya", () => {
    const ans = "```bash\nhermes profile create katering\nkatering setup\nkatering chat\nhermes gateway setup\n```";
    expect(findUnverifiedCode(ans, ctx)).toEqual([]);
  });

  it("tetap menandai subperintah karangan", () => {
    const ans = "```bash\nhermes profile publish katering\nkatering deploy\nhermes gateway connect whatsapp\n```";
    expect(findUnverifiedCode(ans, ctx)).toEqual(["hermes profile publish katering", "katering deploy", "hermes gateway connect whatsapp"]);
  });
});

describe("konsultasi bisnis", () => {
  it("parseRewrite mengenali intent business", () => {
    expect(parseRewrite("INTENT: business\nQ: WhatsApp gateway").intent).toBe("business");
  });

  it("prompt bisnis memuat metode kelas & persona Raka", async () => {
    const { buildAnswerPrompt } = await import("@/lib/hermes-help/prompts");
    const biz = buildAnswerPrompt("[1] x", "", "business");
    expect(biz).toContain("Raka, Jetschool Assistant");
    expect(biz).toContain("Buat profile Hermes");
    expect(biz).toContain("MODE: KONSULTASI BISNIS");
    expect(buildAnswerPrompt("[1] x", "")).not.toContain("MODE: KONSULTASI BISNIS");
  });

  it("selectContext menyertakan anchor profile/skills/delegasi untuk pertanyaan bisnis", async () => {
    const { selectContext } = await import("@/lib/hermes-help/retrieve");
    const mk = (id: string, url: string, title: string, content: string) => ({ id, url, section: "user-guide", title, heading: "", content });
    const docs = [
      mk("p", "https://h/docs/user-guide/profiles", "Profiles: Running Multiple Agents", "Create a profile to run multiple agents, each profile has its own memory."),
      mk("s", "https://h/docs/user-guide/features/skills", "Skills System", "Install skills or create a skill for your agent."),
      mk("d", "https://h/docs/user-guide/features/delegation", "Subagent Delegation", "Delegate work to multiple agents in parallel."),
      mk("w", "https://h/docs/user-guide/messaging/whatsapp", "WhatsApp", "Connect the WhatsApp gateway to chat with customers."),
    ];
    const picked = selectContext({ docsIndex: new Bm25Index(docs), lmsIndex: null, question: "toko kue saya", queries: ["WhatsApp gateway customers"], intent: "business" });
    const ids = picked.map((d) => d.id);
    expect(ids).toEqual(expect.arrayContaining(["p", "s", "d", "w"]));
  });
});

describe("batasan & keamanan", () => {
  it("link dari domain asing tidak lolos verifikasi (cegah cache berisi link phishing)", async () => {
    const { findUntrustedLinks } = await import("@/lib/hermes-help/answer-check");
    const ctx = "See https://github.com/NousResearch/hermes-agent for source.";
    const ans =
      "Buka https://openrouter.ai/keys lalu https://hermes-agent.nousresearch.com/docs/quickstart. " +
      "Repo: https://github.com/NousResearch/hermes-agent. Klaim bonus di https://bonus-openrouter.xyz/claim.";
    expect(findUntrustedLinks(ans, ctx)).toEqual(["https://bonus-openrouter.xyz/claim"]);
  });

  it("hak memakai Raka sama dengan akses penuh LMS", async () => {
    const { hasHelpChatAccess } = await import("@/lib/hermes-help/quota");
    expect(hasHelpChatAccess({ status: "PAID" }, { price: 500000, certPrice: 0 })).toBe(true);
    expect(hasHelpChatAccess({ status: "REGISTERED" }, { price: 500000, certPrice: 0 })).toBe(false); // mode preview
    expect(hasHelpChatAccess({ status: "REGISTERED" }, { price: 0, certPrice: 50000 })).toBe(false); // sertifikat belum dibayar
    expect(hasHelpChatAccess({ status: "REGISTERED" }, { price: 0, certPrice: 0 })).toBe(true); // program gratis penuh
  });

  it("prompt memuat batasan penggunaan & keamanan data", async () => {
    const { buildAnswerPrompt } = await import("@/lib/hermes-help/prompts");
    const p = buildAnswerPrompt("", "");
    expect(p).toContain("BATASAN PENGGUNAAN");
    expect(p).toContain("spam");
    expect(p).toContain("KEAMANAN DATA");
  });
});

describe("prompt-first (Hermes Desktop tanpa terminal)", () => {
  it("blok ```prompt tidak dicocokkan sebagai perintah, perintah terminal ditandai", async () => {
    const { findTerminalCommands } = await import("@/lib/hermes-help/answer-check");
    const ok = "Salin ini ke Hermes Desktop:\n```prompt\nBuatkan profile baru bernama cs untuk layanan pelanggan.\n```";
    expect(findUnverifiedCode(ok, "")).toEqual([]);
    expect(findTerminalCommands(ok)).toEqual([]);
    const bad = "Jalankan:\n```bash\nhermes profile create cs\n```\natau `hermes gateway setup`.";
    expect(findTerminalCommands(bad)).toEqual(["hermes profile create cs", "hermes gateway setup"]);
  });

  it("prompt jawaban melarang terminal & meminta prompt siap salin", async () => {
    const { buildAnswerPrompt } = await import("@/lib/hermes-help/prompts");
    const p = buildAnswerPrompt("", "");
    expect(p).toContain("JANGAN PERNAH memberi perintah terminal");
    expect(p).toContain("PROMPT SIAP SALIN");
    expect(p).toContain("```prompt");
    expect(p).not.toContain("Cara CLI/terminal cukup disebut sebagai alternatif");
  });
});

describe("panduan kanal kelas", () => {
  it("WhatsApp biasa (scan QR) diutamakan, Cloud API tidak disarankan", async () => {
    const { buildAnswerPrompt, docWeight } = await import("@/lib/hermes-help/prompts");
    const p = buildAnswerPrompt("", "");
    expect(p).toContain("WhatsApp BIASA");
    expect(p).toContain("Linked Devices");
    expect(p).toContain("JANGAN menyarankan WhatsApp Business Cloud API");
    const base = { section: "user-guide", title: "WhatsApp", heading: "", content: "" };
    expect(docWeight({ ...base, url: "https://h/docs/user-guide/messaging/whatsapp" })).toBeGreaterThan(
      docWeight({ ...base, url: "https://h/docs/user-guide/messaging/whatsapp-cloud" }),
    );
  });
});
