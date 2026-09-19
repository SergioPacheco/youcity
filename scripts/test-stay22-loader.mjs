#!/usr/bin/env node

import assert from "node:assert/strict";
import { createStay22Loader } from "../src/features/travel/stay22-loader.mjs";

function createDocument() {
  const appended = [];
  return {
    appended,
    head: { appendChild(script) { appended.push(script); } },
    querySelector(selector) {
      if (selector !== 'script[data-youcity-provider="stay22-external"]') return null;
      return appended.find((script) => script.dataset.youcityProvider === "stay22-external" && script.dataset.youcityStatus !== "error") || null;
    },
    createElement() {
      const listeners = {};
      return {
        dataset: {},
        listeners,
        addEventListener(type, handler) { listeners[type] = handler; }
      };
    }
  };
}

const windowRef = {};
const documentRef = createDocument();
const loader = createStay22Loader({ window: windowRef, document: documentRef });
const first = loader.load();
assert.equal(loader.load(), first, "repeated calls must share one promise");
assert.equal(documentRef.appended.length, 1);
assert.equal(documentRef.appended[0].src, "https://scripts.stay22.com/letmeallez.js");
assert.equal(windowRef.Stay22.params.lmaID, "6aa988f40f63b002f3d1083b");
documentRef.appended[0].listeners.load();
assert.equal(await first, true);
assert.equal(await loader.load(), true, "loaded Stay22 should resolve without another script");
assert.equal(documentRef.appended.length, 1);

const retryDocument = createDocument();
const retryLoader = createStay22Loader({ window: {}, document: retryDocument });
const failed = retryLoader.load();
retryDocument.appended[0].listeners.error();
assert.equal(await failed, false);
const retried = retryLoader.load();
assert.equal(retryDocument.appended.length, 2, "a failed load should be retryable");
retryDocument.appended[1].listeners.load();
assert.equal(await retried, true);

console.log("Stay22 loader tests passed: idempotent loading and retry after failure.");
