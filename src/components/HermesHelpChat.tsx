"use client";

// Widget "Tanya Raka" (Raka - Jetschool Assistant) di LMS: chat bantuan Hermes Agent & OpenRouter
// berbasis dokumentasi resmi + materi kelas.
// Jawaban mengalir (stream NDJSON dari /api/member/help-chat), bisa melampirkan screenshot,
// dan tiap jawaban bisa dinilai 👍/👎 (👎 membuang jawaban itu dari cache server).

import { useCallback, useEffect, useRef, useState } from "react";
import HermesChatMarkdown, { linkProps } from "./HermesChatMarkdown";

type Source = { n: number; title: string; url: string };
type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  image?: string | null; // pratinjau (tidak disimpan ke sessionStorage)
  sources?: Source[];
  logId?: string;
  cached?: boolean;
  unverified?: string[];
  feedback?: 1 | -1;
  error?: boolean;
  pending?: boolean;
};

const STORE_KEY = "jsa-hermes-help";
const SUGGESTIONS = [
  "Cara install Hermes Desktop di Windows",
  "Cara menghubungkan Hermes Desktop ke OpenRouter",
  "Cara top up kredit OpenRouter",
  "Cara memilih model AI di Hermes Desktop",
  "Cara menghubungkan Hermes Desktop ke Telegram",
  "Apa itu skills dan bagaimana cara membuatnya?",
];

const uid = () => Math.random().toString(36).slice(2, 10);

/** Kecilkan gambar di browser (maks 1280px, JPEG) supaya upload cepat & token gambar hemat. */
async function compressImage(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Gambar tidak bisa dibaca"));
      el.src = url;
    });
    const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Browser tidak mendukung kompres gambar");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    let quality = 0.85;
    let data = canvas.toDataURL("image/jpeg", quality);
    while (data.length > 1_400_000 && quality > 0.4) {
      quality -= 0.15;
      data = canvas.toDataURL("image/jpeg", quality);
    }
    return data;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function HermesHelpChat({ registrationId }: { registrationId: string }) {
  const [open, setOpen] = useState(false);
  // Pulihkan percakapan tab ini. Aman dari hydration mismatch: pesan hanya dirender saat panel
  // dibuka (selalu tertutup di render pertama). sessionStorage bisa diblokir — selalu try/catch.
  const [messages, setMessages] = useState<Msg[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = sessionStorage.getItem(STORE_KEY);
      return saved ? (JSON.parse(saved) as Msg[]).filter((m) => !m.pending) : [];
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (busy) return;
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify(messages.slice(-30).map((m) => ({ ...m, image: undefined }))));
    } catch {}
  }, [messages, busy]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    fetch("/api/member/help-chat")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setRemaining(d.remaining);
        if (!d.enabled) setNotice("Raka sedang dinonaktifkan admin.");
      })
      .catch(() => {});
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, open]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const patch = (id: string, fn: (m: Msg) => Msg) => setMessages((ms) => ms.map((m) => (m.id === id ? fn(m) : m)));

  const send = useCallback(
    async (text: string) => {
      const question = text.trim();
      if ((!question && !image) || busy) return;
      setNotice(null);

      const history = messages
        .filter((m) => !m.error && !m.pending && m.content)
        .slice(-4)
        .map((m) => ({ role: m.role, content: m.content }));
      const userMsg: Msg = { id: uid(), role: "user", content: question, image };
      const botId = uid();
      setMessages((ms) => [...ms, userMsg, { id: botId, role: "assistant", content: "", pending: true }]);
      setInput("");
      setImage(null);
      setBusy(true);

      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const res = await fetch("/api/member/help-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: question, image: userMsg.image, history, registrationId }),
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => ({}));
          if (typeof data.remaining === "number") setRemaining(data.remaining);
          throw new Error(data.error || "Gagal menghubungi asisten.");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, nl);
            buf = buf.slice(nl + 1);
            if (!line.trim()) continue;
            const ev = JSON.parse(line);
            if (ev.t === "meta") patch(botId, (m) => ({ ...m, sources: ev.sources, cached: ev.cached }));
            else if (ev.t === "delta") patch(botId, (m) => ({ ...m, content: m.content + ev.v }));
            else if (ev.t === "done") {
              patch(botId, (m) => ({ ...m, pending: false, logId: ev.logId, unverified: ev.unverified }));
              if (typeof ev.remaining === "number") setRemaining(ev.remaining);
            } else if (ev.t === "error") throw new Error(ev.message);
          }
        }
        patch(botId, (m) => ({ ...m, pending: false }));
      } catch (err) {
        if (ctrl.signal.aborted) {
          patch(botId, (m) => ({ ...m, pending: false, content: m.content || "(dibatalkan)" }));
        } else {
          const msg = err instanceof Error ? err.message : "Terjadi kesalahan.";
          patch(botId, (m) => ({ ...m, pending: false, error: true, content: m.content ? `${m.content}\n\n${msg}` : msg }));
        }
      } finally {
        setBusy(false);
        abortRef.current = null;
        inputRef.current?.focus();
      }
    },
    [busy, image, messages, registrationId],
  );

  const rate = async (m: Msg, value: 1 | -1) => {
    if (!m.logId || m.feedback) return;
    patch(m.id, (x) => ({ ...x, feedback: value }));
    try {
      await fetch("/api/member/help-chat/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logId: m.logId, value }),
      });
    } catch {}
  };

  const attach = async (file: File | undefined | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setNotice("Hanya file gambar (screenshot) yang bisa dilampirkan.");
      return;
    }
    try {
      setImage(await compressImage(file));
      setNotice(null);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Gambar gagal diproses.");
    }
  };

  const clearChat = () => {
    abortRef.current?.abort();
    setMessages([]);
    try {
      sessionStorage.removeItem(STORE_KEY);
    } catch {}
  };

  return (
    <>
      {!open && (
        <button type="button" className="hh-fab" onClick={() => setOpen(true)} aria-label="Buka Raka - Jetschool Assistant">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 14h5m-9 6 2.6-2.6A2 2 0 0 1 8 17h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v14z" />
          </svg>
          <span>Tanya Raka</span>
        </button>
      )}

      {open && (
        <section className="hh-panel" role="dialog" aria-label="Raka - Jetschool Assistant">
          <header className="hh-head">
            <div>
              <strong>Raka - Jetschool Assistant</strong>
              <small>Panduan Hermes Agent &amp; OpenRouter</small>
            </div>
            <div className="hh-head-actions">
              {messages.length > 0 && (
                <button type="button" onClick={clearChat} title="Mulai percakapan baru" aria-label="Mulai percakapan baru">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v6h6M20 20v-6h-6M5.5 15a7 7 0 0 0 12.1 2.5M18.5 9A7 7 0 0 0 6.4 6.5" />
                  </svg>
                </button>
              )}
              <button type="button" onClick={() => setOpen(false)} title="Tutup" aria-label="Tutup">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
          </header>

          <div className="hh-list" ref={listRef} aria-live="polite">
            {messages.length === 0 && (
              <div className="hh-empty">
                <p>
                  Halo! Tanyakan apa saja tentang cara install, konfigurasi, atau memakai <strong>Hermes Agent</strong> dan <strong>OpenRouter</strong>.
                  Kamu juga bisa melampirkan screenshot error.
                </p>
                <div className="hh-chips">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} type="button" onClick={() => send(s)} disabled={busy}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="hh-msg hh-user">
                  {m.image && <img src={m.image} alt="Lampiran" className="hh-thumb" />}
                  {m.content && <p>{m.content}</p>}
                </div>
              ) : (
                <div key={m.id} className={`hh-msg hh-bot${m.error ? " hh-error" : ""}`}>
                  {m.pending && !m.content ? (
                    <div className="hh-typing" aria-label="Sedang mencari di dokumentasi">
                      <span /> <span /> <span />
                      <em>Mencari di dokumentasi…</em>
                    </div>
                  ) : (
                    <HermesChatMarkdown text={m.content} sources={m.sources ?? []} />
                  )}

                  {!m.pending && m.unverified && m.unverified.length > 0 && (
                    <p className="hh-warn">
                      Sebagian perintah di atas tidak ditemukan persis di dokumentasi. Cocokkan dulu dengan halaman sumber sebelum dijalankan.
                    </p>
                  )}

                  {!m.pending && m.sources && m.sources.length > 0 && (
                    <details className="hh-sources">
                      <summary>Sumber ({m.sources.length})</summary>
                      <ol>
                        {m.sources.map((s) => (
                          <li key={s.n} value={s.n}>
                            <a href={s.url} {...linkProps(s.url)}>{s.title}</a>
                          </li>
                        ))}
                      </ol>
                    </details>
                  )}

                  {!m.pending && m.logId && (
                    <div className="hh-rate">
                      {m.feedback ? (
                        <span>{m.feedback === 1 ? "Terima kasih atas masukannya." : "Terima kasih, jawaban ini akan kami perbaiki."}</span>
                      ) : (
                        <>
                          <span>Membantu?</span>
                          <button type="button" onClick={() => rate(m, 1)} aria-label="Membantu">👍</button>
                          <button type="button" onClick={() => rate(m, -1)} aria-label="Tidak membantu">👎</button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ),
            )}
          </div>

          {notice && <p className="hh-notice">{notice}</p>}

          <form
            className="hh-form"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            {image && (
              <div className="hh-attach">
                <img src={image} alt="Lampiran" />
                <button type="button" onClick={() => setImage(null)} aria-label="Hapus lampiran">×</button>
              </div>
            )}
            <div className="hh-input-row">
              <button type="button" className="hh-icon-btn" onClick={() => fileRef.current?.click()} disabled={busy} title="Lampirkan screenshot" aria-label="Lampirkan screenshot">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.6-4.6a2 2 0 0 1 2.8 0L16 16m-2-2 1.6-1.6a2 2 0 0 1 2.8 0L20 14M14 8h.01M6 20h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z" />
                </svg>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                hidden
                onChange={(e) => {
                  attach(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              <textarea
                ref={inputRef}
                value={input}
                rows={1}
                maxLength={1000}
                placeholder="Tulis pertanyaan… (bisa tempel screenshot)"
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                onPaste={(e) => {
                  const file = [...e.clipboardData.items].find((it) => it.type.startsWith("image/"))?.getAsFile();
                  if (file) {
                    e.preventDefault();
                    attach(file);
                  }
                }}
              />
              {busy ? (
                <button type="button" className="hh-send" onClick={() => abortRef.current?.abort()} aria-label="Hentikan">
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2" /></svg>
                </button>
              ) : (
                <button type="submit" className="hh-send" disabled={!input.trim() && !image} aria-label="Kirim">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </button>
              )}
            </div>
            <small className="hh-foot">
              Jawaban AI bisa keliru — cek tautan sumber.{remaining !== null && ` Sisa kuota hari ini: ${remaining}.`}
            </small>
          </form>
        </section>
      )}
    </>
  );
}
