import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "ui-ux-pro-max-skill/**",
    "src/__tests__/**",  // Test files use patterns necessary for mocking
    "public/pdfjs/**",   // Vendor PDF.js (minified) — bukan kode kita, jangan di-lint
  ]),
]);

export default eslintConfig;
