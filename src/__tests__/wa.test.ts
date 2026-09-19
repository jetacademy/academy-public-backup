import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { normalizeWa, validateWaNumber, sendWaDetailed } from "@/lib/wa";

describe("WhatsApp Phone Number Normalization & Validation", () => {
  describe("normalizeWa", () => {
    it("normalizes standard 08 numbers to 628", () => {
      expect(normalizeWa("081234567890")).toBe("6281234567890");
    });

    it("normalizes numbers starting with 8 to 628", () => {
      expect(normalizeWa("81234567890")).toBe("6281234567890");
    });

    it("normalizes numbers with +62 prefix", () => {
      expect(normalizeWa("+6281234567890")).toBe("6281234567890");
    });

    it("fixes common typo +62 08... or 6208... to 628...", () => {
      expect(normalizeWa("+62 0812 3456 7890")).toBe("6281234567890");
      expect(normalizeWa("62081234567890")).toBe("6281234567890");
    });

    it("strips international exit code 00 prefix (0062... -> 62...)", () => {
      expect(normalizeWa("006281234567890")).toBe("6281234567890");
    });

    it("cleans spaces, dashes, parentheses", () => {
      expect(normalizeWa("(0812) 345-678-90")).toBe("6281234567890");
    });

    it("handles international numbers outside Indonesia", () => {
      expect(normalizeWa("+60 12 345 6789")).toBe("60123456789");
    });

    it("returns empty string for empty or null inputs", () => {
      expect(normalizeWa("")).toBe("");
      expect(normalizeWa("   ")).toBe("");
    });
  });

  describe("validateWaNumber", () => {
    it("validates correct Indonesian mobile number", () => {
      const res = validateWaNumber("081234567890");
      expect(res.valid).toBe(true);
      expect(res.normalized).toBe("6281234567890");
      expect(res.reason).toBeUndefined();
    });

    it("detects and rejects email addresses saved in phone field", () => {
      const res = validateWaNumber("peserta@gmail.com");
      expect(res.valid).toBe(false);
      expect(res.reason).toContain("email");
    });

    it("rejects empty phone numbers", () => {
      const res = validateWaNumber("");
      expect(res.valid).toBe(false);
      expect(res.reason).toContain("kosong");
    });

    it("rejects numbers that are too short (< 10 digits)", () => {
      const res = validateWaNumber("0812345");
      expect(res.valid).toBe(false);
      expect(res.reason).toContain("terlalu pendek");
    });

    it("rejects numbers that are too long (> 15 digits)", () => {
      const res = validateWaNumber("081234567890123456");
      expect(res.valid).toBe(false);
      expect(res.reason).toContain("terlalu panjang");
    });

    it("rejects Indonesian non-mobile phone (e.g. landline 021)", () => {
      const res = validateWaNumber("0215551234");
      expect(res.valid).toBe(false);
      expect(res.reason).toContain("Bukan nomor HP seluler");
    });
  });

  describe("sendWaDetailed", () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
      process.env.EVOLUTION_API_URL = "https://wa.example.com";
      process.env.EVOLUTION_API_API_KEY = "valid_key_123";
      process.env.EVOLUTION_API_INSTANCE = "jetschool";
    });

    afterEach(() => {
      process.env = { ...originalEnv };
      vi.restoreAllMocks();
    });

    it("fails early without HTTP call if phone number format is invalid", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      const res = await sendWaDetailed("budi@email.com", "Halo Budi");
      expect(res.ok).toBe(false);
      expect(res.error).toContain("email");
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("returns friendly error message when number is not registered on WA (400)", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ response: { message: "Number is not registered on whatsapp" } }),
      } as Response);

      const res = await sendWaDetailed("081299998888", "Halo");
      expect(res.ok).toBe(false);
      expect(res.statusCode).toBe(400);
      expect(res.error).toBe("Nomor tidak terdaftar di WhatsApp");
    });

    it("returns rate limit friendly error on 429", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ message: "Too many requests" }),
      } as Response);

      const res = await sendWaDetailed("081299998888", "Halo");
      expect(res.ok).toBe(false);
      expect(res.statusCode).toBe(429);
      expect(res.error).toContain("Rate limit");
    });

    it("succeeds when Evolution API returns 200/201", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ key: { id: "msg_123" } }),
      } as Response);

      const res = await sendWaDetailed("081299998888", "Halo");
      expect(res.ok).toBe(true);
      expect(res.statusCode).toBe(200);
      expect(res.targetPhone).toBe("6281299998888");
    });
  });
});
