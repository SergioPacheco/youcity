# YouCity Radio Module Refactor Design

**Date:** 2026-09-19

## Goal

Refactor the radio subsystem so curated catalog stations and Radio Browser discovery stations share one normalized model, while preserving existing playback, city switching, retry behavior, ICY metadata, lazy YouTube embeds, and the static Cloudflare Pages deployment model.

## Non-goals and constraints

- `data/catalog.json` remains the source of truth for curated radio stations.
- Curated stations remain the primary/recommended stations; Radio Browser is supplemental discovery and enrichment.
- No database, persistent backend, Firebase, Supabase, Express, Java backend, framework, or unnecessary dependency.
- HLS playback remains available even when HLS metadata cannot be inspected.
- The current implementation does not perform audio fingerprinting; no paid recognition provider is added.
- Unrelated video, travel, weather, affiliate, comments, consent, GTM, SEO, and deployment behavior remains unchanged except where radio imports/build registration require edits.

## Architecture

The client will normalize every station into a `RadioStation` object with stable `stationRef`, source metadata, city metadata, stream URL, and a `curated` flag. `createRadioStationRepository({ getCity })` owns catalog normalization, per-city discovered-station memory, conservative deduplication, curated-first ordering, and lookup by reference.

The playback controller receives `getStations()` and owns only playback state. It tracks the current station by `currentStationRef`, deriving the current index from the current repository list. Merging discovery never calls `setRadio`, pauses audio, changes `audio.src`, or calls `audio.load()`.

Radio Browser discovery remains behind `/api/radio-stations`. The Worker performs country/country-code candidate retrieval, filters valid geographic coordinates, ranks by `distanceKm`, uses preferred/fallback distance thresholds up to 150 km, and may supplement with a city-name search. The browser client normalizes API payloads; the repository performs the final merge and deduplication against curated data.

## Station model and repository

`src/radio/radio-station.mjs` will export:

- `normalizeCatalogStation(city, radio, index)`
- `normalizeRadioBrowserStation(city, station)`
- `normalizeStreamUrl(value)`
- conservative station identity helpers used by the repository

Catalog refs use `catalog:<city-slug>:<index>`. Radio Browser refs use `radio-browser:<stationuuid>`. The existing slug contract from `src/core/url.mjs` is reused rather than creating a conflicting slugifier.

`src/radio/radio-station-repository.mjs` will expose:

- `getCatalogStations()`
- `getDiscoveredStations()`
- `getStations()`
- `mergeDiscoveredStations(stations)`
- `clearDiscoveredStations()`
- `findStationByRef(stationRef)`

Discovery is cached in memory per city for the session. Deduplication priority is station UUID, normalized stream URL, normalized homepage plus name, then a conservative name fallback. Curated stations win whenever identity is sufficiently strong.

## Playback migration

`radio-controller.mjs` will remove `additionalStations`, `setAdditionalStations`, `clearAdditionalStations`, and `getAdditionalStations`. `availableStations()` reads `getStations?.() || []`. `playStation(station)` selects by `stationRef`; the controller keeps `currentStationRef` synchronized when setting a station and preserves it when the collection is enriched.

The bootstrap composition root creates the repository before the controller, passes `getStations`, passes the repository to the browser feature, and clears/reset discovery through the repository/browser feature on city changes. Existing controller state callbacks continue to update `state.radioIndex` for the physical display and previous/next controls.

## Local stations UI

The 📻 panel becomes a local-stations view. It renders normalized curated stations immediately under “Recommended”, then starts discovery and renders additional normalized stations under “More nearby”. Empty or failed API responses preserve the recommended list and show an explicit status. Selecting either source calls `radioController.playStation(station)`.

## Server discovery

`functions/api/radio-stations.js` will stop relying on `name=city` as the only candidate filter. It will require city coordinates, search country/country-code candidates, retain usable HTTPS stations with valid `geo_lat`/`geo_long`, calculate distance using the shared `distanceKm` helper, rank by distance and votes/quality, and return no more than the existing small result limit. City-name results can be a supplemental candidate source. No undocumented radius semantics will be assumed.

## Now Playing and security

`scripts/build-catalog.js` will generate `src/radio/radio-catalog-index.mjs`, a lightweight catalog-only index containing station refs, names, and stream URLs. Cloudflare now-playing resolves only:

- `catalog:<city>:<index>` through the generated trusted index;
- `radio-browser:<uuid>` through Radio Browser's UUID endpoint.

Unknown or malformed references return `400 INVALID_STATION_REF` or `404 STATION_NOT_FOUND`. Arbitrary public `url=` fetching is removed. Catalog stations are inspected directly for ICY metadata without requiring Radio Browser indexing. HLS/non-ICY inspection returns an explicit reason such as `UNSUPPORTED_HLS_METADATA`; empty metadata returns `NO_METADATA`.

The browser client sends only `stationRef`. Existing ICY parsing and `normalizeNowPlaying` output remain unchanged.

## Automatic YouTube flow

The ♫ action means “Identify current song”. The first click opens the panel, fetches metadata, and, only when artist/title exists, automatically searches YouTube with `<artist> <title> official music video`. Missing country code leaves `regionCode` absent rather than failing the search. A second click refreshes identification; a dedicated close control closes the panel if needed.

Request cancellation uses `AbortController`, request IDs, and `stationRef` as the station key so stale identification or search results cannot update a different station. Search results render immediately, but the `youtube-nocookie.com` iframe is created only after a result is selected.

## Build and validation

New browser modules are added to `STATIC_ASSETS`. Build validation recursively scans every `.mjs` and `.js` file under `dist/src/`, resolves relative static and literal dynamic imports after stripping query strings, and fails with importer/import/expected-target details when a target is absent.

The radio test chain gains normalization/repository and automatic media-flow regression coverage. Full validation includes `npm test`, `node scripts/build-static.js`, `npm run build:validate`, the SEO check, and drone catalog validation.

## Acceptance evidence

The completed implementation must demonstrate that the curated catalog remains intact, all stations share the normalized shape, discovery is additive, playback is not reloaded by discovery, current station identity is ref-based, curated Now Playing works without Radio Browser indexing, arbitrary URL fetching is unavailable, missing metadata/HLS is explicit, YouTube search is automatic and cancellable, embeds remain lazy, all modules exist in `dist/`, recursive validation works, and the required test/build commands pass.
