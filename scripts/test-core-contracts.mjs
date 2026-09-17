#!/usr/bin/env node

import assert from "node:assert/strict";
import { getEffectiveStartSeconds } from "../src/core/video-policy.mjs";
import { buildCityUrl, parseRoute } from "../src/core/url.mjs";
import { createCatalogRepository } from "../src/catalog/catalog-repository.mjs";

assert.equal(getEffectiveStartSeconds({}), 15);
assert.equal(getEffectiveStartSeconds({ start: "not-a-number" }), 15);
assert.equal(getEffectiveStartSeconds({ start: 0 }), 15);
assert.equal(getEffectiveStartSeconds({ start: 8 }), 15);
assert.equal(getEffectiveStartSeconds({ start: 15 }), 15);
assert.equal(getEffectiveStartSeconds({ start: 45 }), 45);

const route = parseRoute({ pathname: "/youcity/city/Granada", search: "?mode=walk&video=2" }, "/youcity");
assert.deepEqual(route, { citySlug: "granada", mode: "walk", videoIndex: 1, isDeepLink: true });
assert.equal(buildCityUrl({ slug: "sao-paulo", mode: "drive", videoIndex: 0 }, "/youcity"), "/youcity/city/sao-paulo?mode=drive");
assert.equal(buildCityUrl({ slug: "sao-paulo", mode: "walk", videoIndex: 2 }, ""), "/city/sao-paulo?mode=walk&video=3");

const repository = createCatalogRepository([
  { name: "Granada", country: "Spain", videos: { drive: [{ id: "drive" }], walk: [{ id: "walk-1" }, { id: "walk-2" }] } },
  { name: "Tokyo", country: "Japan", videos: { drive: [], bike: [{ id: "bike" }] } }
]);
assert.deepEqual(repository.availableModes(repository.getCity(0)), ["drive", "walk"]);
assert.equal(repository.selectRide({ cityIndex: 0, mode: "walk", videoIndex: 1 }).id, "walk-2");
assert.equal(repository.selectRide({ cityIndex: 0, mode: "bike", videoIndex: 0 }).id, "drive");
assert.equal(repository.selectRide({ cityIndex: 1, mode: "drive", videoIndex: 0 }).id, "bike");

console.log("Core contract tests passed.");
