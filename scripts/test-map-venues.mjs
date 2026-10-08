import assert from "node:assert/strict";
import { createMapController } from "../src/features/map/map-controller.mjs";
import { createMapFeatureLoader } from "../src/features/map/map-feature-loader.mjs";

function createLeafletStub(log) {
  const marker = () => ({
    bindPopup(content) {
      log.popups.push(content);
      return this;
    },
    addTo() {
      return this;
    },
    setStyle() {},
    getTooltip() {
      return null;
    },
    unbindTooltip() {},
    bindTooltip() {
      return this;
    },
    openPopup() {},
    openTooltip() {}
  });
  return {
    map() {
      const map = {
        setView(point, zoom) {
          log.views.push([point, zoom]);
          return map;
        },
        getZoom() {
          return 3;
        },
        fitBounds() {},
        remove() {},
        invalidateSize() {}
      };
      return map;
    },
    tileLayer() {
      return { addTo() {} };
    },
    circleMarker(latlng) {
      log.pins.push(latlng);
      return marker();
    },
    layerGroup() {
      const layer = {
        addTo() {
          return layer;
        },
        remove() {
          log.removed += 1;
        }
      };
      return layer;
    }
  };
}

const cities = [{ name: "Tokyo", country: "Japan", coordinates: [35.68, 139.69], videos: {} }];
const venues = [
  { id: "market", name: "Market <script>", kindLabel: "Market", dishNames: ["Ramen"], coordinates: { lat: 35.7, lng: 139.7 } },
  { id: "hall", name: "Hall", kindLabel: "Food hall", dishNames: [], coordinates: { lat: 35.71, lng: 139.71 } },
  { id: "bad", name: "Bad", kindLabel: "Market", dishNames: [], coordinates: { lat: 999, lng: 0 } }
];

// Controller: pins only for verified coordinates, popups escaped.
{
  const log = { pins: [], popups: [], views: [], removed: 0 };
  const controller = createMapController({
    window: { L: createLeafletStub(log) },
    document: {},
    elements: { mapContainer: { innerHTML: "", addEventListener() {}, removeEventListener() {} }, mapResultCount: {} },
    cities,
    getCurrentCityIndex: () => 0,
    buildPopup: () => ""
  });
  assert.equal(controller.showFoodVenues(venues), 0, "no pins before the map initializes");
  await controller.initialize();
  assert.equal(controller.showFoodVenues(venues), 2, "only verified coordinates become pins");
  assert.deepEqual(log.pins.slice(-2), [[35.7, 139.7], [35.71, 139.71]]);
  assert.ok(log.popups.every((popup) => !popup.includes("<script>")), "venue popups escape third-party text");
  assert.ok(log.popups.some((popup) => popup.includes("Ramen")), "venue popup lists dishes");
  assert.equal(controller.focusFoodVenue(venues[0]), true);
  assert.deepEqual(log.views.at(-1), [[35.7, 139.7], 13], "venue focus zooms to street level");
  assert.equal(controller.focusFoodVenue({ coordinates: { lat: NaN, lng: 0 } }), false);
  controller.clearFoodVenues();
  assert.ok(log.removed >= 1, "clearing removes the venue layer");
  controller.destroy();
}

// Loader: plain opens clear stale venues; focus re-adds its own.
{
  const log = { pins: [], popups: [], views: [], removed: 0 };
  const loader = createMapFeatureLoader({
    window: { L: createLeafletStub(log) },
    document: {},
    elements: { mapContainer: { innerHTML: "", addEventListener() {}, removeEventListener() {} }, mapModal: {}, mapResultCount: {} },
    cities,
    state: { cityIndex: 0 },
    lazyModules: { load: (_, importer) => importer() },
    mapConfig: {},
    buildPopup: () => "",
    closeLayer: () => {},
    selectCity: () => {}
  });
  assert.equal(await loader.showFoodVenues(venues), 2);
  await loader.initialize();
  assert.equal(await loader.showFoodVenues([]), 0, "replacing venues clears the previous layer");
  assert.equal(await loader.focusFoodVenue(venues[1]), true);
  assert.deepEqual(log.views.at(-1), [[35.71, 139.71], 13]);
  assert.equal(await loader.focusFoodVenue({}), false);
}

console.log("Map venue tests passed: verified-only pins, escaped popups, focus and clearing.");
