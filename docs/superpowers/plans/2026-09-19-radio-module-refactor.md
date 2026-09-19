# YouCity Radio Module Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify curated and Radio Browser stations behind a normalized repository while preserving radio playback, safe Now Playing resolution, automatic YouTube search, and deployable static output.

**Architecture:** `radio-station.mjs` defines the normalized station contract. `radio-station-repository.mjs` owns catalog/discovery merge state, deduplication, ordering, and station lookup. Playback consumes repository stations by `stationRef`; Cloudflare Functions resolve only validated refs against a generated catalog index or Radio Browser UUID lookup.

**Tech Stack:** Existing browser ES modules, Cloudflare Pages Functions, Node.js test scripts, generated catalog assets, no new dependency.

**Spec:** `docs/superpowers/specs/2026-09-19-radio-module-refactor-design.md`

## Global Constraints

- `data/catalog.json` remains the source of truth for curated radio stations.
- Curated stations remain primary/recommended; Radio Browser remains supplemental discovery/enrichment.
- No database, persistent backend, new framework, or dependency.
- Preserve playback, city switching, retries, HLS playback, ICY parsing, lazy YouTube embeds, and existing unrelated features.
- No arbitrary public stream URL fetching from the Now Playing endpoint.
- Every new browser module must be present in `dist/` and pass recursive import validation.

## Review Focus

- Discovery completion while a curated station is playing must not change `audio.src`, call `audio.load()`, or interrupt playback; cover in Task 2.
- A catalog stream absent from Radio Browser must still return direct ICY metadata; cover in Task 4.
- Malformed, unknown, `https://`, and `file://` station refs must not trigger arbitrary fetches; cover in Task 4.
- HLS/empty metadata must return an explicit reason without breaking playback; cover in Task 4.
- Stale metadata or YouTube requests must not update a newly selected station; cover in Task 5.

### Task 1: Normalized station model and repository

**Files:**
- Create: `src/radio/radio-station.mjs`
- Create: `src/radio/radio-station-repository.mjs`
- Create: `scripts/test-radio-station-repository.mjs`
- Modify: `src/core/url.mjs` only if the existing slug export needs a direct import adjustment; do not create a second slug contract.

**Interfaces:**
- Produces `normalizeCatalogStation(city, radio, index)`, `normalizeRadioBrowserStation(city, station)`, `normalizeStreamUrl(value)`, `createRadioStationRepository({ getCity })`.
- Repository produces `getCatalogStations()`, `getDiscoveredStations()`, `getStations()`, `mergeDiscoveredStations(stations)`, `clearDiscoveredStations()`, and `findStationByRef(stationRef)`.

- [ ] **Step 1: Write the failing normalization/repository test.** Test the exact catalog and Radio Browser shapes, curated-first ordering, zero-discovery preservation, per-city discovery isolation, UUID/URL deduplication, and curated-wins behavior.

- [ ] **Step 2: Run the test and verify the expected failure.**

  Run: `node scripts/test-radio-station-repository.mjs`

  Expected: FAIL because the new modules do not yet exist.

- [ ] **Step 3: Implement the normalized station helpers.** Reuse `slugify` from `src/core/url.mjs`; trim strings, coerce bitrate, set stable refs, retain optional metadata, and set `curated` correctly.

- [ ] **Step 4: Implement the repository.** Normalize the current city catalog on read, cache discovered stations by city key, normalize incoming Browser records when needed, deduplicate conservatively in identity priority order, keep curated records first, and make merge operations side-effect free with respect to audio.

- [ ] **Step 5: Run the focused test and the existing suite.**

  Run: `node scripts/test-radio-station-repository.mjs`

  Expected: normalization, ordering, deduplication, zero results, and city cache assertions pass.

  Run: `npm test`

  Expected: existing baseline tests plus the new repository test pass.

- [ ] **Step 6: Commit the task.**

  Run: `git add src/radio/radio-station.mjs src/radio/radio-station-repository.mjs scripts/test-radio-station-repository.mjs && git commit -m "feat: add normalized radio station repository"`

### Task 2: Playback controller, bootstrap, and local stations UI

**Files:**
- Modify: `src/radio/radio-controller.mjs`
- Modify: `src/radio/radio-browser-feature.mjs`
- Modify: `src/app/bootstrap.mjs`
- Modify: `src/app/dom.mjs`
- Modify: `index.html`
- Modify: `styles.css` only for local-stations grouping/status/close-control presentation.
- Modify: `scripts/test-radio-browser.mjs`

**Interfaces:**
- Consumes repository API from Task 1.
- Controller consumes `getStations: () => repository.getStations()` and exposes `playStation(station)`, `getCurrentStation()`, `getIndex()` without discovery mutators.
- Browser feature consumes `stationRepository` and renders recommended catalog stations before discovery results.

- [ ] **Step 1: Extend tests with stationRef playback and discovery-stability regressions.** Use an audio spy that counts `pause`, `load`, `src` assignments, and `play`; start a curated station, merge a discovered station, and assert the current ref/source and playback remain unchanged. Assert curated and discovered buttons render in their respective groups and empty API results keep curated stations.

- [ ] **Step 2: Run the focused test and verify the expected failure.**

  Run: `node scripts/test-radio-browser.mjs`

  Expected: FAIL because the controller still owns `additionalStations` and the feature still renders only API stations.

- [ ] **Step 3: Migrate the controller.** Remove `additionalStations` state and mutators. Add `getStations`, `currentStationRef`, ref-based selection, and index derivation. Ensure repository merge is never routed through `setRadio`.

- [ ] **Step 4: Migrate bootstrap and city changes.** Create the repository before the controller, pass it to controller/browser feature, remove controller discovery cleanup, and reset repository/browser feature state at city changes without touching playback semantics.

- [ ] **Step 5: Refactor the local stations feature and markup.** Render curated stations immediately as “Recommended”, show “More nearby” loading/status, merge normalized API stations, preserve curated stations on empty/error, and select any station by `stationRef`. Keep the 📻 button and add only the explicit close control needed by the media panel.

- [ ] **Step 6: Run the focused test and full suite.**

  Run: `node scripts/test-radio-browser.mjs`

  Expected: all discovery, grouping, stationRef, and playback-stability assertions pass.

  Run: `npm test`

  Expected: full suite passes.

- [ ] **Step 7: Commit the task.**

  Run: `git add src/radio/radio-controller.mjs src/radio/radio-browser-feature.mjs src/app/bootstrap.mjs src/app/dom.mjs index.html styles.css scripts/test-radio-browser.mjs && git commit -m "refactor: make curated radio stations primary"`

### Task 3: Geographic Radio Browser discovery

**Files:**
- Modify: `functions/api/radio-stations.js`
- Modify: `src/radio/radio-browser.mjs`
- Modify: `scripts/test-radio-browser.mjs`

**Interfaces:**
- Keeps `/api/radio-stations?city=&country=&latitude=&longitude=` request shape.
- Returns Browser station records with enough metadata for `normalizeRadioBrowserStation`.

- [ ] **Step 1: Add failing endpoint/client tests.** Assert candidate requests do not depend solely on `name=city`, valid geo coordinates are required for local ranking, stations are sorted by distance then votes, preferred candidates within 50 km win over farther candidates, fallback reaches 150 km, and malformed geo records are excluded.

- [ ] **Step 2: Run the focused test and verify failure.**

  Run: `node scripts/test-radio-browser.mjs`

  Expected: FAIL against the current name-only endpoint construction and incomplete assertions.

- [ ] **Step 3: Implement progressive candidate retrieval.** Query country/country-code candidates first, optionally supplement with city-name candidates, use official mirrors, merge payloads, validate HTTPS/nonbroken/non-HLS streams and coordinates, compute `distanceKm`, filter to 150 km, rank by distance and votes, and cap results.

- [ ] **Step 4: Keep browser normalization compatible.** Normalize `stationuuid`, `url_resolved`, country fields, metadata, and source while leaving geographic ranking server-side.

- [ ] **Step 5: Run focused and full tests.**

  Run: `node scripts/test-radio-browser.mjs && npm test`

  Expected: geographic discovery tests and the full suite pass.

- [ ] **Step 6: Commit the task.**

  Run: `git add functions/api/radio-stations.js src/radio/radio-browser.mjs scripts/test-radio-browser.mjs && git commit -m "fix: rank radio discovery by geography"`

### Task 4: Generated catalog index and secure Now Playing resolution

**Files:**
- Modify: `scripts/build-catalog.js`
- Create/generated: `src/radio/radio-catalog-index.mjs` (only through the catalog build; never hand-edit generated content)
- Modify: `src/radio/radio-now-playing.mjs`
- Modify: `functions/api/radio-now-playing.js`
- Modify: `scripts/test-radio-now-playing.mjs`

**Interfaces:**
- Catalog build exports `findCatalogStation(stationRef)` from the generated index.
- Browser request path accepts `station.stationRef` and sends only `stationRef`.
- Worker resolves `catalog:*` locally and `radio-browser:*` through UUID lookup.

- [ ] **Step 1: Write failing tests for stationRef requests and server resolution.** Test the generated catalog ref, direct catalog ICY inspection without Browser lookup, Browser UUID inspection, invalid refs, unknown refs, `url=` rejection, HLS reason, empty metadata reason, and the unchanged ICY normalization.

- [ ] **Step 2: Run the focused test and verify failure.**

  Run: `node scripts/test-radio-now-playing.mjs`

  Expected: FAIL because the browser still sends `stationuuid/url/name` and the Worker still resolves arbitrary URLs through Radio Browser.

- [ ] **Step 3: Generate the lightweight radio index.** Extend `scripts/build-catalog.js` to write station refs, names, and URLs derived from `data/catalog.json`, preserving the existing catalog output and validation.

- [ ] **Step 4: Refactor the browser Now Playing client.** Build `?stationRef=...`, preserve request deduplication and fresh metadata behavior, and keep `normalizeNowPlaying`/`parseIcyMetadata` unchanged in output.

- [ ] **Step 5: Refactor the Worker.** Validate the ref grammar, resolve catalog refs from the generated index, resolve Browser refs only by UUID, inspect the resolved stream directly, distinguish `NO_METADATA`, `UNSUPPORTED_HLS_METADATA`, `STREAM_UNAVAILABLE`, and invalid/not-found errors, and never use user-controlled URLs as fetch targets.

- [ ] **Step 6: Run catalog build, focused tests, and full suite.**

  Run: `node scripts/build-catalog.js && node scripts/test-radio-now-playing.mjs && npm test`

  Expected: generated index exists, curated and Browser Now Playing tests pass, and the full suite remains green.

- [ ] **Step 7: Commit the task.**

  Run: `git add scripts/build-catalog.js src/radio/radio-catalog-index.mjs src/radio/radio-now-playing.mjs functions/api/radio-now-playing.js scripts/test-radio-now-playing.mjs && git commit -m "security: resolve radio now-playing by station ref"`

### Task 5: Automatic identification-to-YouTube flow

**Files:**
- Modify: `src/radio/radio-media-feature.mjs`
- Modify: `src/app/dom.mjs`
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `scripts/test-radio-now-playing.mjs`

**Interfaces:**
- Media feature consumes station refs from `getStation()` and the station country code as optional `countryCode`/legacy-compatible input.
- `identify()` automatically invokes exactly one YouTube search after a non-null track.
- `selectVideo(videoId)` remains the only operation that creates the YouTube iframe.

- [ ] **Step 1: Extend media tests before implementation.** Assert first identify opens the panel, identifies, automatically searches once with `A B official music video`, passes optional region code, does not search on null metadata, stale station results are ignored after station change, and the iframe is absent until `selectVideo`.

- [ ] **Step 2: Run the focused test and verify failure.**

  Run: `node scripts/test-radio-now-playing.mjs`

  Expected: FAIL because the existing feature requires `searchVideos()` as a second action and toggles open panels closed on the second identify click.

- [ ] **Step 3: Implement the flow.** Separate open/close behavior from identify semantics, use `stationRef` as the request key, chain `findForStation` to `youtubeClient.search`, guard both responses by request ID and station ref, and render metadata/results without embedding.

- [ ] **Step 4: Update UI semantics.** Change the secondary button to “Retry video search”/“Search again”, add a clear close button, wire `dom.mjs`, and keep the panel/status accessible.

- [ ] **Step 5: Run focused and full tests.**

  Run: `node scripts/test-radio-now-playing.mjs && npm test`

  Expected: automatic search, no-metadata, stale-request, and lazy-embed assertions pass along with the full suite.

- [ ] **Step 6: Commit the task.**

  Run: `git add src/radio/radio-media-feature.mjs src/app/dom.mjs index.html styles.css scripts/test-radio-now-playing.mjs && git commit -m "feat: search YouTube after radio identification"`

### Task 6: Static build registration and recursive validation

**Files:**
- Modify: `scripts/build-static.js`
- Modify: `scripts/test-build-output.js`
- Modify: `scripts/test-architecture.mjs` if new module inventory assertions need updating.

**Interfaces:**
- Build copies `src/radio/radio-station.mjs`, `src/radio/radio-station-repository.mjs`, and generated `src/radio/radio-catalog-index.mjs` into `dist/`.
- `validateModuleImports()` scans every `.mjs`/`.js` under `dist/src/` and resolves relative static imports plus literal dynamic imports after removing query strings.

- [ ] **Step 1: Add failing build validation tests.** Create a temporary fixture or testable validation entry point proving a missing nested import fails with importer/import/expected target, while existing build output and query-versioned imports pass.

- [ ] **Step 2: Run the focused build test and verify failure.**

  Run: `node scripts/test-build-output.js`

  Expected: FAIL because validation currently scans only four fixed files and the new station modules are not all registered.

- [ ] **Step 3: Register all radio assets and replace the fixed module list with recursive traversal.** Keep existing static asset behavior unchanged, include generated index, support `.mjs` and `.js`, and resolve only relative module imports.

- [ ] **Step 4: Build and validate the static output.**

  Run: `node scripts/build-static.js && npm run build:validate`

  Expected: build succeeds, `dist/src/radio/` contains every required radio module, and recursive import validation passes.

- [ ] **Step 5: Run the full suite.**

  Run: `npm test`

  Expected: all tests pass with the new build-validation coverage.

- [ ] **Step 6: Commit the task.**

  Run: `git add scripts/build-static.js scripts/test-build-output.js scripts/test-architecture.mjs && git commit -m "build: validate every static module dependency"`

### Task 7: Full acceptance verification and review

**Files:**
- Modify only files required by failing acceptance checks.
- Test: existing suite and generated `dist/` output.

- [ ] **Step 1: Run the required validation commands and capture output.**

  Run: `npm test`

  Run: `node scripts/build-static.js`

  Run: `npm run build:validate`

  Run: `SEO_SITE_URL=https://youcity.app node scripts/seo-check.js`

  Run: `node scripts/validate-drone-catalog.js`

  Expected: every command exits zero.

- [ ] **Step 2: Inspect generated output and catalog invariants.** Verify `find dist/src/radio -maxdepth 1 -type f -print`, the generated radio index, and the unchanged curated city/station counts from `data/catalog.json`.

- [ ] **Step 3: Run `git diff --check` and inspect the final diff for unrelated changes.**

- [ ] **Step 4: Commit only any required verification fixes.** Use a focused test-first fix and a descriptive commit if a required check exposes a defect.

- [ ] **Step 5: Perform the final review against the spec and report test evidence, limitations, rulings, and any deferred minor findings.**
