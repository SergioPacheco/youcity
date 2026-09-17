#!/usr/bin/env node

import assert from "node:assert/strict";
import { createRequestGuard } from "../src/core/async-guard.mjs";
import { createLazyModuleLoader } from "../src/core/lazy-module.mjs";
import { createWeatherController } from "../src/weather/weather-controller.mjs";
import { createCommentAssistantLoader } from "../src/features/comment-assistant/comment-assistant-loader.mjs";

const guard = createRequestGuard();
const first = guard.next();
const second = guard.next();
assert.notEqual(first, second);
assert.equal(guard.isCurrent(first), false);
assert.equal(guard.isCurrent(second), true);

const cachedRequest = guard.next();
guard.next();
assert.equal(guard.isCurrent(cachedRequest), false, "navigation must invalidate requests even when the next result is cached");

const loader = createLazyModuleLoader();
let importCount = 0;
let resolveImport;
const pendingImport = new Promise((resolve) => { resolveImport = resolve; });
const firstLoad = loader.load("guide", async () => {
  importCount += 1;
  await pendingImport;
  return { loaded: true };
});
const secondLoad = loader.load("guide", async () => {
  importCount += 1;
  return { loaded: false };
});
assert.strictEqual(firstLoad, secondLoad, "concurrent loads should share one promise");
resolveImport();
assert.deepEqual(await Promise.all([firstLoad, secondLoad]), [{ loaded: true }, { loaded: true }]);
assert.equal(importCount, 1);

let failed = true;
const retryImporter = async () => {
  if (failed) {
    failed = false;
    throw new Error("temporary failure");
  }
  return "retried";
};
await assert.rejects(() => loader.load("retryable", retryImporter));
assert.equal(await loader.load("retryable", retryImporter), "retried", "failed lazy loads should be retryable");

let assistantFactoryCount = 0;
const assistantLoader = createCommentAssistantLoader({
  importer: async () => ({
    createCommentAssistant: (dependencies) => {
      assistantFactoryCount += 1;
      return { dependencies };
    }
  })
});
const assistantDependencies = { isAdmin: true, basePath: "/youcity" };
const assistantFirstLoad = assistantLoader({ enabled: true, ...assistantDependencies });
const assistantSecondLoad = assistantLoader({ enabled: true, ...assistantDependencies });
assert.strictEqual(assistantFirstLoad, assistantSecondLoad, "assistant loads should share one promise");
assert.deepEqual(await assistantFirstLoad, { dependencies: assistantDependencies });
assert.equal(assistantFactoryCount, 1, "assistant factory should run once for concurrent loads");

const weatherRequests = new Map();
const weatherReady = [];
const weatherController = createWeatherController({
  fetchImpl: (endpoint) => new Promise((resolve) => weatherRequests.set(String(endpoint), resolve)),
  getEndpoints: (latitude, longitude) => ({ primary: `${latitude},${longitude}` }),
  render: { loading() {}, error() {}, ready: (value) => weatherReady.push(value.current.temperature_2m) }
});
const oldWeather = weatherController.update({ coordinates: [1, 2] });
const newWeather = weatherController.update({ coordinates: [3, 4] });
weatherRequests.get("1,2")({ ok: true, json: async () => ({ current: { temperature_2m: 10 } }) });
await oldWeather;
assert.deepEqual(weatherReady, [], "obsolete weather responses must not update the interface");
weatherRequests.get("3,4")({ ok: true, json: async () => ({ current: { temperature_2m: 20 } }) });
await newWeather;
assert.deepEqual(weatherReady, [20]);

console.log("Async guard tests passed.");
