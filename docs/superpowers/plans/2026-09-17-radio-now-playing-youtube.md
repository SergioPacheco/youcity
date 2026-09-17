# Radio Now Playing YouTube Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an explicit radio-panel flow that identifies the current track when stream metadata exists and lets the user choose a lazy-loaded YouTube video match.

**Architecture:** Keep audio lifecycle in `radio-controller`. Add small clients for same-origin now-playing and YouTube-search Functions, with session cache and concurrent-request deduplication. A focused feature controller owns abortable UI requests, current-track state, result selection, and creation/removal of the YouTube iframe.

**Tech Stack:** ES Modules, browser `fetch`, Cloudflare Pages Functions, YouTube Data API v3, ICY stream metadata, existing static build and Node test scripts.

**Spec:** `docs/superpowers/specs/2026-09-17-radio-now-playing-youtube-design.md`

## Global Constraints

- Do not add initial-load requests for now-playing or YouTube search.
- Keep `YOUTUBE_API_KEY` server-side in `functions/api/youtube-search.js`.
- Use same-origin `/api/...` paths and preserve base-path support.
- Never autoplay a YouTube video; create the iframe only after a result is selected.
- Preserve existing radio playback, Radio Browser discovery, analytics, and error fallbacks.
- Do not add audio fingerprinting, a bundler, or a new third-party runtime dependency.

### Task 1: Add pure now-playing and YouTube client contracts

**Files:**
- Create: `src/radio/radio-now-playing.mjs`
- Create: `src/radio/radio-youtube.mjs`
- Test: `scripts/test-radio-now-playing.mjs`
- Modify: `scripts/test-architecture.mjs`
- Modify: `scripts/build-static.js`
- Modify: `package.json`

**Interfaces:**
- `normalizeNowPlaying(payload)` returns `{ artist, title, display, source }` or `null`.
- `createNowPlayingClient({ basePath, fetchImpl, cacheTtl })` returns
  `{ findForStation(station, options) }`.
- `normalizeYouTubeResults(payload, { limit })` returns an array of
  `{ videoId, title, channel, thumbnail, videoUrl }`.
- `createYouTubeSearchClient({ basePath, fetchImpl, cacheTtl })` returns
  `{ search(query, options) }`.

- [ ] Write failing tests for ICY-style payload normalization, empty metadata,
  YouTube result filtering, base paths, and concurrent request deduplication.
- [ ] Run `node scripts/test-radio-now-playing.mjs` and verify it fails because
  the new modules are absent.
- [ ] Implement the two small modules with URL encoding, `AbortSignal`
  forwarding, ten-minute cache, and one pending Promise per request key.
- [ ] Run the focused test and then `node scripts/test-architecture.mjs`.

### Task 2: Add server-side metadata and YouTube Functions

**Files:**
- Create: `functions/api/radio-now-playing.js`
- Create: `functions/api/youtube-search.js`
- Test: `scripts/test-radio-now-playing.mjs`

**Interfaces:**
- `GET /api/radio-now-playing?stationuuid=...&url=...` returns
  `{ station, nowPlaying }` or `{ nowPlaying: null, reason }`.
- `GET /api/youtube-search?q=...` returns `{ results: [...] }`.

- [ ] Extend tests with invalid input, no metadata, successful parsing, and
  YouTube API response/error mapping fixtures.
- [ ] Run the focused tests and verify the new endpoint behaviors fail first.
- [ ] Implement station validation, Radio Browser resolution, bounded ICY
  parsing, timeout/byte limits, per-client rate limits, and ten-minute cache.
- [ ] Implement YouTube query validation, server-side key lookup, required
  search filters, three-result normalization, cache, rate limiting, and safe
  error responses.
- [ ] Run focused tests and `git diff --check`.

### Task 3: Connect the radio panel UI and player state

**Files:**
- Create: `src/radio/radio-media-feature.mjs`
- Modify: `src/radio/radio-controller.mjs`
- Modify: `src/app/dom.mjs`
- Modify: `src/app/bootstrap.mjs`
- Modify: `index.html`
- Modify: `styles.css`
- Test: `scripts/test-radio-now-playing.mjs`

**Interfaces:**
- `createRadioMediaFeature({ document, elements, getStation, nowPlayingClient, youtubeClient })`
  returns `{ reset, destroy }`.
- Radio controller exposes `getCurrentStation()` without moving audio state to
  persistent application state.

- [ ] Add failing tests for identify/search click-only behavior, stale response
  suppression, result selection, and iframe creation only after selection.
- [ ] Run the focused tests and verify the new UI contract fails.
- [ ] Add compact panel controls: “♫ Identify music”, current-track output,
  “Find video clip”, result cards, and a lazy video host.
- [ ] Wire the feature to the selected station and reset it when cities or
  stations change; keep listeners single-installed and abort stale requests.
- [ ] Add `getCurrentStation()` to the radio controller and preserve all current
  radio retry/timer ownership.
- [ ] Run focused tests and build the static artifact.

### Task 4: Documentation and full verification

**Files:**
- Modify: `docs/radio-browser-integration.md`
- Modify: `docs/future-integrations.md`
- Modify: `README.md`

- [ ] Document best-effort metadata, user-triggered YouTube search, API key
  configuration, and the no-result fallback.
- [ ] Run `npm test`.
- [ ] Run `node scripts/build-static.js`.
- [ ] Run `SEO_SITE_URL=https://youcity.app node scripts/seo-check.js`.
- [ ] Run `git diff --check` and verify the working tree contains only the
  feature changes.
