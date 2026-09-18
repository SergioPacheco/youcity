#!/usr/bin/env node

import assert from "node:assert/strict";
import {
  buildRadioBrowserRequestPath,
  createRadioBrowserClient,
  distanceKm,
  normalizeRadioBrowserStations
} from "../src/radio/radio-browser.mjs";
import { createRadioPanelController } from "../src/radio/radio-panel.mjs";
import { createRadioController } from "../src/radio/radio-controller.mjs";
import { createRadioBrowserFeature } from "../src/radio/radio-browser-feature.mjs";

const city = {
  name: "São Paulo",
  country: "Brazil",
  coordinates: [-23.5507, -46.6334]
};

const requestPath = buildRadioBrowserRequestPath({ basePath: "/youcity", city });
assert.match(requestPath, /^\/youcity\/api\/radio-stations\?/);
assert.match(requestPath, /city=S%C3%A3o\+Paulo/);
assert.match(requestPath, /country=Brazil/);
assert.match(requestPath, /latitude=-23\.5507/);
assert.match(requestPath, /longitude=-46\.6334/);
assert.ok(Math.abs(distanceKm(0, 0, 0, 1) - 111.195) < 0.2, "distance helper should calculate earth distance in kilometers");

const stations = normalizeRadioBrowserStations([
  { stationuuid: "one", name: "Radio One", url: "http://radio.example/one", url_resolved: "https://radio.example/one.mp3", lastcheckok: 1, hls: 0, codec: "MP3", bitrate: 128 },
  { stationuuid: "two", name: "Broken", url: "https://radio.example/two", lastcheckok: 0, hls: 0 },
  { stationuuid: "three", name: "HLS", url: "https://radio.example/three", lastcheckok: 1, hls: 1 },
  { stationuuid: "four", name: "HTTP", url: "http://radio.example/four", lastcheckok: 1, hls: 0 },
  { stationuuid: "one", name: "Duplicate", url: "https://radio.example/duplicate", lastcheckok: 1, hls: 0 }
]);
assert.deepEqual(stations, [{
  id: "one",
  stationuuid: "one",
  name: "Radio One",
  url: "https://radio.example/one.mp3",
  homepage: "",
  favicon: "",
  country: "",
  countrycode: "",
  language: "",
  tags: "",
  codec: "MP3",
  bitrate: 128,
  source: "radio-browser"
}]);

let fetchCount = 0;
let releaseRequest;
const pending = new Promise((resolve) => { releaseRequest = resolve; });
const client = createRadioBrowserClient({
  basePath: "/youcity",
  fetchImpl: async () => {
    fetchCount += 1;
    await pending;
    return { ok: true, json: async () => ({ stations: [] }) };
  }
});
const firstRequest = client.findForCity(city);
const secondRequest = client.findForCity(city);
assert.strictEqual(firstRequest, secondRequest, "concurrent city searches should share one promise");
releaseRequest();
await firstRequest;
assert.equal(fetchCount, 1);

const classState = new Set();
const playerCard = { classList: { toggle: (name, force) => { const next = force === undefined ? !classState.has(name) : force; if (next) classState.add(name); else classState.delete(name); return next; }, contains: (name) => classState.has(name) } };
const playerCardMain = { classList: { toggle: () => {} } };
const expandButton = { setAttribute: (name, value) => { expandButton[name] = value; } };
const panel = createRadioPanelController({ playerCard, playerCardMain, expandButton });
assert.equal(panel.toggle(), true);
assert.equal(expandButton["aria-expanded"], "true");
assert.equal(panel.toggle(), false);
assert.equal(expandButton["aria-expanded"], "false");
const desktopPanel = createRadioPanelController({ playerCard, playerCardMain, expandButton, initialExpanded: true });
assert.equal(desktopPanel.isExpanded(), true, "desktop radio should expose a collapsible expanded state");
assert.equal(desktopPanel.toggle(), false, "desktop radio should be able to return to compact mode");
const collapseButton = { setAttribute: (name, value) => { collapseButton[name] = value; } };
const panelWithCollapseControl = createRadioPanelController({ playerCard, playerCardMain, expandButton, collapseButton, initialExpanded: true });
assert.equal(collapseButton["aria-expanded"], "true");
panelWithCollapseControl.setExpanded(false);
assert.equal(collapseButton["aria-expanded"], "false");

const audio = {
  paused: true,
  readyState: 0,
  addEventListener() {},
  pause() { this.paused = true; },
  load() {},
  play() { this.paused = false; return Promise.resolve(); },
  removeAttribute() {}
};
const radioElements = {
  play: { querySelector: () => ({ style: {} }), setAttribute() {}, disabled: false },
  equalizer: { classList: { toggle() {} } },
  radioSummaryPlay: { setAttribute() {}, textContent: "" },
  stationName: { innerHTML: "" },
  lcdMeta: { textContent: "" },
  stereoLed: { classList: { add() {}, remove() {} } },
  rdsLed: { classList: { toggle() {} } },
  radioSummaryPrevious: { toggleAttribute() {} },
  radioSummaryNext: { toggleAttribute() {} }
};
const radioController = createRadioController({
  audio,
  elements: radioElements,
  getCity: () => ({ name: "São Paulo", radios: [{ name: "Catalog radio", url: "https://radio.example/catalog" }] }),
  getVolume: () => 64,
  messages: { noRadio: "No radio", radioRetry: "Retry", radioUnavailable: "Unavailable" },
  showToast() {},
  config: { RADIO_MAX_RETRIES: 1, RADIO_RETRY_DELAY: 1, RADIO_LOAD_TIMEOUT: 10 }
});
const additionalStation = { stationuuid: "additional", name: "Local discovery", url: "https://radio.example/additional" };
radioController.setAdditionalStations([additionalStation]);
assert.deepEqual(radioController.getAdditionalStations(), [additionalStation]);
radioController.playStation(additionalStation);
assert.equal(radioController.getIndex(), 1, "an additional station should be playable after catalog stations");
assert.deepEqual(radioController.getCurrentStation(), additionalStation);
radioController.clearAdditionalStations();
assert.deepEqual(radioController.getAdditionalStations(), []);

function browserElement() {
  const classes = new Set();
  return {
    hidden: true,
    disabled: false,
    dataset: {},
    classList: { toggle(name, force) { if (force) classes.add(name); else classes.delete(name); } },
    setAttribute(name, value) { this[name] = value; },
    addEventListener() {},
    replaceChildren(...children) { this.children = children; },
    append(...children) { this.children = [...(this.children || []), ...children]; }
  };
}
const discoverElements = {
  trigger: browserElement(),
  panel: browserElement(),
  status: browserElement(),
  results: browserElement()
};
let discoveryCalls = 0;
const browserFeature = createRadioBrowserFeature({
  document: { createElement: () => browserElement() },
  elements: discoverElements,
  getCity: () => ({ name: "São Paulo", country: "Brazil" }),
  radioController: { setAdditionalStations() {}, getAdditionalStations: () => [], playStation() {} },
  client: { findForCity: async () => { discoveryCalls += 1; return []; } }
});
await browserFeature.search();
assert.equal(discoverElements.panel.hidden, false);
await browserFeature.search();
assert.equal(discoverElements.panel.hidden, true, "the local-radio icon should close an open result list");
assert.equal(discoveryCalls, 1, "closing the list should not repeat the Radio Browser request");

console.log("Radio Browser tests passed: request contract, station normalization, deduplication, and panel expansion.");
