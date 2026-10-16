import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  saveLmsGroup,
  saveLmsModule,
} from "@/app/webadmin/actions";
import AdminLmsCurriculumManager, { type GroupOption } from "@/components/AdminLmsCurriculumManager";

export default async function AdminLms({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ e?: string; ok?: string; deleted?: string }>;
}) {
  const { id } = await params;
  const { e, ok, deleted } = await searchParams;

  const lessonInclude = {
    lessons: {
      orderBy: { order: "asc" as const },
      include: { _count: { select: { questions: true } } },
    },
  };
  const moduleInclude = {
    ...lessonInclude,
    batchLinks: { select: { batchId: true } },
  };

  const program = await prisma.program.findUnique({
    where: { id },
    include: {
      batches: {
        orderBy: { scheduleAt: "desc" },
        select: { id: true, scheduleAt: true, name: true, batchType: true },
      },
      groups: {
        orderBy: { order: "asc" },
        include: { modules: { orderBy: { order: "asc" }, include: moduleInclude } },
      },
      modules: {
        where: { groupId: null },
        orderBy: { order: "asc" },
        include: moduleInclude,
      },
    },
  });
  if (!program) notFound();

  const groupOptions: GroupOption[] = program.groups.map((g) => ({ id: g.id, title: g.title }));
  const batchOptions = program.batches.map((b) => ({
    id: b.id,
    label: (b as any).name
      ? `${(b as any).name} (${new Date(b.scheduleAt).toLocaleDateString("id-ID", { dateStyle: "medium" })})`
      : new Date(b.scheduleAt).toLocaleDateString("id-ID", { dateStyle: "medium" }),
  }));

  const totalGroups = program.groups.length;
  const totalModules = program.groups.reduce((a, g) => a + g.modules.length, 0) + program.modules.length;
  const allLessons = [
    ...program.groups.flatMap((g) => g.modules.flatMap((m) => m.lessons)),
    ...program.modules.flatMap((m) => m.lessons),
  ];
  const totalLessons = allLessons.length;
  const totalQuizzes = allLessons.filter((l) => l.type === "QUIZ").length;
  const totalQuestions = allLessons.reduce((acc, l) => acc + (l._count?.questions || 0), 0);
  const totalVideos = allLessons.filter((l) => l.type === "VIDEO").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.4rem" }}>
      {/* Alert Notifikasi */}
      {e === "lengkapi" && <div className="adm-alert err">Lengkapi kolom yang wajib diisi.</div>}
      {ok && <div className="adm-alert ok">Perubahan kurikulum berhasil disimpan.</div>}
      {deleted && <div className="adm-alert ok">Materi pembelajaran berhasil dihapus.</div>}

      {/* Header Info */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <h2 style={{ fontSize: "1.3rem", fontWeight: 800, margin: 0, color: "var(--ink)" }}>
              Kurikulum &amp; Materi Pembelajaran
            </h2>
            <span className="badge y" style={{ fontSize: "0.7rem" }}>
              LMS Builder
            </span>
          </div>
          <p className="adm-note" style={{ margin: "0.35rem 0 0", maxWidth: "680px", lineHeight: "1.45" }}>
            Susun kurikulum berjenjang: Kelompok Modul (Bagian) berisi Modul (Sub-Bab), dan Modul berisi Materi.
            Anda dapat menyeret (drag &amp; drop) materi untuk berpindah antar modul atau kelompok secara bebas.
          </p>
        </div>
      </div>

      {/* Metric Stat Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "1rem",
        }}
      >
        <div
          style={{
            background: "var(--white)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md)",
            padding: "1.1rem 1.25rem",
            boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem",
          }}
        >
          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Total Kelompok
          </span>
          <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
            <span style={{ fontSize: "1.75rem", fontWeight: 900, color: "var(--ink)" }}>{totalGroups}</span>
            <span style={{ fontSize: "0.8rem", color: "var(--ink-soft)" }}>bagian bab</span>
          </div>
        </div>

        <div
          style={{
            background: "var(--white)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md)",
            padding: "1.1rem 1.25rem",
            boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem",
          }}
        >
          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Total Modul
          </span>
          <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
            <span style={{ fontSize: "1.75rem", fontWeight: 900, color: "var(--purple)" }}>{totalModules}</span>
            <span style={{ fontSize: "0.8rem", color: "var(--ink-soft)" }}>sub-bab modul</span>
          </div>
        </div>

        <div
          style={{
            background: "var(--white)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md)",
            padding: "1.1rem 1.25rem",
            boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem",
          }}
        >
          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Materi Pembelajaran
          </span>
          <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
            <span style={{ fontSize: "1.75rem", fontWeight: 900, color: "#00b894" }}>{totalLessons}</span>
            <span style={{ fontSize: "0.8rem", color: "var(--ink-soft)" }}>
              pelajaran ({totalVideos} video)
            </span>
          </div>
        </div>

        <div
          style={{
            background: "var(--white)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md)",
            padding: "1.1rem 1.25rem",
            boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem",
          }}
        >
          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Kuis &amp; Evaluasi
          </span>
          <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
            <span style={{ fontSize: "1.75rem", fontWeight: 900, color: "#d63031" }}>{totalQuizzes}</span>
            <span style={{ fontSize: "0.8rem", color: "var(--ink-soft)" }}>
              kuis ({totalQuestions} soal)
            </span>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {program.groups.length === 0 && program.modules.length === 0 && (
        <div
          style={{
            padding: "3rem 1.5rem",
            textAlign: "center",
            border: "2px dashed var(--purple)",
            borderRadius: "var(--r-md)",
            background: "var(--white)",
            color: "var(--ink-soft)",
          }}
        >
          <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📚</div>
          <h3 style={{ fontWeight: 800, margin: "0 0 .3rem", color: "var(--ink)" }}>Kurikulum Masih Kosong</h3>
          <p style={{ fontSize: ".88rem", margin: "0 0 1.2rem", color: "var(--ink-soft)" }}>
            Mulai susun kurikulum pembelajaran dengan membuat Bagian pertama atau langsung tambahkan modul di bawah.
          </p>
        </div>
      )}

      {/* Kurikulum Manajer Terpadu (Live Search, Type Filter, Quick Jump & Drag & Drop) */}
      <AdminLmsCurriculumManager
        programId={program.id}
        initialGroups={program.groups}
        initialOrphanModules={program.modules}
        groupOptions={groupOptions}
        batchOptions={batchOptions}
      />

      {/* Tambah kelompok / modul lepas di bagian bawah */}
      <div
        style={{
          background: "var(--white)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-md)",
          padding: "1.4rem",
          boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.4rem" }}>
          <div
            style={{
              padding: "1.2rem",
              background: "var(--chip)",
              borderRadius: "var(--r-sm)",
              border: "1px solid var(--border)",
            }}
          >
            <h4 style={{ color: "var(--purple)", margin: "0 0 0.5rem", fontSize: "0.95rem", fontWeight: 800 }}>
              + Tambah Kelompok Modul (Bagian)
            </h4>
            <p style={{ fontSize: "0.8rem", color: "var(--ink-soft)", margin: "0 0 0.8rem" }}>
              Kelompok berfungsi membagi materi menjadi jenjang besar (cth: Bagian 1: Fondasi).
            </p>
            <form action={saveLmsGroup} style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <input type="hidden" name="programId" value={program.id} />
              <input
                name="title"
                placeholder={`mis. Bagian ${program.groups.length + 1}: Praktik & Studi Kasus`}
                required
                style={{
                  flex: "1 1 200px",
                  padding: "0.55rem 0.8rem",
                  borderRadius: "var(--r-sm)",
                  border: "1px solid var(--border)",
                  background: "var(--white)",
                  fontSize: "0.85rem",
                }}
              />
              <button type="submit" className="btn btn-purple btn-sm" style={{ fontWeight: 700 }}>
                Tambah Kelompok
              </button>
            </form>
          </div>

          <div
            style={{
              padding: "1.2rem",
              background: "var(--chip)",
              borderRadius: "var(--r-sm)",
              border: "1px solid var(--border)",
            }}
          >
            <h4 style={{ color: "var(--ink)", margin: "0 0 0.5rem", fontSize: "0.95rem", fontWeight: 800 }}>
              + Tambah Modul Tanpa Kelompok
            </h4>
            <p style={{ fontSize: "0.8rem", color: "var(--ink-soft)", margin: "0 0 0.8rem" }}>
              Modul mandiri yang berdiri sendiri tanpa dimasukkan ke dalam kelompok modul.
            </p>
            <form action={saveLmsModule} style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <input type="hidden" name="programId" value={program.id} />
              <input type="hidden" name="groupId" value="" />
              <input
                name="title"
                placeholder="mis. Orientasi & Pengantar Kelas"
                required
                style={{
                  flex: "1 1 200px",
                  padding: "0.55rem 0.8rem",
                  borderRadius: "var(--r-sm)",
                  border: "1px solid var(--border)",
                  background: "var(--white)",
                  fontSize: "0.85rem",
                }}
              />
              <button type="submit" className="btn btn-sm" style={{ fontWeight: 700, background: "var(--white)", border: "1px solid var(--border)" }}>
                Tambah Modul
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
