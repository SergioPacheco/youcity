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
  return sectionWithClass(html, "destination-content");
}

function sectionWithClass(html, className) {
  const openPattern = new RegExp(`<section\\b[^>]*class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>`, "i");
  const open = html.match(openPattern);
  if (!open || open.index === undefined) return "";
  const start = open.index;
  const tagPattern = /<\/?section\b[^>]*>/gi;
  tagPattern.lastIndex = start;
  let depth = 0;
  let match;
  while ((match = tagPattern.exec(html))) {
    depth += /^<\/?section\b/i.test(match[0]) && !/^<\//.test(match[0]) ? 1 : -1;
    if (depth === 0) return html.slice(start, tagPattern.lastIndex);
  }
  return "";
}

function visibleText(value) {
  return String(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

function trustedEditorialUrl(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return url.protocol === "https:" && (host === "wikipedia.org" || host.endsWith(".wikipedia.org") || host === "wikidata.org" || host.endsWith(".wikidata.org"));
  } catch {
    return false;
  }
}

function normalizedEditorialText(value, city, country) {
  return visibleText(value)
    .toLowerCase()
    .replaceAll(String(city).toLowerCase(), "")
    .replaceAll(String(country).toLowerCase(), "")
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function checkDestinationContent(file, city, editorialContent, duplicateTexts, wordStats) {
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

  const editorial = editorialContent[slugify(city.name)];
  if (editorial?.status !== "complete") return;
  const about = sectionWithClass(section, "destination-about");
  const places = sectionWithClass(section, "destination-places");
  if (!about) fail(`${file}: missing .destination-about`);
  if (!places) fail(`${file}: missing .destination-places`);
  if (!about.includes(`About ${name}`)) fail(`${file}: missing About ${name}`);
  if (!places.includes(`Places to discover in ${name}`)) fail(`${file}: missing Places to discover in ${name}`);
  if (!/Source:\s*Wikipedia/i.test(about)) fail(`${file}: missing visible Wikipedia attribution`);
  if (about && !trustedEditorialUrl(about.match(/href=["']([^"']+)["']/i)?.[1] || "")) fail(`${file}: About source URL is not trusted`);
  const words = visibleText(section).split(/\s+/).filter(Boolean).length;
  wordStats.push({ file, words });
  if (words < 100) fail(`${file}: complete destination content has ${words} words; minimum is 100`);
  const normalized = `${normalizedEditorialText(about, name, city.country)} ${normalizedEditorialText(places, name, city.country)}`.trim();
  if (duplicateTexts.has(normalized)) fail(`${file}: duplicate normalized editorial content with ${duplicateTexts.get(normalized)}`);
  else duplicateTexts.set(normalized, file);
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

function checkHomeCatalogSummary(catalog) {
  const home = read("index.html");
  const count = String(catalog.length);
  if (!new RegExp(`<span[^>]+id=["']city-total["'][^>]*>${count}<\\/span>`, "i").test(home)) {
    fail(`index.html: city-total should reflect ${count} catalog cities`);
  }
  if (!home.includes(`Explore ${count} cities through real streets`)) {
    fail(`index.html: city-note should reflect ${count} catalog cities`);
  }
  if (!home.includes(`id="map-result-count">${count} cities`)) {
    fail(`index.html: map-result-count should reflect ${count} catalog cities`);
  }
}

function main() {
  if (!existsSync(OUTPUT_DIR)) {
    console.error("SEO check failed: dist/ does not exist. Run node scripts/build-static.js first.");
    process.exitCode = 1;
    return;
  }

  checkRequiredFiles();
  const catalog = expectedCities();
  const editorialPath = join(ROOT_DIR, "data/city-seo-content.json");
  if (!existsSync(editorialPath)) {
    fail("Missing data/city-seo-content.json");
  }
  const editorialContent = existsSync(editorialPath) ? JSON.parse(readFileSync(editorialPath, "utf8")) : {};
  const duplicateTexts = new Map();
  const wordStats = [];
  const files = allHtmlFiles(OUTPUT_DIR).sort();
  const cityFiles = files.filter((file) => file.startsWith("city/"));
  if (cityFiles.length !== catalog.length) fail(`Expected ${catalog.length} city pages, found ${cityFiles.length}`);

  const pageData = files.filter((file) => file !== "404.html").map((file) => ({ file, ...checkPage(file) }));
  checkPage("404.html", { indexable: false });
  checkSitemap(catalog);
  checkHomeCatalogSummary(catalog);

  for (const file of cityFiles) {
    const city = catalog.find((candidate) => `city/${slugify(candidate.name)}.html` === file);
    if (city) checkDestinationContent(file, city, editorialContent, duplicateTexts, wordStats);
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

  if (wordStats.length) {
    const words = wordStats.map((entry) => entry.words);
    const average = words.reduce((total, count) => total + count, 0) / words.length;
    console.log(`Average destination-content words: ${average.toFixed(1)}`);
    console.log(`Minimum words: ${Math.min(...words)}`);
    console.log(`Maximum words: ${Math.max(...words)}`);
  }
  console.log(`SEO check passed: ${pageData.length} indexable pages, ${cityFiles.length} city pages, sitemap verified for ${SITE_URL}${SITE_PATH}`);
}

main();
