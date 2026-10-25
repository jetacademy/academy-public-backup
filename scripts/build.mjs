import { copyFileSync, existsSync, mkdirSync } from "fs";

// Step 0: Ensure PDF.js worker is synced to public/pdfjs
try {
  const workerSrcCandidates = [
    "node_modules/react-pdf/node_modules/pdfjs-dist/build/pdf.worker.min.mjs",
    "node_modules/pdfjs-dist/build/pdf.worker.min.mjs",
  ];
  for (const src of workerSrcCandidates) {
    if (existsSync(src)) {
      mkdirSync("public/pdfjs", { recursive: true });
      copyFileSync(src, "public/pdfjs/pdf.worker.min.mjs");
      console.log(`> Synced PDF.js worker from ${src} to public/pdfjs/pdf.worker.min.mjs`);
      break;
    }
  }
} catch (e) {
  console.warn("Notice: Could not sync pdf.worker.min.mjs:", e.message);
}

import { execSync } from "child_process";
import { exit } from "process";

// Container Hostinger membatasi jumlah thread/proses, tapi melaporkan CPU host yang banyak.
// Tanpa batas, compiler Rust (SWC/tokio) & worker Next membuka thread sebanyak CPU host →
// panic "OS can't spawn worker thread (os error 11)". Batasi semuanya ke angka kecil.
const BUILD_THREADS = process.env.NEXT_BUILD_CPUS || "2";

function run(cmd) {
  console.log(`> ${cmd}`);
  try {
    execSync(cmd, {
      stdio: "inherit",
      env: {
        ...process.env,
        NODE_OPTIONS: process.env.NODE_OPTIONS || "--max-old-space-size=2048",
        NEXT_BUILD_CPUS: BUILD_THREADS,
        TOKIO_WORKER_THREADS: process.env.TOKIO_WORKER_THREADS || BUILD_THREADS,
        RAYON_NUM_THREADS: process.env.RAYON_NUM_THREADS || BUILD_THREADS,
        UV_THREADPOOL_SIZE: process.env.UV_THREADPOOL_SIZE || "4",
        NEXT_TELEMETRY_DISABLED: "1",
      },
    });
    return true;
  } catch {
    return false;
  }
}

// Step 1: Generate Prisma Client
run("npx prisma generate");

// Step 2: Try migrate deploy (for databases with migration history)
const migrated = run("npx prisma migrate deploy");

// Step 3: If migrate fails (P3005 = existing schema, no migrations; P3009 = failed migration), use db push
if (!migrated) {
  console.log("\n⚠️  prisma migrate deploy tidak dapat diaplikasikan. Menjalankan prisma db push untuk sinkronisasi skema...");
  run("npx prisma db push");
}

// Lint sengaja TIDAK dijalankan saat build: hasilnya tidak pernah menggagalkan build
// (run() mengabaikan exit code) tapi tetap makan RAM & waktu di hosting. Jalankan
// `npm run lint` di lokal sebelum push. Type-check tetap jalan di dalam `next build`.

// Step 4: Build Next.js
// Catatan: Di hosting (Hostinger hbuilds/container), Turbopack (default Next.js 16)
// sering crash mendadak ("ERROR: Failed to build the application") tanpa error log detail
// akibat kehabisan RAM (OOM Killer) atau inkompatibilitas Rust binary di container hosting.
// Flag --webpack jauh lebih hemat memori dan stabil di shared/cloud hosting.
console.log("\n🚀 Memulai Next.js build dengan Webpack (hemat RAM untuk hosting)...");
// Tanpa fallback ke Turbopack: di container yang sama ia gagal karena batas thread yang sama
// dan menghabiskan ~15 menit sebelum error (terbukti di log deploy 25 Okt 2026).
const built = run("npx next build --webpack");
if (!built) exit(1);
