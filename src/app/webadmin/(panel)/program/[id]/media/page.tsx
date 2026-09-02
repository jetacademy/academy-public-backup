import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getMediaGallery, saveToMediaGallery, uploadFileAction } from "@/app/webadmin/actions";
import MediaGrid from "@/components/MediaGrid";

export default async function AdminMediaGallery({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ e?: string }>;
}) {
  const { id } = await params;
  const { e } = await searchParams;

  const program = await prisma.program.findUnique({
    where: { id },
    select: { id: true, title: true, slug: true },
  });
  if (!program) notFound();

  const media = await getMediaGallery(id);

  return (
    <div>
      {e === "upload" && <div className="adm-alert err">Upload gagal. File atau program tidak valid.</div>}

      <div className="adm-head">
        <div>
          <h2 style={{ fontSize: "1.15rem", margin: 0 }}>Galeri Media</h2>
          <p className="adm-note" style={{ marginTop: ".25rem" }}>
            File yang diupload di sini bisa dipilih dari form materi (PDF/Video/Gambar).
          </p>
        </div>
        <Link
          href={`/webadmin/program/${id}/media/upload`}
          className="btn btn-purple btn-sm"
        >
          + Upload Baru
        </Link>
      </div>

      <MediaGrid media={media} />

      <div
        id="upload-inline"
        style={{
          marginTop: "2rem",
          padding: "1.4rem",
          border: "2px dashed var(--chip)",
          borderRadius: "var(--r-md)",
        }}
      >
        <h3 style={{ fontSize: ".95rem", margin: "0 0 .8rem" }}>Upload File Baru</h3>
        <UploadInlineForm programId={id} />
      </div>
    </div>
  );
}

/** Inline upload form — server component wrapping a client upload */
function UploadInlineForm({ programId }: { programId: string }) {
  return (
    <form
      action={async (formData: FormData) => {
        "use server";
        formData.append("programId", programId);
        const file = formData.get("file") as File;
        if (!file || file.size === 0) return;

        // Upload file fisik dulu
        const uploadResult = await uploadFileAction(formData);
        if (uploadResult.error || !uploadResult.url) return;

        // Simpan ke gallery
        await saveToMediaGallery(
          programId,
          file.name,
          uploadResult.url,
          file.type,
          file.size,
        );
      }}
      style={{ display: "flex", gap: ".6rem", alignItems: "center", flexWrap: "wrap" }}
    >
      <input
        type="file"
        name="file"
        accept=".pdf,.png,.jpg,.jpeg,.webp"
        required
        style={{ fontSize: ".85rem" }}
      />
      <button type="submit" className="btn btn-purple btn-sm">
        Upload
      </button>
    </form>
  );
}
