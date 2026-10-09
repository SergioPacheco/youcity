import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  hydrateStreetFoodSection,
  streetFoodPlaceholder
} from "../src/features/street-food/street-food-controller.mjs";
import { clearStreetFoodCache } from "../src/features/street-food/street-food-loader.mjs";

const root = resolve(import.meta.dirname, "..");
const streetFood = JSON.parse(readFileSync(resolve(root, "data/street-food.json"), "utf8"));
const tokyo = { id: "tokyo", name: "Tokyo", country: "Japan", countryCode: "JP" };

function createSection() {
  return {
    dataset: {},
    innerHTML: "",
    removed: false,
    isConnected: true,
    handlers: {},
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    addEventListener(event, handler) {
      this.handlers[event] = handler;
    },
    remove() {
      this.removed = true;
    }
  };
}

function createHarness() {
  const section = createSection();
  return {
    section,
    root: { querySelector: () => section, querySelectorAll: () => [section] },
    tracked: [],
    window: {
      fetch: async () => ({ ok: true, json: async () => streetFood }),
      YOUCITY_ANALYTICS: null
    }
  };
}

function deps(harness, extra = {}) {
  harness.window.YOUCITY_ANALYTICS = { track: (payload) => harness.tracked.push(payload) };
  return {
    window: harness.window,
    document: {},
    sitePath: (path) => path,
    affiliate: { createContext: () => ({}), getAffiliateOffers: () => [] },
    mode: "walk",
    renderOffer: () => "",
    ...extra
  };
}

// Tokyo (real published data): full section renders, view tracked.
{
  clearStreetFoodCache();
  const harness = createHarness();
  const ok = await hydrateStreetFoodSection(harness.root, tokyo, deps(harness));
  assert.equal(ok, true);
  assert.equal(harness.section.removed, false);
  const html = harness.section.innerHTML;
  assert.ok(html.includes("Explore Local Food"), "section heading renders");
  for (const dish of ["Sushi", "Ramen", "Tempura"]) {
    assert.ok(html.includes(dish), `${dish} card renders`);
  }
  assert.ok(html.includes("Tsukiji Outer Market"), "verified place renders");
  assert.ok(html.includes("data-street-video"), "click-to-play videos render");
  assert.ok(html.includes("data-street-filter"), "dish filters render");
  assert.ok(html.includes('data-street-osm="https://www.openstreetmap.org/'), "OSM fallback link renders");
  assert.ok(!html.includes("undefined"), "no unrendered holes");
  const views = harness.tracked.filter((event) => event.event === "street_food_view");
  assert.equal(views.length, 1, "one view impression tracked");
  assert.equal(views[0].city, "Tokyo");
  assert.ok(typeof harness.section.handlers.click === "function", "section binds one delegated listener");
  clearStreetFoodCache();
}

// City without published food in an explicit empty catalog:
// placeholder removes itself, no crash.
{
  clearStreetFoodCache();
  const harness = createHarness();
  harness.window.fetch = async () => ({ ok: true, json: async () => ({ schemaVersion: 1, cities: [] }) });
  const ok = await hydrateStreetFoodSection(harness.root, { id: "granada", name: "Granada", country: "Spain" }, deps(harness));
  assert.equal(ok, true);
  assert.equal(harness.section.removed, true, "empty section removes itself");
  assert.equal(harness.section.innerHTML, "", "nothing renders for cities without curation");
  clearStreetFoodCache();
}

// Stale city switch mid-fetch: late response is discarded.
{
  clearStreetFoodCache();
  let release;
  const gate = new Promise((resolveFetch) => {
    release = resolveFetch;
  });
  const harness = createHarness();
  harness.window.fetch = () => gate.then(() => ({ ok: true, json: async () => streetFood }));
  const pending = hydrateStreetFoodSection(harness.root, tokyo, deps(harness));
  harness.section.dataset.streetToken = "paris";
  release();
  const ok = await pending;
  assert.equal(ok, false, "stale hydration is discarded");
  assert.equal(harness.section.innerHTML, "", "stale response never renders");
  assert.equal(harness.tracked.length, 0, "stale response tracks nothing");
  clearStreetFoodCache();
}

// Guide refresh mid-flight: hydrate adopts the live node, never the detached one.
{
  clearStreetFoodCache();
  const makeNode = () => ({
    dataset: {},
    innerHTML: "",
    removed: false,
    isConnected: true,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
    remove() {
      this.removed = true;
    }
  });
  let release;
  const gate = new Promise((resolveFetch) => {
    release = resolveFetch;
  });
  let live = makeNode();
  const detached = live;
  const root = { querySelector: () => live, querySelectorAll: () => [live] };
  const win = {
    fetch: () => gate.then(() => ({ ok: true, json: async () => streetFood })),
    YOUCITY_ANALYTICS: { track() {} }
  };
  const pending = hydrateStreetFoodSection(root, tokyo, {
    window: win,
    document: {},
    sitePath: (path) => path,
    affiliate: { createContext: () => ({}), getAffiliateOffers: () => [] },
    mode: "walk",
    renderOffer: () => ""
  });
  // City-guide refresh() replaces innerHTML: new placeholder stamped with the token.
  live = makeNode();
  live.dataset.streetToken = "tokyo";
  detached.isConnected = false;
  release();
  const ok = await pending;
  assert.equal(ok, true);
  assert.ok(live.innerHTML.includes("Explore Local Food"), "hydrate adopts the live node after refresh");
  assert.equal(detached.innerHTML, "", "detached node is never written to");
  clearStreetFoodCache();
}

// Citywide records remain accessible without inventing dish associations.
// Removing the general lists would hide these published videos and map buttons.
{
  clearStreetFoodCache();
  const city = { id: "test-city", name: "Test City" };
  const dishes = [
    { id: "dish-one", name: "First dish", description: "First description", status: "published" },
    { id: "dish-two", name: "Second dish", description: "Second description", status: "published" },
    { id: "draft-dish", name: "Draft dish", status: "draft" }
  ];
  const places = [
    { id: "linked-market", dishIds: ["dish-one"] },
    { id: "city-market", dishIds: [] },
    { id: "draft-dish-market", dishIds: ["draft-dish"] }
  ].map((place) => ({ ...place, name: place.id, kind: "market", coordinates: { lat: 1, lng: 2 }, status: "published" }));
  places.push({ ...places[1], id: "draft-market", status: "draft" });
  places.push({ ...places[1], id: "unverified-market", coordinates: null });
  const videos = [
    { id: "linkedvideo", dishIds: ["dish-one"], status: "published" },
    { id: "citywidevid", dishIds: [], status: "published" },
    { id: "draftdishvd", dishIds: ["draft-dish"], status: "published" },
    { id: "draft-video", dishIds: [], status: "draft" }
  ];
  const catalog = { cities: [{ slug: city.id, dishes, places, videos }] };
  const harness = createHarness();
  harness.window.fetch = async () => ({ ok: true, json: async () => catalog });
  const opened = [];
  const frames = [];
  const ok = await hydrateStreetFoodSection(harness.root, city, deps(harness, {
    document: { createElement: () => { const frame = {}; frames.push(frame); return frame; } },
    mapVenues: { openVenue: (venue) => opened.push(venue) }
  }));
  assert.equal(ok, true);
  const { section } = harness;
  const html = section.innerHTML;
  const videoIds = [...html.matchAll(/data-street-video="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(videoIds.sort(), ["citywidevid", "draftdishvd", "linkedvideo"], "every published video is accessible once, including records without a published dish");
  const placeIds = [...html.matchAll(/data-street-map-click="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(placeIds.sort(), ["city-market", "draft-dish-market", "linked-market"], "only published, verified places are accessible, including citywide markets");
  const dishArticles = [...html.matchAll(/<article[^>]*data-street-dish="[^"]+"[^>]*>([\s\S]*?)<\/article>/g)];
  assert.ok(dishArticles.length > 0);
  assert.ok(dishArticles.every((match) => !match[1].includes('data-street-video="citywidevid"') && !match[1].includes('data-street-map-click="city-market"')), "citywide records sit outside filterable dish cards");
  const cityMarket = { dataset: { streetMapClick: "city-market" } };
  const cityVideo = { dataset: { streetVideo: "citywidevid" }, replaceWith: (frame) => { cityVideo.frame = frame; } };
  section.contains = (node) => node === cityMarket || node === cityVideo;
  const clickButton = (button, selector) => section.handlers.click({ target: { closest: (query) => query === selector ? button : null } });
  clickButton(cityMarket, "[data-street-map-click]");
  await Promise.resolve();
  assert.equal(opened[0]?.id, "city-market", "citywide market opens the in-app map");
  assert.equal(frames.length, 0, "videos remain click-to-play");
  clickButton(cityVideo, "[data-street-video]");
  assert.match(cityVideo.frame.src, /^https:\/\/www\.youtube-nocookie\.com\/embed\/citywidevid\?/);
  assert.ok(harness.tracked.some((event) => event.event === "street_food_video_open" && event.video === "citywidevid"), "citywide video clicks are tracked");
  clearStreetFoodCache();
}

// Placeholder used by the hub is escaped and carries the hook + token.
{
  const placeholder = streetFoodPlaceholder({ id: "tokyo" });
  assert.ok(placeholder.includes('data-street-food-section="tokyo"'));
  assert.ok(placeholder.includes('data-street-token="tokyo"'), "placeholder stamps the hydration token");
}

console.log("Street food UI tests passed: dishes and citywide media render, map/video actions work, empty/stale guards hold.");
