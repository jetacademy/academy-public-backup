import { Agent, fetch as undiciFetch } from "undici";

/* Google ID token ter-verifikasi melalui tokeninfo. Host prod (Hostinger shared)
   kadang gagal route IPv6 ke oauth2.googleapis.com → fetch throw → login/daftar gagal.
   Force IPv4 + timeout + 1 retry (pola sama seperti fix IPv6 WA 408).
   Tokeninfo = endpoint opsional Google; kalau proses ini gagal total, error jujur
   dikembalikan dan user bisa login OTP.
   Dipakai bersama oleh: src/app/member/actions.ts (login) & src/app/api/register (daftar). */
const GOOGLE_TOKENINFO_V4 = new Agent({
  connect: { family: 4 },
  headersTimeout: 15_000,
  bodyTimeout: 15_000,
  connectTimeout: 15_000,
});

export async function fetchGoogleTokeninfo(credential: string) {
  const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`;
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await undiciFetch(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
        dispatcher: GOOGLE_TOKENINFO_V4,
      });
    } catch (err) {
      lastErr = err;
      // retry sekali untuk kasus network; fallback ke fetch global (yang di-patch Next.js)
      if (attempt === 0) {
        try {
          return await fetch(url, {
            cache: "no-store",
            signal: AbortSignal.timeout(15_000),
          });
        } catch { /* lempar lastErr dari iterasi pertama */ }
      }
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  throw lastErr;
}
