# YouCity Affiliate Engine

The travel monetization layer is a browser-side, static architecture. The
application asks for offers by vertical and does not know how any provider URL
is built.

## Architecture

```text
City
  -> Travel Planner / map placement
  -> Affiliate Engine
  -> Resolver
  -> Ranking strategy
  -> Provider contract
  -> tracked affiliate URL
```

The compatibility modules are loaded in `index.html` before `src/main.mjs`:

- `affiliate/affiliate-config.js` — feature flags, provider status, public IDs,
  priorities, vertical declarations, disclosure and ranking selection.
- `affiliate/affiliate-engine.js` — provider registry, normalized context and
  public engine API.
- `affiliate/affiliate-catalog.js` — catalog lookup and manual override lookup;
  it does not contain affiliate credentials.
- `affiliate/affiliate-resolver.js` — filters enabled/configured providers,
  checks vertical and city support, validates HTTPS URLs and ranks offers.
- `affiliate/affiliate-experiments.js` — default and weighted A/B strategy
  hooks. A/B is opt-in and disabled initially.
- `affiliate/affiliate-tracking.js` — internal impressions/clicks,
  fail-safe analytics and provider query-parameter decoration.
- `affiliate/providers/*.js` — one provider contract per partner.

`src/features/travel/travel-controller.mjs` adapts city data to the common context, renders vertical cards,
observes visible offers and delegates click tracking. The map uses the same
resolver with a different placement.

## Provider contract

Each provider registers an object with `id`, `name`, `verticals`, `supports`,
`createUrl` and `getOffer`:

```js
window.YouCityAffiliate.registerProvider({
  id: "new-provider",
  name: "New Provider",
  verticals: ["hotels"],
  supports(city, vertical, context) { return vertical === "hotels"; },
  createUrl(context) { return "https://approved.example/..."; },
  getOffer(context) { return { url: this.createUrl(context) }; }
});
```

The supplied non-DiscoverCars providers have a safe configuration-driven URL
builder. They return no offer until `configured: true` and an approved
`urlTemplate` are supplied. Templates can use `{city}`, `{cityId}`,
`{country}`, `{countryCode}` and `{vertical}`. No provider ID or URL is
invented by the application.

## Stay22

Stay22 is registered for the `hotels`, `vacation-rentals` and `activities`
verticals with public AID `youcity`. Hotels and vacation rentals use
`/allez/roam` (vacation rentals force the validated `vrbo` route), while
activities use `/allez/getyourguide`. The provider builds links dynamically
from city data; there is no Stay22 destination catalog.

The same provider module exposes the documented accommodation Searchbar URL
(`/allez/searchbar`) and Map URL (`/embed/gm`) for the Travel Planner. The
planner also exposes a separate vacation-rental link routed to VRBO. Search
dates are validated before URL generation, and the Map iframe is lazy and
on-demand. Campaigns use
`yc_{citySlug}_{countryCode}_{vertical}_{placement}` while addresses retain
real characters and are encoded by `URLSearchParams`.

Stay22 flags are available at `features.stay22` and as provider-local feature
overrides. `features.providers.stay22` and `providers.stay22.enabled` remain
supported. Roam remains 100% default; validated `provider` forcing and
`excludeproviders` are opt-in through `providers.stay22.roam` or the disabled
Stay22 experiment definitions in `affiliate-experiments.js`.

Cars and Flights are deliberately not registered as Stay22 offers because the
current official material does not document enough of the Generator/search
contract for this UI. DiscoverCars remains the current cars provider. Nova,
Spark, LinkSwap and Retail are not reimplemented; they depend on the official
domain-specific Stay22 Script and account rollout. See
[`stay22-integration.md`](stay22-integration.md) for the status matrix and
external setup.

## Verticals

The initial identifiers are `hotels`, `flights`, `cars`, `activities`, `esim`
and `insurance`. The resolver already accepts future identifiers such as
`transfers`, `trains`, `buses`, `cruises`, `restaurants`, `tickets` and
`events` without changing the UI or engine.

Current provider declarations:

| Vertical | Providers |
| --- | --- |
| hotels | Stay22, Expedia, Booking.com, Travelpayouts |
| vacation-rentals | Stay22 / VRBO |
| flights | Expedia, Travelpayouts |
| cars | DiscoverCars |
| activities | Stay22 / GetYourGuide, Expedia, Viator |
| esim | Airalo |
| insurance | Heymondo |

At the current rollout: DiscoverCars and Stay22 are `READY`; Expedia,
Booking.com, Viator, Travelpayouts, Airalo and Heymondo are
`AWAITING_AFFILIATE_ID` and remain unconfigured, so they produce no URL or
placeholder card.

## Context and resolver

Use `YouCityAffiliate.createContext(city, vertical, options)` and then
`YouCityAffiliate.getAffiliateOffers(context)`. The normalized context
contains `city.id`, `city.name`, `city.country`, `city.countryCode`,
`vertical`, `placement`, `language`, `device`, `mode` and a `tracking` object.

The resolver returns offers with `provider`, `name`, `vertical`, `url`,
`available`, `priority`, `variant` and `placement`. A provider is omitted when
it is disabled, unconfigured, incompatible with the vertical, unavailable in
the destination catalog, or unable to produce a valid HTTPS URL.

## Configuration and feature flags

Edit `affiliate/affiliate-config.js` to change rollout and priority:

```js
providers: {
  booking: {
    enabled: true,
    configured: true,
    priority: 80,
    urlTemplate: "https://approved-booking-link.example/?city={city}"
  }
}
```

The public feature flag is `features.providers.booking`. Set it to `false`,
or set the provider's `enabled` to `false`, to hide a provider without
changing the interface. `configured: false` is the correct state while an
affiliate ID or approved URL is still pending.

## Catalog and overrides

The canonical catalog source is `data/catalog.json`. The validation and
normalization script `scripts/build-catalog.js` generates the browser asset
`catalog.js`, which is consumed by both the application and the static build.
It contains the unified ride catalog, audited Drone entries, coordinates and
radio sources, validates the records, and caps the runtime radio list at five
stations per city. Video, radio, city and map data therefore have one source
of truth instead of multiple browser bundles.

Provider configuration and destination data are separate. DiscoverCars reads
the generated `discovercars-locations.js`, which is derived from the official
catalog and only exposes `VERIFIED` city-level matches. Ambiguous and missing
localities never fall back to the provider homepage. Its public `a_aid=youcity`
is configured in the provider configuration, not in the destination records.

Generic override source data lives in `data/affiliate-overrides.json`; the
static build generates the browser bundle `affiliate-overrides.js`. An override
can map a city key to a provider-specific destination, for example:

```json
{
  "sao-paulo-br": { "discovercars": { "path": "/brazil/sao-paulo" } }
}
```

Granada is part of the canonical city catalog. Adding another city still
requires a YouCity city record and, separately, a verified provider catalog
match when that provider needs destination-specific data.

## Tracking and attribution

The common tracking layer emits `affiliate_impression` only after an offer is
visible (IntersectionObserver, with a safe fallback) and emits
`affiliate_click` before the existing anchor navigates. Payloads contain
provider, vertical, city, country, placement, variant, provider campaign and
internal campaign fields. Analytics exceptions are caught and never block a
new-tab navigation.

Provider attribution is distinct. A provider may configure a query mapping,
for example `tracking.query: { subid: "providerCampaign" }`; the URL builder
then copies only configured context values. No secret, token or private API key
belongs in this static frontend.

## Experiments and future ranking

The active strategy is `default`, which sorts by configured priority. The
registered `ab-test` strategy understands per-vertical provider weights and
can choose a weighted offer later; it is not active now and the current UI
continues to render all resolved offers.

The extension point is `YouCityAffiliate.registerRankingStrategy(id, strategy)`
where a strategy implements `rank(offers, context)`. A future statistical or
AI strategy can be registered and selected through `ranking.strategy` without
changing Travel Planner markup or provider modules. No AI, external model,
prompt or API key is present in the current frontend.

The resolver is also the seam for a future remote resolver. A later adapter
can replace `getAffiliateOffers(context)` with `/api/affiliate/recommendations`
while returning the same offer shape to the existing UI.

## Adding or disabling a provider

1. Create and register a provider module with the common contract.
2. Add its public configuration, verticals and priority.
3. Supply only the approved public affiliate URL/template and attribution
   mapping; set `configured: true`.
4. Set `features.providers.<id>` or `providers.<id>.enabled` to `false` to
   disable it later.

No change to city navigation or Travel Planner is required for a
normal provider addition.
