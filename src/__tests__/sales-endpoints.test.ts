import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock API Auth
vi.mock("@/lib/api-auth", () => ({
  authorizeApiRequest: vi.fn(async (req: Request) => {
    const key = req.headers.get("x-api-key");
    if (key === "valid-sales-key") {
      return { ok: true, apiKey: "valid-sales-key" };
    }
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ ok: false, error: "Unauthorized: Invalid or missing API Key" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      ),
    };
  }),
}));

const mockFindManyPrograms = vi.fn();
const mockQueryRaw = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
    program: {
      findMany: (...args: unknown[]) => mockFindManyPrograms(...args),
    },
  },
}));

import { GET as getProducts } from "@/app/api/v1/sales/products/route";
import { GET as getFunnel } from "@/app/api/v1/sales/funnel/route";
import { GET as getCustomers } from "@/app/api/v1/sales/customers/route";
import { GET as getDaily } from "@/app/api/v1/sales/daily/route";
import { GET as getChannel } from "@/app/api/v1/sales/channel/route";

describe("Sales Endpoints (/api/v1/sales/*)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. /api/v1/sales/products", () => {
    it("returns 401 when unauthorized", async () => {
      const req = new NextRequest("http://localhost:3000/api/v1/sales/products");
      const res = await getProducts(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.ok).toBe(false);
    });

    it("returns program sales aggregations matching user schema", async () => {
      mockFindManyPrograms.mockResolvedValue([
        { id: "prog-1", title: "Zero Human Company", type: "BOOTCAMP", isActive: true },
        { id: "prog-2", title: "AI Workshop", type: "WORKSHOP", isActive: true },
        { id: "prog-3", title: "Obsolete Program", type: "BOOTCAMP", isActive: true },
      ]);

      mockQueryRaw.mockResolvedValueOnce([
        {
          program_id: "prog-1",
          program_title: "Zero Human Company",
          revenue: 12500000,
          transactions: BigInt(50),
        },
        {
          program_id: "prog-2",
          program_title: "AI Workshop",
          revenue: 8000000,
          transactions: BigInt(40),
        },
      ]);

      const req = new NextRequest("http://localhost:3000/api/v1/sales/products", {
        headers: { "x-api-key": "valid-sales-key" },
      });

      const res = await getProducts(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.ok).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.data.length).toBe(3);

      const top = json.data[0];
      expect(top.program).toBe("Zero Human Company");
      expect(top.revenue).toBe(12500000);
      expect(top.transactions).toBe(50);
      expect(top.avgOrder).toBe(250000);

      const second = json.data[1];
      expect(second.program).toBe("AI Workshop");
      expect(second.revenue).toBe(8000000);
      expect(second.transactions).toBe(40);
      expect(second.avgOrder).toBe(200000);

      // Program tanpa omzet tetap dicantumkan agar tahu mana yang perlu dihentikan
      const zeroProg = json.data.find((p: { program: string }) => p.program === "Obsolete Program");
      expect(zeroProg).toBeDefined();
      expect(zeroProg.revenue).toBe(0);
      expect(zeroProg.transactions).toBe(0);
      expect(zeroProg.avgOrder).toBe(0);
    });
  });

  describe("2. /api/v1/sales/funnel", () => {
    it("returns funnel metrics with impressions, clicks, leads, transactions, revenue", async () => {
      const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
      const todayStr = new Date(Date.now() + WIB_OFFSET_MS).toISOString().slice(0, 10);
      mockQueryRaw
        .mockResolvedValueOnce([
          {
            day: todayStr,
            transactions: BigInt(4),
            revenue: 2025000,
          },
        ])
        .mockResolvedValueOnce([
          {
            day: todayStr,
            leads_count: BigInt(150),
          },
        ]);

      const req = new NextRequest("http://localhost:3000/api/v1/sales/funnel?days=1", {
        headers: { "x-api-key": "valid-sales-key" },
      });

      const res = await getFunnel(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.ok).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.data.length).toBe(1);

      const day = json.data[0];
      expect(day.date).toBe(todayStr);
      expect(day.leads).toBe(150);
      expect(day.transactions).toBe(4);
      expect(day.revenue).toBe(2025000);
      expect(day.clicks).toBeGreaterThan(0);
      expect(day.impressions).toBeGreaterThan(day.clicks);
      expect(json).toHaveProperty("totals");
      expect(json.totals).toHaveProperty("cpa");
      expect(json.totals).toHaveProperty("overallRoi");
    });
  });

  describe("3. /api/v1/sales/customers", () => {
    it("returns customer retention data (new vs repeat) and topCustomer", async () => {
      mockQueryRaw.mockResolvedValueOnce([
        {
          customer_key: "08123456789",
          customer_name: "Budi Santoso",
          customer_phone: "08123456789",
          customer_email: "budi@example.com",
          total_spent: 5000000,
          transaction_count: BigInt(2),
        },
        {
          customer_key: "08987654321",
          customer_name: "Ani Wijaya",
          customer_phone: "08987654321",
          customer_email: "ani@example.com",
          total_spent: 500000,
          transaction_count: BigInt(1),
        },
      ]);

      const req = new NextRequest("http://localhost:3000/api/v1/sales/customers", {
        headers: { "x-api-key": "valid-sales-key" },
      });

      const res = await getCustomers(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.ok).toBe(true);
      expect(json.data.newCustomers).toBe(1); // Ani
      expect(json.data.repeatCustomers).toBe(1); // Budi (2 orders)
      expect(json.data.repeatRate).toBe(50);
      expect(json.data.topCustomer.name).toBe("Budi Santoso");
      expect(json.data.topCustomer.totalSpent).toBe(5000000);
    });
  });

  describe("4. /api/v1/sales/daily", () => {
    it("returns daily aggregated revenue for full month without missing dates", async () => {
      mockQueryRaw.mockResolvedValueOnce([
        {
          day: "2026-09-01",
          transactions: BigInt(2),
          revenue: 350000,
          program_title: "Zero Human Company",
        },
      ]);

      const req = new NextRequest("http://localhost:3000/api/v1/sales/daily?month=2026-09", {
        headers: { "x-api-key": "valid-sales-key" },
      });

      const res = await getDaily(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.ok).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.data.length).toBe(30); // September has 30 days

      const sep01 = json.data.find((d: { date: string }) => d.date === "2026-09-01");
      expect(sep01).toBeDefined();
      expect(sep01.revenue).toBe(350000);
      expect(sep01.transactions).toBe(2);
    });
  });

  describe("5. /api/v1/sales/channel", () => {
    it("returns channel breakdown with spend, revenue, impressions, and roi", async () => {
      mockQueryRaw
        .mockResolvedValueOnce([
          {
            source: "FACEBOOK",
            transactions: BigInt(5),
            revenue: 5000000,
          },
          {
            source: "GOOGLE",
            transactions: BigInt(4),
            revenue: 4000000,
          },
        ])
        .mockResolvedValueOnce([
          {
            source: "FACEBOOK",
            leads_count: BigInt(50),
          },
          {
            source: "GOOGLE",
            leads_count: BigInt(30),
          },
        ]);

      const req = new NextRequest("http://localhost:3000/api/v1/sales/channel?adSpend=5000000", {
        headers: { "x-api-key": "valid-sales-key" },
      });

      const res = await getChannel(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.ok).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);

      const fb = json.data.find((c: { source: string }) => c.source === "facebook");
      expect(fb).toBeDefined();
      expect(fb.revenue).toBe(5000000);
      expect(fb.spend).toBe(3000000); // 60% of 5jt
      expect(fb.roi).toBe(1.67);
    });
  });
});
