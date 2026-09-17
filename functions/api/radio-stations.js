import { distanceKm } from "../../src/radio/radio-browser.mjs";

const CACHE_TTL = 10 * 60 * 1000;
const RATE_WINDOW = 10 * 60 * 1000;
const MAX_REQUESTS = 30;
const MAX_RESULTS = 8;
const cache = new Map();
const rateLimits = new Map();
const API_MIRRORS = [
  "https://all.api.radio-browser.info",
  "https://de1.api.radio-browser.info",
  "https://nl1.api.radio-browser.info"
];

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": status === 200 ? "public, max-age=600, s-maxage=600" : "no-store",
      ...headers
    }
  });
}

function clientKey(request) {
  return request.headers.get("cf-connecting-ip")
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "anonymous";
}

function isRateLimited(request) {
  const key = clientKey(request);
  const now = Date.now();
  const current = rateLimits.get(key) || { startedAt: now, count: 0 };
  if (now - current.startedAt > RATE_WINDOW) {
    rateLimits.set(key, { startedAt: now, count: 1 });
    return false;
  }
  current.count += 1;
  rateLimits.set(key, current);
  return current.count > MAX_REQUESTS;
}

function textParam(value, maxLength) {
  const text = String(value || "").trim();
  return text && text.length <= maxLength ? text : null;
}

function coordinate(value, min, max) {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

function buildEndpoint(mirror, { city, country }) {
  const endpoint = new URL("/json/stations/search", mirror);
  endpoint.searchParams.set("name", city);
  endpoint.searchParams.set("country", country);
  endpoint.searchParams.set("is_https", "true");
  endpoint.searchParams.set("has_geo_info", "true");
  endpoint.searchParams.set("hidebroken", "true");
  endpoint.searchParams.set("order", "votes");
  endpoint.searchParams.set("reverse", "true");
  endpoint.searchParams.set("limit", "25");
  return endpoint;
}

function usableStation(station) {
  const stream = String(station?.url_resolved || station?.url || "").trim();
  return Boolean(
    station?.stationuuid
    && station?.name
    && station?.lastcheckok !== 0
    && Number(station?.hls || 0) === 0
    && /^https:\/\//i.test(stream)
  );
}

function normalizeStations(payload, origin) {
  const source = Array.isArray(payload) ? payload : [];
  const seen = new Set();
  return source.filter(usableStation).map((station) => {
    const url = String(station.url_resolved || station.url).trim();
    return {
      stationuuid: station.stationuuid,
      name: String(station.name).trim(),
      url,
      homepage: String(station.homepage || ""),
      favicon: String(station.favicon || ""),
      country: String(station.country || ""),
      countrycode: String(station.countrycode || ""),
      language: String(station.language || ""),
      tags: String(station.tags || ""),
      codec: String(station.codec || ""),
      bitrate: Number(station.bitrate) || 0,
      source: "radio-browser",
      distance: distanceKm(origin.latitude, origin.longitude, Number(station.geo_lat), Number(station.geo_long)),
      votes: Number(station.votes) || 0
    };
  }).filter((station) => {
    const key = `${station.stationuuid}:${station.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).filter((station) => station.distance <= 150)
    .sort((first, second) => first.distance - second.distance || second.votes - first.votes)
    .slice(0, MAX_RESULTS)
    .map(({ distance, votes, ...station }) => station);
}

async function fetchStations(endpoint) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7_000);
  try {
    const response = await fetch(endpoint, {
      signal: controller.signal,
      headers: {
        accept: "application/json",
        "user-agent": "YouCity/1.0 (https://youcity.app)"
      }
    });
    if (!response.ok) throw new Error(`Radio Browser request failed (${response.status}).`);
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

export async function onRequestGet({ request }) {
  if (isRateLimited(request)) return json({ error: "RATE_LIMITED", message: "Too many radio searches. Try again later." }, 429, { "retry-after": "600" });

  const requestUrl = new URL(request.url);
  const city = textParam(requestUrl.searchParams.get("city"), 80);
  const country = textParam(requestUrl.searchParams.get("country"), 80);
  const latitude = coordinate(requestUrl.searchParams.get("latitude"), -90, 90);
  const longitude = coordinate(requestUrl.searchParams.get("longitude"), -180, 180);
  if (!city || !country || latitude === null || longitude === null) {
    return json({ error: "INVALID_CITY", message: "A valid city, country, and coordinates are required." }, 400);
  }

  const cacheKey = `${city.toLowerCase()}|${country.toLowerCase()}|${latitude.toFixed(4)}|${longitude.toFixed(4)}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return json(cached.value);

  let payload;
  for (const mirror of API_MIRRORS) {
    try {
      payload = await fetchStations(buildEndpoint(mirror, { city, country }));
      break;
    } catch {
      // Try the next official mirror before returning an error.
    }
  }
  if (!payload) return json({ error: "RADIO_BROWSER_UNAVAILABLE", message: "Local radio search is temporarily unavailable." }, 502);

  const value = { city, stations: normalizeStations(payload, { latitude, longitude }) };
  cache.set(cacheKey, { value, expiresAt: Date.now() + CACHE_TTL });
  return json(value);
}
