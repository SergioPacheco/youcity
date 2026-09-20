#!/usr/bin/env node

import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  canonicalCitySlug,
  editorialContentChanged,
  isTrustedEditorialUrl,
  validateCache,
  validateCompleteEntry
} from "./city-seo-content.mjs";

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CATALOG_PATH = resolve(ROOT_DIR, "data/catalog.json");
const CACHE_PATH = resolve(ROOT_DIR, "data/city-seo-content.json");
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const MAX_RETRIES = 2;
const REQUEST_TIMEOUT = 8_000;
const WORKER_COUNT = 3;
const USER_AGENT = "YouCity/1.0 (https://youcity.app)";

function delay(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

function retryableError(error) {
  return RETRYABLE_STATUSES.has(Number(error?.status))
    || error?.name === "AbortError"
    || error?.code === "ETIMEDOUT"
    || !error?.status;
}

function responseError(response, endpoint) {
  const error = new Error(`Request failed with status ${response.status}: ${endpoint}`);
  error.status = response.status;
  return error;
}

export async function retryJson(endpoint, { request = fetch, sleep = delay, timeout = REQUEST_TIMEOUT, maxRetries = MAX_RETRIES } = {}) {
  for (let attempt = 0; ; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await request(endpoint, {
        signal: controller.signal,
        headers: { accept: "application/json", "user-agent": USER_AGENT }
      });
      if (!response?.ok) throw responseError(response, endpoint);
      return await response.json();
    } catch (error) {
      if (!retryableError(error) || attempt >= maxRetries) throw error;
      await sleep(150 * (2 ** attempt));
    } finally {
      clearTimeout(timer);
    }
  }
}

export async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function runWorker() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker()));
  return results;
}

export function createThrottledRequest(request, { minimumInterval = 100, sleep = delay, now = () => Date.now() } = {}) {
  let lastRequestAt = null;
  return async (endpoint, init) => {
    if (lastRequestAt !== null) {
      const wait = minimumInterval - (now() - lastRequestAt);
      if (wait > 0) await sleep(wait);
    }
    lastRequestAt = now();
    return request(endpoint, init);
  };
}

function wikipediaSearchEndpoint(city, country, language) {
  const endpoint = new URL(`https://${language}.wikipedia.org/w/rest.php/v1/search/page`);
  endpoint.searchParams.set("q", `${city}, ${country}`);
  endpoint.searchParams.set("limit", "5");
  return endpoint;
}

function wikipediaActionSearchEndpoint(query, language) {
  const endpoint = new URL(`https://${language}.wikipedia.org/w/api.php`);
  endpoint.searchParams.set("action", "query");
  endpoint.searchParams.set("list", "search");
  endpoint.searchParams.set("srsearch", query);
  endpoint.searchParams.set("srlimit", "5");
  endpoint.searchParams.set("format", "json");
  endpoint.searchParams.set("origin", "*");
  return endpoint;
}

function wikipediaSummaryEndpoint(title, language) {
  return new URL(`https://${language}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
}

function wikidataGeosearchEndpoint(latitude, longitude) {
  const endpoint = new URL("https://www.wikidata.org/w/api.php");
  endpoint.searchParams.set("action", "query");
  endpoint.searchParams.set("list", "geosearch");
  endpoint.searchParams.set("gscoord", `${latitude}|${longitude}`);
  endpoint.searchParams.set("gsradius", "10000");
  endpoint.searchParams.set("gslimit", "20");
  endpoint.searchParams.set("format", "json");
  endpoint.searchParams.set("origin", "*");
  return endpoint;
}

function wikidataEntitiesEndpoint(ids, language) {
  const endpoint = new URL("https://www.wikidata.org/w/api.php");
  endpoint.searchParams.set("action", "wbgetentities");
  endpoint.searchParams.set("ids", ids.join("|"));
  endpoint.searchParams.set("props", "labels|descriptions|sitelinks");
  endpoint.searchParams.set("languages", `${language}|en`);
  endpoint.searchParams.set("sitefilter", `${language}wiki|enwiki`);
  endpoint.searchParams.set("format", "json");
  endpoint.searchParams.set("origin", "*");
  return endpoint;
}

function wikipediaNearbyEndpoint(latitude, longitude, language) {
  const endpoint = new URL(`https://${language}.wikipedia.org/w/api.php`);
  endpoint.searchParams.set("action", "query");
  endpoint.searchParams.set("generator", "geosearch");
  endpoint.searchParams.set("ggscoord", `${latitude}|${longitude}`);
  endpoint.searchParams.set("ggsradius", "10000");
  endpoint.searchParams.set("ggslimit", "20");
  endpoint.searchParams.set("prop", "description|info");
  endpoint.searchParams.set("inprop", "url");
  endpoint.searchParams.set("format", "json");
  endpoint.searchParams.set("origin", "*");
  return endpoint;
}

function comparable(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function placeUrl(language, article) {
  return `https://${language}.wikipedia.org/wiki/${encodeURIComponent(String(article).replaceAll(" ", "_"))}`;
}

const genericDescription = /\b(area|district|borough|county|region|metropolitan|municipality|conurbation|event|championship|pandemic|treaty|timeline|council|historical|festival|subprefecture|prefecture|administration|authority|office|transport|bus|railway|rail|film|station|hotel|neighborhood|jurisdiction|archdiocese)\b|trolley\w*/i;
const placeDescription = /\b(attraction|building|bridge|castle|cathedral|church|column|fort|gallery|garden|landmark|market|monument|museum|palace|park|square|stadium|statue|temple|theatre|tower)\b/i;

async function wikipediaSummary(city, language, requestOptions) {
  const queries = [`${city.name}, ${city.country}`, city.name];
  let page = null;
  for (const query of queries) {
    const endpoint = wikipediaSearchEndpoint(city.name, city.country, language);
    endpoint.searchParams.set("q", query);
    let payload;
    try {
      payload = await retryJson(endpoint, requestOptions);
    } catch {
      payload = await retryJson(wikipediaActionSearchEndpoint(query, language), requestOptions);
    }
    page = payload.pages?.find((candidate) => candidate.title)
      || payload.pages?.[0]
      || payload.query?.search?.find((candidate) => candidate.title)
      || payload.query?.search?.[0];
    if (page?.title) break;
  }
  if (!page?.title) return null;
  const summary = await retryJson(wikipediaSummaryEndpoint(page.title, language), requestOptions);
  const url = summary.content_urls?.desktop?.page || `https://${language}.wikipedia.org/wiki/${encodeURIComponent(page.title.replaceAll(" ", "_"))}`;
  return {
    title: summary.title || page.title,
    description: summary.description || "",
    extract: summary.extract || "",
    url
  };
}

function entityPlace(entity, language) {
  const label = entity?.labels?.[language]?.value || entity?.labels?.en?.value || "";
  const description = entity?.descriptions?.[language]?.value || entity?.descriptions?.en?.value || "";
  const article = entity?.sitelinks?.[`${language}wiki`]?.title || entity?.sitelinks?.enwiki?.title || "";
  if (!label || !article || description.trim().length < 15 || description.trim().length > 180 || genericDescription.test(`${label} ${description}`) || !placeDescription.test(`${label} ${description}`)) return null;
  return { name: label, description, url: placeUrl(language, article) };
}

async function nearbyPlaces(city, language, requestOptions) {
  const [latitude, longitude] = city.coordinates || [];
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
  const places = [];
  try {
    const nearby = await retryJson(wikidataGeosearchEndpoint(latitude, longitude), { ...requestOptions, timeout: 2_500 });
    const ids = (nearby.query?.geosearch || []).map((place) => place.title).filter((id) => /^Q\d+$/.test(id));
    if (ids.length) {
      const entities = await retryJson(wikidataEntitiesEndpoint(ids, language), { ...requestOptions, timeout: 2_500 });
      for (const id of ids) {
        const place = entityPlace(entities.entities?.[id], language);
        if (place && !places.some((existing) => comparable(existing.name) === comparable(place.name))) places.push(place);
        if (places.length === 5) break;
      }
    }
  } catch {
    // Wikipedia geosearch below remains the fallback when Wikidata is busy.
  }

  if (places.length < 2) {
    const nearby = await retryJson(wikipediaNearbyEndpoint(latitude, longitude, language), { ...requestOptions, timeout: 2_500 });
    const fallback = Object.values(nearby.query?.pages || {})
      .sort((first, second) => (first.index || 0) - (second.index || 0))
      .filter((place) => comparable(place.title) !== comparable(city.name) && !genericDescription.test(`${place.title} ${place.description || ""}`))
      .map((place) => ({
        name: place.title,
        description: place.description || "",
        url: place.fullurl || place.canonicalurl || placeUrl(language, place.title)
      }))
      .filter((place) => place.description.trim().length >= 15 && place.description.trim().length <= 180);
    for (const place of fallback) {
      if (!places.some((existing) => comparable(existing.name) === comparable(place.name))) places.push(place);
      if (places.length === 5) break;
    }
  }
  return places;
}

export async function syncCity(city, {
  previous = null,
  request = fetch,
  sleep = delay,
  now = () => new Date().toISOString().slice(0, 10),
  language = "en",
  preserveOnFailure = false
} = {}) {
  const requestOptions = { request, sleep };
  try {
    const summary = await wikipediaSummary(city, language, requestOptions);
    if (!summary || summary.extract.trim().length < 120 || !isTrustedEditorialUrl(summary.url)) {
      return { status: "incomplete", reason: "NO_VALID_SUMMARY" };
    }
    const places = await nearbyPlaces(city, language, requestOptions);
    const candidate = {
      status: "complete",
      city: city.name,
      country: city.country,
      summary,
      places: places.slice(0, 5),
      source: { name: "Wikipedia", url: summary.url },
      updatedAt: now()
    };
    const errors = validateCompleteEntry(candidate, city);
    if (errors.some((error) => error.startsWith("place") || error.includes("places"))) {
      return { status: "incomplete", reason: "NOT_ENOUGH_PLACES" };
    }
    if (errors.length) return { status: "incomplete", reason: "AMBIGUOUS_CITY" };
    if (previous?.status === "complete" && !editorialContentChanged(previous, candidate)) return previous;
    return candidate;
  } catch (error) {
    if (preserveOnFailure && previous?.status === "complete") return previous;
    if (preserveOnFailure) return { status: "incomplete", reason: "REQUEST_FAILED" };
    throw error;
  }
}

export function selectSyncCities(catalog, previousCache, onlyIncomplete = false) {
  if (!onlyIncomplete) return catalog;
  return catalog.filter((city) => {
    const entry = previousCache[canonicalCitySlug(city.name)];
    return entry?.status !== "complete" || entry.places?.some((place) => String(place.description || "").trim().toLowerCase() === "point of interest nearby");
  });
}

function readJson(path, fallback) {
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : fallback;
}

export async function syncCatalog({ catalog, previousCache = {}, request = fetch, sleep = delay } = {}) {
  return Object.fromEntries((await mapWithConcurrency(catalog, WORKER_COUNT, async (city) => {
    const key = canonicalCitySlug(city.name);
    const entry = await syncCity(city, { previous: previousCache[key], request, sleep, preserveOnFailure: true });
    return [key, entry];
  })).map(([key, entry]) => [key, entry]));
}

function printReport(catalog, cache) {
  const complete = catalog.filter((city) => cache[canonicalCitySlug(city.name)]?.status === "complete");
  const incomplete = catalog.filter((city) => cache[canonicalCitySlug(city.name)]?.status !== "complete");
  console.log("City SEO sync");
  console.log(`Cities in catalog: ${catalog.length}`);
  console.log(`Complete: ${complete.length}`);
  console.log(`Incomplete: ${incomplete.length}`);
  if (incomplete.length) {
    console.log("Incomplete cities:");
    incomplete.forEach((city) => console.log(`- ${city.name}, ${city.country} (${cache[canonicalCitySlug(city.name)]?.reason || "REQUEST_FAILED"})`));
  }
  return { complete, incomplete };
}

async function main() {
  const catalog = readJson(CATALOG_PATH, []);
  const previousCache = readJson(CACHE_PATH, {});
  const targetCatalog = selectSyncCities(catalog, previousCache, process.argv.includes("--only-incomplete"));
  const minimumInterval = Number(process.env.SEO_CONTENT_REQUEST_INTERVAL_MS || 350);
  const updates = await syncCatalog({ catalog: targetCatalog, previousCache, request: createThrottledRequest(fetch, { minimumInterval }) });
  const cache = targetCatalog === catalog ? updates : { ...previousCache, ...updates };
  const errors = validateCache(cache, catalog);
  if (errors.length) throw new Error(`Generated city SEO cache is invalid:\n${errors.join("\n")}`);
  const temporaryPath = `${CACHE_PATH}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(cache, null, 2)}\n`);
  renameSync(temporaryPath, CACHE_PATH);
  const { complete } = printReport(catalog, cache);
  const coverage = catalog.length ? complete.length / catalog.length : 0;
  if (coverage < 0.95 && !process.argv.includes("--allow-incomplete")) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
