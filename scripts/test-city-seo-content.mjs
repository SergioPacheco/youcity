#!/usr/bin/env node

import assert from "node:assert/strict";
import {
  canonicalCitySlug,
  editorialContentChanged,
  isTrustedEditorialUrl,
  sentenceAwareExcerpt,
  validateCache,
  validateCompleteEntry
} from "./city-seo-content.mjs";

const validEntry = {
  status: "complete",
  city: "Granada",
  country: "Spain",
  summary: {
    title: "Granada",
    description: "city in Andalusia, Spain",
    extract: "Granada is a city in southern Spain and the capital of the province of Granada. It is known for its history, architecture, and cultural landmarks. The city sits at the foot of the Sierra Nevada mountains.",
    url: "https://en.wikipedia.org/wiki/Granada"
  },
  places: [
    { name: "Alhambra", description: "Palace and fortress complex in Granada.", url: "https://en.wikipedia.org/wiki/Alhambra" },
    { name: "Granada Cathedral", description: "Roman Catholic cathedral in Granada.", url: "https://en.wikipedia.org/wiki/Granada_Cathedral" }
  ],
  source: { name: "Wikipedia", url: "https://en.wikipedia.org/wiki/Granada" },
  updatedAt: "2026-09-19"
};

function runUnitTests() {
  assert.equal(canonicalCitySlug("São Paulo"), "sao-paulo");
  assert.deepEqual(validateCompleteEntry(validEntry, { name: "Granada", country: "Spain" }), []);
  assert.equal(isTrustedEditorialUrl("https://en.wikipedia.org/wiki/Granada"), true);
  assert.equal(isTrustedEditorialUrl("https://example.com/granada"), false);

  const duplicate = structuredClone(validEntry);
  duplicate.places[1].name = duplicate.places[0].name;
  assert.match(validateCompleteEntry(duplicate, { name: "Granada", country: "Spain" }).join("\n"), /unique/i);

  const tooMany = structuredClone(validEntry);
  tooMany.places.push(
    { name: "Sacromonte", description: "Historic hillside neighborhood in Granada.", url: "https://en.wikipedia.org/wiki/Sacromonte" },
    { name: "Generalife", description: "Historic palace and gardens beside the Alhambra.", url: "https://en.wikipedia.org/wiki/Generalife" },
    { name: "Granada Market", description: "Historic market and commercial place in Granada.", url: "https://en.wikipedia.org/wiki/Granada" },
    { name: "Granada Park", description: "Public park and green space in Granada.", url: "https://en.wikipedia.org/wiki/Granada" }
  );
  assert.match(validateCompleteEntry(tooMany, { name: "Granada", country: "Spain" }).join("\n"), /more than 5|maximum|five/i);

  const longText = "First sentence about Granada. Granada is a historic city in southern Spain known for its palaces, cathedral, neighborhoods, and mountain setting. Third sentence adds more context about the region and its history.";
  const excerpt = sentenceAwareExcerpt(longText, 80, 160);
  assert.ok(excerpt.length <= 160);
  assert.match(excerpt, /[.!?]$/);
  assert.ok(!excerpt.endsWith("abruptly"));

  const catalog = [{ name: "Granada", country: "Spain" }, { name: "São Paulo", country: "Brazil" }];
  const cache = { granada: validEntry, "sao-paulo": { status: "incomplete", reason: "REQUEST_FAILED" } };
  assert.deepEqual(validateCache(cache, catalog), []);
  assert.equal(editorialContentChanged(validEntry, { ...validEntry, updatedAt: "2026-09-20" }), false);
  assert.equal(editorialContentChanged(validEntry, { ...validEntry, summary: { ...validEntry.summary, title: "Granada city" } }), true);
}

if (process.argv.includes("--unit")) {
  runUnitTests();
  console.log("City SEO content unit tests passed.");
}
