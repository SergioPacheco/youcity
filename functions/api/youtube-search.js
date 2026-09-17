import { normalizeYouTubeResults } from "../../src/radio/radio-youtube.mjs";

const CACHE_TTL = 10 * 60 * 1000;
const RATE_WINDOW = 10 * 60 * 1000;
const MAX_REQUESTS = 30;
const MAX_RESULTS = 3;
const cache = new Map();
const rateLimits = new Map();

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": status === 200 ? "public, max-age=600, s-maxage=600" : "no-store", ...headers }
  });
}

function clientKey(request) {
  return request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";
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

function validRegion(value) {
  const region = String(value || "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(region) ? region : null;
}

export async function onRequestGet({ request, env }) {
  if (isRateLimited(request)) return json({ error: "RATE_LIMITED", message: "Too many YouTube searches. Try again later." }, 429, { "retry-after": "600" });
  if (!env.YOUTUBE_API_KEY) return json({ error: "YOUTUBE_API_NOT_CONFIGURED", message: "YouTube search is not configured on the server." }, 503);
  const requestUrl = new URL(request.url);
  const query = String(requestUrl.searchParams.get("q") || "").trim();
  const regionCode = validRegion(requestUrl.searchParams.get("regionCode"));
  if (query.length < 2 || query.length > 160) return json({ error: "INVALID_QUERY", message: "A search query between 2 and 160 characters is required." }, 400);
  const cacheKey = `${query.toLowerCase()}|${regionCode || ""}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return json(cached.value);

  const endpoint = new URL("https://www.googleapis.com/youtube/v3/search");
  endpoint.searchParams.set("part", "snippet");
  endpoint.searchParams.set("q", query);
  endpoint.searchParams.set("type", "video");
  endpoint.searchParams.set("videoCategoryId", "10");
  endpoint.searchParams.set("videoEmbeddable", "true");
  endpoint.searchParams.set("videoSyndicated", "true");
  endpoint.searchParams.set("maxResults", String(MAX_RESULTS));
  if (regionCode) endpoint.searchParams.set("regionCode", regionCode);
  endpoint.searchParams.set("key", env.YOUTUBE_API_KEY);

  let response;
  try {
    response = await fetch(endpoint, { headers: { accept: "application/json" } });
  } catch {
    return json({ error: "YOUTUBE_SEARCH_UNAVAILABLE", message: "YouTube search is temporarily unavailable." }, 502);
  }
  let payload = {};
  try { payload = await response.json(); } catch { /* handled below */ }
  if (!response.ok) {
    const reason = payload.error?.errors?.[0]?.reason;
    const status = reason === "quotaExceeded" || reason === "dailyLimitExceeded" ? 503 : 502;
    const error = status === 503 ? "YOUTUBE_API_QUOTA_EXCEEDED" : "YOUTUBE_SEARCH_UNAVAILABLE";
    return json({ error, message: status === 503 ? "YouTube search quota exceeded." : "YouTube search is temporarily unavailable." }, status);
  }
  const value = { results: normalizeYouTubeResults(payload, { limit: MAX_RESULTS }) };
  cache.set(cacheKey, { value, expiresAt: Date.now() + CACHE_TTL });
  return json(value);
}
