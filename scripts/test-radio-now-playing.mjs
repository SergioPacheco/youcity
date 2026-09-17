#!/usr/bin/env node

import assert from "node:assert/strict";
import {
  buildNowPlayingRequestPath,
  createNowPlayingClient,
  normalizeNowPlaying,
  parseIcyMetadata
} from "../src/radio/radio-now-playing.mjs";
import {
  buildYouTubeSearchRequestPath,
  createYouTubeSearchClient,
  normalizeYouTubeResults
} from "../src/radio/radio-youtube.mjs";
import { createRadioMediaFeature } from "../src/radio/radio-media-feature.mjs";

const station = {
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
assert.match(buildNowPlayingRequestPath({ basePath: "/youcity", station }), /stationuuid=station-1/);

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
assert.equal(mediaElements.status.textContent, "A — B");
assert.equal(mediaElements.searchButton.disabled, false);
await mediaFeature.searchVideos();
assert.equal(youtubeSearchCalls, 1, "YouTube search must happen only after the explicit action");
assert.equal(mediaElements.results.children.length, 1);
assert.equal(mediaElements.videoHost.hidden, true, "YouTube iframe must remain lazy until a result is selected");
mediaFeature.selectVideo("video-1");
assert.equal(mediaElements.videoHost.hidden, false);
assert.equal(mediaElements.videoHost.children[0].src, "https://www.youtube-nocookie.com/embed/video-1?rel=0");

console.log("Radio now-playing tests passed: metadata, YouTube normalization, base paths, and request deduplication.");
