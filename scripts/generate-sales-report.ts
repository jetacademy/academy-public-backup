#!/usr/bin/env node
// generate-sales-report.ts
// Jalankan: npx tsx scripts/generate-sales-report.ts [YYYY-MM-DD]

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type DailySale = {
  date: string;
  totalRevenue: number;
  transactionCount: number;
  averageOrder: number;
  topProgram: string | null;
  topProgramRevenue: number;
};

async function generateReport(targetDate?: string, daysBack = 7) {
  try {
    const whereClause = targetDate
      ? "p.status = 'PAID' AND DATE(p.createdAt) = DATE($1)"
      : "p.status = 'PAID'";

    const query = targetDate
      ? `SELECT p.amount, r.programId, pr.title AS programTitle, p.createdAt FROM payment p JOIN registration r ON r.id = p.registrationId JOIN program pr ON pr.id = r.programId WHERE ${whereClause}`
      : `SELECT p.amount, r.programId, pr.title AS programTitle, p.createdAt FROM payment p JOIN registration r ON r.id = p.registrationId JOIN program pr ON pr.id = r.programId WHERE p.status = 'PAID' AND p.createdAt >= DATE_SUB(CURRENT_DATE, INTERVAL ${daysBack} DAY)`;

    const rows = targetDate
      ? await prisma.$queryRawUnsafe(query, targetDate)
      : await prisma.$queryRawUnsafe(query);

    const dailyData = (rows as any[]).reduce((acc: any, row: any) => {
      const dateStr = row.createdAt ? new Date(row.createdAt).toISOString().split('T')[0] : 'unknown';
      const program = row.programTitle || 'Unknown';
      const amount = row.amount || 0;
      if (!acc[dateStr]) {
        acc[dateStr] = { date: dateStr, totalRevenue: 0, transactionCount: 0, programRevenues: {} };
      }
      acc[dateStr].totalRevenue += amount;
      acc[dateStr].transactionCount += 1;
      acc[dateStr].programRevenues[program] = (acc[dateStr].programRevenues[program] || 0) + amount;
      return acc;
    }, {});

    const result: DailySale[] = Object.values(dailyData).map((d: any) => {
      const programs = Object.entries(d.programRevenues || {}).map(([p, r]) => ({ p, r: r as number })).sort((a,b) => b.r - a.r);
      const top = programs[0] || null;
      return {
        date: d.date,
        totalRevenue: d.totalRevenue,
        transactionCount: d.transactionCount,
        averageOrder: d.transactionCount > 0 ? Math.round(d.totalRevenue / d.transactionCount) : 0,
        topProgram: top?.p || null,
        topProgramRevenue: top?.r || 0,
      };
    });

    const sorted = targetDate 
      ? result.filter((r) => r.date === targetDate) 
      : result.sort((a,b) => b.date.localeCompare(a.date)).slice(0, daysBack);

    const finalResult = sorted.length 
      ? sorted 
      : [{ date: targetDate || new Date().toISOString().split('T')[0], totalRevenue: 0, transactionCount: 0, averageOrder: 0, topProgram: null, topProgramRevenue: 0 }];

    console.log(JSON.stringify({
      success: true,
      data: finalResult,
      source: "database",
      generatedAt: new Date().toISOString(),
    }, null, 2));

    return finalResult;
  } catch (error: any) {
    console.error("Error:", error?.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

const dateArg = process.argv[2];
generateReport(dateArg);