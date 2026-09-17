const CACHE_TTL = 10 * 60 * 1000;

function normalizedBasePath(basePath = "") {
  const value = String(basePath || "").replace(/\/+$/, "");
  return value === "/" ? "" : value;
}

export function buildYouTubeSearchRequestPath({ basePath = "", query, regionCode = "" } = {}) {
  const params = new URLSearchParams({ q: String(query || "").trim(), limit: "3" });
  if (regionCode) params.set("regionCode", String(regionCode).toUpperCase());
  return `${normalizedBasePath(basePath)}/api/youtube-search?${params.toString()}`;
}

export function normalizeYouTubeResults(payload, { limit = 3 } = {}) {
  const source = Array.isArray(payload) ? payload : payload?.results;
  if (!Array.isArray(source)) return [];
  const seen = new Set();
  const results = [];
  for (const item of source) {
    const videoId = String(item?.videoId || item?.id?.videoId || "").trim();
    if (!videoId || seen.has(videoId)) continue;
    seen.add(videoId);
    results.push({
      videoId,
      title: String(item.title || item.snippet?.title || "").trim(),
      channel: String(item.channel || item.snippet?.channelTitle || "").trim(),
      thumbnail: String(item.thumbnail || item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || "").trim(),
      videoUrl: String(item.videoUrl || `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`)
    });
    if (results.length >= limit) break;
  }
  return results.filter((result) => result.title && result.videoUrl);
}

export function createYouTubeSearchClient({
  basePath = "",
  fetchImpl = globalThis.fetch?.bind(globalThis),
  cacheTtl = CACHE_TTL
} = {}) {
  const cache = new Map();
  const pending = new Map();

  function search(query, { signal, regionCode } = {}) {
    const requestPath = buildYouTubeSearchRequestPath({ basePath, query, regionCode });
    const cached = cache.get(requestPath);
    if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.value);
    if (pending.has(requestPath)) return pending.get(requestPath);
    if (typeof fetchImpl !== "function") return Promise.reject(new Error("YOUTUBE_SEARCH_FETCH_UNAVAILABLE"));
    const request = Promise.resolve(fetchImpl(requestPath, {
      headers: { accept: "application/json" },
      signal
    })).then(async (response) => {
      let payload = {};
      try { payload = await response.json(); } catch { /* handled below */ }
      if (!response.ok) throw new Error(payload.message || `YouTube search failed (${response.status}).`);
      const value = normalizeYouTubeResults(payload);
      cache.set(requestPath, { value, expiresAt: Date.now() + cacheTtl });
      return value;
    }).finally(() => pending.delete(requestPath));
    pending.set(requestPath, request);
    return request;
  }

  return { search };
}
