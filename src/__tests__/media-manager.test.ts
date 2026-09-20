import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("@/lib/admin-auth", () => ({
  requireAdmin: vi.fn().mockResolvedValue({ id: "admin-1" }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const mockMediaFindUnique = vi.fn();
const mockMediaDelete = vi.fn();
const mockMediaCreate = vi.fn();
const mockMediaFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    media: {
      findUnique: (...args: unknown[]) => mockMediaFindUnique(...args),
      delete: (...args: unknown[]) => mockMediaDelete(...args),
      create: (...args: unknown[]) => mockMediaCreate(...args),
      findMany: (...args: unknown[]) => mockMediaFindMany(...args),
    },
  },
}));

vi.mock("fs/promises", () => ({
  unlink: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

import { deleteMediaAction, uploadToMediaGalleryAction } from "@/app/webadmin/actions";

describe("Media Manager Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("deleteMediaAction", () => {
    it("successfully deletes media record and unlinks file", async () => {
      mockMediaFindUnique.mockResolvedValueOnce({
        id: "media-1",
        url: "/api/uploads/123456-test.webp",
        programId: "prog-1",
      });
      mockMediaDelete.mockResolvedValueOnce({ id: "media-1" });

      const res = await deleteMediaAction("media-1", "prog-1");
      expect(res.ok).toBe(true);
      expect(mockMediaFindUnique).toHaveBeenCalledWith({
        where: { id: "media-1" },
        select: { id: true, url: true, programId: true },
      });
      expect(mockMediaDelete).toHaveBeenCalledWith({ where: { id: "media-1" } });
    });

    it("returns error if media does not exist", async () => {
      mockMediaFindUnique.mockResolvedValueOnce(null);

      const res = await deleteMediaAction("non-existent");
      expect(res.ok).toBe(false);
      expect(res.error).toBe("Media tidak ditemukan.");
      expect(mockMediaDelete).not.toHaveBeenCalled();
    });
  });

  describe("uploadToMediaGalleryAction", () => {
    it("returns error if file is missing", async () => {
      const fd = new FormData();
      fd.append("programId", "prog-1");

      const res = await uploadToMediaGalleryAction(fd);
      expect(res.ok).toBe(false);
      expect(res.error).toBe("File tidak ditemukan.");
    });

    it("returns error if programId is missing", async () => {
      const fd = new FormData();
      const file = new File(["dummy"], "sample.png", { type: "image/png" });
      fd.append("file", file);

      const res = await uploadToMediaGalleryAction(fd);
      expect(res.ok).toBe(false);
      expect(res.error).toBe("Program ID diperlukan.");
    });
  });
});
