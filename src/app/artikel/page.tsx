import Link from "next/link";
import Image from "next/image";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WaFloat from "@/components/WaFloat";
import { prisma } from "@/lib/prisma";

// ISR 5 menit — halaman publik tanpa data personal; simpan/hapus artikel di admin
// memanggil revalidatePath("/artikel") jadi perubahan tetap langsung tampil.
export const revalidate = 300;

export const metadata = {
  title: "Artikel — Tips & Wawasan Seputar AI",
  description: "Kumpulan artikel, tips, dan wawasan seputar AI, pelatihan, dan pengembangan skill dari Jetschool Academy.",
  alternates: { canonical: "/artikel" },
};

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(d);
}

export default async function ArtikelListPage() {
  const articles = await prisma.article.findMany({
    where: { isPublished: true },
    orderBy: { publishedAt: "desc" },
    select: { slug: true, title: true, excerpt: true, coverImageUrl: true, authorName: true, publishedAt: true },
  }).catch((err) => {
    console.error("[artikel] gagal mengambil daftar artikel:", err);
    return [];
  });

  return (
    <>
      <Navbar ctaHref="/program" ctaLabel="Lihat Program" />

      <section className="section" style={{ background: "var(--purple-soft)", padding: "4rem 0 3rem" }}>
        <div className="container">
          <div style={{ maxWidth: "36rem" }}>
            <span className="kicker kicker-ai" style={{ marginBottom: "0.8rem" }}>
              <span className="kicker-dot" />
              Blog Jetschool Academy
            </span>
            <h1 style={{ fontSize: "clamp(2rem, 5vw, 3rem)", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.1, marginBottom: "0.8rem" }}>
              Artikel &amp; <span className="hero-h1-accent">Wawasan.</span>
            </h1>
            <p className="lead" style={{ color: "var(--ink-soft)", fontSize: "1rem", lineHeight: 1.6 }}>
              Tips, panduan, dan wawasan seputar AI dan pengembangan skill dari tim Jetschool Academy.
            </p>
          </div>
        </div>
      </section>

      <section className="section" style={{ minHeight: "50vh", padding: "2.5rem 0 5rem" }}>
        <div className="container">
          {articles.length > 0 ? (
            <div className="prg-grid">
              {articles.map((a) => (
                <Link key={a.slug} href={`/artikel/${a.slug}`} className="prg-card" style={{ display: "flex", flexDirection: "column" }}>
                  <div className={`prg-card-thumb ${a.coverImageUrl ? "prg-card-thumb-dynamic article-card-thumb" : ""}`}>
                    {a.coverImageUrl ? (
                      <Image src={a.coverImageUrl} alt={a.title} fill className="prg-card-thumb-img-dynamic" sizes="(max-width: 780px) 92vw, 46vw" />
                    ) : (
                      <span className="prg-card-thumb-fallback">📰</span>
                    )}
                  </div>
                  <h3 style={{ marginTop: "1rem", marginBottom: "0.5rem" }}>{a.title}</h3>
                  <p style={{ fontSize: "0.86rem", color: "var(--ink-soft)", margin: "0.2rem 0", flex: 1 }}>{a.excerpt}</p>
                  <p className="desc" style={{ marginTop: "auto", paddingTop: "1rem" }}>
                    {a.authorName} · {a.publishedAt ? formatDate(a.publishedAt) : ""}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <div className="bento" style={{ textAlign: "center", padding: "4rem 2rem", background: "var(--white)" }}>
              <h3 style={{ fontSize: "1.35rem", marginBottom: "0.5rem" }}>Belum ada artikel</h3>
              <p className="sub" style={{ color: "var(--ink-soft)" }}>Artikel akan segera hadir di sini.</p>
            </div>
          )}
        </div>
      </section>

      <Footer />
      <WaFloat />
    </>
  );
}
