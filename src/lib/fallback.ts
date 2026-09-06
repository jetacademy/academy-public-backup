// Data contoh yang tampil sebelum database MySQL terhubung / di-seed.
// Bentuknya sama dengan model Program di Prisma.

import type { ContentBlock } from "@/lib/content-blocks";

export type ProgramType = "WEBINAR" | "KELAS" | "WORKSHOP" | "BOOTCAMP";

export type Deliverable = { label: string; value: number };

export type ProgramData = {
  id: string;
  slug: string;
  type: ProgramType;
  title: string;
  tagline: string;
  description: string;
  emoji: string;
  mentorName: string;
  mentorBio: string;
  materi: string[];
  deliverables: Deliverable[];
  guarantee: string | null;
  contentBlocks?: ContentBlock[];
  scheduleAt: Date;
  durationLabel: string;
  waGroupLink: string | null;
  lmsLink: string | null;
  price: number;
  priceOld: number | null;
  certPrice: number;
  certPriceOld: number | null;
  seatsLeft: number | null;
  imageUrl?: string | null;
  categoryId?: string | null;
  category?: {
    id: string;
    name: string;
    slug: string;
    isFeatured: boolean;
  } | null;
  isFeatured?: boolean;
  batches?: {
    id: string;
    name?: string | null;
    batchType?: string;
    scheduleAt: Date;
    seatsLeft: number | null;
    offlineVenue?: string | null;
    offlineScheduleAt?: Date | null;
    priceOnline?: number | null;
    priceOnlineEb?: number | null;
    quotaOnlineEb?: number | null;
    priceOffline?: number | null;
    priceOfflineEb?: number | null;
    quotaOfflineEb?: number | null;
    offlineSeatsMax?: number | null;
  }[];
};

/** Label tipe program untuk tampilan */
export const TYPE_LABEL: Record<ProgramType, string> = {
  WEBINAR: "Webinar Gratis",
  KELAS: "Kelas Online",
  WORKSHOP: "Workshop",
  BOOTCAMP: "Bootcamp",
};

export function nextDay(dayOfWeek: number, hour: number): Date {
  const now = new Date();
  const d = new Date(now);
  d.setHours(hour, 0, 0, 0);
  let add = (dayOfWeek - d.getDay() + 7) % 7;
  if (add === 0 && d <= now) add = 7;
  d.setDate(d.getDate() + add);
  return d;
}

const GUARANTEE =
  "E-sertifikat resmi diterbitkan secara otomatis setelah Anda menyelesaikan evaluasi pasca-pelatihan.";

export const FALLBACK_PROGRAMS: ProgramData[] = [
  {
    id: "fallback-1",
    slug: "digital-marketing-pemula",
    type: "WEBINAR",
    title: "Digital Marketing untuk Pemula",
    tagline: "Dapatkan Pelanggan Pertama Anda dari Instagram dalam 30 Hari.",
    description: "Webinar live: strategi pemasaran melalui media sosial dan iklan Meta — dari nol hingga siap dipraktikkan.",
    emoji: "📱",
    mentorName: "Arif Pratama",
    mentorBio: "Praktisi digital marketing 8+ tahun; mengelola iklan dengan total belanja miliaran rupiah untuk UMKM Indonesia.",
    materi: [
      "Pola pikir pemasaran online yang tepat untuk memulai",
      "Riset produk dan target pasar secara cepat dan terarah",
      "Membuat konten media sosial yang menjual, tanpa keahlian desain",
      "Dasar-dasar iklan Meta (Facebook & Instagram Ads)",
      "Rencana kerja 30 hari pertama memulai penjualan online",
    ],
    deliverables: [
      { label: "e-Sertifikat resmi ber-QR code", value: 149000 },
      { label: "Rekaman full webinar (akses selamanya)", value: 99000 },
      { label: "Template konten 30 hari siap pakai", value: 79000 },
      { label: "Grup alumni & tanya-jawab mentor", value: 0 },
    ],
    guarantee: GUARANTEE,
    scheduleAt: nextDay(6, 19),
    durationLabel: "2 jam · live Zoom",
    waGroupLink: null,
    lmsLink: null,
    price: 0,
    priceOld: null,
    certPrice: 49000,
    certPriceOld: 149000,
    seatsLeft: 100,
    categoryId: "cat-4",
    category: { id: "cat-4", name: "UMKM & Pemasaran", slug: "umkm-pemasaran", isFeatured: true },
    isFeatured: true,
  },
  {
    id: "fallback-2",
    slug: "kelas-ai-untuk-kerja",
    type: "KELAS",
    title: "Kelas Online: AI untuk Dunia Kerja",
    tagline: "Selesaikan Pekerjaan Kantor 2× Lebih Cepat dengan Bantuan AI — Bersertifikat.",
    description: "Kelas online mandiri: memanfaatkan ChatGPT dan AI tools untuk laporan, email, presentasi, dan analisis data.",
    emoji: "🤖",
    mentorName: "Nadia Rahma",
    mentorBio: "AI trainer korporat; telah melatih 3.000+ karyawan perusahaan nasional menggunakan AI secara produktif dan aman.",
    materi: [
      "Dasar penyusunan prompt agar hasil AI akurat",
      "30 prompt siap pakai: laporan, email, notulen, presentasi",
      "Analisis data di Excel dengan bantuan AI",
      "Etika dan keamanan data dalam penggunaan AI di kantor",
      "Studi kasus efisiensi pekerjaan harian",
    ],
    deliverables: [
      { label: "Akses materi selamanya (video & modul)", value: 299000 },
      { label: "30 prompt siap pakai untuk pekerjaan kantor", value: 149000 },
      { label: "e-Sertifikat resmi ber-QR code (3 JP)", value: 149000 },
      { label: "Grup alumni + update materi gratis", value: 0 },
    ],
    guarantee: GUARANTEE,
    scheduleAt: nextDay(1, 9),
    durationLabel: "Belajar mandiri · akses selamanya",
    waGroupLink: null,
    lmsLink: null,
    price: 149000,
    priceOld: 299000,
    certPrice: 0,
    certPriceOld: null,
    seatsLeft: null,
    categoryId: "cat-5",
    category: { id: "cat-5", name: "Produktivitas & Dunia Kerja", slug: "produktivitas-dunia-kerja", isFeatured: true },
    isFeatured: true,
  },
  {
    id: "fallback-3",
    slug: "workshop-excel-praktik",
    type: "WORKSHOP",
    title: "Workshop Excel: Laporan Otomatis dalam 1 Hari",
    tagline: "Satu Hari Praktik, Laporan Bulanan Anda Menjadi Otomatis.",
    description: "Workshop live dengan praktik langsung: menyusun laporan dan dashboard otomatis dari data mentah.",
    emoji: "📊",
    mentorName: "Sinta Dewi",
    mentorBio: "Data analyst & trainer korporat; 6 tahun melatih karyawan perusahaan nasional menggunakan Excel secara efisien.",
    materi: [
      "Rumus penting dunia kerja: VLOOKUP, IF, SUMIFS",
      "Pivot table: merangkum ribuan baris data dalam hitungan detik",
      "Menyusun dashboard laporan otomatis dari nol",
      "Teknik format dan pintasan untuk bekerja lebih cepat",
      "Praktik langsung dengan pendampingan mentor",
    ],
    deliverables: [
      { label: "Sesi live 4 jam + praktik dipandu", value: 199000 },
      { label: "Template dashboard siap pakai", value: 99000 },
      { label: "e-Sertifikat resmi ber-QR code", value: 149000 },
      { label: "Rekaman workshop (akses selamanya)", value: 99000 },
    ],
    guarantee: GUARANTEE,
    scheduleAt: nextDay(0, 9),
    durationLabel: "1 hari · 4 jam live",
    waGroupLink: null,
    lmsLink: null,
    price: 99000,
    priceOld: 199000,
    certPrice: 0,
    certPriceOld: null,
    seatsLeft: 25,
    categoryId: "cat-5",
    category: { id: "cat-5", name: "Produktivitas & Dunia Kerja", slug: "produktivitas-dunia-kerja", isFeatured: true },
    isFeatured: true,
  },
];
