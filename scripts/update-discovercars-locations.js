#!/usr/bin/env node

/**
 * Rebuilds the DiscoverCars locality catalog from the official sitemap.
 *
 * The updater intentionally does not crawl search pages or call DiscoverCars
 * from the browser. City-level matches come from the official English sitemap;
 * only explicit aliases in data/discovercars-overrides.json receive a small
 * page-title check.
 */
const { existsSync, mkdirSync, readFileSync, writeFileSync } = require("node:fs");
const { join, resolve } = require("node:path");
const { runInNewContext } = require("node:vm");

const ROOT_DIR = resolve(__dirname, "..");
const DATA_DIR = resolve(ROOT_DIR, "data");
const REPORT_DIR = resolve(ROOT_DIR, "reports");
const SITEMAP_INDEX_URL = "https://www.discovercars.com/sitemap.xml";
const ROBOTS_URL = "https://www.discovercars.com/robots.txt";
const LOCATIONS_URL = "https://www.discovercars.com/locations";
const DISCOVERCARS_ORIGIN = "https://www.discovercars.com";
const STATUS = Object.freeze({ VERIFIED: "VERIFIED", NOT_AVAILABLE: "NOT_AVAILABLE", AMBIGUOUS: "AMBIGUOUS", NEEDS_REVIEW: "NEEDS_REVIEW" });

const COUNTRY_CODES = {
  Brazil: "BR", UAE: "AE", Mexico: "MX", India: "IN", USA: "US", Netherlands: "NL",
  Philippines: "PH", Turkey: "TR", Greece: "GR", "New Zealand": "NZ", Spain: "ES",
  Switzerland: "CH", China: "CN", "Northern Ireland": "GB", Germany: "DE", France: "FR",
  Australia: "AU", England: "GB", Hungary: "HU", Argentina: "AR", Egypt: "EG",
  "South Africa": "ZA", Senegal: "SN", Ireland: "IE", UK: "GB", Pakistan: "PK",
  Guatemala: "GT", Cuba: "CU", Austria: "AT", Indonesia: "ID", Malaysia: "MY", Ukraine: "UA",
  "Dominican Republic": "DO", Portugal: "PT", Slovenia: "SI", Italy: "IT", Monaco: "MC",
  Uruguay: "UY", Russia: "RU", Japan: "JP", Taiwan: "TW", Canada: "CA", Norway: "NO",
  Czechia: "CZ", Qatar: "QA", Uzbekistan: "UZ", Korea: "KR", Singapore: "SG", Bulgaria: "BG",
  Sweden: "SE", Iran: "IR", Israel: "IL", Poland: "PL"
};

const DISCOVERCARS_ROOTS_BY_CODE = {
  BR: ["brazil"], AE: ["united-arab-emirates"], MX: ["mexico"], IN: ["india"],
  US: [
    "usa-alabama", "usa-alaska", "usa-arizona", "usa-arkansas", "usa-california", "usa-colorado",
    "usa-connecticut", "usa-delaware", "usa-florida", "usa-georgia", "usa-hawaii", "usa-illinois",
    "usa-indiana", "usa-iowa", "usa-kansas", "usa-kentucky", "usa-louisiana", "usa-maine",
    "usa-maryland", "usa-massachusetts", "usa-michigan", "usa-minnesota", "usa-mississippi",
    "usa-missouri", "usa-montana", "usa-nebraska", "usa-nevada", "usa-new-hampshire", "usa-new-jersey",
    "usa-new-mexico", "usa-new-york", "usa-north-carolina", "usa-north-dakota", "usa-ohio",
    "usa-oklahoma", "usa-oregon", "usa-pennsylvania", "usa-rhode-island", "usa-south-carolina",
    "usa-south-dakota", "usa-tennessee", "usa-texas", "usa-utah", "usa-vermont", "usa-virginia",
    "usa-washington", "usa-washington-dc", "usa-west-virginia", "usa-wisconsin", "usa-wyoming"
  ],
  NL: ["netherlands"], PH: ["philippines"], TR: ["turkey"], GR: ["greece"], NZ: ["new-zealand"],
  ES: ["spain", "spain-balearic-islands", "spain-canary-islands"], CH: ["switzerland"], CN: ["china"],
  GB: ["united-kingdom"], DE: ["germany"], FR: ["france"], AU: ["australia"], HU: ["hungary"],
  AR: ["argentina"], EG: ["egypt"], ZA: ["south-africa"], SN: ["senegal"], IE: ["ireland"],
  PK: ["pakistan"], GT: ["guatemala"], CU: ["cuba"], AT: ["austria"], ID: ["indonesia"],
  MY: ["malaysia"], UA: ["ukraine"], DO: ["dominican-republic"], PT: ["portugal", "portugal-azores-islands"],
  SI: ["slovenia"], IT: ["italy-mainland", "italy-sicily", "italy-sardinia"], MC: ["monaco"], UY: ["uruguay"],
  RU: ["russia"], JP: ["japan"], TW: ["taiwan"], CA: ["canada"], NO: ["norway"], CZ: ["czech-republic"],
  QA: ["qatar"], UZ: ["uzbekistan"], KR: ["south-korea"], SG: ["singapore"], BG: ["bulgaria"],
  SE: ["sweden"], IR: ["iran"], IL: ["israel"], PL: ["poland"]
};

const ROOT_COUNTRY_CODE = Object.entries(DISCOVERCARS_ROOTS_BY_CODE).reduce((result, [code, roots]) => {
  roots.forEach((root) => { result[root] = code; });
  return result;
}, {});

function slugify(value) {
  let slug = String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
  while (slug.startsWith("-")) slug = slug.slice(1);
  while (slug.endsWith("-")) slug = slug.slice(0, -1);
  return slug;
}

function normalizeText(value) {
  return slugify(value).replaceAll("-", " ").trim();
}

function parseScript(file, globals) {
  const context = { window: {} };
  // Catalog inputs are fixed, repository-owned browser data files.
  runInNewContext(readFileSync(resolve(ROOT_DIR, file), "utf8"), context); // NOSONAR
  return context.window[globals];
}

function loadYouCityCities() {
  const catalog = parseScript("cities-data.js", "CITY_CATALOG") || [];
  const coordinates = parseScript("map-catalog.js", "CITY_COORDINATES") || {};
  return catalog.map((item) => {
    const point = coordinates[item.name] || coordinates[item.name.replaceAll("Rio De Janeiro", "Rio de Janeiro")] || [];
    const countryCode = COUNTRY_CODES[item.country];
    if (!countryCode) throw new Error(`Missing country code mapping for ${item.country}`);
    return {
      id: slugify(item.name),
      name: item.name,
      country: item.country,
      countryCode,
      latitude: Number.isFinite(point[0]) ? point[0] : null,
      longitude: Number.isFinite(point[1]) ? point[1] : null
    };
  });
}

function decodeXml(value) {
  return value.replaceAll("&amp;", "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"').replaceAll("&apos;", "'");
}

function sitemapLocations(xml) {
  return [...xml.matchAll(/<loc>([^<]*)<\/loc>/gi)]
    .map((match) => decodeXml(match[1].trim()))
    .filter((url) => {
      try { return new URL(url).origin === DISCOVERCARS_ORIGIN; } catch { return false; }
    });
}

async function fetchText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "text/xml,text/plain,text/html;q=0.8",
        "User-Agent": "YouCity-DiscoverCars-Updater/1.0 (sitemap-only)"
      },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

async function loadOfficialSitemaps() {
  const snapshotFile = process.env.DISCOVERCARS_SITEMAP_FILE;
  if (snapshotFile) {
    return {
      sitemapUrls: [SITEMAP_INDEX_URL],
      urls: sitemapLocations(readFileSync(resolve(snapshotFile), "utf8")),
      robotsChecked: false,
      sourceMode: "local-snapshot"
    };
  }

  const robots = await fetchText(ROBOTS_URL);
  if (!/^User-agent:\s*\*/im.test(robots) || /Disallow:\s*\/+(?:locations|sitemap)(?:\/|\s|$)/im.test(robots)) {
    throw new Error("DiscoverCars robots.txt does not permit the public locations/sitemap source used by this updater.");
  }
  const indexUrls = sitemapLocations(await fetchText(SITEMAP_INDEX_URL));
  const sitemapUrls = indexUrls.filter((url) => /sitemap/i.test(url));
  if (!sitemapUrls.length) throw new Error("No sitemap files were advertised by DiscoverCars sitemap.xml.");

  const urls = [];
  for (const sitemapUrl of sitemapUrls) urls.push(...sitemapLocations(await fetchText(sitemapUrl)));
  return { sitemapUrls, urls, robotsChecked: true, sourceMode: "official-sitemap" };
}

function readOverrides() {
  const file = resolve(DATA_DIR, "discovercars-overrides.json");
  if (!existsSync(file)) return {};
  const parsed = JSON.parse(readFileSync(file, "utf8"));
  return parsed.overrides || parsed;
}

function pathParts(url) {
  return new URL(url).pathname.split("/").filter(Boolean);
}

function isAirportPath(segment) {
  return /^[a-z0-9]{3}$/.test(segment) || /airport|port|station|terminal/i.test(segment);
}

function locationType(segment) {
  return /^[a-z0-9]{3}$/i.test(segment) || /airport/i.test(segment) ? "airport" : "pickup";
}

function buildLocationIndex(urls) {
  const cityPages = [];
  const airportPages = [];
  for (const url of new Set(urls)) {
    const parts = pathParts(url);
    const countryCode = ROOT_COUNTRY_CODE[parts[0]];
    if (!countryCode || parts.length < 2) continue;
    if (parts.length === 2) {
      cityPages.push({ countryCode, root: parts[0], slug: slugify(parts[1]), name: parts[1], path: `/${parts.join("/")}`, url });
      continue;
    }
    if (isAirportPath(parts.at(-1))) {
      airportPages.push({ countryCode, root: parts[0], citySlug: slugify(parts[1]), name: parts.at(-1), type: locationType(parts.at(-1)), path: `/${parts.join("/")}`, url });
    }
  }
  return { cityPages, airportPages };
}

function candidateLabel(slug) {
  if (/^[a-z0-9]{3}$/i.test(slug)) return slug.toUpperCase();
  return slug.split("-").map((part) => part ? part[0].toUpperCase() + part.slice(1) : part).join(" ");
}

function nearMatches(city, cityPages) {
  const targetTokens = normalizeText(city.name).split(" ").filter((token) => token.length > 3 && !["city", "new"].includes(token));
  if (!targetTokens.length) return [];
  return cityPages
    .filter((candidate) => candidate.countryCode === city.countryCode)
    .map((candidate) => {
      const candidateTokens = normalizeText(candidate.slug).split(" ");
      const shared = targetTokens.filter((token) => candidateTokens.includes(token));
      return { candidate, shared: shared.length };
    })
    .filter(({ shared }) => shared > 0)
    .sort((left, right) => right.shared - left.shared || left.candidate.path.localeCompare(right.candidate.path))
    .slice(0, 5)
    .map(({ candidate }) => ({ name: candidateLabel(candidate.slug), path: candidate.path, url: candidate.url, type: "city", reason: "name-overlap-only; manual review required" }));
}

async function validateOverridePage(override, url) {
  if (!override.expectedName || process.env.DISCOVERCARS_SKIP_PAGE_VALIDATION === "1") return true;
  const html = await fetchText(url);
  const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || "";
  const headings = [...html.matchAll(/<h1[^>]*>([^<]*)<\/h1>/gi)].map((match) => match[1]);
  return normalizeText(`${title} ${headings.join(" ")}`).includes(normalizeText(override.expectedName));
}

function relatedLocationsFor(candidate, airportPages) {
  const related = airportPages
    .filter((airport) => airport.countryCode === candidate.countryCode && airport.root === candidate.root && airport.citySlug === candidate.slug)
    .map((airport) => ({ name: candidateLabel(airport.name), path: airport.path, url: airport.url, type: airport.type }))
    .sort((left, right) => left.path.localeCompare(right.path));
  return {
    airports: related.filter((location) => location.type === "airport"),
    pickupLocations: related.filter((location) => location.type === "pickup")
  };
}

async function resolveCity(city, indexes, overrides) {
  const key = `${city.name}|${city.countryCode}`;
  const override = overrides[key];
  const exact = indexes.cityPages.filter((candidate) => candidate.countryCode === city.countryCode && candidate.slug === city.id);
  let candidate = null;
  let method = "official-sitemap";
  let possibleMatches = [];

  if (override === null) {
    return { city, available: false, status: STATUS.NOT_AVAILABLE, discoverCars: null, possibleMatches: [], validation: { status: STATUS.NOT_AVAILABLE, method: "manual-override" } };
  }

  if (override) {
    const overridePath = typeof override === "string" ? override : override.path;
    candidate = indexes.cityPages.find((item) => item.countryCode === city.countryCode && item.path === overridePath);
    method = "official-sitemap+manual-override";
    if (!candidate) {
      return { city, available: false, status: STATUS.NEEDS_REVIEW, discoverCars: null, possibleMatches: [], validation: { status: STATUS.NEEDS_REVIEW, method, path: overridePath } };
    }
    if (typeof override === "object" && !(await validateOverridePage(override, candidate.url))) {
      return { city, available: false, status: STATUS.NEEDS_REVIEW, discoverCars: null, possibleMatches: [{ name: candidateLabel(candidate.slug), path: candidate.path, url: candidate.url, type: "city", reason: "override page did not confirm expected locality name" }], validation: { status: STATUS.NEEDS_REVIEW, method, path: candidate.path } };
    }
  } else if (exact.length === 1) {
    candidate = exact[0];
  } else if (exact.length > 1) {
    possibleMatches = exact.map((item) => ({ name: candidateLabel(item.slug), path: item.path, url: item.url, type: "city", reason: "multiple official cities share this name" }));
    return { city, available: false, status: STATUS.AMBIGUOUS, discoverCars: null, possibleMatches, validation: { status: STATUS.AMBIGUOUS, method: "official-sitemap" } };
  } else {
    possibleMatches = nearMatches(city, indexes.cityPages);
    if (possibleMatches.length) {
      return { city, available: false, status: STATUS.AMBIGUOUS, discoverCars: null, possibleMatches, validation: { status: STATUS.AMBIGUOUS, method: "official-sitemap-name-overlap" } };
    }
    return { city, available: false, status: STATUS.NOT_AVAILABLE, discoverCars: null, possibleMatches: [], validation: { status: STATUS.NOT_AVAILABLE, method: "official-sitemap" } };
  }

  const relatedLocations = relatedLocationsFor(candidate, indexes.airportPages);
  const discoverCars = {
    type: "city",
    name: candidateLabel(candidate.slug),
    path: candidate.path,
    url: candidate.url,
    ...relatedLocations
  };
  return {
    city,
    available: true,
    status: STATUS.VERIFIED,
    discoverCars,
    possibleMatches: [],
    validation: { status: STATUS.VERIFIED, method, source: "official-sitemap" }
  };
}

function writeOutputs(results, source) {
  const generatedAt = process.env.GENERATED_AT || new Date().toISOString();
  const locations = Object.fromEntries(results.map((result) => {
    const key = `${result.city.id}-${result.city.countryCode.toLowerCase()}`;
    return [key, {
      youCityId: result.city.id,
      youCityName: result.city.name,
      country: result.city.country,
      countryCode: result.city.countryCode,
      latitude: result.city.latitude,
      longitude: result.city.longitude,
      available: result.available,
      status: result.status,
      discoverCars: result.discoverCars,
      possibleMatches: result.possibleMatches,
      validation: result.validation
    }];
  }));
  const catalog = {
    version: 1,
    generatedAt,
    source: { locations: LOCATIONS_URL, robots: ROBOTS_URL, sitemap: SITEMAP_INDEX_URL, sitemapFiles: source.sitemapUrls, mode: source.sourceMode, robotsChecked: source.robotsChecked },
    matching: { cityAndCountryRequired: true, airportsSeparate: true, ambiguousIsDisabled: true },
    locations
  };
  const report = {
    generatedAt,
    source: catalog.source,
    summary: summarize(results),
    verified: results.filter((result) => result.status === STATUS.VERIFIED).map(reportItem),
    notAvailable: results.filter((result) => result.status === STATUS.NOT_AVAILABLE).map(reportItem),
    ambiguous: results.filter((result) => result.status === STATUS.AMBIGUOUS).map(reportItem),
    needsReview: results.filter((result) => result.status === STATUS.NEEDS_REVIEW).map(reportItem)
  };
  mkdirSync(DATA_DIR, { recursive: true });
  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(resolve(DATA_DIR, "discovercars-locations.json"), `${JSON.stringify(catalog, null, 2)}\n`);
  writeFileSync(resolve(ROOT_DIR, "discovercars-locations.js"), `// Generated by scripts/update-discovercars-locations.js.\nwindow.YOUCITY_DISCOVERCARS_LOCATIONS = ${JSON.stringify(locations)};\n`);
  writeFileSync(resolve(REPORT_DIR, "discovercars-locations-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

function reportItem(result) {
  return { id: result.city.id, name: result.city.name, country: result.city.country, countryCode: result.city.countryCode, status: result.status, possibleMatches: result.possibleMatches };
}

function summarize(results) {
  return {
    youCityCities: results.length,
    verified: results.filter((result) => result.status === STATUS.VERIFIED).length,
    notAvailable: results.filter((result) => result.status === STATUS.NOT_AVAILABLE).length,
    ambiguous: results.filter((result) => result.status === STATUS.AMBIGUOUS).length,
    needsReview: results.filter((result) => result.status === STATUS.NEEDS_REVIEW).length
  };
}

function printReport(report) {
  console.log("DiscoverCars integration");
  console.log(`YouCity cities: ${report.summary.youCityCities}`);
  console.log(`Verified: ${report.summary.verified}`);
  console.log(`Not available: ${report.summary.notAvailable}`);
  console.log(`Ambiguous: ${report.summary.ambiguous}`);
  console.log(`Needs review: ${report.summary.needsReview}`);
  for (const [label, entries] of [["AMBIGUOUS", report.ambiguous], ["NEEDS_REVIEW", report.needsReview]]) {
    if (!entries.length) continue;
    console.log(`\n${label}`);
    entries.forEach((entry) => console.log(`- ${entry.name}, ${entry.country}${entry.possibleMatches.length ? `\n  Possible matches: ${entry.possibleMatches.map((match) => match.path).join(", ")}` : ""}`));
  }
  console.log(`\nCatalog: data/discovercars-locations.json`);
  console.log(`Report: reports/discovercars-locations-report.json`);
}

async function main() {
  const cities = loadYouCityCities();
  const source = await loadOfficialSitemaps();
  const indexes = buildLocationIndex(source.urls);
  const overrides = readOverrides();
  const results = [];
  for (const city of cities) results.push(await resolveCity(city, indexes, overrides));
  const report = writeOutputs(results, source);
  printReport(report);
}

main().catch((error) => {
  console.error(`DiscoverCars update failed: ${error.message}`);
  process.exitCode = 1;
});
