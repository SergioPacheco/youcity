#!/usr/bin/env node

import assert from "node:assert/strict";
import {
  airportsFromDiscoverCars,
  buildFlightSearchUrl,
  createFlightOriginResolver,
  nearestAirport
} from "../src/features/travel/flight-origin.mjs";

const airports = [
  { code: "GRU", name: "São Paulo/Guarulhos", latitude: -23.4356, longitude: -46.4731 },
  { code: "CGH", name: "São Paulo/Congonhas", latitude: -23.6261, longitude: -46.6564 },
  { code: "GIG", name: "Rio de Janeiro/Galeão", latitude: -22.8099, longitude: -43.2506 }
];

assert.equal(nearestAirport(airports, -23.55, -46.63)?.code, "CGH");
assert.equal(nearestAirport(airports, 40.7, -74)?.code, undefined, "distant locations should not guess an airport");
assert.equal(nearestAirport(airports, "invalid", -46)?.code, undefined, "invalid coordinates should not resolve");

const catalogAirports = airportsFromDiscoverCars({
  "sao-paulo-br": {
    youCityId: "sao-paulo",
    youCityName: "Sao Paulo",
    latitude: -23.55,
    longitude: -46.63,
    discoverCars: { airports: [{ name: "CGH" }, { name: "GRU" }] }
  }
});
assert.deepEqual(catalogAirports.map((airport) => airport.code), ["CGH", "GRU"]);
assert.equal(catalogAirports[0].cityId, "sao-paulo");

const resolved = await createFlightOriginResolver({
  geolocation: {
    getCurrentPosition(success) {
      success({ coords: { latitude: -23.55, longitude: -46.63 } });
    }
  },
  getAirports: () => airports
}).resolve();
assert.equal(resolved?.code, "CGH");

const denied = await createFlightOriginResolver({
  geolocation: {
    getCurrentPosition(success, error) {
      error({ code: 1 });
    }
  },
  getAirports: () => airports
}).resolve();
assert.equal(denied, null, "permission denial should fall back without throwing");

const flightUrl = buildFlightSearchUrl("https://www.stay22.com/allez/expedia?aid=youcity&category=flight", {
  fromIata: "cgh",
  toIata: "GRU"
});
assert.equal(new URL(flightUrl).searchParams.get("fromiata"), "CGH");
assert.equal(new URL(flightUrl).searchParams.get("toiata"), "GRU");
assert.equal(buildFlightSearchUrl("javascript:alert(1)", { fromIata: "CGH" }), "");

console.log("Flight origin tests passed: nearest airport, catalog normalization, and permission fallback.");
