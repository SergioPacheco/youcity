#!/usr/bin/env node

const assert = require("node:assert/strict");
const { resolve } = require("node:path");
const { readFileSync } = require("node:fs");
const {
  cityModes,
  citySeoDescription,
  citySeoTitle,
  relatedCities,
  renderDestinationContent
} = require("./build-static");
const { loadCatalog } = require("./load-catalog");

const ROOT_DIR = resolve(__dirname, "..");
const catalog = loadCatalog(ROOT_DIR);
const seoContent = JSON.parse(readFileSync(resolve(ROOT_DIR, "data/city-seo-content.json"), "utf8"));
const granada = catalog.find((city) => city.name === "Granada" && city.country === "Spain");
const london = catalog.find((city) => city.name === "London" && city.country === "UK");
const malibu = catalog.find((city) => city.name === "Malibu" && city.country === "USA");
const sampleCities = ["London", "Sao Paulo", "Medellín", "Nairobi", "Perth", "Malibu"].map((name) => catalog.find((city) => city.name === name));

assert.ok(granada, "Granada should exist in the catalog");
assert.ok(london, "London should exist in the catalog");
assert.ok(malibu, "Malibu should exist in the catalog");
assert.ok(sampleCities.every(Boolean), "generic SEO sample cities should exist in the catalog");

assert.deepEqual(cityModes(granada), ["Walk", "Drive", "Drone"]);
assert.equal(citySeoTitle(granada), "Granada Virtual Tour — Walk, Drive & Drone | YouCity");
assert.equal(citySeoTitle(london), "London Virtual Tour — Walk, Drive & Drone | YouCity");
assert.equal(citySeoTitle(malibu), "Malibu Beach Walk & Virtual Tour | YouCity");
assert.equal(
  citySeoDescription(granada),
  "Explore Granada, Spain through immersive walking, driving and drone tours. Experience the city virtually with local radio on YouCity."
);
assert.equal(
  citySeoDescription(malibu),
  "Explore Malibu, United States through immersive beach walks, walking and driving tours. Experience the city virtually with local radio on YouCity."
);

const granadaContent = renderDestinationContent(granada, catalog);
assert.match(granadaContent, /<section class="destination-content">/);
assert.match(granadaContent, /<h2>Explore Granada virtually<\/h2>/);
assert.match(granadaContent, /Walk through Granada/);
assert.match(granadaContent, /Drive through Granada/);
assert.match(granadaContent, /See Granada from above/);
assert.match(granadaContent, /Onda Cero Granada/);
assert.match(granadaContent, /esRadio Granada/);
assert.doesNotMatch(granadaContent, /https?:\/\//);
assert.equal((granadaContent.match(/<li>[^<]+<\/li>/g) || []).filter((item) => item.includes("Radio") || item.includes("Onda") || item.includes("Cadena") || item.includes("Canal")).length, 3);

const syntheticEditorial = {
  status: "complete",
  city: "Granada",
  country: "Spain",
  summary: {
    title: "Granada",
    description: "city in Andalusia, Spain",
    extract: "Granada is a historic city in southern Spain known for its palaces, cathedral, neighborhoods, and mountain setting. Its cultural landscape reflects centuries of interaction between different traditions.",
    url: "https://en.wikipedia.org/wiki/Granada"
  },
  places: [
    { name: "Alhambra", description: "Palace and fortress complex in Granada.", url: "https://en.wikipedia.org/wiki/Alhambra" },
    { name: "Granada Cathedral", description: "Cathedral <script>alert(1)</script> in Granada.", url: "https://en.wikipedia.org/wiki/Granada_Cathedral" }
  ],
  source: { name: "Wikipedia", url: "https://en.wikipedia.org/wiki/Granada" },
  updatedAt: "2026-09-19"
};
const editorialContent = renderDestinationContent(granada, catalog, syntheticEditorial);
assert.match(editorialContent, /class="destination-about"/);
assert.match(editorialContent, /class="destination-experiences"/);
assert.match(editorialContent, /class="destination-places"/);
assert.match(editorialContent, /About Granada/);
assert.match(editorialContent, /Places to discover in Granada/);
assert.match(editorialContent, /Source: Wikipedia/);
assert.match(editorialContent, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
assert.match(editorialContent, /<a href="https:\/\/en\.wikipedia\.org\/wiki\/Alhambra"[^>]*>Alhambra<\/a>/);
assert.doesNotMatch(editorialContent, /example\.com/);

const fallbackEditorial = renderDestinationContent(granada, catalog, { status: "incomplete", reason: "NOT_ENOUGH_PLACES" });
assert.doesNotMatch(fallbackEditorial, /destination-about|destination-places/);
for (const city of sampleCities) {
  const cached = seoContent[city.name === "Sao Paulo" ? "sao-paulo" : city.name.toLowerCase().replaceAll(" ", "-")];
  if (cached?.status === "complete") {
    const content = renderDestinationContent(city, catalog, cached);
    assert.match(content, /destination-about/);
    assert.match(content, /destination-places/);
  }
}

const related = relatedCities(granada, catalog);
assert.ok(related.length <= 8);
assert.ok(related.every((city) => city.country === granada.country));
assert.ok(!related.some((city) => city.name === granada.name && city.country === granada.country));

console.log("Static SEO tests passed: titles, descriptions, destination content, and related cities.");
