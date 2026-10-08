import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createTravelController } from "../src/features/travel/travel-controller.mjs";

const root = resolve(import.meta.dirname, "..");
const streetFood = JSON.parse(readFileSync(resolve(root, "data/street-food.json"), "utf8"));
const tokyo = { id: "tokyo", name: "Tokyo", country: "Japan", countryCode: "JP", videos: {}, radios: [] };

const streetSection = {
  dataset: {},
  innerHTML: "",
  isConnected: true,
  querySelectorAll: () => [],
  addEventListener() {},
  remove() {}
};
const elements = {
  travelDrawer: { classList: { contains: () => true } },
  cityGuideContent: { innerHTML: "", querySelector: () => streetSection }
};
const tracked = [];
const window = {
  YOUCITY_AFFILIATE_CONFIG: { features: { streetFood: { enabled: true } } },
  YOUCITY_ANALYTICS: { track: (payload) => tracked.push(payload) },
  fetch: async () => ({ ok: true, json: async () => streetFood })
};
const document = {
  querySelector: () => ({}),
  createElement: () => ({ addEventListener() {}, dataset: {} }),
  head: { appendChild() {} }
};
const affiliate = {
  getVerticals: () => ({}),
  createContext: () => ({}),
  getAffiliateOffers: () => [],
  track: (payload) => tracked.push(payload),
  trackClick() {},
  observeImpressions() {}
};
const lazyModules = {
  load: (key, importer) => {
    if (key === "city-guide-controller") {
      return Promise.resolve({
        createCityGuideController: () => ({
          open: async () => {
            elements.cityGuideContent.innerHTML =
              '<section class="city-guide-section street-food-section" data-street-food-section="tokyo" aria-label="Local food"><p class="city-guide-loading" role="status">Loading local food…</p></section>';
          },
          refresh() {},
          invalidate() {}
        })
      });
    }
    return importer();
  }
};

const controller = createTravelController({
  window,
  document,
  elements,
  state: { currentMode: "walk", cityIndex: 0 },
  cities: [tokyo],
  affiliate,
  sitePath: (path) => path,
  lazyModules,
  modeLabels: {},
  availableModes: () => [],
  currentCity: () => tokyo,
  openLayer() {},
  closeLayer() {},
  selectCity() {},
  showToast() {},
  // The third-party script hangs forever: the guide must not hang with it.
  loadStay22: () => new Promise(() => {}),
  stay22WaitMs: 50,
  isStaticLocalPreview: () => true
});

// Fails if openCityGuide ever awaits the hung loader again.
const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("openCityGuide hung on stay22")), 4000));
await Promise.race([controller.openCityGuide(), timeout]);

// Hydration is intentionally fire-and-forget after open; wait for it.
const deadline = Date.now() + 3000;
while (!streetSection.innerHTML.includes("Explore Local Food") && Date.now() < deadline) {
  await new Promise((resolve) => setTimeout(resolve, 10));
}

assert.ok(
  streetSection.innerHTML.includes("Explore Local Food"),
  "street section hydrates even when stay22 hangs"
);
assert.ok(streetSection.innerHTML.includes("Sushi"), "tokyo dishes render");
assert.ok(
  tracked.some((event) => event.event === "street_food_view"),
  "street view tracked"
);

console.log("City guide timeout tests passed: hung stay22 no longer blocks the guide or STREET hydration.");
