import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { compressToWebP, CompressImageOptions } from "@/lib/image-compress";
import { randomBytes } from "crypto";
import { getAdminSession, verifyAdminCookieValue } from "@/lib/admin-auth";
import { authorizeApiRequest } from "@/lib/api-auth";

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? join(process.env.HOME || "/tmp", "jetschool-uploads");

const ALLOWED_IMAGE_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
  "image/tiff",
  "image/bmp",
  // image/svg+xml sengaja dihapus — parsing SVG berisiko XXE/SSRF & tidak perlu (output selalu WebP)
];

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

/**
 * Autentikasi upload: sesi admin/teacher (cookie webadmin) ATAU
 * API key machine-to-machine via header X-API-Key (mis. cron artikel harian).
 * Return null jika diizinkan, atau response penolakan.
 */
async function authorizeUpload(req: NextRequest): Promise<NextResponse | null> {
  const rawCookie = req.cookies.get("jsa_admin")?.value;
  const session = rawCookie
    ? await verifyAdminCookieValue(rawCookie)
    : await getAdminSession().catch(() => null);
  if (session) return null;

  const apiAuth = await authorizeApiRequest(req, {
    rateLimitKey: "api-upload-key",
    max: 20,
    windowMs: 60_000,
  });
  if (!apiAuth.ok) {
    // Pertahankan bentuk respons lama endpoint ini ({success:false,...}).
    const body = (await apiAuth.response.json().catch(() => ({}))) as { error?: string };
    return NextResponse.json(
      { success: false, error: body.error ?? "Tidak diizinkan." },
      { status: apiAuth.response.status }
    );
  }
  return null;
}

/**
 * POST /api/upload
 * Endpoint untuk upload gambar, otomatis dikompres ke WebP dengan fitur resize & crop proporsional.
 */
export async function POST(req: NextRequest) {
  try {
    // Wajib sesi admin/teacher ATAU X-API-Key — endpoint ini menulis file ke disk, tidak boleh publik.
    const denied = await authorizeUpload(req);
    if (denied) return denied;

    const contentType = req.headers.get("content-type") || "";

    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { success: false, error: "Content-Type harus multipart/form-data" },
        { status: 400 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file || !(file instanceof File) || file.size === 0) {
      return NextResponse.json(
        { success: false, error: "File gambar tidak ditemukan atau kosong." },
        { status: 400 }
      );
    }

    // 1. Validasi Ukuran File
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { success: false, error: `Ukuran file melebihi batas maksimal (${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB).` },
        { status: 413 }
      );
    }

    // 2. Validasi Tipe MIME
    if (!ALLOWED_IMAGE_MIMES.includes(file.type.toLowerCase())) {
      return NextResponse.json(
        {
          success: false,
          error: `Format '${file.type}' tidak didukung. Unggah gambar bertipe: JPG, PNG, WebP, AVIF, GIF.`,
        },
        { status: 415 }
      );
    }

    // 3. Ekstrak Opsi Kompresi & Resize
    const qualityParam = formData.get("quality");
    const widthParam = formData.get("width");
    const heightParam = formData.get("height");
    const fitParam = formData.get("fit");
    const targetPreset = (formData.get("preset") || formData.get("target")) as CompressImageOptions["targetPreset"];
    const customPrefix = formData.get("prefix") ? String(formData.get("prefix")).replace(/[^a-zA-Z0-9_-]/g, "") : "";

    const options: CompressImageOptions = {
      quality: qualityParam ? parseInt(String(qualityParam), 10) : 80,
      width: widthParam ? parseInt(String(widthParam), 10) : undefined,
      height: heightParam ? parseInt(String(heightParam), 10) : undefined,
      fit: (fitParam as CompressImageOptions["fit"]) || undefined,
      targetPreset: targetPreset || undefined,
    };

    // 4. Baca file ke Buffer & Kompres dengan Sharp ke WebP
    const arrayBuffer = await file.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);

    const result = await compressToWebP(inputBuffer, options);

    // 5. Simpan ke Direktori Penyimpanan Persisten
    await mkdir(UPLOADS_DIR, { recursive: true });

    const cleanBaseName = (file.name.substring(0, file.name.lastIndexOf(".")) || file.name)
      .replace(/[^a-zA-Z0-9-_]/g, "_")
      .toLowerCase()
      .substring(0, 40);

    const randomSuffix = randomBytes(3).toString("hex");
    const timestamp = Date.now();
    const prefixStr = customPrefix ? `${customPrefix}-` : "";
    const filename = `${prefixStr}${timestamp}-${cleanBaseName}-${randomSuffix}.webp`;

    const targetFilePath = join(UPLOADS_DIR, filename);
    await writeFile(targetFilePath, result.buffer);

    const fileUrl = `/api/uploads/${filename}`;

    return NextResponse.json({
      success: true,
      url: fileUrl,
      filename,
      format: "webp",
      dimensions: {
        width: result.width,
        height: result.height,
      },
      size: {
        originalBytes: result.originalSize,
        compressedBytes: result.compressedSize,
        compressionRatio: result.compressionRatio,
      },
      message: `Gambar berhasil dikompres ke WebP (${result.compressionRatio} lebih hemat).`,
    });
  } catch (error) {
    console.error("[API Upload Image Error]:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Gagal memproses dan mengompres gambar.",
      },
      { status: 500 }
    );
  }
}
