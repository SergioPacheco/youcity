# YouCity City SEO Content Design

**Date:** 2026-09-19  
**Status:** Approved conversational design; awaiting written-spec review

## Goal

Give every catalog city a deterministic, locally cached source of verified city-specific editorial data, and render that data into static HTML before JavaScript executes while preserving the existing Sprint 1 fallback and application behavior.

## Scope and constraints

- `data/catalog.json` remains the source of truth for the 228 catalog cities and is never modified by synchronization.
- Wikipedia summary/search APIs and Wikidata/Wikipedia geosearch are the only editorial sources, reusing the existing City Guide retrieval and filtering principles.
- Normal static builds read only local files and make no external HTTP requests.
- No LLM-generated facts, blog pages, country/region pages, VideoObject markup, affiliate changes, UI redesign, or runtime City Guide changes.
- The existing canonical slug behavior is used for cache keys and city-page matching.
- Incomplete editorial entries never block a build and use the existing Sprint 1 destination content.
- Wikipedia-derived text has visible `Source: Wikipedia` attribution linked to a trusted Wikipedia article.

## Architecture

### Local editorial cache

`data/city-seo-content.json` maps the canonical city slug to either a complete entry or an explicit incomplete entry. Complete entries contain the catalog city identity, Wikipedia summary (`title`, `description`, `extract`, `url`), two to five filtered nearby places (`name`, `description`, optional trusted `url`), a Wikipedia source object, and a stable `updatedAt`. Incomplete entries contain `status: "incomplete"` and a reason such as `NO_VALID_SUMMARY`, `NOT_ENOUGH_PLACES`, `AMBIGUOUS_CITY`, or `REQUEST_FAILED`.

The synchronization script loads the previous cache first. A newly validated entry replaces the old entry and changes `updatedAt` only when the editorial payload changes. Temporary failures preserve an existing valid entry; a city without valid previous data receives an explicit incomplete status.

### Synchronization

`scripts/sync-city-seo-content.mjs` reads the catalog, processes cities with a small worker pool of four, and uses a two-retry exponential backoff for HTTP 429/5xx and timeouts. For each city it searches Wikipedia using `<city>, <country>` and then `<city>`, fetches the selected summary, and retrieves nearby Wikidata entities with Wikipedia geosearch fallback. It does not request Wikimedia Commons images. It validates summary length, place count, place descriptions, duplicate names, city identity, and trusted source hosts before writing the cache atomically.

The command reports catalog size, complete/incomplete counts, coverage, and incomplete cities. It exits nonzero below 95% coverage unless `--allow-incomplete` is supplied.

### Static rendering

`scripts/build-static.js` loads the cache once at startup and passes the matching editorial entry into `renderDestinationContent(city, catalog, editorialContent)`. Complete entries render nested sections for About, Experiences, Places, Radio, and Related destinations. The About excerpt uses sentence-aware extraction with a target of 250–600 characters and a hard maximum of 700. Place output is limited to two to five entries, descriptions are capped at 180 characters, and all text/URLs are HTML escaped and validated against Wikipedia/Wikidata host allowlists. Incomplete entries retain the current Sprint 1 output.

The existing title, description, mode, related-city, radio, affiliate, runtime, and sitemap logic remains unchanged.

### Validation

`scripts/test-city-seo-content.mjs` validates that cache keys correspond exactly to catalog cities, every city has an entry, complete entries satisfy content limits, URLs are trusted, and place names are unique. It prints editorial coverage and exits nonzero on invalid data or below-target coverage unless explicitly allowed.

`scripts/seo-check.js` uses the same local cache to require `.destination-about` and `.destination-places` for complete cities, verify city-specific headings and visible Wikipedia attribution, count visible words within `.destination-content`, and compare normalized About+Places text across complete pages to reject identical destination content. All catalog cities must still have generated static pages.

## Data flow

```text
data/catalog.json
        |
        +--> sync-city-seo-content.mjs --> Wikipedia/Wikidata APIs
        |                                  |
        |                                  +--> data/city-seo-content.json
        |
        +--> build-static.js + local cache --> dist/city/<slug>.html
                                                |
                                                +--> seo-check.js
```

## Error handling

- Network timeout, 429, or 5xx: retry up to two times with short exponential delay.
- Temporary failure with a previous complete cache entry: keep the previous entry and timestamp.
- No valid summary: write or retain `NO_VALID_SUMMARY`/valid cache as appropriate.
- Fewer than two valid places: write or retain `NOT_ENOUGH_PLACES`/valid cache as appropriate.
- Ambiguous or malformed source data: reject the new result and record an explicit incomplete reason.
- Untrusted URL or invalid field lengths: reject the candidate rather than inject it.
- Build-time missing or incomplete editorial entry: render the existing safe Sprint 1 destination section.

## Testing and acceptance

The implementation will add focused tests before production changes for cache validation, trusted URLs, sentence-aware rendering, fallback behavior, and duplicate-content detection. The complete verification sequence is:

```text
npm run seo:content:test
npm test
SEO_SITE_URL=https://youcity.app node scripts/build-static.js
npm run build:validate
SEO_SITE_URL=https://youcity.app node scripts/seo-check.js
```

The final report will include catalog size, complete/incomplete counts, coverage, incomplete cities, static examples (Granada, London, São Paulo, Medellín, Nairobi, Perth), destination-content word statistics, and pass/fail status for each command.
