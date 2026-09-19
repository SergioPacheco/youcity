# YouCity Destination Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the City Guide into a responsive Destination Hub with top-level valid travel actions, visual editorial cards, contextual commerce slots, resilient editorial loading, and no duplicated Stay22 accommodation CTA.

**Architecture:** Add a pure `destination-commerce.mjs` renderer under the Travel feature. The Travel controller supplies offer resolution, shared affiliate metadata, Stay22 behavior, provider loading, and slot refreshes; the City Guide controller receives only slot render callbacks and remains responsible for editorial retrieval/rendering. Static HTML supplies rich Stay22 and destination commerce containers, while CSS scopes the narrower desktop drawer to `.travel-drawer`.

**Tech Stack:** Native browser ES modules, Cloudflare Pages static assets, vanilla HTML/CSS, Node.js assertion scripts, existing affiliate resolver/tracking engine, existing `jsdom` test dependency.

**Spec:** `docs/superpowers/specs/2026-09-19-destination-hub-design.md`

## Global Constraints

- Only offers returned by the existing affiliate resolver may be rendered.
- City Guide offers must use `city_guide_top`, `city_guide_after_places`, `city_guide_stay`, `city_guide_transport`, or `city_guide_bottom`.
- City Guide must not import or name individual providers.
- Wikipedia/Wikimedia links remain non-sponsored; affiliate links retain `target="_blank"` and `rel="sponsored noopener noreferrer"`.
- Stay22 rich accommodation suppresses the generic hotel card in the accommodation slot.
- Editorial failures must leave the destination header and valid commerce usable.
- Existing 24-hour cache and stale-request protection must remain active, including cache-hit paths.
- The City Browser drawer, radio, video, consent, weather, comments, and SEO routing remain out of scope.
- New client modules must be copied into `dist/` and pass recursive import validation.

## Review Focus

- A city with Stay22/activities/cars but no flights must show exactly the valid actions and no empty Flights affordance. Test in Task 1.
- A valid rich Stay22 accommodation section must not be followed by a generic Hotels card. Test in Task 1 and Task 3.
- A slow or failed editorial request must not remove top actions or bottom commerce. Test in Task 2.
- A cached result for a previous city must not overwrite the newly selected city after a request race. Test in Task 2.
- A new commerce module must be present in `dist/` and all relative imports must resolve. Test in Task 5.

---

### Task 1: Add destination commerce slot renderer and focused commerce tests

**Files:**
- Create: `src/features/travel/destination-commerce.mjs`
- Create: `scripts/test-destination-commerce.mjs`
- Modify: `package.json` (add `destination:commerce:test` and include it in `npm test`)

**Interfaces:**
- Consumes: `categories`, `resolveOffers(city, placement)`, and `renderOffer(entry, city, options)` callbacks supplied by `travel-controller.mjs`.
- Produces: `createDestinationCommerce({ categories, resolveOffers, renderOffer, secondaryCategories })` returning `{ topActions, afterPlaces, accommodation, transport, secondary }`. Every method returns an HTML string or `""`.

- [ ] **Step 1: Write the failing commerce tests**

Create a test fixture with categories for hotels, activities, cars, flights, esim, and insurance; make `resolveOffers` return valid offers for hotels, activities, cars, and insurance, and no offer for flights/esim. The shared renderer should add the requested placement to a `data-travel-placement` attribute.

```js
const commerce = createDestinationCommerce({
  categories: fixtureCategories,
  resolveOffers: (city, placement) => fixtureOffers[placement] || {},
  renderOffer: (entry, city, options) => `<a class="${options.className}" data-travel-placement="${entry.placement}">${options.label}</a>`,
  secondaryCategories: ["flights", "esim", "insurance"]
});

assert.match(commerce.topActions(city), /Stay/);
assert.match(commerce.topActions(city), /Things to do/);
assert.match(commerce.topActions(city), /Cars/);
assert.doesNotMatch(commerce.topActions(city), /Flights/);
assert.match(commerce.afterPlaces(city), /city_guide_after_places/);
assert.match(commerce.transport(city), /city_guide_transport/);
assert.match(commerce.accommodation(city, { richAccommodationAvailable: true }), /^$/);
assert.match(commerce.accommodation(city, { richAccommodationAvailable: false }), /city_guide_stay/);
assert.match(commerce.secondary(city), /city_guide_bottom/);
```

- [ ] **Step 2: Run the commerce test and verify it fails**

Run:

```bash
node scripts/test-destination-commerce.mjs
```

Expected: FAIL because `src/features/travel/destination-commerce.mjs` does not exist.

- [ ] **Step 3: Implement the minimal slot renderer**

Implement the module with these rules:

```js
export function createDestinationCommerce({ categories, resolveOffers, renderOffer, secondaryCategories = [] }) {
  const quickCategories = ["hotels", "activities", "cars", "flights"];
  const quickLabels = { hotels: "Stay", activities: "Things to do", cars: "Cars", flights: "Flights" };

  function firstOffer(city, vertical, placement) {
    return resolveOffers(city, placement)[vertical]?.find((entry) => entry?.url) || null;
  }

  function topActions(city) {
    const links = quickCategories.map((vertical) => {
      const entry = firstOffer(city, vertical, "city_guide_top");
      return entry ? renderOffer(entry, city, { className: "city-guide-quick-action", label: quickLabels[vertical], icon: categories[vertical]?.icon }) : "";
    }).filter(Boolean).join("");
    return links ? `<nav class="city-guide-quick-actions" aria-label="Plan your visit">${links}</nav>` : "";
  }

  function afterPlaces(city) {
    const entry = firstOffer(city, "activities", "city_guide_after_places");
    return entry ? `<section class="city-guide-commerce-card city-guide-activities-cta" aria-label="Things to do"><span class="city-guide-commerce-icon" aria-hidden="true">🎟</span><div><strong>Things to do in ${escapeHtml(city.name)}</strong><p>Tours, attractions and local experiences.</p></div>${renderOffer(entry, city, { className: "city-guide-commerce-link", label: "Explore activities →" })}</section>` : "";
  }

  function accommodation(city, { richAccommodationAvailable = false } = {}) {
    if (richAccommodationAvailable) return "";
    const entry = firstOffer(city, "hotels", "city_guide_stay");
    return entry ? `<section class="city-guide-commerce-slot city-guide-generic-accommodation"><span class="drawer-kicker">Where to stay</span>${renderOffer(entry, city, { className: "city-guide-commerce-link", label: `Search stays in ${city.name}` })}</section>` : "";
  }

  function transport(city) {
    const entry = firstOffer(city, "cars", "city_guide_transport");
    return entry ? `<section class="city-guide-commerce-card city-guide-transport-cta" aria-label="Get around"><span class="city-guide-commerce-icon" aria-hidden="true">🚗</span><div><strong>Explore ${escapeHtml(city.name)} by car</strong><p>Compare rental cars for your trip.</p></div>${renderOffer(entry, city, { className: "city-guide-commerce-link", label: "Compare car rentals →" })}</section>` : "";
  }

  function secondary(city) {
    const cards = secondaryCategories.map((vertical) => {
      const entry = firstOffer(city, vertical, "city_guide_bottom");
      return entry ? renderOffer(entry, city, { className: "city-guide-secondary-link", label: categories[vertical]?.label || vertical, compact: true }) : "";
    }).filter(Boolean).join("");
    return cards ? `<section class="city-guide-commerce-slot city-guide-secondary-slot"><span class="drawer-kicker">More for your trip</span><div class="city-guide-secondary-actions">${cards}</div></section>` : "";
  }

  return { topActions, afterPlaces, accommodation, transport, secondary };
}
```

Use the repository’s existing `escapeHtml` helper pattern inside this module, keep labels destination-aware but honest, and ensure no empty section wrapper is returned when no valid offer exists. The exact rendering may be compacted while preserving these interfaces and behaviors.

- [ ] **Step 4: Run the focused commerce tests and verify they pass**

Run:

```bash
node scripts/test-destination-commerce.mjs
```

Expected: PASS with assertions for omitted flights, all five placement values, and Stay22 duplicate suppression behavior.

- [ ] **Step 5: Add the focused test to the full test command**

Add:

```json
"destination:commerce:test": "node scripts/test-destination-commerce.mjs"
```

and include it after `affiliate:test` in `npm test`.

- [ ] **Step 6: Run the task test command**

Run:

```bash
npm run destination:commerce:test
```

Expected: PASS.

- [ ] **Step 7: Commit the commerce renderer**

```bash
git add src/features/travel/destination-commerce.mjs scripts/test-destination-commerce.mjs package.json
git commit -m "feat: add destination commerce slots"
```

### Task 2: Refactor City Guide editorial rendering and resilience

**Files:**
- Modify: `src/features/city-guide/city-guide-controller.mjs`
- Create: `scripts/test-city-guide.mjs`

**Interfaces:**
- Consumes: `renderCommerce.topActions(city)` and `renderCommerce.afterPlaces(city)` callbacks, plus `cityGuideContent` and optional `window.YOUCITY_ANALYTICS`.
- Produces: `createCityGuideController(...).open()`, `.refresh()`, and `.invalidate()`; rendered markup containing destination header, top actions, attractions, contextual activities, About, and subdued source links.

- [ ] **Step 1: Write failing City Guide render tests**

Add a controller fixture that returns editorial data with Granada, Alhambra, a Wikipedia URL, a Commons image/source URL, and commerce callbacks returning identifiable markup. Assert:

```js
await guide.open();
assert.match(content.innerHTML, /Granada/);
assert.match(content.innerHTML, /Alhambra/);
assert.match(content.innerHTML, /Learn more/);
assert.match(content.innerHTML, /Source: Wikipedia/);
assert.match(content.innerHTML, /city-guide-quick-actions/);
assert.match(content.innerHTML, /city-guide-after-places/);
assert.match(content.innerHTML, /href="https:\/\/en\.wikipedia\.org\/wiki\/Alhambra"/);
assert.doesNotMatch(content.innerHTML, /class="city-guide-place-photo" href="https:\/\/commons\.wikimedia\.org/);
```

Add a sentence-aware truncation assertion using an extract longer than 620 characters and verify the About text ends on a sentence or word boundary below 450 visible characters.

- [ ] **Step 2: Run the City Guide tests and verify they fail**

Run:

```bash
node scripts/test-city-guide.mjs
```

Expected: FAIL because the current controller renders About first, has no commerce callbacks, and makes the photo a Commons primary link.

- [ ] **Step 3: Implement destination-first City Guide markup**

Refactor `renderCityGuide(data, city, status)` to render this order:

```text
destination header
quick actions
places
after-places commerce
about
```

Use `wikipedia.description`, then `city.note`, then `A short guide to this destination.` for the tagline. Add a helper that normalizes whitespace, prefers complete sentences under 420 characters, and otherwise cuts at the last word boundary under 420 characters with an ellipsis.

Render every place as an article with one primary Wikipedia link containing image, title, description, and `Learn more →`. Render a separate trusted Commons `Photo source` link outside the primary anchor. Keep `loading="lazy"`, `target="_blank"`, `rel="noopener noreferrer"` for editorial links, and escape all external values before interpolation.

Add `data-city-guide-place-click`, `data-city-guide-place`, and `data-city-guide-position` attributes to the primary link. Register one delegated click handler when the controller is created; it emits:

```js
window.YOUCITY_ANALYTICS?.track?.({
  event: "city_guide_place_click",
  city: city.name,
  country: city.country,
  place: target.dataset.cityGuidePlace,
  source: "wikipedia",
  position: Number(target.dataset.cityGuidePosition)
});
```

Do not emit affiliate events for place links.

- [ ] **Step 4: Add independent editorial loading/error and stale-request handling**

Render the destination header and `renderCommerce.topActions(city)` before the editorial fetch resolves. If the request fails, render the same header/actions plus an editorial error message and any available after-places commerce; do not replace the whole drawer with an error.

Increment `currentRequestId` before cache lookup so a city change invalidates an older request even when the new city is served from cache. Store the last rendered data/city key and implement `.refresh()` to re-render only when the cached/requested city matches `getCity()`.

Remove `ensureDiscoverCarsCatalog()` from the editorial controller. Provider loading belongs to Travel; the controller only consumes render callbacks.

- [ ] **Step 5: Run the City Guide tests and verify they pass**

Run:

```bash
node scripts/test-city-guide.mjs
```

Expected: PASS for render order, link semantics, truncation, independent failure, and stale-request protection.

- [ ] **Step 6: Run async regression coverage**

Run:

```bash
node scripts/test-async-guards.mjs
```

Expected: PASS, including the existing City Guide open assertion.

- [ ] **Step 7: Commit the editorial refactor**

```bash
git add src/features/city-guide/city-guide-controller.mjs scripts/test-city-guide.mjs
git commit -m "feat: make city guide destination first"
```

### Task 3: Integrate Travel controller, Stay22, DiscoverCars, tracking, and provider refresh

**Files:**
- Modify: `src/features/travel/travel-controller.mjs`
- Modify: `src/app/bootstrap.mjs`
- Modify: `src/app/dom.mjs`
- Modify: `scripts/test-destination-commerce.mjs`
- Modify: `scripts/test-async-guards.mjs` if needed for injected dependencies

**Interfaces:**
- Consumes: `createDestinationCommerce()` from Task 1 and City Guide `renderCommerce`/`refresh()` from Task 2.
- Produces: `travelController.openCityGuide()` with destination commerce callbacks, `renderDestinationCommerce(city)`, and existing `renderTravelPlanner`, `renderTravelPrompts`, `trackTravelClick`, `trackStay22Action`, and map APIs preserved.

- [ ] **Step 1: Add failing integration assertions**

Extend the commerce test or add a controller fixture that verifies the shared renderer produces:

```js
assert.match(topMarkup, /data-travel-placement="city_guide_top"/);
assert.match(activitiesMarkup, /data-travel-placement="city_guide_after_places"/);
assert.match(transportMarkup, /data-travel-placement="city_guide_transport"/);
assert.match(stay22Markup, /data-travel-placement="city_guide_stay"/);
assert.match(secondaryMarkup, /data-travel-placement="city_guide_bottom"/);
assert.match(affiliateLink, /rel="sponsored noopener noreferrer"/);
```

Verify a mocked rich Stay22 controller causes the accommodation fallback to be empty while its dedicated DOM slot is visible.

- [ ] **Step 2: Run the integration assertions and verify they fail**

Run:

```bash
node scripts/test-destination-commerce.mjs
```

Expected: FAIL because the current Travel controller uses `travel_planner` placements and does not expose City Guide slot rendering.

- [ ] **Step 3: Refactor shared offer markup without duplicating metadata**

Update `offerMarkup(entry, city, options)` to accept `className`, `label`, `icon`, and `compact` options while keeping one metadata builder. Make `quickActionMarkup()` call that shared builder. Preserve existing planner/map output and their current placements.

Create the destination commerce instance once inside `createTravelController()` using the existing `categories`, `resolveTravelOffers`, and shared renderer. Implement:

```js
function renderDestinationCommerce(city) {
  const richAccommodationAvailable = Boolean(window.YouCityStay22?.isEnabled?.("hotels") && elements.stay22Tools);
  if (elements.cityGuideStayFallback) elements.cityGuideStayFallback.innerHTML = commerce.accommodation(city, { richAccommodationAvailable });
  if (elements.cityGuideTransportSlot) elements.cityGuideTransportSlot.innerHTML = commerce.transport(city);
  if (elements.cityGuideSecondarySlot) elements.cityGuideSecondarySlot.innerHTML = commerce.secondary(city);
  renderStay22Tools(city);
  affiliate.observeImpressions(elements.travelPlanner);
}
```

Render the accommodation subtree after rich Stay22 tools are prepared so no generic hotel block appears immediately before it. The generic fallback is written only to `cityGuideStayFallback`; the existing Stay22 subtree remains intact. Use `city_guide_stay` for Stay22 browse, vacation rentals, search result, map URL, and Stay22 action events. Use `city_guide_transport` for car links and `city_guide_bottom` for secondary links.

- [ ] **Step 4: Wire City Guide callbacks and asynchronous provider refresh**

Pass into `createCityGuideController()`:

```js
renderCommerce: {
  topActions: (city) => commerce.topActions(city),
  afterPlaces: (city) => commerce.afterPlaces(city)
}
```

After the City Guide opens, call `renderDestinationCommerce(currentCity())` and start `ensureDiscoverCarsCatalog()` without awaiting it. When DiscoverCars loads, refresh the current destination commerce and call the City Guide controller’s `.refresh()` only if the drawer is still open and the current city matches. Do the same after optional providers load.

Preserve `travel_planner_open` and add `city_guide_open` with city, country, countryCode, and mode. Opening the drawer remains an internal navigation event and is not an affiliate click. Update the main CTA label/title to `Explore ${city.name}` and `City guide, stays and things to do in ${city.name}`.

- [ ] **Step 5: Update Stay22 event handlers and map/search placement**

In `bootstrap.mjs`, change generated Stay22 search metadata and `trackStay22Action()` placement to `city_guide_stay`; pass `{ placement: "city_guide_stay" }` to `createAccommodationSearchUrl()` and `createMapUrl()`. Change the visible map label to `View stays on map`. Keep popup fallback, valid date checks, focus behavior, and search result click tracking intact.

- [ ] **Step 6: Run focused integration and affiliate tests**

Run:

```bash
node scripts/test-destination-commerce.mjs
node scripts/test-affiliates.js
node scripts/test-async-guards.mjs
```

Expected: PASS; existing affiliate URL and configuration tests must remain green.

- [ ] **Step 7: Commit Travel integration**

```bash
git add src/features/travel/travel-controller.mjs src/app/bootstrap.mjs src/app/dom.mjs scripts/test-destination-commerce.mjs scripts/test-async-guards.mjs
git commit -m "feat: connect destination hub commerce"
```

### Task 4: Update static destination markup and responsive visual hierarchy

**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `src/app/dom.mjs` if a slot selector was not completed in Task 3
- Modify: `scripts/test-city-guide.mjs` for static assertions

**Interfaces:**
- Consumes: Travel controller slot IDs and City Guide classes from Tasks 1–3.
- Produces: A mobile full-width and desktop narrow City Guide drawer with destination-first hierarchy, accessible sections, and responsive attraction cards.

- [ ] **Step 1: Add failing static markup/style assertions**

Assert in the static regression test that `index.html` contains `city-guide-stay-slot`, `city-guide-transport-slot`, `city-guide-secondary-slot`, the existing Stay22 form/map controls, and `View stays on map`. Assert that `styles.css` contains scoped desktop and mobile `.travel-drawer .travel-panel` rules and larger place-card dimensions.

- [ ] **Step 2: Run static assertions and verify they fail**

Run:

```bash
node scripts/test-city-guide.mjs
```

Expected: FAIL because the current HTML has a generic planner divider/primary section and no destination commerce slots, and its CSS uses the generic full-width drawer behavior.

- [ ] **Step 3: Restructure the travel drawer markup**

Keep the existing drawer semantics and close button. Change the header to destination-oriented markup:

```html
<span class="travel-planner-kicker">City guide · plan your trip</span>
<span class="destination-kicker" id="travel-planner-location"></span>
<h2 id="travel-planner-title">Granada</h2>
```

Replace the generic `travel-section-divider` and `travel-primary` placement with dedicated sections after `city-guide-content`:

```html
<section class="city-guide-commerce-section" id="city-guide-stay-slot" aria-label="Where to stay"></section>
<section class="city-guide-commerce-section" id="city-guide-transport-slot" aria-label="Get around"></section>
<section class="city-guide-commerce-section" id="city-guide-secondary-slot" aria-label="More for your trip"></section>
```

Place the existing `stay22-tools` inside the accommodation section beside an empty `city-guide-stay-fallback` container, preserving all IDs used by `createDom()` and `bootstrap.mjs`. The Travel controller writes generic fallback HTML only into `city-guide-stay-fallback`; it never replaces the Stay22 form/map subtree. Keep the disclosure after all commerce slots and source it from `window.YOUCITY_AFFILIATE_CONFIG?.disclosure` through the existing Travel controller.

- [ ] **Step 4: Add destination hub CSS**

Keep the existing dark translucent/newsreader/manrope/DM Mono/lcd-green visual language. Add:

```css
.city-guide-destination { padding-bottom: 4px; }
.city-guide-destination h2 { margin: 7px 0 8px; color: #fff; font: 300 42px/.95 "Newsreader", serif; }
.city-guide-destination p { max-width: 34em; color: rgba(255,255,255,.74); font-size: 13px; line-height: 1.55; }
.city-guide-quick-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; }
.city-guide-place-card { padding: 10px; border: 1px solid rgba(255,255,255,.14); border-radius: 7px; background: rgba(255,255,255,.045); }
.city-guide-place-main { display: grid; grid-template-columns: 92px minmax(0, 1fr); gap: 13px; color: #fff; text-decoration: none; }
.city-guide-place-main img { width: 92px; height: 78px; object-fit: cover; border-radius: 5px; }
.city-guide-place-copy strong { font: 600 18px/1.1 "Newsreader", serif; }
.city-guide-place-copy p { margin-top: 5px; color: rgba(255,255,255,.68); font-size: 11px; line-height: 1.45; }
.city-guide-photo-credit, .city-guide-source { color: rgba(255,255,255,.5); font: 500 8px "DM Mono", monospace; text-decoration: none; }
```

Use responsive rules so mobile cards can switch to a stacked image ratio around 3:2, while desktop keeps 80–100px thumbnails. Add `.travel-drawer .travel-panel { width: min(620px, 48vw); max-width: 620px; }` at `min-width: 900px`, and full-width rules at `max-width: 899px`. Preserve safe-area padding, touch target minimums, `min-width: 0`, and wrapping for long city/place names.

- [ ] **Step 5: Run static assertions and check CSS syntax by building**

Run:

```bash
node scripts/test-city-guide.mjs
node scripts/build-static.js
```

Expected: PASS; `dist/index.html`, `dist/styles.css`, and the required static assets are regenerated.

- [ ] **Step 6: Commit the visual hierarchy**

```bash
git add index.html styles.css src/app/dom.mjs scripts/test-city-guide.mjs
git commit -m "feat: redesign destination hub drawer"
```

### Task 5: Build output, complete regression suite, and final verification

**Files:**
- Modify: `scripts/build-static.js` to include `src/features/travel/destination-commerce.mjs`
- Modify: `scripts/test-build-output.js` to require the new built module if the required-file list is extended
- Modify: `scripts/test-city-guide.mjs` or other focused tests only if verification reveals a regression

**Interfaces:**
- Consumes: all modules and tests from Tasks 1–4.
- Produces: deployable `dist/` with recursive import validation and a verified branch report.

- [ ] **Step 1: Write the failing build-output assertion**

Add `src/features/travel/destination-commerce.mjs` to the required output file list in `scripts/test-build-output.js` and run the validator before updating `scripts/build-static.js` if the build has not already copied it.

- [ ] **Step 2: Run the build-output test and verify the failure or existing gap**

Run:

```bash
node scripts/build-static.js
node scripts/test-build-output.js
```

Expected: the test fails if the module is absent from `dist/`; the failure must identify the missing file. If Task 4’s build already copied it, record that the assertion is already red-to-green covered by the prior task and continue.

- [ ] **Step 3: Add the module to static assets and validate imports**

Insert `src/features/travel/destination-commerce.mjs` next to the other travel assets in `STATIC_ASSETS`. Rebuild and run:

```bash
node scripts/build-static.js
npm run build:validate
```

Expected: PASS; every local JS/MJS import referenced by `dist/` exists and the destination commerce module is present.

- [ ] **Step 4: Run the full project suite**

Run:

```bash
npm test
```

Expected: PASS with zero failed commands, including the new City Guide and commerce tests.

- [ ] **Step 5: Run the required production checks**

Run:

```bash
node scripts/build-static.js
npm run build:validate
SEO_SITE_URL=https://youcity.app node scripts/seo-check.js
node scripts/validate-drone-catalog.js
```

Expected: all commands exit 0. Record the exact result in the final report.

- [ ] **Step 6: Inspect the final diff and status**

Run:

```bash
git diff --check
git status --short --branch
git diff --stat main...HEAD
```

Expected: no whitespace errors, only scoped Destination Hub files changed, and the branch is `feat/destination-hub`.

- [ ] **Step 7: Commit any final build/test harness change**

```bash
git add scripts/build-static.js scripts/test-build-output.js
git commit -m "build: include destination commerce module"
```

- [ ] **Step 8: Final verification before claiming completion**

Re-run the full commands from Steps 3–5 after the final commit and report evidence for each acceptance criterion that can be verified statically or through tests. Do not claim success from an earlier run.
