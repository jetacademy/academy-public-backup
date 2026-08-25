import sharp, { FitEnum } from "sharp";

export interface CompressImageOptions {
  quality?: number; // 1 - 100, default 80
  width?: number; // target max width
  height?: number; // target max height
  fit?: keyof FitEnum; // 'cover' | 'contain' | 'fill' | 'inside' | 'outside'
  position?: string | number; // 'center' | 'top' | 'entropy' | 'attention'
  targetPreset?: "thumbnail" | "avatar" | "certificate" | "banner" | "article" | "original";
}

export interface CompressImageResult {
  buffer: Buffer;
  format: "webp";
  width: number;
  height: number;
  originalSize: number;
  compressedSize: number;
  compressionRatio: string;
}

/**
 * Kompres gambar ke format WebP dengan pengaturan resize/crop proporsional tanpa distorsi.
 */
export async function compressToWebP(
  inputBuffer: Buffer,
  options: CompressImageOptions = {}
): Promise<CompressImageResult> {
  const quality = Math.min(Math.max(Number(options.quality) || 80, 1), 100);
  const originalSize = inputBuffer.length;

  let pipeline = sharp(inputBuffer);
  const metadata = await pipeline.metadata();

  // Handle preset shortcut
  let targetWidth = options.width;
  let targetHeight = options.height;
  let fit: keyof FitEnum = options.fit ?? "inside";
  let position: string | number = options.position ?? "center";

  switch (options.targetPreset) {
    case "thumbnail":
      // Thumbnail rasio 16:9 (1200x675), proporsional tanpa distorsi
      targetWidth = targetWidth ?? 1200;
      targetHeight = targetHeight ?? 675;
      fit = "inside";
      break;

    case "avatar":
      // Avatar rasio 1:1 (400x400), crop center fokus wajah/tengah
      targetWidth = targetWidth ?? 400;
      targetHeight = targetHeight ?? 400;
      fit = "cover";
      position = options.position ?? "attention"; // auto focus pada subjek/kontras
      break;

    case "certificate":
      // Background sertifikat: lebar proporsional maks 1920
      targetWidth = targetWidth ?? 1920;
      fit = "inside";
      break;

    case "banner":
      // Banner hero / web header (1920x1080)
      targetWidth = targetWidth ?? 1920;
      targetHeight = targetHeight ?? 1080;
      fit = "inside";
      break;

    case "article":
      // Gambar cover/inline artikel (maks lebar 1200)
      targetWidth = targetWidth ?? 1200;
      fit = "inside";
      break;

    case "original":
      targetWidth = undefined;
      targetHeight = undefined;
      break;

    default:
      // Default: jika width/height diberikan tanpa preset, resize proporsional
      if (!targetWidth && !targetHeight && metadata.width && metadata.width > 1920) {
        targetWidth = 1920;
        fit = "inside";
      }
      break;
  }

  // Terapkan resize jika target ukuran ada
  if (targetWidth || targetHeight) {
    pipeline = pipeline.resize({
      width: targetWidth,
      height: targetHeight,
      fit: fit,
      position: position,
      withoutEnlargement: true, // jangan perbesar gambar kecil agar tidak pecah/blur
    });
  }

  // Kompres ke WebP dengan lossless/effort balance
  const compressedBuffer = await pipeline
    .webp({
      quality,
      effort: 4, // CPU effort 0-6 (4 optimal untuk server response cepat)
    })
    .toBuffer();

  const finalMetadata = await sharp(compressedBuffer).metadata();
  const compressedSize = compressedBuffer.length;
  const ratio = originalSize > 0 ? (((originalSize - compressedSize) / originalSize) * 100).toFixed(1) + "%" : "0%";

  return {
    buffer: compressedBuffer,
    format: "webp",
    width: finalMetadata.width ?? 0,
    height: finalMetadata.height ?? 0,
    originalSize,
    compressedSize,
    compressionRatio: ratio,
  };
}
