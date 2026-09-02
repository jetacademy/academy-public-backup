import { requireAdmin } from "@/lib/admin-auth";
import Link from "next/link";

export const dynamic = "force-dynamic";

/** Halaman template contoh — biar admin gampang lihat format kolom. */
export default async function KirimCertTemplate() {
  await requireAdmin();

  return (
    <>
      <div className="adm-head">
        <h1>Template Excel — Kirim Sertifikat</h1>
      </div>
      <div className="adm-card" style={{ padding: "1.4rem" }}>
        <h2 style={{ margin: "0 0 .8rem", fontSize: "1.1rem" }}>Format Kolom</h2>
        <p className="muted" style={{ margin: "0 0 1rem", fontSize: ".85rem" }}>
          Kolom dideteksi otomatis dari judul kolom. Minimal <b>Nama</b> diisi; WhatsApp dan/atau
          Email untuk pengiriman.
        </p>
        <div className="tbl-wrap">
          <table className="tbl" style={{ fontSize: ".85rem" }}>
            <thead>
              <tr><th>Nama</th><th>WhatsApp</th><th>Email</th></tr>
            </thead>
            <tbody>
              <tr><td>Budi Santoso</td><td>081234567890</td><td>budi@gmail.com</td></tr>
              <tr><td>Siti Aminah</td><td>085611112222</td><td>siti@yahoo.com</td></tr>
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ margin: "1rem 0 0", fontSize: ".8rem" }}>
          Simpan tabel di atas sebagai file <b>.xlsx</b> atau <b>.csv</b> (header Nama / WhatsApp / Email),
          lalu upload di menu <b>Kirim Sertifikat → Kontak</b>.
        </p>
        <Link href="/webadmin/kirim-sertifikat" className="btn" style={{ marginTop: "1rem" }}>
          ← Kembali ke Kirim Sertifikat
        </Link>
      </div>
    </>
  );
}
