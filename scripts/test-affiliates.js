#!/usr/bin/env node

const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const vm = require("node:vm");

const ROOT_DIR = resolve(__dirname, "..");
const indexHtml = readFileSync(resolve(ROOT_DIR, "index.html"), "utf8");
assert.ok(/AWAITING_STAY22_SCRIPT/.test(indexHtml) || /https:\/\/scripts\.stay22\.com\/letmeallez\.js/.test(indexHtml), "Stay22 script must be installed or explicitly documented as pending");
const catalog = require(resolve(ROOT_DIR, "data/discovercars-locations.json"));
const context = vm.createContext({
  URL,
  console,
  setTimeout,
  clearTimeout,
  window: {
    location: { hostname: "test" },
    YOUCITY_DISCOVERCARS_LOCATIONS: catalog.locations,
    YOUCITY_ANALYTICS: { track() {} }
  }
});

function load(file) {
  // Test fixtures are fixed, repository-owned scripts.
  vm.runInContext(readFileSync(resolve(ROOT_DIR, file), "utf8"), context, { filename: file }); // NOSONAR
}

[
  "affiliate/affiliate-config.js",
  "affiliate/affiliate-engine.js",
  "affiliate/affiliate-catalog.js",
  "affiliate/affiliate-tracking.js",
  "affiliate/affiliate-experiments.js",
  "affiliate/providers/expedia.js",
  "affiliate/providers/booking.js",
  "affiliate/providers/viator.js",
  "affiliate/providers/discovercars.js",
  "affiliate/providers/travelpayouts.js",
  "affiliate/providers/airalo.js",
  "affiliate/providers/heymondo.js",
  "affiliate/providers/stay22.js",
  "affiliate/affiliate-resolver.js"
].forEach(load);

const affiliate = context.window.YouCityAffiliate;
const config = context.window.YOUCITY_AFFILIATE_CONFIG;
const availableCity = { id: "sao-paulo", name: "Sao Paulo", rawCountry: "Brazil", country: "Brazil", countryCode: "BR" };
const unavailableCity = { id: "st-petersburg", name: "St. Petersburg", rawCountry: "Russia", country: "Russia", countryCode: "RU" };
const londonCity = { id: "london", name: "London", rawCountry: "UK", country: "United Kingdom" };
const newYorkCity = { id: "new-york-city", name: "New York City", rawCountry: "USA", country: "United States" };
const granadaCity = { name: "Granada", country: "Spain", countryCode: "ES" };
const saoPauloCity = { name: "São Paulo", country: "Brazil", countryCode: "BR" };
const tokyoCity = { name: "Tokyo", country: "Japan", countryCode: "JP" };
const romeCity = { name: "Rome", country: "Italy", countryCode: "IT" };
const barcelonaCity = { name: "Barcelona", country: "Spain", countryCode: "ES" };

let offers = affiliate.getAffiliateOffers(affiliate.createContext(availableCity, "cars"));
assert.equal(JSON.stringify(offers.map((offer) => offer.provider)), JSON.stringify(["discovercars"]), "enabled provider should appear");
assert.equal(offers[0].url, "https://www.discovercars.com/brazil/sao-paulo?a_aid=youcity");
const londonContext = affiliate.createContext(londonCity, "cars");
assert.equal(londonContext.city.rawCountry, "UK");
assert.equal(londonContext.city.countryCode, "GB", "country code should be derived from raw country metadata");
assert.equal(affiliate.getAffiliateOffers(londonContext)[0].url, "https://www.discovercars.com/united-kingdom/london?a_aid=youcity");
assert.equal(affiliate.getAffiliateOffers(affiliate.createContext(newYorkCity, "cars"))[0].url, "https://www.discovercars.com/usa-new-york/new-york?a_aid=youcity");

context.window.YOUCITY_AFFILIATE_OVERRIDES = { "new-york-city-us": null };
assert.equal(affiliate.getAffiliateOffers(affiliate.createContext(newYorkCity, "cars")).length, 0, "null override should disable a provider");
context.window.YOUCITY_AFFILIATE_OVERRIDES = {};

config.providers.discovercars.enabled = false;
assert.equal(affiliate.getAffiliateOffers(affiliate.createContext(availableCity, "cars")).length, 0, "disabled provider should be hidden");
config.providers.discovercars.enabled = true;

offers = affiliate.getAffiliateOffers(affiliate.createContext(availableCity, "hotels"));
assert.equal(JSON.stringify(offers.map((offer) => offer.provider)), JSON.stringify(["stay22"]), "unconfigured providers must not create URLs");
config.providers.expedia.configured = true;
config.providers.expedia.urlTemplate = "https://approved.example/hotels/{cityId}";
offers = affiliate.getAffiliateOffers(affiliate.createContext(availableCity, "hotels"));
const expediaOffer = offers.find((offer) => offer.provider === "expedia");
assert.ok(expediaOffer, "configured provider URL template should be resolved");
assert.equal(expediaOffer.url, "https://approved.example/hotels/sao-paulo");
config.providers.expedia.configured = false;
delete config.providers.expedia.urlTemplate;
assert.equal(affiliate.getAffiliateOffers(affiliate.createContext(unavailableCity, "cars")).length, 0, "unavailable catalog city must be hidden");
assert.ok(affiliate.getAffiliateOffers(affiliate.createContext(availableCity, "activities")).some((offer) => offer.provider === "stay22"), "Stay22 should appear for activities");

function stay22Offer(city, vertical = "hotels") {
  return affiliate.getAffiliateOffers(affiliate.createContext(city, vertical)).find((offer) => offer.provider === "stay22");
}

const granadaOffer = stay22Offer(granadaCity);
assert.ok(granadaOffer, "Stay22 should resolve without a city catalog entry");
const granadaUrl = new URL(granadaOffer.url);
assert.equal(granadaUrl.origin + granadaUrl.pathname, "https://www.stay22.com/allez/roam");
assert.equal(granadaUrl.searchParams.get("aid"), "youcity");
assert.equal(granadaUrl.searchParams.get("address"), "Granada, Spain");
assert.equal(granadaUrl.searchParams.get("campaign"), "yc_granada_es_hotels_travelplanner");

const vacationRentalOffer = affiliate.getAffiliateOffers(affiliate.createContext(granadaCity, "vacation-rentals"))[0];
assert.ok(vacationRentalOffer, "Stay22 should resolve vacation rentals");
const vacationRentalUrl = new URL(vacationRentalOffer.url);
assert.equal(vacationRentalUrl.pathname, "/allez/roam");
assert.equal(vacationRentalUrl.searchParams.get("provider"), "vrbo");
assert.equal(vacationRentalOffer.variant, "stay22_vrbo");
assert.equal(vacationRentalOffer.label, "Vacation rentals in Granada");

for (const [city, address, campaign] of [
  [saoPauloCity, "São Paulo, Brazil", "yc_sao-paulo_br_hotels_travelplanner"],
  [tokyoCity, "Tokyo, Japan", "yc_tokyo_jp_hotels_travelplanner"],
  [romeCity, "Rome, Italy", "yc_rome_it_hotels_travelplanner"],
  [barcelonaCity, "Barcelona, Spain", "yc_barcelona_es_hotels_travelplanner"],
  [{ name: "Málaga", country: "Spain", countryCode: "ES" }, "Málaga, Spain", "yc_malaga_es_hotels_travelplanner"],
  [{ name: "Córdoba", country: "Spain", countryCode: "ES" }, "Córdoba, Spain", "yc_cordoba_es_hotels_travelplanner"]
]) {
  const url = new URL(stay22Offer(city).url);
  assert.equal(url.searchParams.get("address"), address, `${city.name} address should preserve accents`);
  assert.equal(url.searchParams.get("campaign"), campaign);
}

for (const [city, address, campaign] of [
  [granadaCity, "Granada, Spain", "yc_granada_es_activities_travelplanner"],
  [barcelonaCity, "Barcelona, Spain", "yc_barcelona_es_activities_travelplanner"],
  [romeCity, "Rome, Italy", "yc_rome_it_activities_travelplanner"],
  [tokyoCity, "Tokyo, Japan", "yc_tokyo_jp_activities_travelplanner"],
  [saoPauloCity, "São Paulo, Brazil", "yc_sao-paulo_br_activities_travelplanner"],
  [{ name: "Málaga", country: "Spain", countryCode: "ES" }, "Málaga, Spain", "yc_malaga_es_activities_travelplanner"],
  [{ name: "Córdoba", country: "Spain", countryCode: "ES" }, "Córdoba, Spain", "yc_cordoba_es_activities_travelplanner"],
  [{ name: "Québec", country: "Canada", countryCode: "CA" }, "Québec, Canada", "yc_quebec_ca_activities_travelplanner"],
  [{ name: "Kraków", country: "Poland", countryCode: "PL" }, "Kraków, Poland", "yc_krakow_pl_activities_travelplanner"],
  [{ name: "Zürich", country: "Switzerland", countryCode: "CH" }, "Zürich, Switzerland", "yc_zurich_ch_activities_travelplanner"]
]) {
  const offer = stay22Offer(city, "activities");
  assert.ok(offer, `Stay22 activities should resolve for ${city.name}`);
  const url = new URL(offer.url);
  assert.equal(url.origin + url.pathname, "https://www.stay22.com/allez/getyourguide");
  assert.equal(url.searchParams.get("aid"), "youcity");
  assert.equal(url.searchParams.get("address"), address, `${city.name} activities address should preserve accents`);
  assert.equal(url.searchParams.get("campaign"), campaign);
assert.equal(offer.label, `Things to do in ${city.name}`);
}

const stay22 = context.window.YouCityStay22;
assert.equal(new URL(stay22.createRoamUrl(affiliate.createContext(granadaCity, "hotels"))).searchParams.has("provider"), false, "Roam defaults to AI routing");
config.providers.stay22.roam.forceProvider = "booking";
assert.equal(new URL(stay22.createRoamUrl(affiliate.createContext(granadaCity, "hotels"))).searchParams.get("provider"), "booking");
config.providers.stay22.roam.forceProvider = "not-a-provider";
assert.equal(new URL(stay22.createRoamUrl(affiliate.createContext(granadaCity, "hotels"))).searchParams.has("provider"), false, "invalid provider must be ignored");
config.providers.stay22.roam.excludeProviders = ["vrbo", "expedia", "not-a-provider"];
assert.equal(new URL(stay22.createRoamUrl(affiliate.createContext(granadaCity, "hotels"))).searchParams.get("excludeproviders"), "vrbo,expedia");
config.providers.stay22.roam.forceProvider = null;
config.providers.stay22.roam.excludeProviders = [];
config.experiments.enabled = true;
config.experiments.stay22.enabled = true;
config.experiments.stay22.activeVariant = "stay22_booking";
const experimentOffer = stay22Offer(granadaCity);
assert.equal(new URL(experimentOffer.url).searchParams.get("provider"), "booking", "configured experiment should force Booking through Roam");
assert.equal(experimentOffer.variant, "stay22_booking");
config.experiments.enabled = false;
config.experiments.stay22.enabled = false;
config.experiments.stay22.activeVariant = "stay22_roam";

const searchUrl = stay22.createAccommodationSearchUrl(saoPauloCity, { checkin: "2099-06-10", checkout: "2099-06-15", adults: 2, children: 1 });
assert.ok(searchUrl, "valid accommodation dates should create a Searchbar URL");
const searchParams = new URL(searchUrl).searchParams;
assert.equal(new URL(searchUrl).pathname, "/allez/searchbar");
assert.equal(searchParams.get("address"), "São Paulo, Brazil");
assert.equal(searchParams.get("checkin"), "2099-06-10");
assert.equal(searchParams.get("checkout"), "2099-06-15");
assert.equal(searchParams.get("adults"), "2");
assert.equal(searchParams.get("children"), "1");
assert.equal(searchParams.get("campaign"), "yc_sao-paulo_br_hotel-search_travelplanner");
assert.equal(stay22.createAccommodationSearchUrl(granadaCity, { checkin: "2020-01-01", checkout: "2020-01-02" }), "", "past dates must be rejected");
assert.equal(stay22.createAccommodationSearchUrl(granadaCity, { checkin: "2099-06-10", checkout: "2099-06-10" }), "", "same-day stays must be rejected");
const mapUrl = new URL(stay22.createMapUrl(tokyoCity));
assert.equal(mapUrl.pathname, "/embed/gm");
assert.equal(mapUrl.searchParams.get("aid"), "youcity");
assert.equal(mapUrl.searchParams.get("address"), "Tokyo, Japan");
assert.equal(mapUrl.searchParams.get("campaign"), "yc_tokyo_jp_hotels_map");
config.features.stay22.map = false;
assert.equal(stay22.createMapUrl(tokyoCity), "", "map flag should disable map URLs");
config.features.stay22.map = true;
config.features.stay22.activities = false;
assert.equal(stay22Offer(granadaCity, "activities"), undefined, "activities flag should disable activities");
config.features.stay22.activities = true;
assert.equal(stay22Offer(granadaCity, "cars"), undefined, "Stay22 cars remain disabled until confirmed");
assert.equal(stay22Offer(granadaCity, "flights"), undefined, "Stay22 flights remain disabled until confirmed");

config.providers.stay22.enabled = false;
assert.equal(stay22Offer(granadaCity), undefined, "disabled Stay22 should be hidden");
config.providers.stay22.enabled = true;
config.providers.stay22.configured = false;
assert.equal(stay22Offer(granadaCity), undefined, "unconfigured Stay22 should not produce an offer");
config.providers.stay22.configured = true;
for (const vertical of ["cars", "flights", "insurance", "esim"]) {
  assert.equal(stay22Offer(granadaCity, vertical), undefined, `Stay22 should not appear in ${vertical}`);
}
assert.equal(affiliate.getAffiliateOffers(affiliate.createContext({ name: "Granada" }, "hotels")).length, 0, "city without country should be unavailable");
assert.equal(affiliate.getAffiliateOffers(affiliate.createContext({ country: "Spain" }, "hotels")).length, 0, "city without name should be unavailable");
assert.ok(affiliate.getProvider("viator"), "Viator should remain registered");

["test-expedia", "test-booking", "test-travelpayouts"].forEach((providerId, index) => {
  config.providers[providerId] = { enabled: true, configured: true, priority: index + 1 };
  affiliate.registerProvider({
    id: providerId,
    name: providerId,
    verticals: ["hotels"],
    supports: () => true,
    createUrl: () => `https://example.com/${providerId}`,
    getOffer: (decisionContext) => ({ url: `https://example.com/${providerId}?city=${decisionContext.city.id}` })
  });
});
offers = affiliate.getAffiliateOffers(affiliate.createContext(availableCity, "hotels"));
assert.equal(JSON.stringify(offers.map((offer) => offer.provider)), JSON.stringify(["stay22", "test-travelpayouts", "test-booking", "test-expedia"]), "multiple providers should be ranked centrally");

const tracked = [];
context.window.YOUCITY_ANALYTICS = { track(payload) { tracked.push(payload); } };
const element = { dataset: {
  travelProvider: "stay22",
  travelVertical: "activities",
  travelCityName: "Sao Paulo",
  travelCountry: "Brazil",
  travelPlacement: "travel_planner",
  travelVariant: "A"
} };
context.window.YouCityAffiliateTracking.trackImpression(element);
context.window.YouCityAffiliateTracking.trackClick(element);
assert.equal(JSON.stringify(tracked.map((payload) => payload.event)), JSON.stringify(["affiliate_impression", "affiliate_click"]), "impression and click events should be emitted");
assert.equal(tracked[1].provider, "stay22");
assert.equal(tracked[1].vertical, "activities");

context.window.YOUCITY_ANALYTICS = { track() { throw new Error("analytics down"); } };
assert.doesNotThrow(() => context.window.YouCityAffiliateTracking.trackClick(element), "analytics failure must not block navigation");

console.log("Affiliate tests passed: enabled/disabled/configuration/vertical/catalog filtering, multiple providers, impressions, clicks, and analytics fail-safe.");
