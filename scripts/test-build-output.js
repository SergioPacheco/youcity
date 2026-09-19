#!/usr/bin/env node

/**
 * Regression test: validate critical build output files
 * 
 * This test prevents the production incident where consent.mjs was missing from dist/.
 * 
 * Run: node scripts/test-build-output.mjs
 */

const { existsSync } = require("node:fs");
const { resolve } = require("node:path");

const ROOT_DIR = resolve(__dirname, "..");
const OUTPUT_DIR = resolve(ROOT_DIR, "dist");

const REQUIRED_FILES = [
  "src/main.mjs",
  "src/integrations/analytics.mjs",
  "src/integrations/consent.mjs",
  "src/app/bootstrap.mjs",
  "styles.css",
  "privacy.html",
  "terms.html",
  "index.html"
];

console.log("Build Output Validation\n");

let passed = 0;
let failed = 0;

for (const file of REQUIRED_FILES) {
  const filePath = resolve(OUTPUT_DIR, file);
  if (existsSync(filePath)) {
    console.log(`  ✓ ${file}`);
    passed++;
  } else {
    console.log(`  ✗ ${file} — MISSING FROM dist/`);
    failed++;
  }
}

console.log(`\n${passed} files present, ${failed} missing\n`);

if (failed > 0) {
  console.log("Build validation FAILED.\n");
  process.exit(1);
}

console.log("Build validation PASSED.\n");
process.exit(0);
