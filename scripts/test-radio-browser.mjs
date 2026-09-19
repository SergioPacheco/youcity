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
import { createRadioStationRepository } from "../src/radio/radio-station-repository.mjs";

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

let audioSrc = "";
let audioLoadCount = 0;
let audioPauseCount = 0;
let audioPlayCount = 0;
const audio = {
  paused: true,
  readyState: 0,
  addEventListener() {},
  pause() { audioPauseCount += 1; this.paused = true; },
  load() { audioLoadCount += 1; },
  play() { audioPlayCount += 1; this.paused = false; return Promise.resolve(); },
  removeAttribute() {},
  get src() { return audioSrc; },
  set src(value) { audioSrc = value; }
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
const playbackCity = {
  name: "São Paulo",
  country: "Brazil",
  countryCode: "BR",
  radios: [{ name: "Catalog radio", url: "https://radio.example/catalog" }]
};
let currentPlaybackCity = playbackCity;
const stationRepository = createRadioStationRepository({ getCity: () => currentPlaybackCity });
const radioController = createRadioController({
  audio,
  elements: radioElements,
  getCity: () => currentPlaybackCity,
  getStations: () => stationRepository.getStations(),
  getVolume: () => 64,
  messages: { noRadio: "No radio", radioRetry: "Retry", radioUnavailable: "Unavailable" },
  showToast() {},
  config: { RADIO_MAX_RETRIES: 1, RADIO_RETRY_DELAY: 1, RADIO_LOAD_TIMEOUT: 10 }
});
radioController.setRadio(0, true);
const playingStation = radioController.getCurrentStation();
const sourceBeforeDiscovery = audio.src;
const loadCountBeforeDiscovery = audioLoadCount;
const playCountBeforeDiscovery = audioPlayCount;
assert.equal(playingStation.stationRef, "catalog:sao-paulo:0");
stationRepository.mergeDiscoveredStations([{ stationuuid: "additional", name: "Local discovery", url: "https://radio.example/additional" }]);
assert.equal(radioController.getCurrentStation().stationRef, playingStation.stationRef, "discovery must not change the current station");
assert.equal(audio.src, sourceBeforeDiscovery, "discovery must not change the playing stream");
assert.equal(audioLoadCount, loadCountBeforeDiscovery, "discovery must not reload audio");
assert.equal(audioPauseCount, 1, "only the original station selection should pause before loading");
assert.equal(audioPlayCount, playCountBeforeDiscovery, "discovery must not replay audio");
const additionalStation = stationRepository.getDiscoveredStations()[0];
radioController.playStation(additionalStation);
assert.equal(radioController.getIndex(), 1, "a discovered station should be playable after catalog stations");
assert.deepEqual(radioController.getCurrentStation(), additionalStation);
assert.equal(typeof radioController.setAdditionalStations, "undefined");

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
const browserStationRepository = createRadioStationRepository({ getCity: () => playbackCity });
const browserFeature = createRadioBrowserFeature({
  document: { createElement: () => browserElement() },
  elements: discoverElements,
  getCity: () => playbackCity,
  stationRepository: browserStationRepository,
  radioController,
  client: { findForCity: async () => { discoveryCalls += 1; return []; } }
});
await browserFeature.search();
assert.equal(discoverElements.panel.hidden, false);
assert.ok(discoverElements.results.children.some((item) => item.dataset?.stationGroup === "recommended"), "curated stations should render immediately");
assert.equal(discoverElements.results.children.filter((item) => item.dataset?.stationRef === "catalog:sao-paulo:0").length, 1);
assert.match(discoverElements.status.textContent, /No additional nearby stations found/);
await browserFeature.search();
assert.equal(discoverElements.panel.hidden, true, "the local-radio icon should close an open result list");
assert.equal(discoveryCalls, 1, "closing the list should not repeat the Radio Browser request");

console.log("Radio Browser tests passed: request contract, station normalization, deduplication, and panel expansion.");
