import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatHariTanggal } from "@/lib/format";
import { sendBroadcast } from "../../actions";
import BroadcastButton from "./BroadcastButton";
import BroadcastReport from "./BroadcastReport";
import { getBroadcastReport, getLatestBroadcastReport } from "@/lib/broadcast-store";

export const dynamic = "force-dynamic";

type BroadcastMessageType = "zoom" | "grup" | "custom";

const MESSAGE_TYPE_LABEL: Record<BroadcastMessageType, string> = {
  zoom: "Link Zoom",
  grup: "Link Grup WA",
  custom: "Pesan Custom",
};

/** Cari program yang dimaksud (lengkap dengan zoomLink/waGroupLink untuk preview). */
async function getProgramDetail(id: string) {
  return prisma.program.findUnique({
    where: { id },
    select: { id: true, title: true, zoomLink: true, waGroupLink: true, price: true },
  });
}

/** Hitung jumlah penerima broadcast yang valid sesuai jenis program (gratis vs berbayar). */
async function countRecipients(programId?: string, batchId?: string): Promise<number> {
  let isFree = false;
  if (programId) {
    const prog = await prisma.program.findUnique({ where: { id: programId }, select: { price: true } });
    isFree = prog ? prog.price === 0 : false;
  } else if (batchId) {
    const batch = await prisma.programBatch.findUnique({
      where: { id: batchId },
      include: { program: { select: { price: true } } },
    });
    isFree = batch ? batch.program.price === 0 : false;
  }

  const statusFilter = isFree ? ["PAID", "PASSED", "REGISTERED"] : ["PAID", "PASSED"];
  const where: Record<string, unknown> = {
    status: { in: statusFilter },
  };
  if (batchId) where.batchId = batchId;
  else if (programId) where.programId = programId;

  return prisma.registration.count({ where });
}

export default async function AdminBroadcast({
  searchParams,
}: {
  searchParams: Promise<{ program?: string; batch?: string; type?: string; ok?: string; sent?: string; failed?: string; total?: string; reportId?: string; e?: string }>;
}) {
  const sp = await searchParams;
  const selectedProgramId = sp.program ?? "";
  const selectedBatchId = sp.batch ?? "";
  const selectedType = (sp.type ?? "") as BroadcastMessageType | "";
  const error = sp.e ?? "";

  // ── Laporan broadcast (jika baru saja dikirim atau ada reportId) ──
  const activeReport = sp.reportId
    ? getBroadcastReport(sp.reportId)
    : sp.ok === "1"
    ? getLatestBroadcastReport()
    : null;

  // ── Fetch data ──────────────────────────────────────────────
  const [programs, allBatches, programDetail, batchDetail, recipientCount] = await Promise.all([
    prisma.program.findMany({ orderBy: { title: "asc" }, take: 200, select: { id: true, title: true, price: true } }),
    prisma.programBatch.findMany({
      orderBy: { scheduleAt: "desc" },
      select: { id: true, scheduleAt: true, programId: true, program: { select: { title: true } } },
    }),
    selectedProgramId ? getProgramDetail(selectedProgramId) : null,
    selectedBatchId
      ? prisma.programBatch.findUnique({
          where: { id: selectedBatchId },
          include: { program: { select: { title: true, zoomLink: true, waGroupLink: true } } },
        })
      : null,
    selectedProgramId || selectedBatchId
      ? countRecipients(selectedProgramId || undefined, selectedBatchId || undefined)
      : Promise.resolve(0),
  ]);

  // Filter batch yang relevan jika program dipilih
  const filteredBatches = selectedProgramId
    ? allBatches.filter((b) => b.programId === selectedProgramId)
    : allBatches;

  // ── Build target info & message preview ─────────────────────
  let targetTitle = programDetail?.title ?? "";
  let targetZoomLink = programDetail?.zoomLink ?? null;
  let targetWaGroupLink = programDetail?.waGroupLink ?? null;

  if (batchDetail) {
    targetTitle = `${batchDetail.program.title} (${batchDetail.name || formatHariTanggal(batchDetail.scheduleAt)})`;
    targetZoomLink = batchDetail.zoomLink || batchDetail.program.zoomLink;
    targetWaGroupLink = batchDetail.waGroupLink || batchDetail.program.waGroupLink;
  }

  const messagePreview =
    selectedType === "zoom"
      ? targetZoomLink
        ? `Halo {{name}},\n\nBerikut link Zoom untuk program "${targetTitle}":\n${targetZoomLink}\n\nSampai jumpa! 😊`
        : null
      : selectedType === "grup"
        ? targetWaGroupLink
          ? `Halo {{name}},\n\nBergabunglah dengan grup WhatsApp "${targetTitle}":\n${targetWaGroupLink}\n\nDiskusikan materi di grup ya! 😊`
          : null
      : null;

  return (
    <>
      <div className="adm-head">
        <h1>📢 Broadcast WhatsApp</h1>
      </div>

      {/* ── Laporan detail hasil pengiriman & kegagalan ───────── */}
      {activeReport ? (
        <BroadcastReport report={activeReport} />
      ) : sp.ok === "1" ? (
        <div className="alert alert-success" style={{ marginBottom: "1.4rem", padding: "1rem", background: "#dcfce7", border: "1px solid #86efac", borderRadius: 8 }}>
          <strong>✅ Broadcast berhasil dikirim!</strong>
          <br />
          <span style={{ fontSize: ".9rem" }}>
            {sp.total} penerima &middot; {sp.sent} terkirim
            {Number(sp.failed ?? 0) > 0 ? <span style={{ color: "#dc2626" }}> &middot; {sp.failed} gagal</span> : ""}
          </span>
        </div>
      ) : null}

      {error && (
        <div className="alert alert-error" style={{ marginBottom: "1.4rem", padding: "1rem", background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8 }}>
          <strong>❌ {error}</strong>
        </div>
      )}

      {/* ── Form filter / preview ─────────────────────────────── */}
      <form method="get" className="adm-filter-row" style={{ marginBottom: "1.6rem" }}>
        <select name="program" defaultValue={selectedProgramId} style={{ minWidth: "14rem" }}>
          <option value="">Semua Program</option>
          {programs.map((p) => (
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
        </select>

        <select name="batch" defaultValue={selectedBatchId} style={{ minWidth: "14rem" }}>
          <option value="">Semua Batch (semua peserta program)</option>
          {filteredBatches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.program.title} — {formatHariTanggal(b.scheduleAt)}
            </option>
          ))}
        </select>

        <select name="type" defaultValue={selectedType}>
          <option value="">Pilih tipe pesan...</option>
          <option value="zoom">Link Zoom</option>
          <option value="grup">Link Grup WA</option>
          <option value="custom">Pesan Custom</option>
        </select>

        <button type="submit" className="btn btn-sm">Preview</button>
      </form>

      {/* ── Recipient count ──────────────────────────────────── */}
      {(selectedProgramId || selectedBatchId) && (
        <div style={{
          background: "var(--bg-soft)",
          padding: "1rem 1.2rem",
          borderRadius: 8,
          marginBottom: "1.6rem",
          border: "1px solid var(--border)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: ".6rem" }}>
            <span>
              <strong>🎯 Target Penerima:</strong>{" "}
              {targetTitle || "—"}
            </span>
            <span style={{
              background: "var(--yellow)",
              color: "#000",
              fontWeight: 700,
              padding: ".3rem .8rem",
              borderRadius: 999,
              fontSize: ".85rem",
            }}>
              {recipientCount} penerima
            </span>
          </div>
        </div>
      )}

      {/* ── Send form ─────────────────────────────────────────── */}
      <form
        action={sendBroadcast}
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: "1.6rem",
          maxWidth: 720,
        }}
      >
        <input type="hidden" name="programId" value={selectedProgramId} />
        <input type="hidden" name="batchId" value={selectedBatchId} />
        <input type="hidden" name="messageType" value={selectedType} />

        {/* ── Ringkasan ──────────────────────────────────────── */}
        <div style={{ marginBottom: "1.4rem" }}>
          <h3 style={{ margin: "0 0 .4rem" }}>Ringkasan Broadcast</h3>
          <table style={{ fontSize: ".9rem", width: "100%" }}>
            <tbody>
              <tr>
                <td style={{ padding: ".25rem .5rem .25rem 0", color: "var(--ink-soft)", width: 140 }}>Target</td>
                <td style={{ padding: ".25rem 0", fontWeight: 600 }}>
                  {targetTitle
                    ? (selectedBatchId ? `Batch — ${targetTitle}` : `Program — ${targetTitle}`)
                    : <span style={{ color: "var(--ink-faint)" }}>Belum dipilih</span>}
                </td>
              </tr>
              <tr>
                <td style={{ padding: ".25rem .5rem .25rem 0", color: "var(--ink-soft)" }}>Tipe Pesan</td>
                <td style={{ padding: ".25rem 0", fontWeight: 600 }}>
                  {selectedType ? MESSAGE_TYPE_LABEL[selectedType] : <span style={{ color: "var(--ink-faint)" }}>Belum dipilih</span>}
                </td>
              </tr>
              <tr>
                <td style={{ padding: ".25rem .5rem .25rem 0", color: "var(--ink-soft)" }}>Jumlah Penerima</td>
                <td style={{ padding: ".25rem 0", fontWeight: 700, fontSize: "1.1rem" }}>{recipientCount} peserta</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ── Opsi: hanya pendaftar baru ──────────────────────── */}
        <div style={{ marginBottom: "1.4rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <input type="checkbox" id="onlyNew" name="onlyNew" value="1" defaultChecked />
          <label htmlFor="onlyNew" style={{ fontSize: ".85rem", fontWeight: 600 }}>
            Hanya pendaftar baru (sejak broadcast terakhir)
          </label>
        </div>

        {/* ── Preview pesan ───────────────────────────────────── */}
        {(selectedType === "zoom" || selectedType === "grup") && (
          <div style={{ marginBottom: "1.4rem" }}>
            <label style={{ display: "block", fontWeight: 700, marginBottom: ".4rem" }}>📝 Preview Pesan</label>
            {messagePreview ? (
              <pre style={{
                background: "var(--bg-soft)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: ".8rem 1rem",
                fontSize: ".85rem",
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
                color: "var(--ink)",
                fontFamily: "inherit",
              }}>
                {messagePreview}
              </pre>
            ) : (
              <p className="muted" style={{ fontStyle: "italic" }}>
                {selectedType === "zoom"
                  ? "Target ini belum memiliki link Zoom."
                  : "Target ini belum memiliki link Grup WA."}
              </p>
            )}
          </div>
        )}

        {selectedType === "custom" && (
          <div style={{ marginBottom: "1.4rem" }}>
            <label htmlFor="customMessage" style={{ display: "block", fontWeight: 700, marginBottom: ".4rem" }}>
              ✏️ Pesan Broadcast
            </label>
            <p className="muted" style={{ fontSize: ".8rem", margin: "0 0 .5rem" }}>
              Gunakan <code>{`{{name}}`}</code> untuk menyisipkan nama peserta. Pesan akan dikirim personal ke setiap peserta.
            </p>
            <textarea
              id="customMessage"
              name="customMessage"
              rows={8}
              style={{
                width: "100%",
                padding: ".7rem .9rem",
                fontSize: ".9rem",
                lineHeight: 1.6,
                border: "1px solid var(--border)",
                borderRadius: 8,
                resize: "vertical",
                fontFamily: "inherit",
                background: "var(--bg-card)",
                color: "var(--ink)",
              }}
              placeholder={`Halo {{name}},\n\nIni adalah pesan broadcast dari Jetschool Academy.\n\nTerima kasih! 😊`}
            />
          </div>
        )}

        {/* ── Send button ─────────────────────────────────────── */}
        <div style={{ display: "flex", gap: ".8rem", alignItems: "center" }}>
          <BroadcastButton
            disabled={!selectedProgramId && !selectedBatchId}
            recipientCount={recipientCount}
          />
          {selectedProgramId && (
            <Link href={`/webadmin/program/${selectedProgramId}`} className="btn btn-sm" style={{ fontSize: ".85rem" }}>
              Edit Program ↗
            </Link>
          )}
        </div>
      </form>
    </>
  );
}
