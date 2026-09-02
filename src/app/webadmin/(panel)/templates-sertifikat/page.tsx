import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import ConfirmButton from "@/components/ConfirmButton";
import { deleteMasterCertTemplate } from "@/app/webadmin/actions";
import type { CertConfig } from "@/lib/types";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminCertTemplatesPage() {
  await requireAdmin();

  const templates = await prisma.certificateTemplate.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div style={{ maxWidth: "1200px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 style={{ fontSize: "1.35rem", fontWeight: 700, margin: 0 }}>Template Sertifikat</h1>
          <p className="muted" style={{ margin: ".2rem 0 0", fontSize: ".85rem" }}>
            Pustaka template sertifikat yang dapat digunakan kembali di semua program dan batch.
          </p>
        </div>
      </div>

      {templates.length === 0 ? (
        <div className="reg-card" style={{ textAlign: "center", padding: "3rem 1.5rem" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: ".5rem" }}>📜</div>
          <h3 style={{ margin: "0 0 .5rem" }}>Belum Ada Template Sertifikat</h3>
          <p className="muted" style={{ maxWidth: "28rem", margin: "0 auto 1.5rem", fontSize: ".88rem" }}>
            Buka editor sertifikat di salah satu halaman program, lalu klik <strong>&quot;Simpan sebagai Template&quot;</strong> untuk menambahkan template pertama Anda.
          </p>
          <Link href="/webadmin/program" className="btn btn-purple btn-sm">
            Buka Daftar Program →
          </Link>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "1.5rem" }}>
          {templates.map((tpl) => {
            const config = (tpl.certConfig as CertConfig) || {};
            return (
              <div key={tpl.id} className="reg-card" style={{ display: "flex", flexDirection: "column", gap: ".8rem", padding: "1.2rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: ".5rem" }}>
                  <div>
                    <h3 style={{ fontSize: "1.05rem", margin: "0 0 .3rem" }}>{tpl.name}</h3>
                    {tpl.description && (
                      <p className="muted" style={{ fontSize: ".8rem", margin: 0, lineHeight: 1.4 }}>
                        {tpl.description}
                      </p>
                    )}
                  </div>
                  <span className="badge purple" style={{ fontSize: ".7rem", flexShrink: 0 }}>
                    {tpl.certBgUrl ? "Gambar Background" : "Desain Vector"}
                  </span>
                </div>

                {/* Thumbnail Preview Box */}
                <div
                  style={{
                    position: "relative",
                    width: "100%",
                    height: "180px",
                    borderRadius: "var(--r-md)",
                    overflow: "hidden",
                    border: "1px solid var(--line)",
                    background: tpl.certBgUrl ? `url(${tpl.certBgUrl}) center/cover no-repeat` : "#F8F9FB",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "1rem",
                    boxSizing: "border-box",
                  }}
                >
                  {!tpl.certBgUrl && (
                    <div style={{ textAlign: "center", pointerEvents: "none" }}>
                      <div
                        style={{
                          fontSize: "1.1rem",
                          fontWeight: 700,
                          color: config.accentColor || "#232176",
                          marginBottom: ".3rem",
                        }}
                      >
                        {config.title || "SERTIFIKAT"}
                      </div>
                      <div style={{ fontSize: ".75rem", color: "var(--ink-soft)", maxWidth: "80%" }}>
                        {config.subtitle || "KETERANGAN SELESAI TOPIK PELATIHAN"}
                      </div>
                      {config.sign2Name && (
                        <div style={{ marginTop: ".8rem", fontSize: ".7rem", color: "var(--ink-faint)" }}>
                          Tanda Tangan: {config.sign2Name} ({config.sign2Role || "Direktur"})
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Details info */}
                <div style={{ fontSize: ".78rem", color: "var(--ink-soft)", display: "flex", justifyContent: "space-between" }}>
                  <span>Aksen Warna: <strong style={{ color: config.accentColor || "#232176" }}>{config.accentColor || "#232176"}</strong></span>
                  <span>Diperbarui: {new Date(tpl.updatedAt).toLocaleDateString("id-ID")}</span>
                </div>

                {/* Action buttons */}
                <div style={{ display: "flex", gap: ".5rem", marginTop: "auto", paddingTop: ".5rem", borderTop: "1px solid var(--line)" }}>
                  <form action={deleteMasterCertTemplate} style={{ marginLeft: "auto" }}>
                    <input type="hidden" name="id" value={tpl.id} />
                    <ConfirmButton
                      className="btn btn-sm btn-danger"
                      message={`Hapus template sertifikat "${tpl.name}"? Program yang sudah memakai template ini tidak akan terpengaruh.`}
                    >
                      Hapus Template
                    </ConfirmButton>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
