import Link from "next/link";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { getHelpSettings } from "@/lib/hermes-help/docs-store";
import { HELP_MODEL } from "@/lib/hermes-help/openrouter";
import { startOfTodayWib } from "@/lib/hermes-help/quota";
import { clearHelpChatCache, saveHelpChatQuota, saveInstructorNotes, syncHelpDocsNow, toggleHelpChat } from "../../help-chat-actions";
import { DEFAULT_INSTRUCTOR_NOTES } from "@/lib/hermes-help/prompts";
import ConfirmButton from "@/components/ConfirmButton";

export const dynamic = "force-dynamic";

const USD_IDR = 16500; // perkiraan kasar untuk tampilan saja

const FILTERS = {
  all: { label: "Semua", where: {} },
  neg: { label: "Dinilai tidak membantu", where: { feedback: -1 } },
  unverified: { label: "Perintah tak terverifikasi", where: { unverified: { not: Prisma.AnyNull } } },
  error: { label: "Gagal", where: { intent: "error" } },
} as const;

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

const fmtDate = new Intl.DateTimeFormat("id-ID", {
  day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta",
});

export default async function AdminBantuanAi({ searchParams }: {
  searchParams: Promise<{ f?: string; ok?: string; e?: string; n?: string }>;
}) {
  await requireAdmin();
  const { f, ok, e, n } = await searchParams;
  const filterKey = (f && f in FILTERS ? f : "all") as keyof typeof FILTERS;
  const since7 = daysAgo(7);

  const [settings, today, week, weekCached, negatives, cacheCount, logs] = await Promise.all([
    getHelpSettings(),
    prisma.helpChatLog.count({ where: { createdAt: { gte: startOfTodayWib() } } }),
    prisma.helpChatLog.aggregate({ where: { createdAt: { gte: since7 } }, _count: true, _sum: { costUsd: true }, _avg: { latencyMs: true } }),
    prisma.helpChatLog.count({ where: { createdAt: { gte: since7 }, cached: true } }),
    prisma.helpChatLog.count({ where: { createdAt: { gte: since7 }, feedback: -1 } }),
    prisma.helpChatCache.count(),
    prisma.helpChatLog.findMany({
      where: FILTERS[filterKey].where,
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true, identifier: true, question: true, answer: true, intent: true, cached: true, hasImage: true,
        unverified: true, costUsd: true, latencyMs: true, feedback: true, error: true, createdAt: true,
      },
    }),
  ]);

  const weekCost = week._sum.costUsd ?? 0;
  const perQuestion = week._count - weekCached > 0 ? weekCost / (week._count - weekCached) : 0;
  const hitRate = week._count ? Math.round((weekCached / week._count) * 100) : 0;

  return (
    <>
      <div className="adm-head">
        <h1>Raka - Jetschool Assistant</h1>
      </div>

      {ok === "quota" && <div className="adm-alert ok">Kuota harian disimpan.</div>}
      {ok === "sync" && <div className="adm-alert ok">Dokumentasi disinkron — {n} potongan.</div>}
      {ok === "cache" && <div className="adm-alert ok">Cache jawaban dikosongkan.</div>}
      {ok === "notes" && <div className="adm-alert ok">Catatan instruktur disimpan.</div>}
      {e === "quota" && <div className="adm-alert err">Kuota harus angka 1–500.</div>}
      {e === "sync" && <div className="adm-alert err">Sinkron gagal: {settings.syncError}</div>}
      {!process.env.OPENROUTER_API_KEY && (
        <div className="adm-alert err">OPENROUTER_API_KEY belum diisi di environment server — widget tidak tampil di LMS.</div>
      )}

      <div className="adm-stats">
        <div className="adm-stat"><b>{today}</b><span>Pertanyaan hari ini</span></div>
        <div className="adm-stat">
          <b>${weekCost.toFixed(4)}</b>
          <span>Biaya 7 hari (±Rp{Math.round(weekCost * USD_IDR).toLocaleString("id-ID")})</span>
        </div>
        <div className="adm-stat">
          <b>{hitRate}%</b>
          <span>Dijawab dari cache (7 hari, {week._count} total)</span>
        </div>
        <div className="adm-stat">
          <b>{negatives}</b>
          <span>Dinilai tidak membantu (7 hari)</span>
        </div>
      </div>

      <section className="form-section">
        <header>
          <h3>Pengaturan</h3>
          <p>
            Model {HELP_MODEL} via OpenRouter · rata-rata ${perQuestion.toFixed(5)} per pertanyaan non-cache
            {week._avg.latencyMs ? ` · ${(week._avg.latencyMs / 1000).toFixed(1)} dtk` : ""}
          </p>
        </header>
        <div style={{ padding: "1.2rem 1.4rem", display: "flex", flexWrap: "wrap", gap: "1.5rem", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div>
            <strong>Widget di LMS: {settings.enabled ? "Aktif" : "Nonaktif"}</strong>
            <p className="muted" style={{ margin: ".3rem 0 .7rem", fontSize: ".82rem" }}>
              Tombol &quot;Tanya Raka&quot; di pojok kanan bawah halaman materi LMS.
            </p>
            <form action={toggleHelpChat}>
              <button type="submit" className={`btn btn-sm ${settings.enabled ? "btn-line" : "btn-purple"}`}>
                {settings.enabled ? "Nonaktifkan" : "Aktifkan"}
              </button>
            </form>
          </div>
          <form action={saveHelpChatQuota} style={{ display: "flex", gap: ".6rem", alignItems: "flex-end" }}>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="dailyQuota">Kuota per peserta per hari</label>
              <input id="dailyQuota" name="dailyQuota" type="number" min={1} max={500} defaultValue={settings.dailyQuota} style={{ width: "8rem" }} />
            </div>
            <button type="submit" className="btn btn-sm btn-purple">Simpan</button>
          </form>
        </div>
      </section>

      <section className="form-section">
        <header>
          <h3>Catatan Instruktur</h3>
          <p>Selalu disertakan ke AI dan jadi rujukan jawaban — mis. rekomendasi pembayaran, model yang dipakai di kelas. Satu poin per baris.</p>
        </header>
        <form action={saveInstructorNotes} style={{ padding: "1.2rem 1.4rem" }}>
          <div className="field" style={{ margin: 0 }}>
            <textarea
              name="instructorNotes"
              rows={5}
              maxLength={3000}
              defaultValue={settings.instructorNotes ?? DEFAULT_INSTRUCTOR_NOTES}
              style={{ width: "100%" }}
            />
          </div>
          <div style={{ display: "flex", gap: ".6rem", alignItems: "center", marginTop: ".7rem", flexWrap: "wrap" }}>
            <button type="submit" className="btn btn-sm btn-purple">Simpan Catatan</button>
            <span className="muted" style={{ fontSize: ".78rem" }}>
              Kosongkan lalu simpan untuk kembali ke teks bawaan. Jawaban cache otomatis diperbarui setelah catatan diubah.
            </span>
          </div>
        </form>
      </section>

      <section className="form-section">
        <header>
          <h3>Dokumentasi Resmi</h3>
          <p>Sumber: Hermes Agent (hermes-agent.nousresearch.com/docs) &amp; OpenRouter (openrouter.ai/docs) · dicek ulang otomatis tiap 7 hari</p>
        </header>
        <div style={{ padding: "1.2rem 1.4rem", display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: ".88rem", lineHeight: 1.7 }}>
            <div><strong>{settings.docsChunkCount.toLocaleString("id-ID")}</strong> potongan dokumen</div>
            <div className="muted">
              Terakhir dicek: {settings.docsSyncedAt ? fmtDate.format(settings.docsSyncedAt) : "belum pernah (otomatis saat pertanyaan pertama)"}
            </div>
            {settings.syncError && <div style={{ color: "var(--red)" }}>Error terakhir: {settings.syncError}</div>}
            <div className="muted">{cacheCount} jawaban tersimpan di cache</div>
          </div>
          <div style={{ display: "flex", gap: ".6rem", flexWrap: "wrap" }}>
            <form action={syncHelpDocsNow}>
              <button type="submit" className="btn btn-sm btn-line">Sinkron sekarang</button>
            </form>
            <form action={clearHelpChatCache}>
              <ConfirmButton className="btn btn-sm btn-line" message="Kosongkan semua jawaban cache? Pertanyaan berikutnya akan dijawab ulang oleh AI (memakai token).">
                Kosongkan cache
              </ConfirmButton>
            </form>
          </div>
        </div>
      </section>

      <div className="adm-head" style={{ marginTop: "2rem" }}>
        <h2 style={{ margin: 0, fontSize: "1.15rem" }}>Pertanyaan Terbaru</h2>
        <div style={{ display: "flex", gap: ".4rem", flexWrap: "wrap" }}>
          {Object.entries(FILTERS).map(([k, v]) => (
            <Link key={k} href={k === "all" ? "/webadmin/bantuan-ai" : `/webadmin/bantuan-ai?f=${k}`} className={`btn btn-sm ${k === filterKey ? "btn-purple" : "btn-line"}`}>
              {v.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr><th>Waktu</th><th>Peserta</th><th>Pertanyaan &amp; Jawaban</th><th>Status</th><th>Biaya</th></tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr><td colSpan={5} className="muted" style={{ textAlign: "center", padding: "2rem" }}>Belum ada data.</td></tr>
            )}
            {logs.map((l) => (
              <tr key={l.id}>
                <td data-label="Waktu" className="muted" style={{ whiteSpace: "nowrap" }}>{fmtDate.format(l.createdAt)}</td>
                <td data-label="Peserta" className="muted" style={{ maxWidth: "11rem", overflowWrap: "anywhere" }}>{l.identifier}</td>
                <td data-label="Pertanyaan" style={{ maxWidth: "34rem" }}>
                  <div style={{ fontWeight: 600 }}>{l.hasImage ? "[gambar] " : ""}{l.question}</div>
                  {l.answer && (
                    <details style={{ marginTop: ".3rem" }}>
                      <summary className="muted" style={{ cursor: "pointer", fontSize: ".8rem" }}>Lihat jawaban</summary>
                      <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: ".8rem", margin: ".4rem 0 0" }}>{l.answer}</pre>
                    </details>
                  )}
                  {Array.isArray(l.unverified) && l.unverified.length > 0 && (
                    <div style={{ fontSize: ".78rem", color: "#7A4A0B", marginTop: ".3rem" }}>
                      Tidak ada di dokumen: {(l.unverified as string[]).map((u) => `\`${u}\``).join(", ")}
                    </div>
                  )}
                  {l.error && <div style={{ fontSize: ".78rem", color: "var(--red)", marginTop: ".3rem" }}>{l.error}</div>}
                </td>
                <td data-label="Status" style={{ whiteSpace: "nowrap", fontSize: ".82rem" }}>
                  {l.cached ? "Cache" : l.intent === "hermes" ? "AI" : l.intent}
                  {l.feedback === 1 && " · 👍"}
                  {l.feedback === -1 && " · 👎"}
                  <div className="muted">{(l.latencyMs / 1000).toFixed(1)} dtk</div>
                </td>
                <td data-label="Biaya" className="muted" style={{ whiteSpace: "nowrap" }}>${l.costUsd.toFixed(5)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
