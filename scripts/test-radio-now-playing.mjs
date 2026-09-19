#!/usr/bin/env node

import assert from "node:assert/strict";
import {
  buildNowPlayingRequestPath,
  createNowPlayingClient,
  normalizeNowPlaying,
  parseIcyMetadata
} from "../src/radio/radio-now-playing.mjs";
import { findCatalogStation } from "../src/radio/radio-catalog-index.mjs";
import {
  handleNowPlayingRequest,
  parseStationRef
} from "../src/radio/radio-now-playing-server.mjs";
import {
  buildYouTubeSearchRequestPath,
  createYouTubeSearchClient,
  normalizeYouTubeResults
} from "../src/radio/radio-youtube.mjs";
import { createRadioMediaFeature } from "../src/radio/radio-media-feature.mjs";

const station = {
  stationRef: "radio-browser:station-1",
  stationuuid: "station-1",
  name: "Radio Example",
  url: "https://radio.example/stream",
  countrycode: "BR"
};

assert.deepEqual(normalizeNowPlaying({
  nowPlaying: { artist: "A Banda", title: "Uma Música" }
}), {
  artist: "A Banda",
  title: "Uma Música",
  display: "A Banda — Uma Música",
  source: "icy"
});
assert.deepEqual(normalizeNowPlaying({ streamTitle: "Artist - Song" }), {
  artist: "Artist",
  title: "Song",
  display: "Artist — Song",
  source: "icy"
});
assert.equal(normalizeNowPlaying({ nowPlaying: null }), null);
const icyMetadata = new TextEncoder().encode("StreamTitle='DJ Example - Song Example';\0\0");
assert.deepEqual(parseIcyMetadata(icyMetadata), {
  artist: "DJ Example",
  title: "Song Example",
  display: "DJ Example — Song Example",
  source: "icy"
});
assert.equal(parseIcyMetadata(new TextEncoder().encode("StreamUrl='https://radio.example';")), null);
assert.match(buildNowPlayingRequestPath({ basePath: "/youcity", station }), /^\/youcity\/api\/radio-now-playing\?/);
assert.match(buildNowPlayingRequestPath({ basePath: "/youcity", station }), /stationRef=radio-browser%3Astation-1/);
assert.doesNotMatch(buildNowPlayingRequestPath({ basePath: "/youcity", station }), /stationuuid=|url=|name=/);

function icyResponse(streamTitle) {
  const metadata = new TextEncoder().encode(`StreamTitle='${streamTitle}';`);
  const metadataLength = Math.ceil(metadata.length / 16) * 16;
  const body = new Uint8Array(4 + 1 + metadataLength);
  body[4] = metadataLength / 16;
  body.set(metadata, 5);
  let read = false;
  return {
    ok: true,
    status: 200,
    headers: { get: (name) => name.toLowerCase() === "icy-metaint" ? "4" : null },
    body: {
      getReader() {
        return {
          async read() {
            if (read) return { done: true, value: undefined };
            read = true;
            return { done: false, value: body };
          },
          async cancel() {}
        };
      }
    }
  };
}

const generatedCatalogStation = findCatalogStation("catalog:sao-paulo:0");
assert.equal(generatedCatalogStation.stationRef, "catalog:sao-paulo:0");
let catalogFetches = 0;
const catalogResult = await handleNowPlayingRequest({
  stationRef: generatedCatalogStation.stationRef,
  fetchImpl: async () => {
    catalogFetches += 1;
    return icyResponse("Artist - Catalog Song");
  },
  findCatalogStation: () => generatedCatalogStation,
  apiMirrors: ["https://radio-browser.test"]
});
assert.equal(catalogResult.status, 200);
assert.deepEqual(catalogResult.body.nowPlaying, {
  artist: "Artist",
  title: "Catalog Song",
  display: "Artist — Catalog Song",
  source: "icy"
});
assert.equal(catalogFetches, 1, "curated Now Playing must inspect the trusted catalog stream directly");

let browserApiFetches = 0;
const browserResult = await handleNowPlayingRequest({
  stationRef: "radio-browser:browser-uuid",
  fetchImpl: async (url) => {
    browserApiFetches += 1;
    if (String(url).includes("/byuuid/")) {
      return { ok: true, status: 200, json: async () => [{ stationuuid: "browser-uuid", name: "Browser FM", url: "https://browser.example/live" }] };
    }
    return icyResponse("Artist - Browser Song");
  },
  findCatalogStation: () => null,
  apiMirrors: ["https://radio-browser.test"]
});
assert.equal(browserResult.status, 200);
assert.equal(browserResult.body.nowPlaying.title, "Browser Song");
assert.equal(browserApiFetches, 2);

assert.equal(parseStationRef("https://evil.example/"), null);
assert.equal(parseStationRef("file:///etc/passwd"), null);
assert.equal(parseStationRef("unknown:anything"), null);
const invalidResult = await handleNowPlayingRequest({ stationRef: "https://evil.example/", fetchImpl: async () => { throw new Error("must not fetch"); } });
assert.equal(invalidResult.status, 400);
const unknownResult = await handleNowPlayingRequest({ stationRef: "catalog:unknown:0", findCatalogStation: () => null, fetchImpl: async () => { throw new Error("must not fetch"); } });
assert.equal(unknownResult.status, 404);

const hlsResult = await handleNowPlayingRequest({
  stationRef: "catalog:test-city:0",
  findCatalogStation: () => ({ stationRef: "catalog:test-city:0", name: "HLS FM", url: "https://radio.example/live.m3u8" }),
  fetchImpl: async () => { throw new Error("HLS metadata must not be fetched as ICY"); }
});
assert.equal(hlsResult.body.reason, "UNSUPPORTED_HLS_METADATA");
const emptyMetadataResult = await handleNowPlayingRequest({
  stationRef: "catalog:test-city:1",
  findCatalogStation: () => ({ stationRef: "catalog:test-city:1", name: "Silent FM", url: "https://radio.example/live" }),
  fetchImpl: async () => ({ ok: true, status: 200, headers: { get: () => null }, body: { cancel: async () => {} } })
});
assert.equal(emptyMetadataResult.body.reason, "NO_METADATA");

let releaseNowPlaying;
let nowPlayingCalls = 0;
const nowPlayingPending = new Promise((resolve) => { releaseNowPlaying = resolve; });
const nowPlayingClient = createNowPlayingClient({
  basePath: "/youcity",
  fetchImpl: async () => {
    nowPlayingCalls += 1;
    await nowPlayingPending;
    return { ok: true, json: async () => ({ nowPlaying: { artist: "A", title: "B" } }) };
  }
});
const firstNowPlaying = nowPlayingClient.findForStation(station);
const secondNowPlaying = nowPlayingClient.findForStation(station);
assert.strictEqual(firstNowPlaying, secondNowPlaying, "concurrent metadata requests should share one promise");
releaseNowPlaying();
assert.deepEqual(await firstNowPlaying, {
  artist: "A",
  title: "B",
  display: "A — B",
  source: "icy"
});
assert.equal(nowPlayingCalls, 1);

let freshMetadataCalls = 0;
const freshNowPlayingClient = createNowPlayingClient({
  fetchImpl: async () => {
    freshMetadataCalls += 1;
    const title = freshMetadataCalls === 1 ? "First song" : "Second song";
    return { ok: true, json: async () => ({ nowPlaying: { artist: "Artist", title } }) };
  }
});
assert.equal((await freshNowPlayingClient.findForStation(station)).title, "First song");
assert.equal((await freshNowPlayingClient.findForStation(station)).title, "Second song", "a new explicit identification should not reuse the previous track");
assert.equal(freshMetadataCalls, 2);

const youtubeResults = normalizeYouTubeResults({
  results: [
    { videoId: "one", title: "One", channel: "Channel One", thumbnail: "https://img.example/one.jpg", videoUrl: "https://www.youtube.com/watch?v=one" },
    { videoId: "one", title: "Duplicate", channel: "Channel One", thumbnail: "", videoUrl: "https://www.youtube.com/watch?v=one" },
    { videoId: "two", title: "Two", channel: "Channel Two", thumbnail: "", videoUrl: "https://www.youtube.com/watch?v=two" }
  ]
}, { limit: 3 });
assert.deepEqual(youtubeResults, [
  { videoId: "one", title: "One", channel: "Channel One", thumbnail: "https://img.example/one.jpg", videoUrl: "https://www.youtube.com/watch?v=one" },
  { videoId: "two", title: "Two", channel: "Channel Two", thumbnail: "", videoUrl: "https://www.youtube.com/watch?v=two" }
]);
assert.deepEqual(normalizeYouTubeResults({
  items: [{
    id: { videoId: "official-1" },
    snippet: {
      title: "Official video",
      channelTitle: "Official channel",
      thumbnails: { high: { url: "https://img.example/official.jpg" } }
    }
  }]
}), [{
  videoId: "official-1",
  title: "Official video",
  channel: "Official channel",
  thumbnail: "https://img.example/official.jpg",
  videoUrl: "https://www.youtube.com/watch?v=official-1"
}], "the YouTube Data API items format should be normalized");
assert.match(buildYouTubeSearchRequestPath({ basePath: "/youcity", query: "A & B" }), /q=A\+%26\+B/);

let releaseSearch;
let searchCalls = 0;
const searchPending = new Promise((resolve) => { releaseSearch = resolve; });
const youtubeClient = createYouTubeSearchClient({
  basePath: "/youcity",
  fetchImpl: async () => {
    searchCalls += 1;
    await searchPending;
    return { ok: true, json: async () => ({ results: [] }) };
  }
});
const firstSearch = youtubeClient.search("A — B");
const secondSearch = youtubeClient.search("A — B");
assert.strictEqual(firstSearch, secondSearch, "concurrent YouTube searches should share one promise");
releaseSearch();
await firstSearch;
assert.equal(searchCalls, 1);

function fakeElement() {
  const classNames = new Set();
  return {
    children: [],
    dataset: {},
    hidden: false,
    disabled: false,
    classList: {
      toggle(name, force) { if (force) classNames.add(name); else classNames.delete(name); }
    },
    setAttribute(name, value) { this[name] = value; },
    addEventListener() {},
    removeEventListener() {},
    replaceChildren(...children) { this.children = children; },
    append(...children) { this.children.push(...children); }
  };
}

const mediaElements = {
  identifyButton: fakeElement(),
  panel: fakeElement(),
  status: fakeElement(),
  searchButton: fakeElement(),
  results: fakeElement(),
  videoHost: fakeElement()
};
let nowPlayingCallsFromFeature = 0;
let youtubeSearchCalls = 0;
const mediaFeature = createRadioMediaFeature({
  document: { createElement: () => fakeElement() },
  elements: mediaElements,
  getStation: () => station,
  nowPlayingClient: { findForStation: async () => { nowPlayingCallsFromFeature += 1; return { artist: "A", title: "B", display: "A — B", source: "icy" }; } },
  youtubeClient: { search: async (query) => { youtubeSearchCalls += 1; assert.equal(query, "A B official music video"); return [{ videoId: "video-1", title: "A - B", channel: "Official", thumbnail: "", videoUrl: "https://www.youtube.com/watch?v=video-1" }]; } }
});
assert.equal(mediaElements.panel.hidden, true, "media panel should start closed");
await mediaFeature.identify();
assert.equal(nowPlayingCallsFromFeature, 1, "identification must happen only after the explicit action");
assert.match(mediaElements.status.textContent, /^A — B/);
assert.equal(mediaElements.searchButton.disabled, false);
assert.equal(youtubeSearchCalls, 1, "YouTube search must start automatically after identification");
assert.equal(mediaElements.results.children.length, 1);
assert.equal(mediaElements.videoHost.hidden, true, "YouTube iframe must remain lazy until a result is selected");
await mediaFeature.identify();
assert.equal(mediaElements.panel.hidden, false, "the identify button should keep the Now Playing panel open");
assert.equal(nowPlayingCallsFromFeature, 2, "a second click should refresh identification");
assert.equal(youtubeSearchCalls, 2, "each identification refresh should search YouTube once");
await mediaFeature.searchVideos();
assert.equal(youtubeSearchCalls, 3, "the secondary button should remain available for an explicit retry");
assert.equal(mediaElements.results.children.length, 1);
mediaFeature.selectVideo("video-1");
assert.equal(mediaElements.videoHost.hidden, false);
assert.equal(mediaElements.videoHost.children[0].src, "https://www.youtube-nocookie.com/embed/video-1?rel=0");

const noMetadataElements = {
  identifyButton: fakeElement(),
  panel: fakeElement(),
  status: fakeElement(),
  searchButton: fakeElement(),
  results: fakeElement(),
  videoHost: fakeElement()
};
let noMetadataSearches = 0;
const noMetadataFeature = createRadioMediaFeature({
  document: { createElement: () => fakeElement() },
  elements: noMetadataElements,
  getStation: () => station,
  nowPlayingClient: { findForStation: async () => null },
  youtubeClient: { search: async () => { noMetadataSearches += 1; return []; } }
});
await noMetadataFeature.identify();
assert.equal(noMetadataSearches, 0, "missing metadata must not trigger YouTube search");
assert.match(noMetadataElements.status.textContent, /not sending current-song metadata/);

const staleElements = {
  identifyButton: fakeElement(),
  panel: fakeElement(),
  status: fakeElement(),
  searchButton: fakeElement(),
  results: fakeElement(),
  videoHost: fakeElement()
};
let activeStation = station;
let releaseStaleTrack;
const staleTrackPending = new Promise((resolve) => { releaseStaleTrack = resolve; });
let staleSearches = 0;
const staleFeature = createRadioMediaFeature({
  document: { createElement: () => fakeElement() },
  elements: staleElements,
  getStation: () => activeStation,
  nowPlayingClient: { findForStation: async () => { await staleTrackPending; return { artist: "Old", title: "Track", display: "Old — Track", source: "icy" }; } },
  youtubeClient: { search: async () => { staleSearches += 1; return []; } }
});
const staleIdentification = staleFeature.identify();
activeStation = { ...station, stationRef: "radio-browser:station-2" };
releaseStaleTrack();
await staleIdentification;
assert.equal(staleSearches, 0, "stale identification must not search or update the new station");

console.log("Radio now-playing tests passed: metadata, YouTube normalization, base paths, and request deduplication.");
