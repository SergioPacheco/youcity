#!/usr/bin/env node

/**
 * Regression test: validate critical build output files
 * 
 * This test prevents the production incident where consent.mjs was missing from dist/.
 * 
 * Run: node scripts/test-build-output.mjs
 */

const { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const { join, resolve } = require("node:path");
const { tmpdir } = require("node:os");
const { validateModuleImports } = require("./build-static.js");

const ROOT_DIR = resolve(__dirname, "..");
const OUTPUT_DIR = resolve(ROOT_DIR, "dist");
const catalog = require("../data/catalog.json");

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
  "blog.css",
  "privacy.html",
  "terms.html",
  "index.html",
  "blog/index.html",
  "blog/explore-a-city-virtually-before-travelling.html",
  "blog/discovering-a-citys-atmosphere-through-local-radio.html",
  "blog/paris-in-3-days.html",
  "blog/lisbon-or-porto.html",
  "blog/how-to-choose-hotel-location.html",
  "blog/plan-weekend-city-break.html",
  "blog/plan-self-guided-city-walk.html"
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

const blogDocuments = [
  "blog/index.html",
  "blog/explore-a-city-virtually-before-travelling.html",
  "blog/discovering-a-citys-atmosphere-through-local-radio.html",
  "blog/paris-in-3-days.html",
  "blog/lisbon-or-porto.html",
  "blog/how-to-choose-hotel-location.html",
  "blog/plan-weekend-city-break.html",
  "blog/plan-self-guided-city-walk.html"
];
for (const file of blogDocuments) {
  const source = readFileSync(resolve(OUTPUT_DIR, file), "utf8");
  if (/src\/main\.mjs|type=["']module["']|youtube\.com\/embed|leaflet/i.test(source)) {
    console.log(`  ✗ ${file} — interactive bootstrap/media reference found`);
    process.exitCode = 1;
  } else {
    console.log(`  ✓ ${file} — static blog document has no interactive bootstrap`);
  }
}

const sitemap = readFileSync(resolve(OUTPUT_DIR, "sitemap.xml"), "utf8");
for (const path of [
  "/blog/",
  "/blog/explore-a-city-virtually-before-travelling",
  "/blog/discovering-a-citys-atmosphere-through-local-radio",
  "/blog/paris-in-3-days",
  "/blog/lisbon-or-porto",
  "/blog/how-to-choose-hotel-location",
  "/blog/plan-weekend-city-break",
  "/blog/plan-self-guided-city-walk"
]) {
  if (!sitemap.includes(`https://youcity.app${path}`)) {
    console.log(`  ✗ sitemap.xml — missing ${path}`);
    process.exitCode = 1;
  } else {
    console.log(`  ✓ sitemap.xml — includes ${path}`);
  }
}
if (process.exitCode) process.exit(1);

function slugify(value) {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

const expectedSitemap = new Set([
  "https://youcity.app/",
  ...catalog.filter((city) => Object.values(city.videos || {}).some((videos) => Array.isArray(videos) && videos.length)).map((city) => `https://youcity.app/city/${slugify(city.name)}`),
  "https://youcity.app/blog/",
  "https://youcity.app/blog/explore-a-city-virtually-before-travelling",
  "https://youcity.app/blog/discovering-a-citys-atmosphere-through-local-radio",
  "https://youcity.app/blog/paris-in-3-days",
  "https://youcity.app/blog/lisbon-or-porto",
  "https://youcity.app/blog/how-to-choose-hotel-location",
  "https://youcity.app/blog/plan-weekend-city-break",
  "https://youcity.app/blog/plan-self-guided-city-walk"
]);
const actualSitemap = new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]));
if (actualSitemap.size !== expectedSitemap.size || [...expectedSitemap].some((url) => !actualSitemap.has(url))) {
  console.log(`  ✗ sitemap.xml — expected ${expectedSitemap.size} URLs, found ${actualSitemap.size}`);
  process.exit(1);
}
console.log(`  ✓ sitemap.xml — exact public URL set (${actualSitemap.size} URLs)`);

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
