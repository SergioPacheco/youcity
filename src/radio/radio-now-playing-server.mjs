import { parseIcyMetadata, normalizeNowPlaying } from "./radio-now-playing.mjs";
import { findCatalogStation as findGeneratedCatalogStation } from "./radio-catalog-index.mjs";

const DEFAULT_API_MIRRORS = [
  "https://all.api.radio-browser.info",
  "https://de1.api.radio-browser.info",
  "https://nl1.api.radio-browser.info"
];
const MAX_BYTES = 256 * 1024;
const REQUEST_TIMEOUT = 7_000;

function text(value) {
  return String(value || "").trim();
}

export function parseStationRef(value) {
  const stationRef = text(value);
  if (/^catalog:[a-z0-9-]+:\d+$/.test(stationRef)) {
    return { stationRef, source: "catalog", sourceId: stationRef.slice("catalog:".length) };
  }
  if (/^radio-browser:[a-z0-9-]{8,64}$/i.test(stationRef)) {
    return { stationRef, source: "radio-browser", sourceId: stationRef.slice("radio-browser:".length) };
  }
  return null;
}

function validUrl(value) {
  try {
    const url = new URL(text(value));
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function isHlsUrl(value) {
  try {
    return new URL(value).pathname.toLowerCase().endsWith(".m3u8");
  } catch {
    return false;
  }
}

async function fetchJson(endpoint, signal, fetchImpl) {
  const response = await fetchImpl(endpoint, {
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

async function resolveRadioBrowserStation(uuid, signal, { fetchImpl, apiMirrors }) {
  for (const mirror of apiMirrors) {
    try {
      const endpoint = new URL(`/json/stations/byuuid/${encodeURIComponent(uuid)}`, mirror);
      const stations = await fetchJson(endpoint, signal, fetchImpl);
      const station = stations.find((item) => item?.stationuuid === uuid && (item.url_resolved || item.url));
      if (station) {
        return {
          ...station,
          stationRef: `radio-browser:${uuid}`,
          url: text(station.url_resolved || station.url)
        };
      }
    } catch {
      // Try the next official mirror before returning not found.
    }
  }
  return null;
}

export async function resolveStationFromRef(stationRef, {
  signal,
  fetchImpl = globalThis.fetch?.bind(globalThis),
  findCatalogStation = findGeneratedCatalogStation,
  apiMirrors = DEFAULT_API_MIRRORS
} = {}) {
  const parsed = parseStationRef(stationRef);
  if (!parsed || typeof fetchImpl !== "function") return null;
  if (parsed.source === "catalog") return findCatalogStation(parsed.stationRef) || null;
  return resolveRadioBrowserStation(parsed.sourceId, signal, { fetchImpl, apiMirrors });
}

function appendBytes(first, second) {
  const result = new Uint8Array(first.length + second.length);
  result.set(first);
  result.set(second, first.length);
  return result;
}

export async function readIcyMetadata(response) {
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

export async function inspectStation(station, {
  signal,
  fetchImpl = globalThis.fetch?.bind(globalThis),
  timeoutMs = REQUEST_TIMEOUT
} = {}) {
  const streamUrl = validUrl(station?.url_resolved || station?.url);
  if (!streamUrl) return { nowPlaying: null, reason: "STREAM_UNAVAILABLE" };
  if (isHlsUrl(streamUrl)) return { nowPlaying: null, reason: "UNSUPPORTED_HLS_METADATA" };
  if (signal?.aborted) return { nowPlaying: null, reason: "METADATA_TIMEOUT" };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(streamUrl, {
      signal: controller.signal,
      cache: "no-store",
      redirect: "follow",
      headers: {
        accept: "audio/*",
        "icy-metadata": "1",
        "user-agent": "YouCity/1.0 (https://youcity.app)"
      }
    });
    if (!response.ok) return { nowPlaying: null, reason: "STREAM_UNAVAILABLE" };
    const nowPlaying = normalizeNowPlaying(await readIcyMetadata(response));
    return { nowPlaying, reason: nowPlaying ? null : "NO_METADATA" };
  } catch (error) {
    if (error?.name === "AbortError") return { nowPlaying: null, reason: "METADATA_TIMEOUT" };
    return { nowPlaying: null, reason: "STREAM_UNAVAILABLE" };
  } finally {
    clearTimeout(timeout);
  }
}

export async function handleNowPlayingRequest({
  stationRef,
  signal,
  fetchImpl = globalThis.fetch?.bind(globalThis),
  findCatalogStation = findGeneratedCatalogStation,
  apiMirrors = DEFAULT_API_MIRRORS
} = {}) {
  const parsed = parseStationRef(stationRef);
  if (!parsed) return { status: 400, body: { error: "INVALID_STATION_REF", message: "A valid station reference is required." } };
  const station = await resolveStationFromRef(stationRef, { signal, fetchImpl, findCatalogStation, apiMirrors });
  if (!station) return { status: 404, body: { error: "STATION_NOT_FOUND", message: "The requested station was not found." } };
  const inspected = await inspectStation(station, { signal, fetchImpl });
  return {
    status: 200,
    body: {
      station: { stationRef: parsed.stationRef, stationuuid: text(station.stationuuid), name: text(station.name) },
      nowPlaying: inspected.nowPlaying,
      reason: inspected.reason
    }
  };
}
