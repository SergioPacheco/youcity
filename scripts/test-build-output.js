#!/usr/bin/env node

/**
 * Regression test: validate critical build output files
 * 
 * This test prevents the production incident where consent.mjs was missing from dist/.
 * 
 * Run: node scripts/test-build-output.mjs
 */

const { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } = require("node:fs");
const { join, resolve } = require("node:path");
const { tmpdir } = require("node:os");
const { validateModuleImports } = require("./build-static.js");

const ROOT_DIR = resolve(__dirname, "..");
const OUTPUT_DIR = resolve(ROOT_DIR, "dist");

const REQUIRED_FILES = [
  "src/main.mjs",
  "src/integrations/analytics.mjs",
  "src/integrations/consent.mjs",
  "src/app/bootstrap.mjs",
  "src/radio/radio-controller.mjs",
  "src/radio/radio-panel.mjs",
  "src/radio/radio-browser.mjs",
  "src/radio/radio-browser-feature.mjs",
  "src/radio/radio-now-playing.mjs",
  "src/radio/radio-now-playing-server.mjs",
  "src/radio/radio-youtube.mjs",
  "src/radio/radio-media-feature.mjs",
  "src/radio/radio-station.mjs",
  "src/radio/radio-station-repository.mjs",
  "src/radio/radio-catalog-index.mjs",
  "src/features/travel/destination-commerce.mjs",
  "src/features/travel/flight-origin.mjs",
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

const fixture = mkdtempSync(join(tmpdir(), "youcity-build-validation-"));
try {
  mkdirSync(join(fixture, "src"), { recursive: true });
  writeFileSync(join(fixture, "src/entry.mjs"), 'import "./missing.mjs?v=fixture";\n');
  try {
    validateModuleImports(fixture, { checkRequired: false });
    console.log("  ✗ recursive missing-module fixture was accepted");
    process.exitCode = 1;
  } catch (error) {
    if (!/Importer: dist\/src\/entry\.mjs/.test(error.message)
      || !/Import: \.\/missing\.mjs\?v=fixture/.test(error.message)
      || !/Expected: dist\/src\/missing\.mjs/.test(error.message)) {
      throw error;
    }
    console.log("  ✓ recursive missing-module validation reports importer, import, and expected target");
  }
} finally {
  rmSync(fixture, { recursive: true, force: true });
}

console.log("Build validation PASSED.\n");
process.exit(process.exitCode || 0);
