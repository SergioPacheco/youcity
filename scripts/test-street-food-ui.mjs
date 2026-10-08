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
    root: { querySelector: () => section },
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

// City without published food: placeholder removes itself, no crash.
{
  clearStreetFoodCache();
  const harness = createHarness();
  const ok = await hydrateStreetFoodSection(harness.root, { id: "paris", name: "Paris", country: "France" }, deps(harness));
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

// Placeholder used by the hub is escaped and carries the hook.
{
  const placeholder = streetFoodPlaceholder({ id: "tokyo" });
  assert.ok(placeholder.includes('data-street-food-section="tokyo"'));
}

console.log("Street food UI tests passed: tokyo renders, empty cities self-remove, stale guard holds.");
