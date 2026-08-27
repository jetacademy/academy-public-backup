import { describe, it, expect, vi } from "vitest";
import sharp from "sharp";

// Mock prisma khusus verifikasi API key — tidak sentuh DB sungguhan.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    apiKey: {
      findUnique: vi.fn(async ({ where }: { where: { key: string } }) =>
        where.key === "kunci-cron-valid"
          ? { id: "key-1", key: "kunci-cron-valid", isActive: true }
          : null
      ),
      update: vi.fn(async () => ({})),
    },
  },
}));

import { POST } from "@/app/api/upload/route";
import { NextRequest } from "next/server";

async function makePngFile(): Promise<File> {
  const svg = Buffer.from(
    `<svg width="600" height="400" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#059669"/></svg>`
  );
  const png = await sharp(svg).png().toBuffer();
  return new File([png as unknown as BlobPart], "cover.png", { type: "image/png" });
}

describe("POST /api/upload dengan X-API-Key (jalur cron artikel)", () => {
  it("menerima upload machine-to-machine via X-API-Key valid", async () => {
    const formData = new FormData();
    formData.append("file", await makePngFile());
    formData.append("preset", "thumbnail");

    const req = new NextRequest("http://localhost:3000/api/upload", {
      method: "POST",
      body: formData,
    });
    req.headers.set("x-api-key", "kunci-cron-valid");

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.url).toMatch(/^\/api\/uploads\/.*\.webp$/);
  });

  it("menolak X-API-Key salah dengan 401", async () => {
    const formData = new FormData();
    formData.append("file", await makePngFile());

    const req = new NextRequest("http://localhost:3000/api/upload", {
      method: "POST",
      body: formData,
    });
    req.headers.set("x-api-key", "kunci-salah");

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.success).toBe(false);
  });
});
