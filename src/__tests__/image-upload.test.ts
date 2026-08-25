import { describe, it, expect } from "vitest";
import { compressToWebP } from "@/lib/image-compress";
import sharp from "sharp";
import { POST } from "@/app/api/upload/route";
import { NextRequest } from "next/server";

describe("Image Compression & WebP API", () => {
  it("compresses a sample raw image to WebP format", async () => {
    // Buat gambar contoh (SVG buffer lalu render ke PNG 1600x900)
    const svgBuffer = Buffer.from(`
      <svg width="1600" height="900" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#4f46e5"/>
        <text x="50%" y="50%" font-size="24" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">Testing WebP</text>
      </svg>
    `);
    const pngBuffer = await sharp(svgBuffer).png().toBuffer();

    const result = await compressToWebP(pngBuffer, {
      quality: 80,
      targetPreset: "thumbnail",
    });

    expect(result.format).toBe("webp");
    expect(result.buffer).toBeInstanceOf(Buffer);
    expect(result.compressedSize).toBeGreaterThan(0);
    expect(result.width).toBeLessThanOrEqual(1200);
    expect(result.height).toBeLessThanOrEqual(675);
  });

  it("handles POST /api/upload with multipart form data", async () => {
    // Buat gambar 800x800 lalu resize avatar ke 400x400
    const svgBuffer = Buffer.from(`
      <svg width="800" height="800" xmlns="http://www.w3.org/2000/svg">
        <circle cx="400" cy="400" r="300" fill="#059669"/>
      </svg>
    `);
    const pngBuffer = await sharp(svgBuffer).png().toBuffer();

    const formData = new FormData();
    const file = new File([pngBuffer], "avatar.png", { type: "image/png" });
    formData.append("file", file);
    formData.append("preset", "avatar");
    formData.append("quality", "85");

    const req = new NextRequest("http://localhost:3000/api/upload", {
      method: "POST",
      body: formData,
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.format).toBe("webp");
    expect(json.url).toMatch(/^\/api\/uploads\/.*\.webp$/);
    expect(json.dimensions.width).toBe(400);
    expect(json.dimensions.height).toBe(400);
  });

  it("rejects non-image files with 415 Unsupported Media Type", async () => {
    const formData = new FormData();
    const file = new File(["console.log('malicious')"], "script.js", { type: "text/javascript" });
    formData.append("file", file);

    const req = new NextRequest("http://localhost:3000/api/upload", {
      method: "POST",
      body: formData,
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(415);
    expect(json.success).toBe(false);
    expect(json.error).toContain("tidak didukung");
  });
});
