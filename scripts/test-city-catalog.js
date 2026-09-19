#!/usr/bin/env node

const assert = require("node:assert/strict");
const { resolve } = require("node:path");
const { loadCatalog } = require("./load-catalog");

const ROOT_DIR = resolve(__dirname, "..");
const catalog = loadCatalog(ROOT_DIR);
const granada = catalog.find((city) => city.name === "Granada" && city.country === "Spain");
assert.ok(granada, "Granada, Spain must be in the city catalog");
assert.equal(granada.countryCode, "ES");
assert.equal(catalog.length, 206, "catalog should contain 206 cities including Beach Walk destinations");
assert.deepEqual(Array.from(granada.videos.drive, (video) => video.id), ["zMTHYYszb94"]);
assert.deepEqual(Array.from(granada.videos.walk, (video) => video.id), ["X1unB-eKnB4", "thvjqM6ksHI"]);
assert.deepEqual(Array.from(granada.videos.drone, (video) => video.id), ["c6u22gDXtYw"]);
assert.deepEqual(Array.from(granada.coordinates), [37.1765, -3.5979]);
const beachWalkIds = new Set(catalog.flatMap((city) => city.videos.beach_walk || []).map((video) => video.id));
const beachWalkRides = catalog.flatMap((city) => city.videos.beach_walk || []);
assert.equal(beachWalkIds.size, 17, "Beach Walk catalog should contain 17 active unique videos");
assert.equal(beachWalkRides.length, 17, "all active Beach Walk videos should be loaded into the canonical catalog");
assert.equal(beachWalkIds.has("K7T-e62o18g"), false, "the removed Clearwater video must not return to the catalog");
assert.ok(beachWalkRides.every((video) => beachWalkIds.has(video.id)), "Beach Walk rides should have unique catalog IDs");
assert.ok(catalog.filter((city) => city.videos.beach_walk.length).length >= 14, "Beach Walk rides should cover the curated destinations");
assert.ok(catalog.filter((city) => city.videos.beach_walk.length).every((city) => city.radios.length > 0), "every Beach Walk destination should have a radio station");
assert.ok(catalog.every((city) => city.radios.length <= 5), "canonical catalog should cap radios at five per city");
assert.ok(catalog.every((city) => city.radios.length > 0), "every catalog city should have at least one radio station");
assert.ok(catalog.every((city) => Object.values(city.videos).every((videos) => new Set(videos.map((video) => video.id)).size === videos.length)), "canonical catalog should deduplicate ride IDs");
assert.equal(new Set(catalog.map((city) => `${city.name}\u0000${city.country}`)).size, catalog.length, "canonical catalog should not contain duplicate city keys");
assert.ok(catalog.every((city) => Array.isArray(city.coordinates)), "canonical catalog should provide coordinates for every city");

const expectedBeachWalkCoverage = {
  Nerja: { walk: ["UN4UTkhkajo"] },
  "Fort Myers": { walk: ["bWhSxsjwLs4"], drone: ["_N_nJmW9i1g"] },
  Kefalonia: { walk: ["xRu_O6KPmN0"] },
  Elafonisi: { drone: ["oaYPWbJgpuI"] },
  "St. Pete Beach": { walk: ["oK2967-MN4I"] },
  Skopelos: { walk: ["y7_sn5tW794"], drone: ["bM2rrmRraSY"] },
  Malibu: { walk: ["HD9bJOtMJvg"], drive: ["gAqKmqYlwv8"] }
};
for (const [cityName, modes] of Object.entries(expectedBeachWalkCoverage)) {
  const city = catalog.find((entry) => entry.name === cityName);
  assert.ok(city, `${cityName} must be in the city catalog`);
  for (const [mode, ids] of Object.entries(modes)) {
    assert.deepEqual(city.videos[mode].map((video) => video.id), ids, `${cityName} ${mode} coverage should be curated`);
  }
}

for (const cityName of ["Cala Mariolu", "Saint-Tropez"]) {
  const city = catalog.find((entry) => entry.name === cityName);
  assert.ok(city, `${cityName} must be in the city catalog`);
  assert.equal(city.videos.walk.length, 0, `${cityName} walk coverage should remain pending validation`);
  assert.equal(city.videos.drone.length, 0, `${cityName} drone coverage should remain pending validation`);
}

console.log("City catalog tests passed: Granada, Spain is available with Drive, Walk, Drone, and map data.");
