#!/usr/bin/env node

/**
 * Validates the generated static SEO output before it is uploaded to Cloudflare Pages.
 */
const { existsSync, readdirSync, readFileSync } = require("node:fs");
const { join, resolve } = require("node:path");
const { loadCatalog: loadCanonicalCatalog } = require("./load-catalog");

const ROOT_DIR = resolve(__dirname, "..");
const OUTPUT_DIR = resolve(ROOT_DIR, "dist");

function trimTrailingSlashes(value) {
  let result = String(value);
  while (result.endsWith("/")) result = result.slice(0, -1);
  return result;
}

function trimOuterSlashes(value) {
  let result = String(value);
  while (result.startsWith("/")) result = result.slice(1);
  while (result.endsWith("/")) result = result.slice(0, -1);
  return result;
}

const SITE_URL = trimTrailingSlashes(process.env.SEO_SITE_URL || "https://youcity.app");
const BASE_PATH = trimOuterSlashes(String(process.env.SEO_BASE_PATH || "").trim());
const SITE_PATH = BASE_PATH ? `/${BASE_PATH}` : "";
const failures = [];

function sitePath(path) {
  return `${SITE_PATH}${path}`;
}

function fail(message) {
  failures.push(message);
}

function read(file) {
  return readFileSync(join(OUTPUT_DIR, file), "utf8");
}

function countMatches(html, pattern) {
  return [...html.matchAll(pattern)].length;
}

function firstMeta(html, attribute, value) {
  const pattern = new RegExp(String.raw`<meta\b[^>]*${attribute}=["']${value}["'][^>]*content=["']([^"']*)["'][^>]*>`, "i");
  const alternatePattern = new RegExp(String.raw`<meta\b[^>]*content=["']([^"']*)["'][^>]*${attribute}=["']${value}["'][^>]*>`, "i");
  return html.match(pattern)?.[1] || html.match(alternatePattern)?.[1] || "";
}

function allHtmlFiles(directory, prefix = "") {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relative = join(prefix, entry.name);
    if (entry.isDirectory()) return allHtmlFiles(join(directory, entry.name), relative);
    return entry.name.endsWith(".html") ? [relative] : [];
  });
}

function expectedCities() {
  return loadCanonicalCatalog(ROOT_DIR);
}

function checkRequiredFiles() {
  for (const file of ["index.html", "404.html", "robots.txt", "sitemap.xml", "_headers", "_redirects"]) {
    if (!existsSync(join(OUTPUT_DIR, file))) fail(`Missing dist/${file}`);
  }
}

function checkPage(file, { indexable = true } = {}) {
  const html = read(file);
  if (html.includes("youcity.pages.dev")) fail(`${file}: contains legacy pages.dev SEO reference`);
  const title = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1].trim() || "";
  const h1 = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((match) => stripTags(match[1])).filter(Boolean);

  if (countMatches(html, /<title>/gi) !== 1 || !title) fail(`${file}: expected exactly one non-empty title`);
  if (h1.length !== 1) fail(`${file}: expected exactly one non-empty H1`);

  const robots = firstMeta(html, "name", "robots");
  if (!robots) fail(`${file}: missing robots meta`);

  if (!indexable) {
    if (!/noindex/i.test(robots)) fail(`${file}: expected noindex robots meta`);
    return { title, canonical: "", description: "" };
  }

  const description = firstMeta(html, "name", "description");
  const canonical = html.match(/<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i)?.[1] || "";
  if (!description || description.length < 50) fail(`${file}: missing or unusually short meta description`);
  if (!canonical.startsWith(`${SITE_URL}${sitePath("/")}`)) fail(`${file}: canonical is not on ${SITE_URL}${SITE_PATH}`);

  for (const [attribute, value] of [
    ["property", "og:title"],
    ["property", "og:description"],
    ["property", "og:url"],
    ["property", "og:type"],
    ["property", "og:image"],
    ["property", "og:site_name"],
    ["name", "twitter:card"],
    ["name", "twitter:title"],
    ["name", "twitter:description"],
    ["name", "twitter:image"]
  ]) {
    if (!firstMeta(html, attribute, value)) fail(`${file}: missing ${value} meta`);
  }

  const jsonLd = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  if (jsonLd.length !== 1) fail(`${file}: expected exactly one JSON-LD block`);
  else {
    try {
      JSON.parse(jsonLd[0][1]);
    } catch (error) {
      fail(`${file}: invalid JSON-LD (${error.message})`);
    }
  }

  return { title, canonical, description };
}

function slugify(value) {
  let slug = String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  while (slug.startsWith("-")) slug = slug.slice(1);
  while (slug.endsWith("-")) slug = slug.slice(0, -1);
  return slug;
}

function stripTags(value) {
  return String(value).split("<").map((part) => {
    const end = part.indexOf(">");
    return end < 0 ? part : part.slice(end + 1);
  }).join("").trim();
}

function cityUrl(city) {
  const path = `/city/${slugify(city.name)}`;
  return SITE_URL + sitePath(path);
}

function displayCityName(city) {
  return { "Sao Paulo": "São Paulo" }[city.name] || city.name;
}

function destinationSection(html) {
  const match = html.match(/<section\b[^>]*class=["'][^"']*\bdestination-content\b[^"']*["'][^>]*>[\s\S]*?<\/section>/i);
  return match?.[0] || "";
}

function checkDestinationContent(file, city) {
  const html = read(file);
  const sections = [...html.matchAll(/<section\b[^>]*class=["'][^"']*\bdestination-content\b[^"']*["'][^>]*>/gi)];
  if (sections.length !== 1) {
    fail(`${file}: expected exactly one <section class="destination-content">`);
    return;
  }

  const section = destinationSection(html);
  const name = displayCityName(city);
  if (!section.includes(name)) fail(`${file}: destination content does not contain ${name}`);

  const requiredExperiences = {
    walk: `Walk through ${name}`,
    drive: `Drive through ${name}`,
    bike: `Cycle through ${name}`,
    drone: `See ${name} from above`,
    beach_walk: `Take a beach walk in ${name}`
  };
  for (const [mode, text] of Object.entries(requiredExperiences)) {
    if (city.videos?.[mode]?.length && !section.includes(text)) {
      fail(`${file}: destination content is missing ${text}`);
    }
  }

  const relatedLists = [...section.matchAll(/<ul\b[^>]*class=["'][^"']*\bdestination-related\b[^"']*["'][^>]*>([\s\S]*?)<\/ul>/gi)];
  const relatedLinks = relatedLists.flatMap((match) => [...match[1].matchAll(/<a\b[^>]*href=["'][^"']+["'][^>]*>/gi)]);
  if (relatedLinks.length > 8) fail(`${file}: destination-related contains ${relatedLinks.length} links; maximum is 8`);
}

function hasVideoExperience(city) {
  return Object.values(city.videos || {}).some((rides) => Array.isArray(rides) && rides.length > 0);
}

function checkSitemap(catalog) {
  const sitemap = read("sitemap.xml");
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  const sitemapCatalog = catalog.filter(hasVideoExperience);
  const expected = [`${SITE_URL}${sitePath("/")}`, ...sitemapCatalog.map(cityUrl)];
  if (urls.length !== expected.length) fail(`sitemap.xml: expected ${expected.length} URLs, found ${urls.length}`);
  for (const url of expected) if (!urls.includes(url)) fail(`sitemap.xml: missing ${url}`);
}

function main() {
  if (!existsSync(OUTPUT_DIR)) {
    console.error("SEO check failed: dist/ does not exist. Run node scripts/build-static.js first.");
    process.exitCode = 1;
    return;
  }

  checkRequiredFiles();
  const catalog = expectedCities();
  const files = allHtmlFiles(OUTPUT_DIR).sort();
  const cityFiles = files.filter((file) => file.startsWith("city/"));
  if (cityFiles.length !== catalog.length) fail(`Expected ${catalog.length} city pages, found ${cityFiles.length}`);

  const pageData = files.filter((file) => file !== "404.html").map((file) => ({ file, ...checkPage(file) }));
  checkPage("404.html", { indexable: false });
  checkSitemap(catalog);

  for (const file of cityFiles) {
    const city = catalog.find((candidate) => `city/${slugify(candidate.name)}.html` === file);
    if (city) checkDestinationContent(file, city);
  }

  for (const key of ["title", "canonical", "description"]) {
    const seen = new Map();
    for (const page of pageData) {
      if (seen.has(page[key])) fail(`${page.file}: duplicate ${key} with ${seen.get(page[key])}`);
      else seen.set(page[key], page.file);
    }
  }

  if (failures.length) {
    console.error(`SEO check failed with ${failures.length} issue(s):`);
    failures.forEach((message) => console.error(`- ${message}`));
    process.exitCode = 1;
    return;
  }

  console.log(`SEO check passed: ${pageData.length} indexable pages, ${cityFiles.length} city pages, sitemap verified for ${SITE_URL}${SITE_PATH}`);
}

main();
