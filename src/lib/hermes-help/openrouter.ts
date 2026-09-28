// Klien minimal OpenRouter (Chat Completions, kompatibel OpenAI) — tanpa SDK.
// Hanya dipakai di server; OPENROUTER_API_KEY tidak pernah dikirim ke browser.

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

export const HELP_MODEL = process.env.HERMES_HELP_MODEL || "z-ai/glm-5.3-flash";

// GLM 5.3 Flash dilayani ±30 provider dengan harga berbeda jauh (input $0,045–$0,75 per 1 jt token).
// max_price → provider mahal tidak pernah dipakai walau sedang jadi fallback, jadi sort=latency
// (terukur 2,6–3 dtk vs 6+ dtk untuk sort=price) tetap di kisaran harga yang sama.
// data_collection=deny → hanya provider yang tidak melatih model dari prompt peserta.
const PROVIDER = {
  sort: process.env.HERMES_HELP_PROVIDER_SORT || "latency",
  data_collection: "deny",
  max_price: { prompt: 0.2, completion: 0.6 },
};

export type ContentPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };
export type ChatMessage = { role: "system" | "user" | "assistant"; content: string | ContentPart[] };

export type Usage = { promptTokens: number; completionTokens: number; costUsd: number };
const ZERO: Usage = { promptTokens: 0, completionTokens: 0, costUsd: 0 };

type RawUsage = { prompt_tokens?: number; completion_tokens?: number; cost?: number };

function toUsage(u: RawUsage | undefined): Usage {
  return u
    ? { promptTokens: u.prompt_tokens ?? 0, completionTokens: u.completion_tokens ?? 0, costUsd: u.cost ?? 0 }
    : ZERO;
}

export function addUsage(a: Usage, b: Usage): Usage {
  return {
    promptTokens: a.promptTokens + b.promptTokens,
    completionTokens: a.completionTokens + b.completionTokens,
    costUsd: a.costUsd + b.costUsd,
  };
}

type Options = {
  messages: ChatMessage[];
  maxTokens: number;
  temperature: number;
  signal?: AbortSignal;
};

function requestBody(o: Options, stream: boolean) {
  return JSON.stringify({
    model: HELP_MODEL,
    messages: o.messages,
    max_tokens: o.maxTokens,
    temperature: o.temperature,
    stream,
    // GLM 5.3 Flash WAJIB reasoning dengan default effort "max" — dibiarkan, token reasoning
    // (ditagih sebagai output) bisa ratusan per jawaban. "low" + exclude: murah & cepat.
    reasoning: { effort: "low", exclude: true },
    provider: PROVIDER,
    usage: { include: true },
  });
}

function headers() {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY belum diisi di .env");
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    "HTTP-Referer": process.env.NEXT_PUBLIC_BASE_URL ||"https://jetschool.id",
    "X-Title": "Jetschool Academy - Raka Assistant",
  };
}

/** Batalkan bila klien menutup koneksi ATAU provider macet melewati batas waktu. */
function withTimeout(signal: AbortSignal | undefined, ms: number): AbortSignal {
  const timeout = AbortSignal.timeout(ms);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

async function failure(res: Response): Promise<Error> {
  const text = await res.text().catch(() => "");
  return new Error(`OpenRouter ${res.status}: ${text.slice(0, 300)}`);
}

export async function complete(o: Options): Promise<{ text: string; usage: Usage }> {
  const res = await fetch(ENDPOINT, { method: "POST", headers: headers(), body: requestBody(o, false), signal: withTimeout(o.signal, 30_000) });
  if (!res.ok) throw await failure(res);
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[]; usage?: RawUsage };
  return { text: json.choices?.[0]?.message?.content ?? "", usage: toUsage(json.usage) };
}

/** Streaming SSE; `onDelta` dipanggil per potongan teks jawaban. */
export async function streamComplete(
  o: Options,
  onDelta: (text: string) => void,
): Promise<{ text: string; usage: Usage }> {
  const res = await fetch(ENDPOINT, { method: "POST", headers: headers(), body: requestBody(o, true), signal: withTimeout(o.signal, 60_000) });
  if (!res.ok || !res.body) throw await failure(res);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let text = "";
  let usage = ZERO;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith("data:")) continue; // komentar keep-alive ": OPENROUTER PROCESSING"
      const data = line.slice(5).trim();
      if (data === "[DONE]") continue;
      let chunk: { choices?: { delta?: { content?: string } }[]; usage?: RawUsage; error?: { message?: string } };
      try {
        chunk = JSON.parse(data);
      } catch {
        continue;
      }
      if (chunk.error) throw new Error(`OpenRouter: ${chunk.error.message ?? "stream error"}`);
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) {
        text += delta;
        onDelta(delta);
      }
      if (chunk.usage) usage = toUsage(chunk.usage);
    }
  }
  return { text, usage };
}
