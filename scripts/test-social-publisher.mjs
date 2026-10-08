import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

function readText(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

// Publisher modules mirror the Imovue layout (config, selection, cards,
// Facebook client, daily runner, stale cleanup).
for (const file of [
  "tools/social/__init__.py",
  "tools/social/config.py",
  "tools/social/utils.py",
  "tools/social/ranking.py",
  "tools/social/selector.py",
  "tools/social/templates.py",
  "tools/social/compose_post.py",
  "tools/social/generate_card.py",
  "tools/social/facebook_client.py",
  "tools/social/city_image.py",
  "tools/social/post_daily.py",
  "tools/social/prune_stale.py",
  "social/facebook_pages.json",
  "social/published.json",
  "requirements-social.txt",
  "docs/SOCIAL_PUBLISHER.md",
  ".github/workflows/facebook-daily.yml",
  "assets/logo-youcity.png",
]) {
  assert.equal(existsSync(resolve(root, file)), true, `missing social publisher file: ${file}`);
}

// The WORLD page carries the official numeric Page ID and no tokens.
const pages = readJson("social/facebook_pages.json");
assert.ok(pages.WORLD, "facebook_pages.json should register the WORLD page");
assert.match(pages.WORLD.pageId || "", /^\d+$/, "WORLD page should carry the numeric Facebook Page ID");
assert.doesNotMatch(readText("social/facebook_pages.json"), /token/i, "facebook_pages.json must not contain tokens");

// History starts as an empty list.
const published = readJson("social/published.json");
assert.equal(Array.isArray(published), true, "published.json should hold a list");

// Catalog slugs must be unique and non-empty; spot-check the slugify
// parity with scripts/build-static.js ("Sao Paulo" -> "sao-paulo").
const catalog = readJson("data/catalog.json");
assert.ok(Array.isArray(catalog) && catalog.length > 0, "catalog should not be empty");
const slugify = (value) =>
  String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
const slugs = catalog.map((city) => slugify(city.name));
assert.ok(slugs.every(Boolean), "every catalog city should produce a slug");
assert.equal(new Set(slugs).size, slugs.length, "catalog slugs should be unique");
assert.ok(slugs.includes("sao-paulo"), "slugify should map 'Sao Paulo' to 'sao-paulo'");
const eligible = catalog.filter((city) =>
  Object.values(city.videos || {}).some((rides) => Array.isArray(rides) && rides.length > 0)
);
assert.ok(eligible.length > 200, `the draw pool should stay large (got ${eligible.length})`);

// Social dependencies match the Imovue publisher (cards + Graph API).
const requirements = readText("requirements-social.txt");
assert.match(requirements, /Pillow==/i, "requirements should pin Pillow for card generation");
assert.match(requirements, /requests==/i, "requirements should pin requests for the Graph API");

// Workflow: 4 posts/day on the 4-slot grid, prune before publish,
// single System User secret, history committed back.
const workflow = readText(".github/workflows/facebook-daily.yml");
assert.match(workflow, /YOUCITY_FACEBOOK_POSTS_PER_DAY: '4'/, "workflow should default to 4 posts/day");
assert.match(workflow, /prune_stale\.py/, "workflow should prune stale posts before publishing");
assert.match(workflow, /post_daily\.py --all --publish/, "workflow should publish the slot city");
assert.match(workflow, /FB_SYSTEM_USER_TOKEN/, "workflow should use the single System User secret");
for (const cron of ["30 12", "30 15", "30 19", "0 23"]) {
  assert.match(
    workflow,
    new RegExp(`cron: '${cron.replace(/ /g, "\\s+")}[^']*'`),
    `workflow should cover the 4-slot grid (cron ${cron} UTC)`
  );
}
assert.match(workflow, /social\/published\.json/, "workflow should persist the publication history");

// Photo cache: committed Wikipedia metadata (no secrets), covering the
// bulk of the catalog; cities without a photo use the gradient fallback.
const photoCache = readJson("tools/.city_image_cache.json");
assert.equal(typeof photoCache, "object", "photo cache should be an object");
assert.doesNotMatch(
  readText("tools/.city_image_cache.json"),
  /token|access_key|secret/i,
  "photo cache must not contain secrets"
);
const cachedSlugs = new Set(Object.keys(photoCache));
const eligibleSlugs = new Set(
  eligible.map((city) => slugify(city.name))
);
const covered = [...eligibleSlugs].filter((slug) => cachedSlugs.has(slug)).length;
assert.ok(
  covered / eligibleSlugs.size >= 0.7,
  `photo cache should cover most cities (got ${covered}/${eligibleSlugs.size})`
);
for (const [slug, meta] of Object.entries(photoCache)) {
  assert.ok(meta.image_url?.startsWith("https://"), `${slug} should cache an https photo URL`);
  assert.equal(meta.provider, "wikipedia", `${slug} should record its provider`);
}

console.log(`Social publisher layout OK (${slugs.length} catalog cities, 4 posts/day)`);
