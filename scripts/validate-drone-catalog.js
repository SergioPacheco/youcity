#!/usr/bin/env node

/** Validates the curated Drone entries in the canonical catalog. */
const { resolve } = require("node:path");
const { loadCatalog } = require("./load-catalog");

const catalog = loadCatalog(resolve(__dirname, ".."));
const failures = [];
const ids = new Map();
let cityCount = 0;

for (const city of catalog) {
  const rides = city.videos?.drone || [];
  if (!rides.length) continue;
  cityCount += 1;
  for (const ride of rides) {
    if (!ride || !/^[A-Za-z0-9_-]{11}$/.test(ride.id || "")) failures.push(`${city.name}: invalid YouTube ID`);
    if (!/^[AB]$/.test(ride.confidence || "")) failures.push(`${city.name}: missing confidence A/B`);
    if (ids.has(ride.id)) failures.push(`${city.name}: duplicate ID already used by ${ids.get(ride.id)}`);
    else ids.set(ride.id, city.name);
  }
}

if (failures.length) {
  console.error(`Drone catalog validation failed with ${failures.length} issue(s):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(`Drone catalog validation passed: ${cityCount} cities, ${ids.size} unique videos.`);
}
