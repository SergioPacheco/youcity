# YouCity Destination Hub Design

**Date:** 2026-09-19
**Branch:** `feat/destination-hub`

## Goal

Refactor the City Guide into a destination hub that moves users through discovery, interest, activities, trip planning, and honest affiliate actions without making the drawer feel like an advertising wall.

## Current problems

The City Guide currently renders a long About section before attractions and leaves the commercial planner below the editorial content. On desktop the travel drawer consumes the full viewport, hiding the immersive video. Attraction photos and titles have different destinations, and the small row treatment makes the guide feel administrative. The generic hotel category is also rendered alongside the richer Stay22 accommodation tools.

The existing affiliate engine already filters disabled and unconfigured providers. The refactor will reuse that engine and its tracking path instead of creating City Guide-specific provider URL logic.

## Approved architecture

### City Guide controller

`src/features/city-guide/city-guide-controller.mjs` remains responsible for:

- Wikipedia, Wikidata, and Wikimedia Commons requests;
- editorial cache and request freshness;
- trusted URL validation;
- destination intro, places, About, attribution, and editorial failure states;
- non-commercial place interaction analytics.

It receives an injected `renderCommerce` interface. It knows only the destination commerce slots and calls the interface for markup; it does not import or name Stay22, DiscoverCars, Booking, Viator, Travelpayouts, Airalo, Heymondo, or another provider.

The controller will return a `refresh()` method so the Travel layer can re-render cached editorial content after asynchronously loaded provider/catalog data becomes available.

### Travel controller and destination commerce

`src/features/travel/travel-controller.mjs` remains responsible for:

- affiliate context creation and offer resolution;
- shared affiliate metadata markup;
- existing planner, prompt, map-popup, Stay22, and provider-loading behavior;
- destination commerce composition and impression/click tracking.

New module `src/features/travel/destination-commerce.mjs` will own slot-specific presentation. It will receive the existing resolver and shared markup callbacks from the Travel controller. It will expose pure rendering functions for:

```text
topActions(city)
afterPlaces(city)
accommodation(city, { richAccommodationAvailable })
transport(city)
secondary(city)
```

The Travel controller will render those results into the destination hub and observe impressions. Existing generic planner/map placements remain unchanged outside the City Guide.

### Commerce placement contract

City Guide offers use these placement values:

```text
city_guide_top
city_guide_after_places
city_guide_stay
city_guide_transport
city_guide_bottom
```

All offer links retain the existing `data-affiliate-offer`, provider, vertical, city, campaign, mode, and placement attributes. External affiliate links retain `target="_blank"` and `rel="sponsored noopener noreferrer"`. Internal City Guide navigation and Wikipedia/Wikimedia links remain non-sponsored.

Only offers returned by the existing resolver are rendered. Because the resolver already checks provider configuration, provider enablement, supported verticals, valid HTTPS URLs, and DiscoverCars catalog availability, unconfigured providers and unavailable locations naturally disappear from the UI.

### Accommodation policy

The rich Stay22 section is the primary accommodation experience when `YouCityStay22.isEnabled("hotels")` is true. The generic hotel offer is suppressed in the accommodation slot in that case. If Stay22 is unavailable, the slot may render the first valid generic hotel offer. The existing date validation, popup fallback, search result link, browse link, vacation-rental link, map, and tracking remain active, but their City Guide links use `city_guide_stay`.

### Loading and failure behavior

Opening the drawer immediately renders the destination header, quick actions currently resolvable, and a lightweight editorial loading state. DiscoverCars catalog loading and optional providers are not awaited before the drawer appears. When those resources finish, the Travel layer refreshes the destination commerce slots and cached City Guide editorial render.

Editorial data is independent from commerce:

- Wikipedia failure with places still renders places and commerce.
- Places failure with Wikipedia still renders About and commerce.
- Both editorial sources failing renders the destination header, available commerce, and a small editorial error.
- A stale request cannot replace content for a newly selected city, including cache-hit paths.

The client keeps the existing 24-hour City Guide cache. The API’s existing partial-result and cache behavior remains unchanged.

## Destination hub hierarchy

The drawer will render this order:

```text
Destination header
Plan your visit / quick actions
Worth exploring / attraction cards
Contextual activities CTA
About the city / subdued Wikipedia source
Where to stay / Stay22 or valid hotel fallback
Get around / DiscoverCars when available
More for your trip / valid secondary providers only
Affiliate disclosure
```

The header uses a kicker such as `GRANADA · SPAIN`, a city title, and a concise tagline selected from `wikipedia.description`, `city.note`, or a short fallback. The visible About extract uses sentence-aware truncation around 300–450 characters and never cuts a word when a sentence or word boundary is available.

## Attraction card semantics

Each place becomes a larger responsive card. The image and title are inside one primary Wikipedia anchor with the same predictable destination. The primary card is not a Commons link. A separate subdued Commons `Photo source` link remains when a trusted source URL exists. Images remain lazy-loaded.

The card records `city_guide_place_click` with city, place, source `wikipedia`, and position. This event is separate from affiliate tracking.

## Static markup and responsive behavior

`index.html` will keep the existing Stay22 form and map controls but place them in dedicated destination sections/slots. `src/app/dom.mjs` will expose those slots. `src/app/bootstrap.mjs` will continue owning Stay22 form/map event handlers and will use the City Guide placement for generated links.

The City Guide drawer is scoped with `.travel-drawer`:

- desktop: a right-side panel around `min(620px, 48vw)`, capped near 620px;
- mobile: full width;
- existing safe-area padding, focusable close control, `aria-labelledby`, `aria-live`, and touch target rules remain intact.

The City Browser drawer is not changed.

## Verification requirements

Add focused tests for:

- configured-only quick actions;
- unavailable flights omitted from a Stay/Activities/Cars result;
- City Guide placement metadata;
- Stay22 duplicate hotel suppression;
- contextual activities and transport placements;
- non-sponsored Wikipedia and Commons semantics;
- image/title primary-link consistency;
- editorial failure with commerce still visible;
- stale city request protection;
- destination render output and trusted URL filtering.

Run the existing full suite plus:

```bash
npm test
node scripts/build-static.js
npm run build:validate
SEO_SITE_URL=https://youcity.app node scripts/seo-check.js
node scripts/validate-drone-catalog.js
```

The new client module must be listed in `scripts/build-static.js` so it is copied to `dist/` and included in recursive import validation.
