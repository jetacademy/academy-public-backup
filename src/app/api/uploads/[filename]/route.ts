import { NextResponse } from "next/server";
import { mkdir, readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

// Upload ke folder persisten di luar project (biar nggak ilang saat rebuild)
const UPLOADS_DIR = process.env.UPLOADS_DIR ?? join(process.env.HOME || "/tmp", "jetschool-uploads");

const MIME_MAP: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  pdf: "application/pdf",
};

/**
 * GET /api/uploads/:filename
 * Menyajikan file upload dari direktori persistent (luar public/).
 * Tidak perlu remotePatterns, tidak hilang saat redeploy.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  // Pastikan folder uploads ada (auto-terbuat kalau ilang pas rebuild)
  await mkdir(UPLOADS_DIR, { recursive: true }).catch(() => {});

  // Security: cegah path traversal
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const filePath = join(/* turbopackIgnore: true */ UPLOADS_DIR, filename);

  if (!existsSync(/* turbopackIgnore: true */ filePath)) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const ext = (filename.split(".").pop() ?? "").toLowerCase();
  const contentType = MIME_MAP[ext] ?? "application/octet-stream";

  try {
    const buffer = await readFile(/* turbopackIgnore: true */ filePath);
    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Content-Length": buffer.length.toString(),
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=31536000, immutable",
      "Access-Control-Allow-Origin": "*",
    };

    if (ext === "pdf") {
      headers["Content-Disposition"] = `inline; filename="${filename}"`;
    }

    return new NextResponse(buffer, {
      headers,
    });
  } catch {
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
