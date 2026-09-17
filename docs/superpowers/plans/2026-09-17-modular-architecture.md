# YouCity Modular Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the global-script `app.js` runtime with a native ES Module application while preserving current routes, catalog behavior, analytics, storage, media behavior, and static deployment.

**Architecture:** Native browser ES Modules will provide explicit dependency boundaries. A small bootstrap will create an application context containing catalog, DOM, state, and services; domain controllers will own their timers, media handles, maps, and abort controllers. Secondary domains will be imported on demand through a shared deduplicating loader. No framework or bundler will be introduced.

**Tech Stack:** Browser ES Modules, existing Node.js scripts, Cloudflare Pages Functions, native `import()`, existing vendor script loaders, Node `assert` tests.

**Spec:** `docs/specs-refatoração.md`

## Global Constraints

- Preserve the existing `Math.max(15, configuredStart válido ? configuredStart : 0)` playback policy and test it as intentional behavior.
- Do not change public URLs, slugs, query parameters, storage keys, analytics event names, catalog records, or affiliate contracts.
- Keep weather available in the initial interface with non-blocking loading.
- Keep `?role=admin` as an interface-only flag; do not implement authentication in this scope.
- Do not add React, Vue, Angular, Svelte, a bundler, or third-party runtime dependencies.
- Do not change visual design or product rules while extracting code.
- Do not push, merge, deploy, or publish.

### Task 1: Marco 1 baseline and contract tests

**Files:**
- Create: `docs/refactoring/baseline.md`
- Create: `scripts/test-core-contracts.js`
- Create: `scripts/test-async-guards.js`
- Modify: `package.json`
- Modify: `docs/specs-refatoração.md`

**Interfaces:**
- `scripts/test-core-contracts.js` will exercise pure modules through Node's native CommonJS/ESM-compatible entry points.
- `scripts/test-async-guards.js` will verify that a stale request token cannot commit after a newer token.

- [ ] Record the branch SHA, worktree state, commands, passing results, build output, SEO output, raw asset sizes, initial JavaScript bytes, request count, and known unmeasured browser metrics.
- [ ] Add failing tests for effective video start policy, route parsing/building, city/mode/video selection, and stale async results.
- [ ] Run each new test and confirm the failure is caused by the missing extracted contract, not by test setup.
- [ ] Implement only the minimal pure helpers required by the tests.
- [ ] Run the new tests, `npm test`, the static build, and `seo-check`.
- [ ] Add the new tests to the normal test command and record the green result in the baseline.

### Task 2: Marco 2 core modules

**Files:**
- Create: `src/core/video-policy.js`
- Create: `src/core/url.js`
- Create: `src/core/storage.js`
- Create: `src/state/store.js`
- Create: `src/catalog/catalog-repository.js`
- Create: `src/player/youtube-player.js`
- Create: `src/radio/radio-controller.js`
- Create: `src/app/app-context.js`
- Create: `src/app/bootstrap.js`
- Create: `src/main.js`
- Modify: `index.html`
- Remove: `app.js`

**Interfaces:**
- `getEffectiveStartSeconds(ride, minimum = 15): number` preserves the current policy.
- `parseRoute(location, basePath): { citySlug, mode, videoIndex, isDeepLink }` and `buildCityUrl(city, mode, videoIndex, basePath): string` preserve route contracts.
- `createStorage(storage): { readJson, writeJson, remove }` safely isolates browser storage failures.
- `createAppStore(initialState, persistence): { getState, update, subscribe, restore }` stores only serializable application data; controllers retain runtime resources privately.
- `createCatalogRepository(rawCatalog, dependencies): { list, getByIndex, findBySlug, availableModes, currentRide }` owns normalization and catalog selection.
- `createYouTubePlayer({ document, window, getState, getStartSeconds }): { load, command, destroy }` owns the YouTube API handle and timers.
- `createRadioController({ audio, getCity, onStateChange }): { setStation, toggle, retry, destroy }` owns radio retry/load timers.
- `createAppContext(dependencies)` returns the explicit objects passed to domain controllers.

- [ ] Move pure route, storage, catalog, and playback-policy behavior behind the interfaces above and make the contract tests import those modules.
- [ ] Extract YouTube API lifecycle and radio lifecycle without placing players, timers, or abort controllers into the store.
- [ ] Wire the existing navigation, video, and radio controls through the context and controllers.
- [ ] Change the document entry point to `src/main.js` and remove the classic `app.js` entry.
- [ ] Run core contract tests and the existing suite after each controller extraction.

### Task 3: Marco 3 on-demand domains

**Files:**
- Create: `src/core/lazy-module.js`
- Create: `src/map/map-controller.js`
- Create: `src/city-guide/city-guide-controller.js`
- Create: `src/travel/travel-controller.js`
- Create: `src/admin/comment-assistant-loader.js`
- Create: `src/sharing/sharing-controller.js`
- Create: `src/weather/weather-controller.js`
- Modify: `src/app/bootstrap.js`
- Modify: `scripts/build-static.js`
- Modify: `scripts/seo-check.js`

**Interfaces:**
- `loadOnce(key, importer): Promise<unknown>` deduplicates concurrent imports and resets the cache after failure so retry remains possible.
- `createWeatherController({ fetch, signalFactory, render, cache })` starts non-blocking weather work on city changes and rejects stale commits.
- `createCommentAssistantLoader({ load, isEnabled, open })` imports the assistant only after interface authorization and explicit opening.
- Map, City Guide, travel, and sharing controllers expose `open`, `close`, and `destroy` without publishing globals.

- [ ] Add a failing test proving concurrent `loadOnce` calls invoke an importer once and failed imports can be retried.
- [ ] Move map, City Guide, secondary travel code, and Comment Assistant behind lazy module boundaries.
- [ ] Preserve the vendor Leaflet loader when it remains simpler than importing the UMD build.
- [ ] Keep visible travel CTAs usable immediately and defer only the resolver/provider implementation that is not needed for the initial render.
- [ ] Keep weather initialization attached to city selection, but execute it asynchronously without blocking bootstrap.
- [ ] Ensure every lazy boundary has loading, error, retry, base-path, and generated-artifact behavior.
- [ ] Add tests for one-time imports, failure retry, and stale weather/guide responses.

### Task 4: Marco 4 legacy removal and validation

**Files:**
- Modify: `src/app/bootstrap.js`
- Modify: `src/main.js`
- Modify: `index.html`
- Modify: `scripts/build-static.js`
- Modify: `scripts/seo-check.js`
- Modify: `docs/SEO.md`
- Create: `docs/refactoring/architecture.md`
- Create: `docs/refactoring/rollback.md`
- Create: `docs/refactoring/final-report.md`

- [ ] Remove temporary adapters, dead functions, obsolete global reads, duplicate listeners, and old classic-script imports.
- [ ] Make static build substitutions fail explicitly when their required target is absent.
- [ ] Run `npm test`, normal build/SEO validation, and GitHub Pages base-path build/SEO validation.
- [ ] Run the available desktop, mobile, and landscape smoke checks without adding a full visual-regression suite.
- [ ] Compare application code bytes, catalog bytes, compressed transfer sizes, request counts, and available parse/execute measurements against the baseline.
- [ ] Document the final dependency graph, intentional limitations, deferred security/SEO/product work, and rollback procedure.
- [ ] Review the complete diff, confirm the user specification remains intact, and leave deployment actions untouched.

## Execution checkpoints

After Tasks 1, 2, 3, and 4, the complete existing test suite and the relevant build/SEO checks must pass. A checkpoint may document a known deferred defect, but no checkpoint may knowingly change a public contract or leave two permanent implementations of the same domain.
