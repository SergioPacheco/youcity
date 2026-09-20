# City SEO Content Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a deterministic, locally cached and validated editorial layer for every catalog city and render complete city-specific content into static HTML with a safe Sprint 1 fallback.

**Architecture:** A shared ESM contract module validates cache entries, trusted URLs, excerpt limits, and catalog coverage. An explicit four-worker synchronization script fetches Wikipedia/Wikidata data and atomically updates the cache while preserving previous valid entries on temporary failures. The CommonJS static builder reads the cache once and renders complete entries; validation scripts check cache quality and generated HTML without any build-time network access.

**Tech Stack:** Node.js 20, built-in `fetch`, built-in `assert`, JSON, CommonJS static build script, ESM synchronization/helpers, existing `src/core/url.mjs` slug contract.

**Spec:** `docs/superpowers/specs/2026-09-19-city-seo-content-design.md`

## Global Constraints

- `data/catalog.json` is read-only for synchronization.
- `node scripts/build-static.js` must make no external HTTP requests.
- Use Wikipedia summary/search and Wikidata/Wikipedia geosearch logic already used by City Guide.
- Do not fetch Wikimedia Commons images in synchronization.
- Use canonical city slugs and allow only Wikipedia/Wikidata editorial URLs.
- Complete entries require an extract of at least 120 characters and at least two valid places.
- Render at most five places, with descriptions from 15 through 180 characters.
- Keep `updatedAt` unchanged when editorial content is unchanged.
- Preserve valid cache entries when a new sync attempt fails temporarily.
- Incomplete entries must never remove a city page or block the static build.
- Do not alter meta title/description, affiliate logic, radio playback, video player, runtime City Guide, or other unrelated features.

## Review Focus

- A temporary API failure must not erase an existing complete city entry; test with a preloaded cache and a rejected fetch.
- A malicious or non-editorial URL must never reach generated HTML; test trusted-host rejection and escaped output.
- Nested destination sections must be counted as one outer section; test complete pages with About and Places subsections.
- A complete page with only generic template text must fail the 100-word and duplicate-content checks; test two normalized pages.
- A missing or incomplete cache entry must still render the old destination template and keep the city page in the build; test fallback rendering.

---

### Task 1: Add the shared editorial cache contract and validator

**Files:**
- Create: `scripts/city-seo-content.mjs`
- Modify: `scripts/test-city-seo-content.mjs`

**Interfaces:**
- Consumes: catalog array and cache object.
- Produces: `canonicalCitySlug(value)`, `isTrustedEditorialUrl(value)`, `sentenceAwareExcerpt(value, minLength, maxLength)`, `validateCompleteEntry(entry, city)`, `validateCache(cache, catalog)`, and `editorialContentChanged(previous, next)`.

- [ ] **Step 1: Write the failing tests**

Add assertions to `scripts/test-city-seo-content.mjs` for a valid synthetic Granada entry, rejection of an `example.com` source URL, rejection of a duplicate place name, rejection of a sixth place, sentence-aware extraction below 700 characters, and exact catalog-key matching. Import the named functions from `scripts/city-seo-content.mjs` before that file exists.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `node scripts/test-city-seo-content.mjs --unit`

Expected: FAIL because `scripts/city-seo-content.mjs` does not exist.

- [ ] **Step 3: Implement the minimal shared module**

Implement these behaviors:

```js
import { slugify } from "../src/core/url.mjs";

export const MIN_EXTRACT_LENGTH = 120;
export const MIN_PLACE_COUNT = 2;
export const MAX_PLACE_COUNT = 5;
export const TRUSTED_EDITORIAL_HOSTS = new Set(["wikipedia.org", "wikidata.org"]);

export function canonicalCitySlug(value) {
  return slugify(value);
}

export function isTrustedEditorialUrl(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return (host === "wikipedia.org" || host.endsWith(".wikipedia.org") || host === "wikidata.org" || host.endsWith(".wikidata.org")) && url.protocol === "https:";
  } catch {
    return false;
  }
}
```

`sentenceAwareExcerpt` must normalize whitespace, return no more than 700 characters, prefer the last complete sentence within the limit, and use the maximum boundary only when no complete sentence exists. `validateCompleteEntry` must return an array of error strings, requiring `status === "complete"`, matching city/country, a trusted summary URL, an extract of at least 120 characters, two to five places, unique non-empty names, descriptions of 15–180 characters, and trusted place URLs when present. `validateCache` must reject unknown keys, missing catalog keys, invalid complete entries, and malformed incomplete reasons. `editorialContentChanged` must compare only editorial fields and ignore `updatedAt`.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `node scripts/test-city-seo-content.mjs --unit`

Expected: PASS for all unit assertions.

- [ ] **Step 5: Commit**

```bash
git add scripts/city-seo-content.mjs scripts/test-city-seo-content.mjs
git commit -m "feat: add city SEO cache validation contract"
```

### Task 2: Implement the explicit city SEO synchronization command

**Files:**
- Create: `scripts/sync-city-seo-content.mjs`
- Modify: `scripts/test-city-seo-content.mjs`
- Create: `data/city-seo-content.json`

**Interfaces:**
- Consumes: `data/catalog.json`, existing cache if present, and the shared contract from Task 1.
- Produces: one cache entry for every catalog city, sync report, `--allow-incomplete`, four-city worker pool, and retry behavior for 429/500/502/503/504/timeouts.

- [ ] **Step 1: Write the failing synchronization tests**

Add `--sync-unit` assertions using injected request functions for: a 429 followed by success (three total attempts), no more than four active city workers, preservation of a previous complete entry after a request failure, fallback from `<city>, <country>` search to `<city>`, and omission of Commons URLs from the requested endpoints. Export testable `retryJson`, `mapWithConcurrency`, and `syncCity` functions from the synchronization module without running the CLI on import.

- [ ] **Step 2: Run the synchronization tests to verify they fail**

Run: `node scripts/test-city-seo-content.mjs --sync-unit`

Expected: FAIL because `scripts/sync-city-seo-content.mjs` does not exist.

- [ ] **Step 3: Implement the synchronization command**

Use `fetch` with an `AbortController`, an 8-second default timeout, `accept: application/json`, and a YouCity user agent. Retry only 429 and 500/502/503/504 plus abort/timeouts, with delays of 150ms and 300ms. Search Wikipedia in the catalog city’s country form first and city-only second; select a result whose title is present, then request `/api/rest_v1/page/summary/<title>`. Use catalog coordinates for Wikidata geosearch and the existing City Guide generic-description/place-type filters, then Wikipedia geosearch fallback. Fetch no Commons endpoint.

Normalize summary and place fields through the shared validator. A valid new entry uses the current ISO date only when its editorial payload differs from the previous complete entry. If all attempts fail and a previous complete entry exists, retain it byte-for-byte. Otherwise write `{ status: "incomplete", reason }`. Write JSON with stable two-space formatting through a temporary file and `renameSync`.

The CLI must print:

```text
City SEO sync
Cities in catalog: <N>
Complete: <N>
Incomplete: <N>
```

then list incomplete cities. Exit nonzero below 95% unless `--allow-incomplete` is present. Never write to `data/catalog.json`.

- [ ] **Step 4: Run the synchronization tests to verify they pass**

Run: `node scripts/test-city-seo-content.mjs --sync-unit`

Expected: PASS for retry, concurrency, fallback, cache preservation, and no-Commons assertions.

- [ ] **Step 5: Run the real synchronization**

Run: `npm run seo:content:sync -- --allow-incomplete`

Expected: cache contains exactly one entry for each of the 228 catalog cities and the command prints complete/incomplete coverage plus incomplete city names. A transient external failure may leave an explicit incomplete entry or preserve an existing valid entry.

- [ ] **Step 6: Commit**

```bash
git add scripts/sync-city-seo-content.mjs scripts/test-city-seo-content.mjs data/city-seo-content.json
git commit -m "feat: sync cached city SEO editorial content"
```

### Task 3: Render complete editorial content in the static builder

**Files:**
- Modify: `scripts/build-static.js`
- Modify: `scripts/test-static-seo.js`

**Interfaces:**
- Consumes: local `data/city-seo-content.json`, `city`, `catalog`, and the existing rendering helpers.
- Produces: `renderDestinationContent(city, catalog, editorialContent)` with complete and fallback branches.

- [ ] **Step 1: Write the failing renderer tests**

Extend `scripts/test-static-seo.js` with a synthetic complete editorial entry containing escaped text and trusted Wikipedia links. Assert `.destination-about`, `.destination-experiences`, `.destination-places`, `About Granada`, `Places to discover in Granada`, visible `Source: Wikipedia`, escaped description markup, linked place names, and a fallback render when `status` is incomplete. Add the sample cities London, São Paulo, Medellín, Nairobi, Perth, and Malibu to the fixture lookup so the test exercises the generic renderer.

- [ ] **Step 2: Run the renderer tests to verify they fail**

Run: `node scripts/test-static-seo.js`

Expected: FAIL because `renderDestinationContent` does not accept editorial content or emit the new sections.

- [ ] **Step 3: Implement the renderer and local cache loading**

Load and parse `data/city-seo-content.json` once in `main`, pass `seoContent[slugify(city.name)]` through `renderPage`/`replaceDestinationContent`, and update the exported function signature to `renderDestinationContent(city, catalog, editorialContent)`. Keep the current opening heading, mode list, radio section, and related section. For complete entries add:

```html
<section class="destination-about">...</section>
<section class="destination-experiences">...</section>
<section class="destination-places">...</section>
```

Use `sentenceAwareExcerpt` behavior locally in CommonJS-compatible code, retain visible `Source: Wikipedia ↗`, allow a place name link only when its URL passes the trusted-host predicate, and HTML-escape every interpolated field. Keep the old output exactly for incomplete/missing editorial data. The cache is optional for backward-compatible local builds only when absent; a present malformed cache should fail clearly rather than silently inject data.

- [ ] **Step 4: Run the renderer tests to verify they pass**

Run: `node scripts/test-static-seo.js`

Expected: PASS for complete rendering, escaping, trusted links, fallback, existing title/description behavior, radio output, and related cities.

- [ ] **Step 5: Commit**

```bash
git add scripts/build-static.js scripts/test-static-seo.js
git commit -m "feat: render cached city editorial content"
```

### Task 4: Add cache coverage tests, static SEO checks, and npm wiring

**Files:**
- Modify: `scripts/test-city-seo-content.mjs`
- Modify: `scripts/seo-check.js`
- Modify: `package.json`
- Modify: `package-lock.json` only if npm changes it

**Interfaces:**
- Consumes: generated cache from Task 2 and generated HTML from Task 3.
- Produces: `seo:content:test`, content coverage report, complete-page structure/word/duplicate checks, and `npm test` integration.

- [ ] **Step 1: Write failing cache and SEO-check assertions**

Make the content test load the real catalog and cache by default, call `validateCache`, print:

```text
SEO editorial coverage
Catalog cities: <N>
Complete editorial entries: <N>
Incomplete entries: <N>
Coverage: <X.X>%
```

and fail on unknown/missing keys, invalid data, or coverage below 95% unless `--allow-incomplete` is passed. Extend `seo-check.js` tests/checks to require, for complete cities, the About and Places classes/headings, a visible Wikipedia attribution, at least 100 visible words inside the outer destination section, and unique normalized About+Places text across complete pages. Add fixture coverage for Granada, London, São Paulo, Medellín, Nairobi, Perth, and Malibu.

- [ ] **Step 2: Run the checks to verify they fail before implementation**

Run: `node scripts/test-city-seo-content.mjs --allow-incomplete`

Expected: FAIL if the cache is absent or does not yet satisfy the catalog contract.

Run: `SEO_SITE_URL=https://youcity.app node scripts/build-static.js && node scripts/seo-check.js`

Expected: FAIL because the generated pages do not yet contain the required complete-editorial sections.

- [ ] **Step 3: Implement the validator and SEO checks**

Use the shared canonical slug and validator. In `seo-check.js`, extract the outer `destination-content` section with a balanced tag scan so nested About/Places sections are not truncated. Strip tags and decode HTML entities enough for visible word counting. Normalize duplicate comparison by lowercasing, removing city and country names, removing punctuation, and collapsing whitespace. Only complete cache entries participate in the 100-word and duplicate checks.

Add package scripts:

```json
"seo:content:sync": "node scripts/sync-city-seo-content.mjs",
"seo:content:test": "node scripts/test-city-seo-content.mjs"
```

and include `npm run seo:content:test` in `npm test`.

- [ ] **Step 4: Run the cache test to verify it passes**

Run: `npm run seo:content:test -- --allow-incomplete`

Expected: PASS with coverage report and explicit incomplete cities, unless actual synchronized coverage is below target without the flag.

- [ ] **Step 5: Commit**

```bash
git add scripts/test-city-seo-content.mjs scripts/seo-check.js package.json package-lock.json
git commit -m "test: enforce city SEO editorial coverage"
```

### Task 5: Verify performance, full build, and regression safety

**Files:**
- Modify: `scripts/build-static.js` only if verification reveals a defect.
- Modify: `scripts/seo-check.js` only if verification reveals a defect.
- Modify: `scripts/test-city-seo-content.mjs` only if verification reveals a defect.

**Interfaces:**
- Consumes: all prior tasks and the complete local cache.
- Produces: verified static output, build validation, regression test results, word-count report, and final coverage report.

- [ ] **Step 1: Run the requested content review**

Run: `npm run seo:content:test`

Expected: PASS, coverage at least 95%, no unknown keys, trusted URLs, valid descriptions, and no duplicate place names.

- [ ] **Step 2: Run the full project test suite**

Run: `npm test`

Expected: PASS, including the new content test, with existing catalog, architecture, radio, affiliate, and UI tests unchanged.

- [ ] **Step 3: Build and validate with timing and network guard**

Run: `env -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY SEO_SITE_URL=https://youcity.app /usr/bin/time -f 'build_seconds=%e' node scripts/build-static.js`

Expected: exit 0, 229 HTML pages, and no HTTP request code path invoked. The build reads the cache once and completes within the baseline-plus-local-JSON parsing overhead; record the measured duration.

Run: `npm run build:validate`

Expected: PASS with module imports and required files validated.

- [ ] **Step 4: Run the final static SEO check**

Run: `SEO_SITE_URL=https://youcity.app node scripts/seo-check.js`

Expected: PASS for all catalog city pages, complete-page structure, 100-word minimum, attribution, duplicate-content, metadata, and sitemap checks. Print average/minimum/maximum destination-content words.

- [ ] **Step 5: Inspect diff and representative pages**

Run: `git diff --check && rg -n "destination-about|destination-places|Source: Wikipedia|About Granada|Places to discover in Medellín" dist/city/granada.html dist/city/london.html dist/city/sao-paulo.html dist/city/medellin.html dist/city/nairobi.html dist/city/perth.html dist/city/malibu.html`

Expected: each representative complete page contains city-specific About and Places content, visible attribution, and no unescaped markup.

- [ ] **Step 6: Commit any verification-only fixes**

```bash
git add scripts package.json package-lock.json data/city-seo-content.json
git commit -m "test: verify static city SEO content pipeline"
```
