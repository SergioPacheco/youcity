import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  getPublishedStreetFood,
  getStreetFoodEntry,
  hasPublishedStreetFood,
  hasVerifiedCoordinates,
  placesForDish,
  videosForDish
} from "../src/features/street-food/street-food-repository.mjs";
import { clearStreetFoodCache, loadStreetFoodCatalog } from "../src/features/street-food/street-food-loader.mjs";
import { isStreetFoodEnabled, streetFoodPlaceholder } from "../src/features/street-food/street-food-controller.mjs";
import { validateStreetFood } from "./validate-street-food.mjs";
import buildStatic from "./build-static.js";

const { streetFoodPagePlan, cityFoodSeo, streetFoodTeaser } = buildStatic;

const root = resolve(import.meta.dirname, "..");
const catalog = JSON.parse(readFileSync(resolve(root, "data/catalog.json"), "utf8"));
const streetFood = JSON.parse(readFileSync(resolve(root, "data/street-food.json"), "utf8"));

// Real catalog: pilot slugs must resolve, validation must be clean.
assert.deepEqual(validateStreetFood(catalog, streetFood), []);
for (const slug of ["tokyo", "istanbul", "mexico-city", "seoul", "taipei"]) {
  assert.ok(getStreetFoodEntry(streetFood, slug), `${slug} must be a pilot entry`);
}
assert.ok(!getStreetFoodEntry(streetFood, "bangkok"), "bangkok is not in the city catalog and must not be an entry");
assert.equal(hasPublishedStreetFood(streetFood, "tokyo"), true, "tokyo pilot is published");
assert.equal(hasPublishedStreetFood(streetFood, "seoul"), true, "seoul pilot is published");
assert.equal(hasPublishedStreetFood(streetFood, "taipei"), true, "taipei pilot is published");
assert.deepEqual(
  getPublishedStreetFood(streetFood, "tokyo").dishes.map((dish) => dish.id).sort(),
  ["ramen", "sushi", "tempura"]
);
assert.equal(getPublishedStreetFood(streetFood, "tokyo").places.length, 2);
assert.equal(getPublishedStreetFood(streetFood, "tokyo").videos.length, 3);

// Repository fixtures: drafts never surface, pins require coordinates.
const fixture = {
  schemaVersion: 1,
  cities: [
    {
      slug: "tokyo",
      dishes: [
        { id: "ramen", name: "Ramen", description: "Noodle soup.", status: "published" },
        { id: "draft-dish", name: "Draft", description: "Hidden.", status: "draft" }
      ],
      places: [
        {
          id: "market",
          name: "Market",
          kind: "market",
          dishIds: ["ramen"],
          coordinates: { lat: 35.7, lng: 139.7 },
          status: "published"
        },
        {
          id: "no-coords",
          name: "No Coords",
          kind: "restaurant",
          dishIds: ["ramen"],
          coordinates: null,
          status: "published"
        },
        {
          id: "bad-coords",
          name: "Bad Coords",
          kind: "restaurant",
          dishIds: ["ramen"],
          coordinates: { lat: 999, lng: 0 },
          status: "published"
        }
      ],
      videos: [
        { id: "dQw4w9WgXcQ", dishIds: ["ramen"], placeIds: [], status: "published" },
        { id: "draft-video", dishIds: [], placeIds: [], status: "draft" }
      ]
    }
  ]
};
const published = getPublishedStreetFood(fixture, "tokyo");
assert.deepEqual(published.dishes.map((dish) => dish.id), ["ramen"]);
assert.deepEqual(published.places.map((place) => place.id), ["market"], "only verified-coordinate places become pins");
assert.deepEqual(published.videos.map((video) => video.id), ["dQw4w9WgXcQ"]);
assert.deepEqual(getPublishedStreetFood(fixture, "unknown"), { dishes: [], places: [], videos: [] });
assert.equal(hasPublishedStreetFood(fixture, "tokyo"), true);
assert.equal(hasVerifiedCoordinates({ coordinates: { lat: 35.7, lng: 139.7 } }), true);
assert.equal(hasVerifiedCoordinates({ coordinates: { lat: 91, lng: 0 } }), false);
assert.equal(hasVerifiedCoordinates({ coordinates: null }), false);
assert.deepEqual(placesForDish(published.places, "ramen").map((place) => place.id), ["market"]);
assert.deepEqual(videosForDish(published.videos, "ramen").map((video) => video.id), ["dQw4w9WgXcQ"]);

// Validator fixtures: every integrity rule must fire.
const bad = {
  schemaVersion: 1,
  cities: [
    {
      slug: "no-such-city",
      dishes: [{ id: "x", status: "published" }],
      places: [
        {
          id: "p",
          name: "P",
          kind: "market",
          dishIds: ["ghost"],
          coordinates: { lat: 0, lng: 200 },
          status: "published",
          verifiedAt: "2026-10-08"
        }
      ],
      videos: [{ id: "short", dishIds: [], placeIds: ["ghost-place"], status: "published", verifiedAt: "2026-10-08" }]
    }
  ]
};
const errors = validateStreetFood([{ name: "Tokyo", country: "Japan" }], bad);
assert.ok(errors.some((error) => error.includes("does not match any catalog city")), "unknown slug rejected");
assert.ok(errors.some((error) => error.includes("requires name and description")), "published dish requires content");
assert.ok(errors.some((error) => error.includes("at least one source")), "published dish requires source");
assert.ok(errors.some((error) => error.includes("unknown dishId")), "dangling dishId rejected");
assert.ok(errors.some((error) => error.includes("coordinates must be finite")), "bad coordinates rejected");
assert.ok(errors.some((error) => error.includes("invalid YouTube video id")), "bad video id rejected");
assert.ok(errors.some((error) => error.includes("unknown placeId")), "evidence-free place link rejected");

// Loader: single fetch cached, failure resets, base path respected.
clearStreetFoodCache();
let calls = [];
const fakeFetch = async (url, options) => {
  calls.push([url, options]);
  return { ok: true, json: async () => ({ schemaVersion: 1, cities: [] }) };
};
const sitePath = (path) => `/preview${path}`;
const first = await loadStreetFoodCatalog({ fetchImpl: fakeFetch, sitePath });
const second = await loadStreetFoodCatalog({ fetchImpl: fakeFetch, sitePath });
assert.equal(first, second, "catalog promise is cached");
assert.deepEqual(calls.map(([url]) => url), ["/preview/data/street-food.json"]);
clearStreetFoodCache();
let failingCalls = 0;
await assert.rejects(
  loadStreetFoodCatalog({
    fetchImpl: async () => {
      failingCalls += 1;
      return { ok: false, status: 404 };
    },
    sitePath: (path) => path
  }),
  /HTTP 404/
);
assert.equal(failingCalls, 1);
const recovered = await loadStreetFoodCatalog({ fetchImpl: fakeFetch, sitePath: (path) => path });
assert.deepEqual(recovered, { schemaVersion: 1, cities: [] }, "cache was reset after failure");
clearStreetFoodCache();

// Controller: flag defaults off, placeholder is escaped and sync.
assert.equal(isStreetFoodEnabled({}), false);
assert.equal(isStreetFoodEnabled({ YOUCITY_AFFILIATE_CONFIG: { features: { streetFood: { enabled: true } } } }), true);
const placeholder = streetFoodPlaceholder({ id: 'tokyo"><img src=x>' });
assert.ok(placeholder.includes("data-street-food-section"), "placeholder carries the hook attribute");
assert.ok(!placeholder.includes("<img src=x>"), "placeholder escapes the city slug");

// Food pages: only cities with published dishes earn a page; teaser links it.
// The five original pilots must always be present; every catalog entry must
// meet the curation floor (3+ dishes, 2+ places with verified coordinates,
// 2+ videos) so coverage can only grow from here.
const realPlan = streetFoodPagePlan(streetFood, catalog);
for (const slug of ["istanbul", "mexico-city", "seoul", "taipei", "tokyo"]) {
  assert.ok(realPlan.some((entry) => entry.slug === slug), `${slug} pilot keeps its food guide`);
}
for (const entry of realPlan) {
  assert.ok(entry.dishes.length >= 3, `${entry.slug} has at least 3 published dishes`);
  const published = getPublishedStreetFood(streetFood, entry.slug);
  assert.ok(published.places.length >= 2, `${entry.slug} has at least 2 pinned places`);
  assert.ok(published.places.every(hasVerifiedCoordinates), `${entry.slug} pins all carry verified coordinates`);
  assert.ok(published.videos.length >= 2, `${entry.slug} has at least 2 videos`);
}
assert.ok(realPlan.length >= 5, `at least the 5 pilot guides exist (found ${realPlan.length})`);
const foodPlan = streetFoodPagePlan(
  { cities: [{ slug: "tokyo", dishes: [{ id: "ramen", name: "Ramen", description: "Noodle soup with broth.", status: "published" }], places: [], videos: [] }] },
  [{ name: "Tokyo", country: "Japan" }]
);
assert.equal(foodPlan.length, 1);
assert.equal(foodPlan[0].slug, "tokyo");
const foodSeo = cityFoodSeo(foodPlan[0].city, foodPlan[0].dishes);
assert.equal(foodSeo.title, "Tokyo Food Guide | YouCity");
assert.equal(foodSeo.canonical, "https://youcity.app/city/tokyo/food");
assert.ok(foodSeo.description.length >= 50, "food description satisfies the SEO minimum");
assert.equal(foodSeo.jsonLd.length, 3, "single JSON-LD block with WebPage, BreadcrumbList and ItemList");
const teaser = streetFoodTeaser(foodPlan[0].city, {
  cities: [{ slug: "tokyo", dishes: foodPlan[0].dishes }]
});
assert.ok(teaser.includes("/city/tokyo/food"), "city teaser links the food guide");
assert.equal(streetFoodTeaser({ name: "Tokyo" }, { cities: [] }), "", "no teaser without published dishes");

console.log("Street food tests passed: schema, validator, repository, loader and controller placeholder.");
