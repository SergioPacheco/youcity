const CACHE_TTL = 10 * 60 * 1000;

function normalizedBasePath(basePath = "") {
  const value = String(basePath || "").replace(/\/+$/, "");
  return value === "/" ? "" : value;
}

function cityCoordinates(city) {
  const latitude = Number(city?.coordinates?.[0]);
  const longitude = Number(city?.coordinates?.[1]);
  return {
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null
  };
}

export function distanceKm(firstLatitude, firstLongitude, secondLatitude, secondLongitude) {
  const values = [firstLatitude, firstLongitude, secondLatitude, secondLongitude].map(Number);
  if (values.some((value) => !Number.isFinite(value))) return Number.POSITIVE_INFINITY;
  const [firstLat, firstLon, secondLat, secondLon] = values.map((value) => value * Math.PI / 180);
  const latitudeDelta = secondLat - firstLat;
  const longitudeDelta = secondLon - firstLon;
  const arc = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(firstLat) * Math.cos(secondLat) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(arc), Math.sqrt(1 - arc));
}

export function buildRadioBrowserRequestPath({ basePath = "", city } = {}) {
  const { latitude, longitude } = cityCoordinates(city);
  const params = new URLSearchParams({
    city: String(city?.name || "").trim(),
    country: String(city?.country || "").trim(),
    limit: "8"
  });
  if (latitude !== null) params.set("latitude", latitude.toFixed(4));
  if (longitude !== null) params.set("longitude", longitude.toFixed(4));
  return `${normalizedBasePath(basePath)}/api/radio-stations?${params.toString()}`;
}

function isUsableStation(station) {
  const url = String(station?.url_resolved || station?.url || "").trim();
  return Boolean(
    station?.name
    && station?.lastcheckok !== 0
    && Number(station?.hls || 0) === 0
    && /^https:\/\//i.test(url)
  );
}

export function normalizeRadioBrowserStations(payload, { limit = 8 } = {}) {
  const source = Array.isArray(payload) ? payload : payload?.stations;
  if (!Array.isArray(source)) return [];
  const seen = new Set();
  const stations = [];
  for (const station of source) {
    if (!isUsableStation(station)) continue;
    const url = String(station.url_resolved || station.url).trim();
    const id = String(station.stationuuid || url);
    if (seen.has(id) || seen.has(url)) continue;
    seen.add(id);
    seen.add(url);
    stations.push({
      id,
      stationuuid: String(station.stationuuid || ""),
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
      source: "radio-browser"
    });
    if (stations.length >= limit) break;
  }
  return stations;
}

export function createRadioBrowserClient({
  basePath = "",
  fetchImpl = globalThis.fetch?.bind(globalThis),
  cacheTtl = CACHE_TTL
} = {}) {
  const cache = new Map();
  const pending = new Map();

  function findForCity(city, { signal } = {}) {
    const requestPath = buildRadioBrowserRequestPath({ basePath, city });
    const cached = cache.get(requestPath);
    if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.value);
    if (pending.has(requestPath)) return pending.get(requestPath);
    if (typeof fetchImpl !== "function") return Promise.reject(new Error("RADIO_BROWSER_FETCH_UNAVAILABLE"));

    const request = Promise.resolve(fetchImpl(requestPath, {
      headers: { accept: "application/json" },
      signal
    })).then(async (response) => {
      let payload = {};
      try { payload = await response.json(); } catch { /* handled below */ }
      if (!response.ok) throw new Error(payload.message || `Radio Browser request failed (${response.status}).`);
      const stations = normalizeRadioBrowserStations(payload);
      cache.set(requestPath, { value: stations, expiresAt: Date.now() + cacheTtl });
      return stations;
    }).finally(() => pending.delete(requestPath));
    pending.set(requestPath, request);
    return request;
  }

  return { findForCity };
}
