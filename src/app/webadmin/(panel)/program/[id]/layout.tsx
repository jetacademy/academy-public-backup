import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ProgramSubTabs from "@/components/ProgramSubTabs";

export default async function ProgramEditorLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const program = await prisma.program.findUnique({
    where: { id },
    select: { id: true, title: true, slug: true, type: true, isActive: true, emoji: true },
  });
  if (!program) notFound();

  return (
    <>
      <div
        className="prog-editor-head"
        style={{
          background: "var(--white)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-md)",
          padding: "1.2rem 1.4rem",
          marginBottom: "1rem",
          boxShadow: "0 2px 6px rgba(0,0,0,0.02)",
        }}
      >
        <div style={{ flex: "1 1 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: ".6rem", flexWrap: "wrap", marginBottom: "0.4rem" }}>
            <Link
              href="/webadmin/program"
              style={{
                color: "var(--ink-faint)",
                fontSize: ".82rem",
                fontWeight: 700,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.25rem",
              }}
            >
              <span>←</span>
              <span>Daftar Program</span>
            </Link>
            <span style={{ color: "var(--border)" }}>•</span>
            <span className={`badge ${program.isActive ? "g" : "dim"}`}>
              {program.isActive ? "🟢 Publik Aktif" : "⚪ Nonaktif / Draft"}
            </span>
            <span
              className="badge"
              style={{
                background: "var(--purple-soft)",
                color: "var(--purple-deep)",
                fontWeight: 800,
              }}
            >
              {program.type}
            </span>
          </div>
          <h1
            style={{
              fontSize: "clamp(1.25rem, 2.5vw, 1.65rem)",
              margin: 0,
              fontWeight: 900,
              color: "var(--ink)",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <span>{program.emoji || "🎓"}</span>
            <span>{program.title}</span>
          </h1>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
          <a
            href={`/program/${program.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-sm"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              fontWeight: 700,
            }}
          >
            <span>Lihat Halaman Publik</span>
            <span>↗</span>
          </a>
        </div>
      </div>

      <ProgramSubTabs programId={program.id} />

      <div style={{ marginTop: "1.4rem" }}>{children}</div>
    </>
  );
}
