import { normalizeNowPlaying, parseIcyMetadata } from "../../src/radio/radio-now-playing.mjs";

// Never cache the track itself: a later user request must inspect the live stream again.
const CACHE_TTL = 0;
const RATE_WINDOW = 10 * 60 * 1000;
const MAX_REQUESTS = 30;
const MAX_BYTES = 256 * 1024;
const REQUEST_TIMEOUT = 7_000;
const API_MIRRORS = [
  "https://all.api.radio-browser.info",
  "https://de1.api.radio-browser.info",
  "https://nl1.api.radio-browser.info"
];
const cache = new Map();
const rateLimits = new Map();

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
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

function validUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return (url.protocol === "https:" || url.protocol === "http:") ? url.toString() : null;
  } catch {
    return null;
  }
}

function validStationUuid(value) {
  const uuid = String(value || "").trim();
  return /^[a-z0-9-]{8,64}$/i.test(uuid) ? uuid : null;
}

async function fetchJson(endpoint, signal) {
  const response = await fetch(endpoint, {
    signal,
    headers: {
      accept: "application/json",
      "user-agent": "YouCity/1.0 (https://youcity.app)"
    }
  });
  if (!response.ok) throw new Error(`Radio Browser request failed (${response.status}).`);
  const payload = await response.json();
  return Array.isArray(payload) ? payload : [];
}

async function resolveStation({ stationuuid, url }, signal) {
  for (const mirror of API_MIRRORS) {
    try {
      const endpoint = stationuuid
        ? new URL(`/json/stations/byuuid/${encodeURIComponent(stationuuid)}`, mirror)
        : new URL("/json/stations/byurl", mirror);
      if (!stationuuid) endpoint.searchParams.set("url", url);
      const stations = await fetchJson(endpoint, signal);
      const station = stations.find((item) => {
        const stream = String(item?.url_resolved || item?.url || "").trim();
        return (!stationuuid || item?.stationuuid === stationuuid) && (!url || stream === url || item?.url === url);
      }) || stations[0];
      if (station?.stationuuid && station?.name && (station.url_resolved || station.url)) return station;
    } catch {
      // Try the next official mirror before returning an unavailable response.
    }
  }
  return null;
}

function appendBytes(first, second) {
  const result = new Uint8Array(first.length + second.length);
  result.set(first);
  result.set(second, first.length);
  return result;
}

async function readIcyMetadata(response) {
  const metaint = Number(response.headers.get("icy-metaint"));
  if (!Number.isInteger(metaint) || metaint <= 0 || metaint > MAX_BYTES || !response.body?.getReader) {
    if (response.body?.cancel) await response.body.cancel().catch(() => {});
    return null;
  }
  const reader = response.body.getReader();
  let buffer = new Uint8Array(0);
  let bytesRead = 0;
  async function ensure(length) {
    while (buffer.length < length) {
      const chunk = await reader.read();
      if (chunk.done) return false;
      const value = chunk.value instanceof Uint8Array ? chunk.value : new Uint8Array(chunk.value || []);
      bytesRead += value.length;
      if (bytesRead > MAX_BYTES) throw new Error("ICY metadata limit exceeded.");
      buffer = appendBytes(buffer, value);
    }
    return true;
  }
  function take(length) {
    const value = buffer.slice(0, length);
    buffer = buffer.slice(length);
    return value;
  }
  try {
    if (!await ensure(metaint + 1)) return null;
    take(metaint);
    const metadataLength = take(1)[0] * 16;
    if (!metadataLength || !await ensure(metadataLength)) return null;
    return parseIcyMetadata(take(metadataLength));
  } finally {
    await reader.cancel().catch(() => {});
  }
}

async function inspectStation(station) {
  const streamUrl = validUrl(station.url_resolved || station.url);
  if (!streamUrl) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    const response = await fetch(streamUrl, {
      signal: controller.signal,
      cache: "no-store",
      redirect: "follow",
      headers: {
        accept: "audio/*",
        "icy-metadata": "1",
        "user-agent": "YouCity/1.0 (https://youcity.app)"
      }
    });
    if (!response.ok) return null;
    return await readIcyMetadata(response);
  } finally {
    clearTimeout(timeout);
  }
}

export async function onRequestGet({ request }) {
  if (isRateLimited(request)) return json({ error: "RATE_LIMITED", message: "Too many metadata requests. Try again later." }, 429, { "retry-after": "600" });
  const requestUrl = new URL(request.url);
  const stationuuid = validStationUuid(requestUrl.searchParams.get("stationuuid"));
  const url = validUrl(requestUrl.searchParams.get("url"));
  if (!stationuuid && !url) return json({ error: "INVALID_STATION", message: "A station UUID or valid stream URL is required." }, 400);
  const cacheKey = stationuuid || url;
  const cached = cache.get(cacheKey);
  if (CACHE_TTL > 0 && cached && cached.expiresAt > Date.now()) return json(cached.value);

  const resolveController = new AbortController();
  const resolveTimeout = setTimeout(() => resolveController.abort(), REQUEST_TIMEOUT);
  let station;
  try {
    station = await resolveStation({ stationuuid, url }, resolveController.signal);
  } finally {
    clearTimeout(resolveTimeout);
  }
  if (!station) {
    const value = { nowPlaying: null, reason: "STATION_NOT_INDEXED" };
    if (CACHE_TTL > 0) cache.set(cacheKey, { value, expiresAt: Date.now() + CACHE_TTL });
    return json(value);
  }

  let nowPlaying = null;
  try { nowPlaying = normalizeNowPlaying(await inspectStation(station)); } catch {
    nowPlaying = null;
  }
  const value = {
    station: { stationuuid: station.stationuuid, name: String(station.name).trim() },
    nowPlaying,
    reason: nowPlaying ? null : "NO_METADATA"
  };
  if (CACHE_TTL > 0) cache.set(cacheKey, { value, expiresAt: Date.now() + CACHE_TTL });
  return json(value);
}
