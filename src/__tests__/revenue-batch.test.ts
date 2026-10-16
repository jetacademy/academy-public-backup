import { describe, it, expect } from "vitest";
import { getDaysLeftDetail } from "@/lib/revenue";

describe("getDaysLeftDetail", () => {
  it("calculates 'Hari ini' when event is on the same day in WIB", () => {
    const now = new Date("2026-10-16T08:00:00.000Z"); // 15:00 WIB
    const event = new Date("2026-10-16T13:00:00.000Z"); // 20:00 WIB
    const res = getDaysLeftDetail(event, now);
    expect(res.daysLeft).toBe(0);
    expect(res.isPast).toBe(false);
    expect(res.isToday).toBe(true);
    expect(res.label).toBe("Hari ini");
    expect(res.shortLabel).toBe("Hari ini");
  });

  it("calculates 'Besok (1 hari lagi)' for event tomorrow in WIB", () => {
    const now = new Date("2026-10-16T12:00:00.000Z"); // 19:00 WIB
    const event = new Date("2026-10-17T02:00:00.000Z"); // 09:00 WIB besok
    const res = getDaysLeftDetail(event, now);
    expect(res.daysLeft).toBe(1);
    expect(res.isPast).toBe(false);
    expect(res.isToday).toBe(false);
    expect(res.label).toBe("Besok (1 hari lagi)");
    expect(res.shortLabel).toBe("Besok");
  });

  it("calculates 'X hari lagi' for event several days away", () => {
    const now = new Date("2026-10-16T00:00:00.000Z");
    const event = new Date("2026-10-20T00:00:00.000Z");
    const res = getDaysLeftDetail(event, now);
    expect(res.daysLeft).toBe(4);
    expect(res.isPast).toBe(false);
    expect(res.label).toBe("4 hari lagi");
    expect(res.shortLabel).toBe("4 hari lagi");
  });

  it("calculates 'Selesai' for past event", () => {
    const now = new Date("2026-10-16T00:00:00.000Z");
    const event = new Date("2026-10-10T00:00:00.000Z");
    const res = getDaysLeftDetail(event, now);
    expect(res.daysLeft).toBeLessThan(0);
    expect(res.isPast).toBe(true);
    expect(res.label).toBe("Selesai");
    expect(res.shortLabel).toBe("Selesai");
  });
});

import { getPaymentReminderEmailHtml } from "@/lib/email";

describe("getPaymentReminderEmailHtml", () => {
  it("renders email with sapaan Kaka, program title, and invoice link", () => {
    const html = getPaymentReminderEmailHtml({
      name: "Budi Santoso",
      programTitle: "Zero Human Company",
      batchName: "Batch 12",
      price: 225000,
      invoiceUrl: "https://checkout.xendit.co/v2/invoice-12345",
    });

    // Validasi sapaan Kaka
    expect(html).toContain("Halo Kaka Budi Santoso");
    // Validasi judul program & batch
    expect(html).toContain("Zero Human Company");
    expect(html).toContain("Batch 12");
    // Validasi link invoice
    expect(html).toContain("https://checkout.xendit.co/v2/invoice-12345");
    // Validasi format rupiah
    expect(html).toContain("Rp");
    expect(html).toContain("225.000");
  });
});

