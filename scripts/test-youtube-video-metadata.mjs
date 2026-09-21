#!/usr/bin/env node

import assert from "node:assert/strict";
import {
  collectVideoIds,
  normalizePlayerMetadata,
  upsertVideoMetadata
} from "./youtube-video-metadata.mjs";

assert.deepEqual(
  collectVideoIds([
    { videos: { drive: [{ id: "aaaaaaaaaaa" }, { id: "bbbbbbbbbbb" }], walk: [{ id: "aaaaaaaaaaa" }] } },
    { videos: { drone: [{ id: "ccccccccccc" }] } }
  ]),
  ["aaaaaaaaaaa", "bbbbbbbbbbb", "ccccccccccc"],
  "video IDs should be collected once in catalog order"
);

assert.deepEqual(
  normalizePlayerMetadata({
    id: "wide-video1",
    player: { embedWidth: 1280, embedHeight: 720 },
    contentDetails: { definition: "hd", dimension: "2d" }
  }),
  {
    aspectRatio: "16:9",
    youtubeMeta: { embedWidth: 1280, embedHeight: 720, definition: "hd", dimension: "2d" }
  },
  "16:9 metadata should be normalized from embed dimensions"
);

assert.deepEqual(
  normalizePlayerMetadata({
    id: "vertical001",
    player: { embedWidth: 405, embedHeight: 720 },
    contentDetails: { definition: "hd", dimension: "2d" }
  }),
  {
    aspectRatio: "9:16",
    youtubeMeta: { embedWidth: 405, embedHeight: 720, definition: "hd", dimension: "2d" }
  },
  "vertical metadata should be reduced to 9:16"
);

assert.equal(
  normalizePlayerMetadata({ id: "missing0001", player: {}, contentDetails: {} }),
  null,
  "videos without embed dimensions should not receive guessed metadata"
);

const sourceCatalog = [{
  name: "Test City",
  videos: {
    drive: [{ id: "wide-video1", start: 0 }],
    walk: [{ id: "missing0001", start: 0, aspectRatio: "4:3", youtubeMeta: { embedWidth: 640, embedHeight: 480 } }]
  }
}];
const updatedCatalog = upsertVideoMetadata(sourceCatalog, new Map([
  ["wide-video1", { aspectRatio: "16:9", youtubeMeta: { embedWidth: 1280, embedHeight: 720, definition: "hd", dimension: "2d" } }],
  ["missing0001", null]
]));

assert.deepEqual(
  updatedCatalog[0].videos.drive[0],
  {
    id: "wide-video1",
    start: 0,
    aspectRatio: "16:9",
    youtubeMeta: { embedWidth: 1280, embedHeight: 720, definition: "hd", dimension: "2d" }
  },
  "available metadata should be added to matching videos"
);
assert.deepEqual(
  updatedCatalog[0].videos.walk[0],
  { id: "missing0001", start: 0, aspectRatio: "4:3", youtubeMeta: { embedWidth: 640, embedHeight: 480 } },
  "missing API metadata should preserve existing catalog values"
);

console.log("YouTube video metadata tests passed: IDs, aspect ratios, and catalog updates are normalized.");
