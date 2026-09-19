#!/usr/bin/env node

import assert from "node:assert/strict";
import { createCityBrowser } from "../src/ui/city-browser.mjs";

const cities = [
  {
    name: "Granada",
    rawName: "Granada",
    country: "Spain",
    rawCountry: "Spain",
    region: "Europe",
    videos: { drive: [{ id: "granada-drive" }] }
  },
  {
    name: "Recife",
    rawName: "Recife",
    country: "Brazil",
    rawCountry: "Brazil",
    region: "South America",
    videos: { walk: [{ id: "recife-walk" }] }
  }
];

const filterButtons = ["all", "favorites", "drive", "walk"].map((filter) => ({
  dataset: { filter },
  classList: { toggle() {} }
}));
const elements = {
  search: { value: "recife" },
  filterContinent: { value: "South America" },
  filterButtons,
  grid: { innerHTML: "" },
  resultCount: { textContent: "" }
};
const state = {
  currentFilter: "walk",
  currentContinent: "South America",
  favorites: ["Granada"],
  visitedCities: ["Recife"]
};
const storage = {
  readJson() { return []; },
  writeJson() {}
};

const browser = createCityBrowser({
  cities,
  state,
  elements,
  storage,
  storageKeys: { favorites: "favorites", recentCities: "recent-cities" },
  config: {
    filters: { ALL: "all", FAVORITES: "favorites" },
    modes: { DRIVE: "drive", WALK: "walk", DRONE: "drone", BEACH_WALK: "beach_walk" }
  },
  modeLabels: { drive: "Drive", walk: "Walk" },
  modeOrder: ["drive", "walk"],
  messages: {},
  showToast() {}
});

browser.resetForOpen();

assert.equal(state.currentFilter, "all");
assert.equal(state.currentContinent, "");
assert.equal(elements.search.value, "");
assert.equal(elements.filterContinent.value, "");
assert.match(elements.grid.innerHTML, /Granada/);
assert.match(elements.grid.innerHTML, /Recife/);
assert.deepEqual(state.favorites, ["Granada"]);
assert.deepEqual(state.visitedCities, ["Recife"]);

console.log("City browser reset tests passed: Explore cities starts fresh on ALL without clearing user data.");
