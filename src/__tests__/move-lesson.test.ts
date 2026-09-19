import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => {
  const mock: any = {
    lesson: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    lmsModule: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(async (cb: any) => cb(mock)),
  };
  return { mockPrisma: mock };
});

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/admin-auth", () => ({
  requireAdmin: vi.fn().mockResolvedValue({ id: "admin-1" }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { moveLmsLessonAction } from "@/app/webadmin/actions";

describe("moveLmsLessonAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fails if lesson not found or belongs to another program", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue(null);

    const result = await moveLmsLessonAction("prog-1", "les-1", "mod-2", 0);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("tidak ditemukan");
  });

  it("fails if target module belongs to another program", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue({
      id: "les-1",
      moduleId: "mod-1",
      module: { id: "mod-1", programId: "prog-1" },
    });
    mockPrisma.lmsModule.findUnique.mockResolvedValue({
      id: "mod-2",
      programId: "prog-2", // different program!
    });

    const result = await moveLmsLessonAction("prog-1", "les-1", "mod-2", 0);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("tidak valid");
  });

  it("moves lesson to a different module/group and recalculates orders", async () => {
    const lesson = {
      id: "les-1",
      moduleId: "mod-1",
      order: 1,
      module: { id: "mod-1", programId: "prog-1" },
    };

    mockPrisma.lesson.findUnique.mockResolvedValue(lesson);
    mockPrisma.lmsModule.findUnique.mockResolvedValue({
      id: "mod-2",
      programId: "prog-1",
    });

    // Target module currently has 1 lesson
    const targetLessons = [
      { id: "les-target-1", moduleId: "mod-2", order: 1 },
    ];
    // Source module has 1 remaining lesson
    const sourceRemaining = [
      { id: "les-source-2", moduleId: "mod-1", order: 2 },
    ];

    mockPrisma.lesson.findMany
      .mockResolvedValueOnce(targetLessons)
      .mockResolvedValueOnce(sourceRemaining);

    // Move to index 0 of mod-2
    const result = await moveLmsLessonAction("prog-1", "les-1", "mod-2", 0);
    expect(result.ok).toBe(true);

    // Verify transaction updated lesson to mod-2
    expect(mockPrisma.lesson.update).toHaveBeenCalledWith({
      where: { id: "les-1" },
      data: { moduleId: "mod-2", order: 1 },
    });

    // Target items reordered
    expect(mockPrisma.lesson.update).toHaveBeenCalledWith({
      where: { id: "les-target-1" },
      data: { order: 2 },
    });

    // Source remaining normalized
    expect(mockPrisma.lesson.update).toHaveBeenCalledWith({
      where: { id: "les-source-2" },
      data: { order: 1 },
    });
  });

  it("reorders lesson within the same module", async () => {
    const lesson = {
      id: "les-1",
      moduleId: "mod-1",
      order: 1,
      module: { id: "mod-1", programId: "prog-1" },
    };

    mockPrisma.lesson.findUnique.mockResolvedValue(lesson);
    mockPrisma.lmsModule.findUnique.mockResolvedValue({
      id: "mod-1",
      programId: "prog-1",
    });

    const moduleLessons = [
      { id: "les-1", moduleId: "mod-1", order: 1 },
      { id: "les-2", moduleId: "mod-1", order: 2 },
      { id: "les-3", moduleId: "mod-1", order: 3 },
    ];

    mockPrisma.lesson.findMany.mockResolvedValueOnce(moduleLessons);

    // Move les-1 to index 2 (at the end)
    const result = await moveLmsLessonAction("prog-1", "les-1", "mod-1", 2);
    expect(result.ok).toBe(true);

    // les-2 becomes order 1, les-3 becomes order 2, les-1 becomes order 3
    expect(mockPrisma.lesson.update).toHaveBeenCalledWith({
      where: { id: "les-2" },
      data: { order: 1 },
    });
    expect(mockPrisma.lesson.update).toHaveBeenCalledWith({
      where: { id: "les-3" },
      data: { order: 2 },
    });
    expect(mockPrisma.lesson.update).toHaveBeenCalledWith({
      where: { id: "les-1" },
      data: { order: 3 },
    });
  });
});
