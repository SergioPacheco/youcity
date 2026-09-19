# YouCity performance pass design

## Goal

Improve the mobile loading experience without changing YouCity's core promise:
the current city ride still starts muted and autoplayed, the city browser still
shows the full catalog when opened, and travel integrations remain available
when their features are used.

The PageSpeed run supplied on 2026-09-19 reports mobile performance 55, FCP
3.4 s, LCP 7.5 s, Speed Index 8.9 s, TBT 300 ms, 2.2 s of main-thread work,
and 3.7 MiB of transferred resources. Desktop performance is 85 with 0.8 s
FCP/LCP. The largest initial payloads are YouTube's player, Google tags,
Stay22, fonts, and YouTube thumbnails.

## Scope

1. Delay the YouTube player initialization on mobile until the poster has had
   a chance to paint, targeting roughly 1 second after startup. A user gesture
   that requires playback may start it immediately. Existing video switching,
   autoplay fallback, error handling, and desktop startup remain unchanged.
2. Render the city catalog grid when the city drawer opens instead of building
   all catalog cards during boot. Search and city changes while the drawer is
   open continue to refresh the grid.
3. Use `hqdefault.jpg` as the initial YouTube poster URL so unavailable
   `maxresdefault.jpg` requests do not generate console 404s.
4. Remove Stay22's eager head injection and load it only when travel features
   need it. Existing fallback commerce remains available if the provider is
   unavailable.
5. Change first-party, versioned static assets to long-lived immutable cache
   headers. API and HTML caching behavior remains unchanged.
6. Fix the PageSpeed accessibility findings that are local to YouCity: the
   source link's accessible name and the city rail dot hit areas.

## Interfaces and behavior

- `createVideoController.startPlayback()` remains the public playback entry.
  The delay is internal to startup scheduling and is canceled by an explicit
  user gesture or teardown.
- `cityBrowser.renderGrid()` remains the renderer. `onBeforeDrawerOpen` owns
  the first render; `selectCity` refreshes only when the drawer is visible.
- Stay22 loading is idempotent and returns a promise. Travel code must tolerate
  the provider not being present during normal city selection, then refresh the
  travel surface after the provider loads.
- The existing asset build keeps query-string versioning, so immutable caching
  is safe for the generated static files.

## Regression safeguards

Add focused tests for:

- delayed startup and immediate user-gesture playback;
- city grid rendering only on drawer open and refresh while open;
- absence of `maxresdefault.jpg` poster construction;
- deferred Stay22 loading and fallback behavior;
- cache header declarations and accessible control sizing/name.

Then run the full `npm test`, static build, build-output validation, and
`git diff --check`. No change is complete if the existing video, mobile-menu,
affiliate, city-browser, architecture, or build tests regress.

## Non-goals

- Do not remove autoplay, the YouTube player, travel monetization, city search,
  or the existing catalog data.
- Do not minify or rewrite the entire JavaScript/CSS architecture in this pass.
- Do not change API contracts or production secrets.
