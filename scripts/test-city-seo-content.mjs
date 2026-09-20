#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  canonicalCitySlug,
  editorialContentChanged,
  isTrustedEditorialUrl,
  sentenceAwareExcerpt,
  validateCache,
  validateCompleteEntry
} from "./city-seo-content.mjs";
import { createThrottledRequest, mapWithConcurrency, retryJson, selectSyncCities, syncCity } from "./sync-city-seo-content.mjs";

const validEntry = {
  status: "complete",
  city: "Granada",
  country: "Spain",
  summary: {
    title: "Granada",
    description: "city in Andalusia, Spain",
    extract: "Granada is a city in southern Spain and the capital of the province of Granada. It is known for its history, architecture, and cultural landmarks. The city sits at the foot of the Sierra Nevada mountains.",
    url: "https://en.wikipedia.org/wiki/Granada"
  },
  places: [
    { name: "Alhambra", description: "Palace and fortress complex in Granada.", url: "https://en.wikipedia.org/wiki/Alhambra" },
    { name: "Granada Cathedral", description: "Roman Catholic cathedral in Granada.", url: "https://en.wikipedia.org/wiki/Granada_Cathedral" }
  ],
  source: { name: "Wikipedia", url: "https://en.wikipedia.org/wiki/Granada" },
  updatedAt: "2026-09-19"
};

function runUnitTests() {
  assert.equal(canonicalCitySlug("São Paulo"), "sao-paulo");
  assert.deepEqual(validateCompleteEntry(validEntry, { name: "Granada", country: "Spain" }), []);
  const fabricatedDescription = structuredClone(validEntry);
  fabricatedDescription.places[0].description = "Point of interest nearby";
  assert.match(validateCompleteEntry(fabricatedDescription, { name: "Granada", country: "Spain" }).join("\n"), /factual|generic|nearby/i);
  assert.equal(isTrustedEditorialUrl("https://en.wikipedia.org/wiki/Granada"), true);
  assert.equal(isTrustedEditorialUrl("https://example.com/granada"), false);

  const duplicate = structuredClone(validEntry);
  duplicate.places[1].name = duplicate.places[0].name;
  assert.match(validateCompleteEntry(duplicate, { name: "Granada", country: "Spain" }).join("\n"), /unique/i);

  const tooMany = structuredClone(validEntry);
  tooMany.places.push(
    { name: "Sacromonte", description: "Historic hillside neighborhood in Granada.", url: "https://en.wikipedia.org/wiki/Sacromonte" },
    { name: "Generalife", description: "Historic palace and gardens beside the Alhambra.", url: "https://en.wikipedia.org/wiki/Generalife" },
    { name: "Granada Market", description: "Historic market and commercial place in Granada.", url: "https://en.wikipedia.org/wiki/Granada" },
    { name: "Granada Park", description: "Public park and green space in Granada.", url: "https://en.wikipedia.org/wiki/Granada" }
  );
  assert.match(validateCompleteEntry(tooMany, { name: "Granada", country: "Spain" }).join("\n"), /more than 5|maximum|five/i);

  const longText = "First sentence about Granada. Granada is a historic city in southern Spain known for its palaces, cathedral, neighborhoods, and mountain setting. Third sentence adds more context about the region and its history.";
  const excerpt = sentenceAwareExcerpt(longText, 80, 160);
  assert.ok(excerpt.length <= 160);
  assert.match(excerpt, /[.!?]$/);
  assert.ok(!excerpt.endsWith("abruptly"));

  const catalog = [{ name: "Granada", country: "Spain" }, { name: "São Paulo", country: "Brazil" }];
  const cache = { granada: validEntry, "sao-paulo": { status: "incomplete", reason: "REQUEST_FAILED" } };
  assert.deepEqual(validateCache(cache, catalog), []);
  assert.equal(editorialContentChanged(validEntry, { ...validEntry, updatedAt: "2026-09-20" }), false);
  assert.equal(editorialContentChanged(validEntry, { ...validEntry, summary: { ...validEntry.summary, title: "Granada city" } }), true);
}

async function runSyncUnitTests() {
  let attempts = 0;
  const retryResult = await retryJson("https://example.test/retry", {
    request: async () => {
      attempts += 1;
      if (attempts < 3) throw Object.assign(new Error("busy"), { status: 429 });
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    },
    sleep: async () => {}
  });
  assert.deepEqual(retryResult, { ok: true });
  assert.equal(attempts, 3);

  let active = 0;
  let maximumActive = 0;
  await mapWithConcurrency([1, 2, 3, 4, 5, 6, 7], 4, async (value) => {
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    await new Promise((resolve) => setTimeout(resolve, 1));
    active -= 1;
    return value * 2;
  });
  assert.ok(maximumActive <= 4);

  const city = { name: "Granada", country: "Spain", coordinates: [37.1765, -3.5979] };
  const previous = { ...validEntry, updatedAt: "2026-09-18" };
  await assert.rejects(() => syncCity(city, {
    previous,
    request: async () => { throw Object.assign(new Error("offline"), { status: 503 }); },
    sleep: async () => {}
  }));
  const retained = await syncCity(city, {
    previous,
    request: async () => { throw Object.assign(new Error("offline"), { status: 503 }); },
    sleep: async () => {},
    preserveOnFailure: true
  });
  assert.deepEqual(retained, previous);

  const insufficientRequest = async (endpoint) => {
    const url = new URL(endpoint);
    if (url.pathname.endsWith("/search/page")) return { ok: true, status: 200, json: async () => ({ pages: [{ title: "Granada" }] }) };
    if (url.pathname.includes("/summary/")) return { ok: true, status: 200, json: async () => ({ title: "Granada", extract: validEntry.summary.extract, content_urls: { desktop: { page: validEntry.summary.url } } }) };
    return { ok: true, status: 200, json: async () => ({ query: { geosearch: [], pages: {} } }) };
  };
  const retainedAfterInsufficientData = await syncCity(city, {
    previous,
    request: insufficientRequest,
    sleep: async () => {},
    preserveOnFailure: true
  });
  assert.deepEqual(retainedAfterInsufficientData, previous);

  const requested = [];
  const request = async (endpoint) => {
    const url = new URL(endpoint);
    requested.push(url.href);
    if (url.pathname.endsWith("/search/page")) {
      return { ok: true, status: 200, json: async () => url.searchParams.get("q") === "Granada, Spain" ? { pages: [] } : { pages: [{ title: "Granada" }] } };
    }
    if (url.pathname.includes("/summary/")) {
      return { ok: true, status: 200, json: async () => ({ title: "Granada", description: "city in Andalusia, Spain", extract: validEntry.summary.extract, content_urls: { desktop: { page: validEntry.summary.url } } }) };
    }
    if (url.hostname === "www.wikidata.org" && url.searchParams.get("list") === "geosearch") {
      return { ok: true, status: 200, json: async () => ({ query: { geosearch: [{ title: "Q1" }, { title: "Q2" }, { title: "Q3" }] } }) };
    }
    if (url.hostname === "www.wikidata.org" && url.searchParams.get("action") === "wbgetentities") {
      return { ok: true, status: 200, json: async () => ({ entities: {
        Q1: { labels: { en: { value: "Alhambra" } }, descriptions: { en: { value: "Palace and fortress complex in Granada." } }, sitelinks: { enwiki: { title: "Alhambra" } } },
        Q2: { labels: { en: { value: "Granada Cathedral" } }, descriptions: { en: { value: "Roman Catholic cathedral in Granada." } }, sitelinks: { enwiki: { title: "Granada Cathedral" } } },
        Q3: { labels: { en: { value: "Short Description Stadium" } }, descriptions: { en: { value: "stadium" } }, sitelinks: { enwiki: { title: "Short Description Stadium" } } }
      } }) };
    }
    if (url.hostname.endsWith("wikipedia.org") && url.pathname.endsWith("/w/api.php")) {
      return { ok: true, status: 200, json: async () => ({ query: { pages: {} } }) };
    }
    throw new Error(`Unexpected endpoint ${url.href}`);
  };
  const synced = await syncCity(city, { request, sleep: async () => {}, now: () => "2026-09-19" });
  assert.equal(synced.status, "complete");
  assert.ok(synced.places.length >= 2);
  assert.ok(!synced.places.some((place) => place.name === "Short Description Stadium"));
  assert.ok(requested.every((url) => !url.includes("commons.wikimedia.org")));
  assert.ok(requested.every((url) => !url.includes("generator=geosearch")), "Wikipedia geosearch should only run when Wikidata has fewer than two places");

  let usedActionSearch = false;
  const restLimitedRequest = async (endpoint, init) => {
    const url = new URL(endpoint);
    if (url.pathname.endsWith("/search/page")) throw Object.assign(new Error("busy"), { status: 429 });
    if (url.pathname.endsWith("/w/api.php") && url.searchParams.get("list") === "search") {
      usedActionSearch = true;
      return { ok: true, status: 200, json: async () => ({ query: { search: [{ title: "Granada" }] } }) };
    }
    return request(endpoint, init);
  };
  const fallbackSynced = await syncCity(city, { request: restLimitedRequest, sleep: async () => {}, now: () => "2026-09-19" });
  assert.equal(fallbackSynced.status, "complete");
  assert.equal(usedActionSearch, true);

  const pauses = [];
  let clock = 1_000;
  const throttled = createThrottledRequest(async () => ({ ok: true, status: 200, json: async () => ({}) }), {
    minimumInterval: 100,
    sleep: async (milliseconds) => { pauses.push(milliseconds); },
    now: () => clock
  });
  await throttled("https://example.test/one");
  await throttled("https://example.test/two");
  assert.deepEqual(pauses, [100]);

  const startTimes = [];
  const queued = createThrottledRequest(async () => {
    startTimes.push(clock);
    return { ok: true, status: 200, json: async () => ({}) };
  }, {
    minimumInterval: 100,
    sleep: async (milliseconds) => { clock += milliseconds; },
    now: () => clock
  });
  await Promise.all([
    queued("https://example.test/a"),
    queued("https://example.test/b"),
    queued("https://example.test/c")
  ]);
  assert.deepEqual(startTimes, [1000, 1100, 1200]);

  const incompleteOnly = selectSyncCities(
    [{ name: "Granada" }, { name: "London" }],
    { granada: { status: "complete" }, london: { status: "incomplete", reason: "REQUEST_FAILED" } },
    true
  );
  assert.deepEqual(incompleteOnly.map((city) => city.name), ["London"]);
  const needsRefresh = selectSyncCities(
    [{ name: "Granada" }, { name: "London" }],
    { granada: { status: "complete", places: [{ description: "Point of interest nearby" }] }, london: { status: "complete", places: [{ description: "Historic landmark in London" }] } },
    true
  );
  assert.deepEqual(needsRefresh.map((city) => city.name), ["Granada"]);
}

function runCoverageTest() {
  const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
  const catalog = JSON.parse(readFileSync(resolve(root, "data/catalog.json"), "utf8"));
  const cache = JSON.parse(readFileSync(resolve(root, "data/city-seo-content.json"), "utf8"));
  const errors = validateCache(cache, catalog);
  if (errors.length) throw new Error(`SEO content validation failed:\n${errors.join("\n")}`);
  const complete = catalog.filter((city) => cache[canonicalCitySlug(city.name)]?.status === "complete");
  const incomplete = catalog.filter((city) => cache[canonicalCitySlug(city.name)]?.status !== "complete");
  const coverage = catalog.length ? (complete.length / catalog.length) * 100 : 0;
  console.log("SEO editorial coverage");
  console.log(`Catalog cities: ${catalog.length}`);
  console.log(`Complete editorial entries: ${complete.length}`);
  console.log(`Incomplete entries: ${incomplete.length}`);
  console.log(`Coverage: ${coverage.toFixed(1)}%`);
  if (incomplete.length) {
    console.log("Incomplete cities:");
    incomplete.forEach((city) => console.log(`- ${city.name}, ${city.country} (${cache[canonicalCitySlug(city.name)]?.reason})`));
  }
  for (const name of ["Granada", "London", "Sao Paulo", "Medellín", "Nairobi", "Perth", "Malibu"]) {
    const city = catalog.find((candidate) => candidate.name === name);
    assert.ok(city, `${name} should exist in catalog`);
    assert.equal(cache[canonicalCitySlug(city.name)]?.status, "complete", `${name} should have complete editorial content`);
  }
  if (coverage < 95 && !process.argv.includes("--allow-incomplete")) {
    throw new Error(`Editorial coverage ${coverage.toFixed(1)}% is below the required 95.0%`);
  }
}

if (process.argv.includes("--unit")) {
  runUnitTests();
  console.log("City SEO content unit tests passed.");
}

if (process.argv.includes("--sync-unit")) {
  await runSyncUnitTests();
  console.log("City SEO synchronization unit tests passed.");
}

if (!process.argv.includes("--unit") && !process.argv.includes("--sync-unit")) runCoverageTest();
