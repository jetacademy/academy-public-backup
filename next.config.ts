import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  poweredByHeader: false,
  generateEtags: false,
  experimental: {
    serverActions: {
      // upload PDF/gambar materi & sertifikat via server action (maks 20 MB + overhead encoding)
      bodySizeLimit: "25mb",
    },
  },
  images: {
    // 🔴 KOREKSI 3 Sep: image optimizer (_next/image) hang di prod → semua gambar
    // di halaman broken/kosong walau file asli ada. Set unoptimized=TRUE supaya
    // next/image menyajikan gambar asli langsung (tanpa optimizer), memulihkan
    // tampilan gambar & tidak bergantung pada optimizer yang macet. (Harga: file
    // tidak di-optimasi ukurannya; tradeoff diterima demi ketersediaan gambar.)
    unoptimized: true,
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      // Batasi ke domain yang dikenal — jangan izinkan semua hostname
      { protocol: "https", hostname: "*.jetschool.id" },
      { protocol: "https", hostname: "jetschool.id" },
      { protocol: "https", hostname: "storage.googleapis.com" },
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      // YouTube thumbnails (untuk preview video LMS)
      { protocol: "https", hostname: "img.youtube.com" },
      { protocol: "https", hostname: "i.ytimg.com" },
      // Picsum photos (untuk dummy/placeholder images)
      { protocol: "https", hostname: "picsum.photos" },
    ],
  },
  async headers() {
    return [
      {
        // Katalog program — statis, tanpa data personal → aman di-cache publik di CDN.
        // JANGAN pakai wildcard ":path*" di sini: /program/[slug] merender data
        // personal member (nama/email/WA/instansi dari sesi) ke dalam HTML lewat
        // getMemberSession(), jadi tidak boleh ikut cache publik — kalau tidak,
        // CDN bisa menyajikan data satu member ke pengunjung lain (kebocoran PII).
        // Halaman detail dibiarkan tanpa override di sini supaya Next menerapkan
        // Cache-Control dinamis bawaannya sendiri (private, no-store).
        source: "/program",
        headers: [
          { key: "Cache-Control", value: "public, s-maxage=3600, stale-while-revalidate=60" },
        ],
      },
      {
        // Sertifikat publik — cache lebih lama
        source: "/sertifikat/:path*",
        headers: [
          { key: "Cache-Control", value: "public, s-maxage=86400, stale-while-revalidate=3600" },
        ],
      },
      {
        // Halaman autentikasi — jangan cache
        source: "/((?!_next/static|_next/image|favicon\\.ico|program|sertifikat).*)",
        headers: [
          { key: "Cache-Control", value: "no-store, must-revalidate" },
        ],
      },
      {
        // Security headers untuk SEMUA halaman
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // HSTS — paksa HTTPS selama 2 tahun, termasuk subdomain
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          // Batasi fitur browser yang tidak diperlukan
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
