/**
 * Seed: Zero Human Company — Workshop 6 AI Agent untuk Bisnis
 * Program WORKSHOP berbayar Rp 225.000, batch berurutan.
 *
 * Jalankan: npx tsx prisma/seed-zero-human-company.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** Helper: buat Date jam 13:00 WIB (UTC 06:00) */
function makeDate(day: number, month: number, year: number = 2026): Date {
  return new Date(Date.UTC(year, month - 1, day, 6, 0, 0));
}

async function main() {
  console.log("=== SEED: Zero Human Company ===");

  // ── 0. HAPUS PROGRAM LAMA (jika sudah ada) ─────────────────────
  const old = await prisma.program.findUnique({ where: { slug: "zero-human-company" } });
  if (old) {
    await prisma.question.deleteMany({ where: { programId: old.id } });
    await prisma.lesson.deleteMany({ where: { module: { programId: old.id } } });
    await prisma.lmsModule.deleteMany({ where: { programId: old.id } });
    await prisma.lmsGroup.deleteMany({ where: { programId: old.id } });
    await prisma.programBatch.deleteMany({ where: { programId: old.id } });
    await prisma.program.delete({ where: { id: old.id } });
    console.log("✓ Program lama dihapus.");
  }

  // ── 1. KATEGORI ──────────────────────────────────────────────────
  await prisma.category.upsert({
    where: { slug: "ai-bisnis-digital" },
    create: { slug: "ai-bisnis-digital", name: "AI & Bisnis Digital", isFeatured: true },
    update: {},
  });
  const category = await prisma.category.findUnique({ where: { slug: "ai-bisnis-digital" } });

  // ── 2. PROGRAM ────────────────────────────────────────────────────
  const program = await prisma.program.create({
    data: {
      slug: "zero-human-company",
      type: "WORKSHOP",
      title: "Zero Human Company: Membangun Perusahaan Tanpa Karyawan dengan Agent AI",
      tagline: "Rekrut 6 Karyawan AI untuk Bisnis Anda dalam 3 Jam — Kerja 24 Jam, Tanpa Digaji Bulanan.",
      description:
        "Workshop intensif 3 jam: pelajari cara merekrut & mengoperasikan 6 Karyawan AI (AI Agent) untuk mengotomatisasi customer service, konten, marketing, sales, developer, dan laporan bisnis Anda — berjalan 24 jam tanpa gaji bulanan. Pulang-pulang, Karyawan AI Anda sudah terhubung ke WhatsApp dan siap bekerja.",
      emoji: "🤖",
      mentorName: "Tim Jetschool Academy",
      mentorBio:
        "Tim praktisi AI yang telah membantu puluhan UMKM dan startup Indonesia mengotomatisasi operasional bisnis mereka menggunakan AI Agent.",
      materi: [
        "Customer Service Agent — jawab pelanggan 24 jam via WA",
        "Content Agent — tulis & publikasi artikel otomatis",
        "Marketing Agent — riset konten, caption, penjadwalan",
        "Sales Agent — follow-up prospek otomatis & terstruktur",
        "Developer Agent — perbaiki bugs & tambah fitur website",
        "Report Agent — laporan bisnis harian otomatis via WA",
      ],
      deliverables: [
        { label: "Praktik langsung merekrut & merakit 6 Karyawan AI (CS, Content, Marketing, Sales, Developer, Report)", value: 299000 },
        { label: "Hubungkan Agent dengan WhatsApp — langsung praktek", value: 199000 },
        { label: "Rekaman Workshop (akses seumur hidup)", value: 149000 },
        { label: "e-Sertifikat Resmi + Grup WA Alumni", value: 0 },
      ],
      guarantee: null,
      scheduleAt: makeDate(30, 7),
      durationLabel: "3 jam · Live Zoom",
      price: 225000,
      priceOld: 490000,
      certPrice: 0,
      seatsLeft: 20,
      passingScore: 70,
      isActive: true,
      isFeatured: true,
      categoryId: category?.id ?? null,
    },
  });
  console.log(`✓ Program dibuat: ${program.slug} (ID: ${program.id})`);

  // ── 3. BATCH ──────────────────────────────────────────────────────
  const batchDates = [
    { label: "BATCH-001", date: makeDate(30, 7) },  // 30 Juli 2026
    { label: "BATCH-002", date: makeDate(6, 8) },   // 6 Agustus 2026
    { label: "BATCH-003", date: makeDate(13, 8) },  // 13 Agustus 2026
  ];

  for (const b of batchDates) {
    await prisma.programBatch.create({
      data: { programId: program.id, scheduleAt: b.date, seatsLeft: 20, isActive: true },
    });
    console.log(`   ${b.label}: ${b.date.toISOString()}`);
  }

  console.log(`✓ (Workshop murni — tanpa LMS modul. Strategi upsell terpisah.)`);

  console.log("\n=== SEED SELESAI ===");
  console.log(`📋 Program: Zero Human Company`);
  console.log(`   URL     : /program/zero-human-company`);
  console.log(`   Harga   : Rp 225.000 (WORKSHOP)`);
  console.log(`   Batch   : 3 batch (30 Jul — 13 Agu 2026)`);
  console.log(`   Modul   : Workshop murni — 3 jam live Zoom`);
}

main()
  .catch((e) => { console.error("❌ Gagal:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
