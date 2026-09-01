// app/api/v1/sales/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const targetDate = searchParams.get('date'); // YYYY-MM-DD format
    const daysBack = parseInt(searchParams.get('days') || '7', 10);

    let whereClause = '';
    const queryParams = [];

    if (targetDate) {
      whereClause = `p.status = 'PAID' AND DATE(p.createdAt) = DATE(?)`;
      queryParams.push(targetDate);
    } else {
      whereClause = `p.status = 'PAID' AND p.createdAt >= DATE_SUB(NOW(), INTERVAL ? DAY)`;
      queryParams.push(daysBack);
    }

    const query = `
      SELECT p.amount, r.programId, pr.title AS programTitle, p.createdAt
      FROM payment p
      JOIN registration r ON r.id = p.registrationId
      JOIN program pr ON pr.id = r.programId
      WHERE ${whereClause}
      ORDER BY p.createdAt DESC
    `;

    const rows = await prisma.$queryRawUnsafe(query, queryParams);

    const dailyData = (rows as any[]).reduce((acc: any, row: any) => {
      const dateStr = row.createdAt ? new Date(row.createdAt).toISOString().split('T')[0] : 'unknown';
      const program = row.programTitle || 'Unknown';
      const amount = row.amount || 0;

      if (!acc[dateStr]) {
        acc[dateStr] = {
          date: dateStr,
          totalRevenue: 0,
          transactionCount: 0,
          programRevenues: {}
        };
      }

      acc[dateStr].totalRevenue += amount;
      acc[dateStr].transactionCount += 1;
      acc[dateStr].programRevenues[program] = (acc[dateStr].programRevenues[program] || 0) + amount;

      return acc;
    }, {});

    const result = Object.values(dailyData).map((d: any) => {
      const programs = Object.entries(d.programRevenues || {}).map(([p, r]) => ({ program: p, revenue: r as number }))
        .sort((a, b) => b.revenue - a.revenue);
      const top = programs[0] || null;

      return {
        date: d.date,
        totalRevenue: d.totalRevenue,
        transactionCount: d.transactionCount,
        averageOrder: d.transactionCount > 0 ? Math.round(d.totalRevenue / d.transactionCount) : 0,
        topProgram: top?.program || null,
        topProgramRevenue: top?.revenue || 0
      };
    });

    const sorted = targetDate
      ? result.filter(item => item.date === targetDate)
      : result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, daysBack);

    return NextResponse.json({
      success: true,
      data: sorted.length > 0 ? sorted : [{
        date: targetDate || new Date().toISOString().split('T')[0],
        totalRevenue: 0,
        transactionCount: 0,
        averageOrder: 0,
        topProgram: null,
        topProgramRevenue: 0
      }],
      source: 'database',
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Sales API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
