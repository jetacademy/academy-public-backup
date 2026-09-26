import { getPrograms } from "@/lib/programs";
import { prisma } from "@/lib/prisma";
import ProgramListClient from "@/components/ProgramListClient";

// ISR 5 menit — katalog publik tanpa data personal. Sebelumnya force-dynamic: tiap
// kunjungan = 2 query DB. Simpan/hapus program & kategori di admin memanggil
// revalidatePath("/program"), jadi perubahan tetap langsung tampil.
export const revalidate = 300;

export const metadata = {
  title: "Kursus AI Bersertifikat — Semua Program Pelatihan",
  description:
    "Jelajahi semua kursus AI, webinar gratis, kelas online, workshop, dan bootcamp AI bersertifikat di Jetschool Academy.",
  alternates: { canonical: "/program" },
};

export default async function ProgramPage() {
  const { programs } = await getPrograms();
  
  // Ambil semua kategori untuk filter
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
    }
  }).catch(() => []);

  return <ProgramListClient initialPrograms={programs} categories={categories} />;
}
