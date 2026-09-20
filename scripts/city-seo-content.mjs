import { slugify } from "../src/core/url.mjs";

export const MIN_EXTRACT_LENGTH = 120;
export const MIN_PLACE_COUNT = 2;
export const MAX_PLACE_COUNT = 5;
export const MIN_PLACE_DESCRIPTION_LENGTH = 15;
export const MAX_PLACE_DESCRIPTION_LENGTH = 180;
export const TRUSTED_EDITORIAL_HOSTS = new Set(["wikipedia.org", "wikidata.org"]);
export const INCOMPLETE_REASONS = new Set([
  "NO_VALID_SUMMARY",
  "NOT_ENOUGH_PLACES",
  "AMBIGUOUS_CITY",
  "REQUEST_FAILED"
]);

export function canonicalCitySlug(value) {
  return slugify(value);
}

export function isTrustedEditorialUrl(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const trustedHost = [...TRUSTED_EDITORIAL_HOSTS].some((root) => host === root || host.endsWith(`.${root}`));
    return url.protocol === "https:" && trustedHost;
  } catch {
    return false;
  }
}

function normalizedText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function trimToWordBoundary(value) {
  const trimmed = String(value).trimEnd();
  const boundary = trimmed.lastIndexOf(" ");
  return boundary > 0 ? trimmed.slice(0, boundary).trimEnd() : trimmed;
}

export function sentenceAwareExcerpt(value, minLength = 250, maxLength = 700) {
  const text = normalizedText(value);
  if (text.length <= maxLength) return text;

  const boundary = text.slice(0, maxLength + 1);
  const sentenceEnds = [...boundary.matchAll(/[.!?](?=\s|$)/g)].map((match) => match.index + 1);
  const preferred = sentenceEnds.filter((end) => end >= minLength).at(-1);
  if (preferred) return text.slice(0, preferred).trim();
  return trimToWordBoundary(boundary);
}

function comparable(value) {
  return normalizedText(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function validateCompleteEntry(entry, city) {
  const errors = [];
  if (!entry || entry.status !== "complete") errors.push("status must be complete");
  if (entry?.city !== city?.name) errors.push("city does not match catalog");
  if (entry?.country !== city?.country) errors.push("country does not match catalog");

  const summary = entry?.summary;
  if (!summary || typeof summary !== "object") {
    errors.push("summary is required");
  } else {
    if (!normalizedText(summary.title)) errors.push("summary title is required");
    if (!normalizedText(summary.extract) || summary.extract.trim().length < MIN_EXTRACT_LENGTH) {
      errors.push(`summary extract must be at least ${MIN_EXTRACT_LENGTH} characters`);
    }
    if (!isTrustedEditorialUrl(summary.url)) errors.push("summary URL is not trusted");
  }

  if (!isTrustedEditorialUrl(entry?.source?.url)) errors.push("source URL is not trusted");
  if (entry?.source?.name !== "Wikipedia") errors.push("source name must be Wikipedia");

  if (!Array.isArray(entry?.places)) {
    errors.push("places must be an array");
  } else {
    if (entry.places.length < MIN_PLACE_COUNT) errors.push(`places must contain at least ${MIN_PLACE_COUNT} entries`);
    if (entry.places.length > MAX_PLACE_COUNT) errors.push(`places cannot contain more than ${MAX_PLACE_COUNT} entries`);
    const names = new Set();
    entry.places.forEach((place, index) => {
      const name = comparable(place?.name);
      if (!name) errors.push(`place ${index + 1} has no name`);
      else if (names.has(name)) errors.push(`place names must be unique: ${place.name}`);
      names.add(name);
      const descriptionLength = normalizedText(place?.description).length;
      if (descriptionLength < MIN_PLACE_DESCRIPTION_LENGTH || descriptionLength > MAX_PLACE_DESCRIPTION_LENGTH) {
        errors.push(`place ${index + 1} description must be ${MIN_PLACE_DESCRIPTION_LENGTH}-${MAX_PLACE_DESCRIPTION_LENGTH} characters`);
      }
      if (comparable(place?.description) === "point of interest nearby") errors.push(`place ${index + 1} description must contain factual source text`);
      if (place?.url && !isTrustedEditorialUrl(place.url)) errors.push(`place ${index + 1} URL is not trusted`);
    });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(entry?.updatedAt || ""))) errors.push("updatedAt must be an ISO date");
  return errors;
}

export function validateCache(cache, catalog) {
  const errors = [];
  if (!cache || typeof cache !== "object" || Array.isArray(cache)) return ["cache must be an object"];
  const citiesBySlug = new Map(catalog.map((city) => [canonicalCitySlug(city.name), city]));
  for (const key of Object.keys(cache)) {
    if (!citiesBySlug.has(key)) errors.push(`unknown city key: ${key}`);
  }
  for (const [key, city] of citiesBySlug) {
    const entry = cache[key];
    if (!entry) {
      errors.push(`missing city key: ${key}`);
      continue;
    }
    if (entry.status === "complete") {
      errors.push(...validateCompleteEntry(entry, city).map((error) => `${key}: ${error}`));
    } else if (entry.status === "incomplete") {
      if (!INCOMPLETE_REASONS.has(entry.reason)) errors.push(`${key}: invalid incomplete reason`);
    } else {
      errors.push(`${key}: status must be complete or incomplete`);
    }
  }
  return errors;
}

function editorialFields(entry) {
  if (!entry) return null;
  const { updatedAt, ...fields } = entry;
  return fields;
}

export function editorialContentChanged(previous, next) {
  return JSON.stringify(editorialFields(previous)) !== JSON.stringify(editorialFields(next));
}
