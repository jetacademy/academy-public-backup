import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  saveLmsGroup,
  deleteLmsGroup,
  moveLmsGroup,
  saveLmsModule,
  deleteLmsModule,
  moveLmsModule,
  deleteLmsLesson,
  moveLmsLesson,
} from "@/app/webadmin/actions";
import ConfirmButton from "@/components/ConfirmButton";

const TYPE_CHIP: Record<string, { cls: string; label: string }> = {
  VIDEO: { cls: "video", label: "Video" },
  TEXT: { cls: "text", label: "Teks" },
  PDF: { cls: "pdf", label: "PDF" },
  QUIZ: { cls: "quiz", label: "Kuis" },
};

type LessonRow = {
  id: string;
  title: string;
  type: string;
  duration: string;
  isPreview: boolean;
  passingScore: number | null;
  _count: { questions: number };
};

type ModuleRow = {
  id: string;
  title: string;
  groupId: string | null;
  lessons: LessonRow[];
  batchLinks: { batchId: string }[];
};

type GroupOption = { id: string; title: string };

/** Kartu satu modul: rename + pindah kelompok, daftar materi, tambah materi */
function ModuleCard({
  programId,
  mod,
  label,
  isFirst,
  isLast,
  groups,
  batches,
}: {
  programId: string;
  mod: ModuleRow;
  label: string;
  isFirst: boolean;
  isLast: boolean;
  groups: GroupOption[];
  batches: { id: string; label: string }[];
}) {
  return (
    <section className="lms-mod">
      <div className="lms-mod-head">
        <div className="lms-mod-head-top">
          <span className="mod-no">{label}</span>
          <span className="lms-mod-count">
            {mod.lessons.length} materi
          </span>
          <div className="lms-mod-actions">
            <form action={moveLmsModule}>
              <input type="hidden" name="id" value={mod.id} />
              <input type="hidden" name="programId" value={programId} />
              <input type="hidden" name="dir" value="up" />
              <button type="submit" className="icon-btn" disabled={isFirst} title="Geser ke atas" aria-label="Geser ke atas">↑</button>
            </form>
            <form action={moveLmsModule}>
              <input type="hidden" name="id" value={mod.id} />
              <input type="hidden" name="programId" value={programId} />
              <input type="hidden" name="dir" value="down" />
              <button type="submit" className="icon-btn" disabled={isLast} title="Geser ke bawah" aria-label="Geser ke bawah">↓</button>
            </form>
            <form action={deleteLmsModule}>
              <input type="hidden" name="id" value={mod.id} />
              <input type="hidden" name="programId" value={programId} />
              <ConfirmButton
                className="icon-btn danger"
                title="Hapus modul"
                message={`Hapus modul "${mod.title}" beserta ${mod.lessons.length} materinya? Progres belajar peserta pada modul ini ikut terhapus.`}
              >
                Hapus
              </ConfirmButton>
            </form>
          </div>
        </div>

        <form action={saveLmsModule} className="lms-mod-form">
          <input type="hidden" name="id" value={mod.id} />
          <input type="hidden" name="programId" value={programId} />
          <div className="lms-mod-title-row">
            <input
              name="title"
              defaultValue={mod.title}
              required
              title="Klik untuk mengganti nama modul"
              className="lms-mod-title-input"
            />
            <select
              name="groupId"
              defaultValue={mod.groupId ?? ""}
              title="Pindahkan ke kelompok lain"
              className="lms-mod-group-select"
            >
              <option value="">Tanpa kelompok</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.title}</option>
              ))}
            </select>
            <button type="submit" className="btn btn-sm btn-purple lms-mod-save-btn">Simpan</button>
          </div>

          <div className="lms-batch-selector">
            <span className="lms-batch-label">Akses Batch:</span>
            {batches.length > 0 ? (
              batches.map((b) => (
                <label key={b.id} className="lms-batch-chip">
                  <input
                    type="checkbox"
                    name="batchIds"
                    value={b.id}
                    defaultChecked={mod.batchLinks.some((bl) => bl.batchId === b.id)}
                  />
                  <span>{b.label}</span>
                </label>
              ))
            ) : (
              <span style={{ fontSize: ".78rem", color: "var(--ink-faint)" }}>Belum ada batch/angkatan.</span>
            )}
          </div>
        </form>
      </div>

      <div className="lms-lessons">
        {mod.lessons.length === 0 && (
          <p style={{ fontSize: ".8rem", color: "var(--ink-faint)", fontStyle: "italic", padding: ".6rem .8rem", margin: 0 }}>
            Belum ada materi di modul ini.
          </p>
        )}

        {mod.lessons.map((les, lesIdx) => {
          const chip = TYPE_CHIP[les.type] ?? TYPE_CHIP.VIDEO;
          return (
            <div key={les.id} className="lms-lesson-item">
              <div className="lms-lesson-main">
                <div className="lms-lesson-meta-top">
                  <span className={`type-chip ${chip.cls}`}>{chip.label}</span>
                  {les.isPreview && <span className="badge" style={{ fontSize: ".62rem" }}>Preview Gratis</span>}
                  {les.type === "QUIZ" && (
                    <span className="l-meta">{les._count.questions} soal</span>
                  )}
                  {les.duration && <span className="l-meta">{les.duration}</span>}
                </div>
                <Link
                  href={`/webadmin/program/${programId}/lms/lesson/${les.id}`}
                  className="lms-lesson-title"
                  title="Klik untuk mengedit materi"
                >
                  {les.title}
                </Link>
              </div>

              <div className="lms-lesson-actions">
                <div className="lms-lesson-reorder">
                  <form action={moveLmsLesson}>
                    <input type="hidden" name="id" value={les.id} />
                    <input type="hidden" name="programId" value={programId} />
                    <input type="hidden" name="moduleId" value={mod.id} />
                    <input type="hidden" name="dir" value="up" />
                    <button type="submit" className="icon-btn" disabled={lesIdx === 0} title="Geser ke atas" aria-label="Geser ke atas">↑</button>
                  </form>
                  <form action={moveLmsLesson}>
                    <input type="hidden" name="id" value={les.id} />
                    <input type="hidden" name="programId" value={programId} />
                    <input type="hidden" name="moduleId" value={mod.id} />
                    <input type="hidden" name="dir" value="down" />
                    <button type="submit" className="icon-btn" disabled={lesIdx === mod.lessons.length - 1} title="Geser ke bawah" aria-label="Geser ke bawah">↓</button>
                  </form>
                </div>
                <div className="lms-lesson-ops">
                  <Link href={`/webadmin/program/${programId}/lms/lesson/${les.id}`} className="btn btn-sm lms-btn-edit">
                    Edit
                  </Link>
                  <form action={deleteLmsLesson}>
                    <input type="hidden" name="id" value={les.id} />
                    <input type="hidden" name="programId" value={programId} />
                    <ConfirmButton className="icon-btn danger" title="Hapus materi" message={`Hapus materi "${les.title}"?`}>
                      Hapus
                    </ConfirmButton>
                  </form>
                </div>
              </div>
            </div>
          );
        })}

        <div className="lms-add-lesson-btn-wrapper">
          <Link
            href={`/webadmin/program/${programId}/lms/lesson/new?module=${mod.id}`}
            className="btn btn-sm lms-add-lesson-btn"
          >
            + Tambah Materi / Tes
          </Link>
        </div>
      </div>
    </section>
  );
}

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

      {/* Kelompok modul */}
      {program.groups.map((group, gIdx) => (
        <section key={group.id} className="lms-group">
          <div className="lms-group-head">
            <div className="lms-group-head-top">
              <span className="group-no">Bagian {gIdx + 1}</span>
              <span className="lms-group-count">
                {group.modules.length} modul
              </span>
              <div className="lms-group-actions">
                <form action={moveLmsGroup}>
                  <input type="hidden" name="id" value={group.id} />
                  <input type="hidden" name="programId" value={program.id} />
                  <input type="hidden" name="dir" value="up" />
                  <button type="submit" className="icon-btn" disabled={gIdx === 0} title="Geser ke atas" aria-label="Geser ke atas">↑</button>
                </form>
                <form action={moveLmsGroup}>
                  <input type="hidden" name="id" value={group.id} />
                  <input type="hidden" name="programId" value={program.id} />
                  <input type="hidden" name="dir" value="down" />
                  <button type="submit" className="icon-btn" disabled={gIdx === program.groups.length - 1} title="Geser ke bawah" aria-label="Geser ke bawah">↓</button>
                </form>
                <form action={deleteLmsGroup}>
                  <input type="hidden" name="id" value={group.id} />
                  <input type="hidden" name="programId" value={program.id} />
                  <ConfirmButton
                    className="icon-btn danger"
                    title="Hapus kelompok"
                    message={`Hapus kelompok "${group.title}"? Modul di dalamnya TIDAK ikut terhapus — hanya keluar dari kelompok.`}
                  >
                    Hapus
                  </ConfirmButton>
                </form>
              </div>
            </div>

            <form action={saveLmsGroup} className="lms-group-form">
              <input type="hidden" name="id" value={group.id} />
              <input type="hidden" name="programId" value={program.id} />
              <input
                name="title"
                defaultValue={group.title}
                required
                title="Klik untuk mengganti nama kelompok"
                className="lms-group-title-input"
              />
              <button type="submit" className="btn btn-sm btn-purple lms-group-save-btn">Simpan Nama</button>
            </form>
          </div>

          <div className="lms-group-body">
            {group.modules.map((mod, mIdx) => (
              <ModuleCard
                key={mod.id}
                programId={program.id}
                mod={mod}
                label={`${gIdx + 1}.${mIdx + 1}`}
                isFirst={mIdx === 0}
                isLast={mIdx === group.modules.length - 1}
                groups={groupOptions}
                batches={batchOptions}
              />
            ))}

            {/* Tambah modul ke kelompok ini */}
            <form action={saveLmsModule} className="lms-add-module-form" style={{ marginTop: group.modules.length > 0 ? "1rem" : 0 }}>
              <input type="hidden" name="programId" value={program.id} />
              <input type="hidden" name="groupId" value={group.id} />
              <input
                name="title"
                placeholder={`Nama modul baru di Bagian ${gIdx + 1}…`}
                required
                className="lms-add-module-input"
              />
              <button type="submit" className="btn btn-sm btn-purple lms-add-module-btn">+ Tambah Modul</button>
            </form>
          </div>
        </section>
      ))}

      {/* Modul tanpa kelompok */}
      {program.modules.length > 0 && (
        <div style={{ marginTop: program.groups.length > 0 ? "1.6rem" : 0 }}>
          {program.groups.length > 0 && (
            <h3 style={{ fontSize: ".9rem", color: "var(--ink-soft)", margin: "0 0 .8rem" }}>Modul Tanpa Kelompok</h3>
          )}
          {program.modules.map((mod, mIdx) => (
            <ModuleCard
              key={mod.id}
              programId={program.id}
              mod={mod}
              label={String(mIdx + 1)}
              isFirst={mIdx === 0}
              isLast={mIdx === program.modules.length - 1}
              groups={groupOptions}
              batches={batchOptions}
            />
          ))}
        </div>
      )}

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
