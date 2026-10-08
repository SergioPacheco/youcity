#!/usr/bin/env node

// Editorial validator for data/street-food.json.
//
// Usage: node scripts/validate-street-food.mjs [--catalog data/catalog.json] [--street data/street-food.json]
// Exits non-zero and prints every integrity error found.
//
// Integrity rules (see .superpowers/sdd/YOUCITY_STREET_MVP_IMPLEMENTACAO.md):
// - every city slug must match a real catalog city (slugified name);
// - dishIds/placeIds must reference items of the same city;
// - status=published requires name, useful description, valid HTTPS source
//   and verifiedAt; pins additionally require verified coordinates;
// - a city-level video must not claim a placeId without evidence;
// - no secrets, no invented coordinates, no price/schedule claims.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  STREET_FOOD_PLACE_KINDS,
  STREET_FOOD_SCHEMA_VERSION,
  STREET_FOOD_STATUSES,
  hasVerifiedCoordinates
} from "../src/features/street-food/street-food-repository.mjs";

const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function slugify(value) {
  // Mirror of slugify() in src/core/url.mjs and scripts/build-static.js.
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isHttpsUrl(value) {
  try {
    return new URL(String(value)).protocol === "https:";
  } catch {
    return false;
  }
}

function validateSource(source, label, errors) {
  if (!source || typeof source !== "object") {
    errors.push(`${label}: missing source object`);
    return;
  }
  if (!isHttpsUrl(source.url)) errors.push(`${label}: source.url must be a valid https URL`);
  if (!DATE_PATTERN.test(String(source.checkedAt || ""))) {
    errors.push(`${label}: source.checkedAt must be YYYY-MM-DD`);
  }
}

export function validateStreetFood(catalog, streetFood) {
  const errors = [];
  if (!streetFood || typeof streetFood !== "object") return ["street-food catalog must be an object"];
  if (streetFood.schemaVersion !== STREET_FOOD_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${STREET_FOOD_SCHEMA_VERSION}`);
  }
  if (!Array.isArray(streetFood.cities)) return [...errors, "cities must be an array"];

  const catalogSlugs = new Set((Array.isArray(catalog) ? catalog : []).map((city) => slugify(city?.name)));
  const seenSlugs = new Set();

  for (const entry of streetFood.cities) {
    const where = `city ${JSON.stringify(entry?.slug)}`;
    if (!entry || typeof entry !== "object") {
      errors.push("city entry must be an object");
      continue;
    }
    const allowedCityKeys = new Set(["slug", "note", "dishes", "places", "videos"]);
    for (const key of Object.keys(entry)) {
      if (!allowedCityKeys.has(key)) errors.push(`${where}: unknown key ${JSON.stringify(key)}`);
    }
    if (!entry.slug || typeof entry.slug !== "string") {
      errors.push("city entry requires a slug string");
      continue;
    }
    if (seenSlugs.has(entry.slug)) errors.push(`${where}: duplicate city slug`);
    seenSlugs.add(entry.slug);
    if (!catalogSlugs.has(entry.slug)) {
      errors.push(`${where}: slug does not match any catalog city (check data/catalog.json)`);
    }
    for (const collection of ["dishes", "places", "videos"]) {
      if (!Array.isArray(entry[collection])) errors.push(`${where}: ${collection} must be an array`);
    }
    if (!Array.isArray(entry.dishes) || !Array.isArray(entry.places) || !Array.isArray(entry.videos)) {
      continue;
    }

    const dishIds = new Set();
    for (const dish of entry.dishes) {
      const label = `${where} dish ${JSON.stringify(dish?.id)}`;
      if (!dish || typeof dish !== "object" || !dish.id || typeof dish.id !== "string") {
        errors.push(`${where}: dish requires a string id`);
        continue;
      }
      if (dishIds.has(dish.id)) errors.push(`${label}: duplicate dish id`);
      dishIds.add(dish.id);
      if (!STREET_FOOD_STATUSES.has(dish.status)) errors.push(`${label}: status must be published|draft`);
      if (dish.status !== "published") continue;
      if (!dish.name || !String(dish.description || "").trim()) {
        errors.push(`${label}: published dish requires name and description`);
      }
      if (dish.category !== undefined && typeof dish.category !== "string") {
        errors.push(`${label}: category must be a string`);
      }
      if (!Array.isArray(dish.sources) || dish.sources.length === 0) {
        errors.push(`${label}: published dish requires at least one source`);
      } else dish.sources.forEach((source, index) => validateSource(source, `${label} source[${index}]`, errors));
      if (!DATE_PATTERN.test(String(dish.verifiedAt || ""))) {
        errors.push(`${label}: published dish requires verifiedAt YYYY-MM-DD`);
      }
      if (dish.dietaryClaims !== undefined && !Array.isArray(dish.dietaryClaims)) {
        errors.push(`${label}: dietaryClaims must be an array`);
      }
    }

    const placeIds = new Set();
    for (const place of entry.places) {
      const label = `${where} place ${JSON.stringify(place?.id)}`;
      if (!place || typeof place !== "object" || !place.id || typeof place.id !== "string") {
        errors.push(`${where}: place requires a string id`);
        continue;
      }
      if (placeIds.has(place.id)) errors.push(`${label}: duplicate place id`);
      placeIds.add(place.id);
      if (!STREET_FOOD_STATUSES.has(place.status)) errors.push(`${label}: status must be published|draft`);
      for (const dishId of Array.isArray(place.dishIds) ? place.dishIds : []) {
        if (!dishIds.has(dishId)) errors.push(`${label}: unknown dishId ${JSON.stringify(dishId)}`);
      }
      if (place.status !== "published") continue;
      if (!place.name) errors.push(`${label}: published place requires name`);
      if (!STREET_FOOD_PLACE_KINDS.has(place.kind)) {
        errors.push(`${label}: published place kind must be one of ${[...STREET_FOOD_PLACE_KINDS].join(",")}`);
      }
      if (place.sourceUrl !== undefined && place.sourceUrl !== null && !isHttpsUrl(place.sourceUrl)) {
        errors.push(`${label}: sourceUrl must be a valid https URL`);
      }
      if (!DATE_PATTERN.test(String(place.verifiedAt || ""))) {
        errors.push(`${label}: published place requires verifiedAt YYYY-MM-DD`);
      }
      if (place.coordinates !== undefined && place.coordinates !== null && !hasVerifiedCoordinates(place)) {
        errors.push(`${label}: coordinates must be finite lat [-90,90] / lng [-180,180]`);
      }
    }

    for (const video of entry.videos) {
      const label = `${where} video ${JSON.stringify(video?.id)}`;
      if (!video || typeof video !== "object") {
        errors.push(`${where}: video must be an object`);
        continue;
      }
      if (!YOUTUBE_ID_PATTERN.test(video.id || "")) errors.push(`${label}: invalid YouTube video id`);
      if (!STREET_FOOD_STATUSES.has(video.status)) errors.push(`${label}: status must be published|draft`);
      for (const dishId of Array.isArray(video.dishIds) ? video.dishIds : []) {
        if (!dishIds.has(dishId)) errors.push(`${label}: unknown dishId ${JSON.stringify(dishId)}`);
      }
      for (const placeId of Array.isArray(video.placeIds) ? video.placeIds : []) {
        if (!placeIds.has(placeId)) {
          errors.push(`${label}: unknown placeId ${JSON.stringify(placeId)} (never link a city-wide video to a vendor without evidence)`);
        }
      }
      if (video.status !== "published") continue;
      if (!DATE_PATTERN.test(String(video.verifiedAt || ""))) {
        errors.push(`${label}: published video requires verifiedAt YYYY-MM-DD`);
      }
      if (video.startSeconds !== undefined && (!Number.isFinite(Number(video.startSeconds)) || Number(video.startSeconds) < 0)) {
        errors.push(`${label}: startSeconds must be a non-negative number`);
      }
    }
  }
  return errors;
}

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const invokedAsScript = process.argv[1] ? resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname) : false;
if (invokedAsScript) {
  const root = resolve(new URL(".", import.meta.url).pathname, "..");
  const catalog = JSON.parse(readFileSync(resolve(root, argValue("--catalog", "data/catalog.json")), "utf8"));
  const streetFood = JSON.parse(readFileSync(resolve(root, argValue("--street", "data/street-food.json")), "utf8"));
  const errors = validateStreetFood(catalog, streetFood);
  if (errors.length) {
    console.error(`Street food validation failed (${errors.length} error(s)):`);
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log("Street food catalog is valid.");
}
