import {
  buildRadioBrowserSearchEndpoint,
  normalizeRadioBrowserSearchStations
} from "../../src/radio/radio-browser.mjs";

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
  const countryCode = textParam(requestUrl.searchParams.get("countryCode"), 3);
  const latitude = coordinate(requestUrl.searchParams.get("latitude"), -90, 90);
  const longitude = coordinate(requestUrl.searchParams.get("longitude"), -180, 180);
  if (!city || !country || latitude === null || longitude === null) {
    return json({ error: "INVALID_CITY", message: "A valid city, country, and coordinates are required." }, 400);
  }

  const cacheKey = `${city.toLowerCase()}|${country.toLowerCase()}|${latitude.toFixed(4)}|${longitude.toFixed(4)}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return json(cached.value);

  const payloads = [];
  let receivedResponse = false;
  for (const mirror of API_MIRRORS) {
    const endpoints = [
      buildRadioBrowserSearchEndpoint(mirror, { city, country, countryCode }),
      buildRadioBrowserSearchEndpoint(mirror, { city, country, countryCode, includeName: true })
    ];
    for (const endpoint of endpoints) {
      try {
        payloads.push(await fetchStations(endpoint));
        receivedResponse = true;
      } catch {
        // Try the next candidate endpoint and official mirror.
      }
    }
    if (receivedResponse) break;
  }
  if (!receivedResponse) return json({ error: "RADIO_BROWSER_UNAVAILABLE", message: "Local radio search is temporarily unavailable." }, 502);

  const stations = normalizeRadioBrowserSearchStations(payloads.flat(), { latitude, longitude }, { limit: MAX_RESULTS })
    .map(({ distance, votes, ...station }) => station);
  const value = { city, stations };
  cache.set(cacheKey, { value, expiresAt: Date.now() + CACHE_TTL });
  return json(value);
}
