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
        orderBy: { scheduleAt: "asc" },
        select: { id: true, scheduleAt: true },
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
    label: new Date(b.scheduleAt).toLocaleDateString("id-ID", { dateStyle: "medium" }),
  }));
  const totalModules = program.groups.reduce((a, g) => a + g.modules.length, 0) + program.modules.length;
  const totalLessons =
    program.groups.reduce((a, g) => a + g.modules.reduce((b, m) => b + m.lessons.length, 0), 0) +
    program.modules.reduce((a, m) => a + m.lessons.length, 0);

  return (
    <>
      {e === "lengkapi" && <div className="adm-alert err">Lengkapi kolom yang wajib diisi.</div>}
      {ok && <div className="adm-alert ok">Perubahan kurikulum tersimpan.</div>}
      {deleted && <div className="adm-alert ok">Materi dihapus.</div>}

      <div style={{ marginBottom: "1.4rem" }}>
        <h2 style={{ fontSize: "1.15rem", margin: 0 }}>Kurikulum</h2>
        <p className="adm-note" style={{ marginTop: ".3rem" }}>
          {program.groups.length} kelompok · {totalModules} modul · {totalLessons} materi.
          Susun kurikulum berjenjang: kelompok modul berisi modul (sub-bab), modul berisi materi.
          Tes/kuis adalah materi biasa — bisa ditaruh di awal, tengah, akhir, atau per sub-bab.
        </p>
      </div>

      {program.groups.length === 0 && program.modules.length === 0 && (
        <div style={{ padding: "2.5rem", textAlign: "center", border: "2px dashed var(--chip)", borderRadius: "var(--r-md)", color: "var(--ink-soft)", marginBottom: "1rem" }}>
          <p style={{ fontWeight: 700, margin: "0 0 .2rem" }}>Kurikulum masih kosong</p>
          <p style={{ fontSize: ".85rem", margin: 0 }}>Mulai dengan membuat kelompok modul atau langsung modul di bawah.</p>
        </div>
      )}

      {/* Kurikulum Manajer Terpadu (Dukungan Drag & Drop Pindah Materi Antar Kelompok & Modul) */}
      <AdminLmsCurriculumManager
        programId={program.id}
        initialGroups={program.groups}
        initialOrphanModules={program.modules}
        groupOptions={groupOptions}
        batchOptions={batchOptions}
      />

      {/* Tambah kelompok / modul lepas */}
      <div className="lms-add-mod">
        <div className="lms-add-mod-grid">
          <div className="lms-add-card">
            <h3 style={{ color: "var(--purple)" }}>
              + Tambah Kelompok Modul
            </h3>
            <form action={saveLmsGroup} className="lms-add-form">
              <input type="hidden" name="programId" value={program.id} />
              <input
                name="title"
                placeholder={`cth: Bagian ${program.groups.length + 1}: Praktik & Studi Kasus`}
                required
              />
              <button type="submit" className="btn btn-purple">Tambah Kelompok</button>
            </form>
          </div>
          <div className="lms-add-card">
            <h3 style={{ color: "var(--ink-soft)" }}>
              + Tambah Modul Tanpa Kelompok
            </h3>
            <form action={saveLmsModule} className="lms-add-form">
              <input type="hidden" name="programId" value={program.id} />
              <input type="hidden" name="groupId" value="" />
              <input
                name="title"
                placeholder="cth: Orientasi & Pengantar"
                required
              />
              <button type="submit" className="btn">Tambah Modul</button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
