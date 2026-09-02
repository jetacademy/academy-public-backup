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

function run(cmd) {
  console.log(`> ${cmd}`);
  try {
    execSync(cmd, { stdio: "inherit" });
    return true;
  } catch {
    return false;
  }
}

// Step 1: Generate Prisma Client
run("npx prisma generate");

// Step 2: Try migrate deploy (for databases with migration history)
const migrated = run("npx prisma migrate deploy");

// Step 3: If migrate fails (P3005 = existing schema, no migrations), use db push
if (!migrated) {
  console.log("\n⚠️  No migration history found. Running prisma db push to sync schema...");
  run("npx prisma db push");
}

// Step 4: Lint
run("npx eslint .");

// Step 5: Build Next.js
const built = run("npx next build");
if (!built) exit(1);
