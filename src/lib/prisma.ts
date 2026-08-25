import { PrismaClient } from "@prisma/client";

// Singleton supaya hot-reload dev & multi-chunk SSR production tidak membuka koneksi MySQL berulang
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

globalForPrisma.prisma = prisma;
