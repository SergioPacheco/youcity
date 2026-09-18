// A current track changes during the session; explicit requests must read fresh metadata.
const CACHE_TTL = 0;

function normalizedBasePath(basePath = "") {
  const value = String(basePath || "").replace(/\/+$/, "");
  return value === "/" ? "" : value;
}

function text(value) {
  return String(value || "").replace(/[\u0000\u0001-\u001f\u007f]/g, "").trim();
}

function splitStreamTitle(value) {
  const streamTitle = text(value);
  if (!streamTitle) return { artist: "", title: "" };
  const separator = streamTitle.indexOf(" - ");
  if (separator < 0) return { artist: "", title: streamTitle };
  return {
    artist: text(streamTitle.slice(0, separator)),
    title: text(streamTitle.slice(separator + 3))
  };
}

export function parseIcyMetadata(bytes) {
  const source = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  const value = new TextDecoder().decode(source).replace(/\u0000/g, "").trim();
  const match = value.match(/StreamTitle\s*=\s*(['"])(.*?)\1\s*;?/i);
  return match ? normalizeNowPlaying({ streamTitle: match[2] }) : null;
}

export function normalizeNowPlaying(payload) {
  const value = payload?.nowPlaying && typeof payload.nowPlaying === "object"
    ? payload.nowPlaying
    : payload;
  if (!value || typeof value !== "object") return null;
  const parsed = splitStreamTitle(value.streamTitle || value.raw || "");
  const artist = text(value.artist) || parsed.artist;
  const title = text(value.title || value.song) || parsed.title;
  if (!artist && !title) return null;
  const display = text(value.display) || [artist, title].filter(Boolean).join(" — ");
  return {
    artist,
    title,
    display,
    source: text(value.source) || "icy"
  };
}

export function buildNowPlayingRequestPath({ basePath = "", station } = {}) {
  const params = new URLSearchParams();
  if (station?.stationuuid) params.set("stationuuid", String(station.stationuuid));
  if (station?.url) params.set("url", String(station.url));
  if (station?.name) params.set("name", String(station.name));
  return `${normalizedBasePath(basePath)}/api/radio-now-playing?${params.toString()}`;
}

export function createNowPlayingClient({
  basePath = "",
  fetchImpl = globalThis.fetch?.bind(globalThis),
  cacheTtl = CACHE_TTL
} = {}) {
  const cache = new Map();
  const pending = new Map();

  function findForStation(station, { signal } = {}) {
    const requestPath = buildNowPlayingRequestPath({ basePath, station });
    const cached = cache.get(requestPath);
    if (cacheTtl > 0 && cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.value);
    if (pending.has(requestPath)) return pending.get(requestPath);
    if (typeof fetchImpl !== "function") return Promise.reject(new Error("RADIO_NOW_PLAYING_FETCH_UNAVAILABLE"));
    const request = Promise.resolve(fetchImpl(requestPath, {
      headers: { accept: "application/json" },
      cache: "no-store",
      signal
    })).then(async (response) => {
      let payload = {};
      try { payload = await response.json(); } catch { /* handled by normalization */ }
      if (!response.ok && response.status !== 404) {
        throw new Error(payload.message || `Now-playing request failed (${response.status}).`);
      }
      const value = normalizeNowPlaying(payload);
      if (cacheTtl > 0) cache.set(requestPath, { value, expiresAt: Date.now() + cacheTtl });
      return value;
    }).finally(() => pending.delete(requestPath));
    pending.set(requestPath, request);
    return request;
  }

  return { findForStation };
}
