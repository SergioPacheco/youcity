#!/usr/bin/env node

const assert = require("node:assert/strict");
const { resolve } = require("node:path");
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
const granada = catalog.find((city) => city.name === "Granada" && city.country === "Spain");
const london = catalog.find((city) => city.name === "London" && city.country === "UK");
const malibu = catalog.find((city) => city.name === "Malibu" && city.country === "USA");

assert.ok(granada, "Granada should exist in the catalog");
assert.ok(london, "London should exist in the catalog");
assert.ok(malibu, "Malibu should exist in the catalog");

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

const related = relatedCities(granada, catalog);
assert.ok(related.length <= 8);
assert.ok(related.every((city) => city.country === granada.country));
assert.ok(!related.some((city) => city.name === granada.name && city.country === granada.country));

console.log("Static SEO tests passed: titles, descriptions, destination content, and related cities.");
