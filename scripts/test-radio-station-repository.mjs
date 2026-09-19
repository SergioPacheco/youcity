#!/usr/bin/env node

import assert from "node:assert/strict";
import {
  normalizeCatalogStation,
  normalizeRadioBrowserStation,
  normalizeStreamUrl
} from "../src/radio/radio-station.mjs";
import { createRadioStationRepository } from "../src/radio/radio-station-repository.mjs";

const city = {
  name: "Granada",
  country: "Spain",
  countryCode: "ES",
  radios: [{ name: "Radio Granada", url: "https://radio.example/live///" }]
};

const catalogStation = normalizeCatalogStation(city, city.radios[0], 0);
assert.equal(catalogStation.id, "catalog:granada:0");
assert.equal(catalogStation.stationRef, "catalog:granada:0");
assert.equal(catalogStation.source, "catalog");
assert.equal(catalogStation.sourceId, "granada:0");
assert.equal(catalogStation.name, "Radio Granada");
assert.equal(catalogStation.url, "https://radio.example/live///");
assert.equal(catalogStation.cityId, "granada");
assert.equal(catalogStation.countryCode, "ES");
assert.equal(catalogStation.stationuuid, "");
assert.equal(catalogStation.curated, true);

const browserStation = normalizeRadioBrowserStation(city, {
  stationuuid: "abc",
  name: "Example FM",
  url: "https://example.test/live",
  url_resolved: "https://example.test/live",
  countrycode: "ES",
  homepage: "https://example.test",
  language: "Spanish",
  tags: "pop",
  codec: "MP3",
  bitrate: "128"
});
assert.equal(browserStation.id, "radio-browser:abc");
assert.equal(browserStation.stationRef, "radio-browser:abc");
assert.equal(browserStation.source, "radio-browser");
assert.equal(browserStation.sourceId, "abc");
assert.equal(browserStation.countryCode, "ES");
assert.equal(browserStation.bitrate, 128);
assert.equal(browserStation.curated, false);
assert.equal(normalizeStreamUrl(" HTTPS://RADIO.EXAMPLE/live/// "), "https://radio.example/live");

let currentCity = city;
const repository = createRadioStationRepository({ getCity: () => currentCity });
assert.deepEqual(repository.getCatalogStations().map((station) => station.stationRef), ["catalog:granada:0"]);
assert.deepEqual(repository.getStations().map((station) => station.stationRef), ["catalog:granada:0"]);

const discovered = repository.mergeDiscoveredStations([
  {
    stationuuid: "duplicate-url",
    name: "Radio Granada FM",
    url: "https://radio.example/live",
    countrycode: "ES"
  },
  {
    stationuuid: "nearby",
    name: "Nearby FM",
    url: "https://nearby.example/live",
    countrycode: "ES"
  }
]);
assert.equal(discovered.length, 1, "a duplicate stream must not displace the curated station");
assert.equal(discovered[0].stationRef, "radio-browser:nearby");
assert.deepEqual(repository.getStations().map((station) => station.stationRef), [
  "catalog:granada:0",
  "radio-browser:nearby"
]);
assert.equal(repository.findStationByRef("catalog:granada:0").curated, true);
assert.equal(repository.findStationByRef("radio-browser:nearby").name, "Nearby FM");

repository.mergeDiscoveredStations([]);
assert.equal(repository.getStations().length, 2, "empty discovery must preserve curated and cached stations");

currentCity = {
  name: "Madrid",
  country: "Spain",
  countryCode: "ES",
  radios: [{ name: "Madrid FM", url: "https://madrid.example/live" }]
};
assert.deepEqual(repository.getStations().map((station) => station.stationRef), ["catalog:madrid:0"]);
repository.mergeDiscoveredStations([{
  stationuuid: "madrid-nearby",
  name: "Madrid Nearby",
  url: "https://madrid-nearby.example/live"
}]);
assert.equal(repository.getDiscoveredStations().length, 1);

currentCity = city;
assert.deepEqual(repository.getStations().map((station) => station.stationRef), [
  "catalog:granada:0",
  "radio-browser:nearby"
]);
repository.clearDiscoveredStations();
assert.deepEqual(repository.getStations().map((station) => station.stationRef), ["catalog:granada:0"]);

console.log("Radio station repository tests passed: normalization, curated priority, deduplication, zero results, and city cache.");
