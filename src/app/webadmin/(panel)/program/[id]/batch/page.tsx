import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createBatch, toggleBatch, deleteBatch, updateBatchLinks, toggleBatchCertPublish } from "@/app/webadmin/actions";
import { formatJadwal } from "@/lib/format";
import ConfirmButton from "@/components/ConfirmButton";

export default async function AdminBatch({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; e?: string; deleted?: string; cert?: string; issued?: string }>;
}) {
  const { id } = await params;
  const { ok, e, deleted, cert, issued } = await searchParams;

  const program = await prisma.program.findUnique({ where: { id } });
  if (!program) notFound();

  const batches = await prisma.programBatch.findMany({
    where: { programId: id },
    orderBy: { scheduleAt: "asc" },
    include: { _count: { select: { registrations: true } } },
  });

  const now = new Date();

  return (
    <>
      {ok === "1" && <div className="adm-alert ok">Batch baru berhasil ditambahkan.</div>}
      {deleted === "1" && <div className="adm-alert ok">Batch dihapus.</div>}
      {cert === "published" && (
        <div className="adm-alert ok">
          Sertifikat batch dipublikasikan. {issued && Number(issued) > 0
            ? `${issued} peserta lunas langsung diterbitkan sertifikatnya.`
            : "Belum ada peserta lunas baru yang perlu diterbitkan — sertifikat akan otomatis terbit saat batch selesai & peserta lunas."}
        </div>
      )}
      {cert === "unpublished" && (
        <div className="adm-alert warn">Rilis sertifikat batch dibatalkan. Sertifikat baru tidak terbit ke peserta batch ini sampai dipublikasikan lagi — yang sudah terbit tidak terpengaruh.</div>
      )}
      {e === "lengkapi" && <div className="adm-alert err">Tanggal jadwal wajib diisi.</div>}
      {e === "tanggal" && <div className="adm-alert err">Format tanggal tidak valid.</div>}

      <h2 style={{ fontSize: "1.15rem", margin: "0 0 .3rem" }}>Jadwal &amp; Batch</h2>
      <p className="adm-note" style={{ marginBottom: "1.6rem" }}>
        Untuk program yang berulang (webinar mingguan, kelas bulanan, dst), tambahkan banyak jadwal batch
        di sini — kurikulum, materi, dan harga tetap satu program yang sama. Peserta memilih batch saat
        mendaftar; histori pendaftaran &amp; sertifikat tetap terpisah per batch.
        {batches.length === 0 && " Selama belum ada batch, halaman publik memakai jadwal default program (tab Info Program)."}
      </p>

      <div className="form-section">
        <header>
          <h3>Tambah Batch Baru</h3>
        </header>
        <form action={createBatch} className="fs-body">
          <input type="hidden" name="programId" value={program.id} />
          <div className="field">
            <label>Format Pelatihan</label>
            <select name="batchType" defaultValue="ONLINE" style={{ fontWeight: 600 }}>
              <option value="ONLINE">💻 Online (Zoom)</option>
              <option value="OFFLINE">🏢 Offline (Tatap Muka di Lokasi/Bekasi)</option>
            </select>
          </div>
          <div className="field">
            <label>Nama / Label Batch (opsional)</label>
            <input name="name" placeholder="mis. Batch 6 (Online) atau Batch 1 (Offline Bekasi)" />
          </div>
          <div className="field">
            <label>Tanggal &amp; Jam Mulai</label>
            <input type="datetime-local" name="scheduleAt" required />
          </div>
          <div className="field">
            <label>Harga Normal (Rp)</label>
            <input name="normalPrice" inputMode="numeric" placeholder="Online default: 490000 / Offline: 1400000" />
          </div>
          <div className="field">
            <label>Harga Early Bird (Rp)</label>
            <input name="ebPrice" inputMode="numeric" placeholder="Online default: 225000 / Offline: 750000" />
          </div>
          <div className="field">
            <label>Kuota Early Bird (orang)</label>
            <input name="ebQuota" inputMode="numeric" placeholder="Online default: 20 / Offline: 10" />
          </div>
          <div className="field">
            <label>Kuota Total Kursi (Khusus Offline)</label>
            <input name="seatsLeft" inputMode="numeric" placeholder="Online: opsional / Offline: 20" />
          </div>
          <div className="field">
            <label>Alamat / Venue (khusus Offline)</label>
            <input name="offlineVenue" placeholder="mis. Coworking Space Kota Bekasi" />
          </div>
          <div className="full">
            <button type="submit" className="btn btn-purple">Tambah Batch</button>
          </div>
        </form>
      </div>

      <div className="tbl-wrap" style={{ marginTop: "1.2rem" }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Format &amp; Batch</th>
              <th>Jadwal</th>
              <th>Harga &amp; Promo</th>
              <th>Pendaftar</th>
              <th>Status</th>
              <th>Sertifikat</th>
              <th style={{ minWidth: "19rem" }}>Detail, Link &amp; Harga</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {batches.map((b) => {
              const past = b.scheduleAt < now;
              const isOffline = (b as any).batchType === "OFFLINE";
              const currentNormalPrice = (isOffline ? (b as any).priceOffline : (b as any).priceOnline) ?? (isOffline ? 1400000 : 490000);
              const currentEbPrice = (isOffline ? (b as any).priceOfflineEb : (b as any).priceOnlineEb) ?? (isOffline ? 750000 : 225000);
              const currentEbQuota = (isOffline ? (b as any).quotaOfflineEb : (b as any).quotaOnlineEb) ?? (isOffline ? 10 : 20);

              return (
                <tr key={b.id}>
                  <td data-label="Format">
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", alignItems: "flex-start" }}>
                      <span className={`badge ${isOffline ? "warn" : "b"}`} style={{ fontWeight: 700 }}>
                        {isOffline ? "🏢 Offline" : "💻 Online"}
                      </span>
                      <strong style={{ fontSize: "0.85rem" }}>
                        {(b as any).name || (isOffline ? "Batch Offline" : "Batch Online")}
                      </strong>
                    </div>
                  </td>
                  <td data-label="Jadwal">
                    {formatJadwal(b.scheduleAt)}
                    {past && <div className="muted">Sudah lewat</div>}
                  </td>
                  <td data-label="Harga &amp; Promo">
                    <div style={{ fontSize: "0.8rem", display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                      <div>
                        <span className="muted">Normal:</span> <strong>Rp {currentNormalPrice.toLocaleString("id-ID")}</strong>
                      </div>
                      <div>
                        <span className="muted">Early Bird:</span> <strong style={{ color: "#00b894" }}>Rp {currentEbPrice.toLocaleString("id-ID")}</strong>
                      </div>
                      <div className="muted" style={{ fontSize: "0.75rem" }}>
                        Kuota EB: {currentEbQuota} org {isOffline ? `| Ruang: ${b.seatsLeft ?? 20} kursi` : ""}
                      </div>
                    </div>
                  </td>
                  <td data-label="Pendaftar">
                    {b._count.registrations > 0 ? (
                      <Link href={`/webadmin/pendaftar?batchId=${b.id}`} className="btn btn-sm">
                        {b._count.registrations} peserta →
                      </Link>
                    ) : (
                      0
                    )}
                  </td>
                  <td data-label="Status">
                    <span className={`badge ${b.isActive ? "g" : "dim"}`}>{b.isActive ? "Aktif" : "Nonaktif"}</span>
                  </td>
                  <td data-label="Sertifikat">
                    <span className={`badge ${b.certPublished ? "g" : "dim"}`}>
                      {b.certPublished ? "Sertifikat Rilis" : "Sertifikat Ditahan"}
                    </span>
                    <form action={toggleBatchCertPublish} style={{ marginTop: "0.35rem" }}>
                      <input type="hidden" name="id" value={b.id} />
                      <input type="hidden" name="programId" value={program.id} />
                      <button type="submit" className={`btn btn-sm ${b.certPublished ? "btn-danger" : "btn-purple"}`}>
                        {b.certPublished ? "Batalkan Rilis" : "Rilis Sertifikat"}
                      </button>
                    </form>
                  </td>
                  <td data-label="Detail, Link &amp; Harga">
                    <form action={updateBatchLinks} style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                      <input type="hidden" name="id" value={b.id} />
                      <input type="hidden" name="programId" value={program.id} />
                      
                      {/* Baris 1: Nama label batch */}
                      <input name="name" defaultValue={(b as any).name ?? ""} placeholder="Label Nama Batch" style={{ fontSize: "0.75rem", padding: "0.2rem 0.4rem", border: "1px solid var(--border)", borderRadius: "4px", width: "100%" }} />

                      {/* Baris 2: Harga & Kuota */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.3rem" }}>
                        <div>
                          <label style={{ fontSize: "0.68rem", color: "var(--ink-soft)", display: "block" }}>Normal (Rp)</label>
                          <input
                            name={isOffline ? "priceOffline" : "priceOnline"}
                            defaultValue={currentNormalPrice}
                            placeholder="Normal"
                            style={{ fontSize: "0.75rem", padding: "0.2rem 0.35rem", border: "1px solid var(--border)", borderRadius: "4px", width: "100%" }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: "0.68rem", color: "var(--ink-soft)", display: "block" }}>Early Bird (Rp)</label>
                          <input
                            name={isOffline ? "priceOfflineEb" : "priceOnlineEb"}
                            defaultValue={currentEbPrice}
                            placeholder="Early Bird"
                            style={{ fontSize: "0.75rem", padding: "0.2rem 0.35rem", border: "1px solid var(--border)", borderRadius: "4px", width: "100%" }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: "0.68rem", color: "var(--ink-soft)", display: "block" }}>Kuota EB</label>
                          <input
                            name={isOffline ? "quotaOfflineEb" : "quotaOnlineEb"}
                            defaultValue={currentEbQuota}
                            placeholder="Kuota EB"
                            style={{ fontSize: "0.75rem", padding: "0.2rem 0.35rem", border: "1px solid var(--border)", borderRadius: "4px", width: "100%" }}
                          />
                        </div>
                      </div>

                      {/* Baris 3: Link zoom / Venue / Kuota Ruangan */}
                      {!isOffline ? (
                        <input name="zoomLink" defaultValue={b.zoomLink ?? ""} placeholder="Link Zoom (Online)" style={{ fontSize: "0.75rem", padding: "0.2rem 0.4rem", border: "1px solid var(--border)", borderRadius: "4px", width: "100%" }} />
                      ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "0.3rem" }}>
                          <input name="offlineVenue" defaultValue={(b as any).offlineVenue ?? ""} placeholder="Alamat Venue (Bekasi)" style={{ fontSize: "0.75rem", padding: "0.2rem 0.4rem", border: "1px solid var(--border)", borderRadius: "4px", width: "100%" }} />
                          <input name="seatsLeft" defaultValue={b.seatsLeft ?? 20} placeholder="Kursi Ruang" title="Maksimal Kursi Ruangan" style={{ fontSize: "0.75rem", padding: "0.2rem 0.4rem", border: "1px solid var(--border)", borderRadius: "4px", width: "100%" }} />
                        </div>
                      )}

                      {/* Baris 4: WA & Rekaman */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.3rem" }}>
                        <input name="waGroupLink" defaultValue={b.waGroupLink ?? ""} placeholder={`Link Grup WA`} style={{ fontSize: "0.75rem", padding: "0.2rem 0.4rem", border: "1px solid var(--border)", borderRadius: "4px", width: "100%" }} />
                        <input name="recordingLink" defaultValue={b.recordingLink ?? ""} placeholder="Link Rekaman / LMS" style={{ fontSize: "0.75rem", padding: "0.2rem 0.4rem", border: "1px solid var(--border)", borderRadius: "4px", width: "100%" }} />
                      </div>

                      <button type="submit" className="btn btn-sm btn-purple" style={{ alignSelf: "flex-end", marginTop: "0.15rem" }}>Simpan Pengaturan</button>
                    </form>
                  </td>
                  <td data-label="Aksi">
                    <div style={{ display: "flex", gap: ".4rem", flexWrap: "wrap" }}>
                      <form action={toggleBatch}>
                        <input type="hidden" name="id" value={b.id} />
                        <input type="hidden" name="programId" value={program.id} />
                        <button type="submit" className="btn btn-sm">{b.isActive ? "Nonaktifkan" : "Aktifkan"}</button>
                      </form>
                      <form action={deleteBatch}>
                        <input type="hidden" name="id" value={b.id} />
                        <input type="hidden" name="programId" value={program.id} />
                        <ConfirmButton className="btn btn-sm btn-danger" message="Apakah Anda yakin ingin menghapus batch jadwal ini?" disabled={b._count.registrations > 0} title={b._count.registrations > 0 ? "Tidak bisa dihapus — sudah ada pendaftar. Nonaktifkan saja." : undefined}>
                          Hapus
                        </ConfirmButton>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
            {batches.length === 0 && (
              <tr><td colSpan={8} className="muted">Belum ada batch. Program memakai jadwal tunggal di tab Info Program.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
