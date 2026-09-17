# YouCity refactoring baseline

Date: 2026-09-17  
Branch: `refactor/modular-architecture`  
Initial commit SHA: `f3711ceaff37bf0782f3b044cc70a5a427da259c`

## Worktree

The worktree started from `main` with the user's staged and unstaged change to
`docs/specs-refatoração.md`. That change was preserved. No unrelated tracked
changes were present.

## Environment

```text
Node.js v20.18.1
npm 11.7.0
Cloudflare Pages Functions: not executed by the local static commands
Lighthouse: unavailable
brotli: unavailable
```

## Commands and results

| Command | Result | Measured time |
| --- | --- | ---: |
| `npm test` | PASS: catalog, affiliates, DiscoverCars, city catalog, Comment Assistant | 0.815 s |
| `node scripts/build-static.js` | PASS: 207 SEO pages, 206 city pages, 207 sitemap URLs | 0.281 s |
| `node scripts/seo-check.js` | PASS: 207 indexable pages, 206 city pages | 0.102 s |
| `SEO_SITE_URL=https://sergiopacheco.github.io SEO_BASE_PATH=/youcity node scripts/build-static.js` | PASS | 0.4 s |
| `SEO_SITE_URL=https://sergiopacheco.github.io SEO_BASE_PATH=/youcity node scripts/seo-check.js` | PASS | included above |

The first two commands were also rerun after the baseline collection. They
remained green. The current test command does not include browser DOM tests,
endpoint contract tests, or an E2E suite.

## Asset baseline

Sizes are source bytes and gzip bytes produced with the system `gzip` command.
The browser entry currently declares 20 script sources and 2 stylesheet links
(one external font stylesheet and the local stylesheet). The JavaScript total
below counts the local script sources declared by `index.html`, excluding inline
GTM and external scripts injected by the page.

| Asset | Raw bytes | Gzip bytes |
| --- | ---: | ---: |
| `app.js` | 143,992 | 35,338 |
| `catalog.js` | 162,887 | 42,743 |
| `comment-assistant.js` | 18,757 | 5,299 |
| `analytics.js` | 1,099 | 469 |
| `map-config.js` | 427 | 301 |
| `styles.css` | 77,507 | 15,715 |

All local initial JavaScript sources total 360,075 raw bytes. Of that,
`app.js` plus the other application scripts excluding `catalog.js` total
197,188 raw bytes, and the catalog accounts for 162,887 raw bytes.

## Request and runtime baseline

- 20 local JavaScript source tags are present in `index.html`.
- 2 stylesheet links are present; one is local and one is Google Fonts.
- GTM and Stay22 add external script work from inline/page markup.
- YouTube, radio, weather, City Guide, Wikimedia, and Leaflet requests happen
  at runtime and were not measured by a browser run in this baseline.
- Parse/execute cost, transfer sizes over HTTP, console warnings, Lighthouse,
  and coverage were not measured because the available environment had no
  browser performance harness or Lighthouse executable.

## Known observations

- The 15-second video minimum is intentional product behavior and is preserved
  as a characterization target.
- `app.js` currently owns catalog normalization, URL handling, state,
  navigation, player, radio, weather, City Guide, map, travel, sharing,
  accessibility layers, and event binding.
- Affiliate provider scripts and `comment-assistant.js` are loaded by the
  initial HTML even though their UI flows are secondary.
- The static builder still contains a silent replacement for the removed
  `travel-button-full` element; this is documented as an extraction-adjacent
  defect and must be handled only if needed by the migration.
- `?role=admin` controls Comment Assistant visibility only. Authentication and
  endpoint security are separate work.
