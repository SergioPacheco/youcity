import { extractYouTubeVideoId, youtubeWatchUrl } from "../../comment-assistant/core.mjs";

const CACHE_TTL = 5 * 60 * 1000;
const RATE_WINDOW = 10 * 60 * 1000;
const MAX_REQUESTS = 30;
const cache = new Map();
const rateLimits = new Map();

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers }
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

function apiError(reason) {
  if (reason === "quotaExceeded" || reason === "dailyLimitExceeded") return [503, "YOUTUBE_API_QUOTA_EXCEEDED", "YouTube API quota exceeded."];
  if (reason === "videoNotFound") return [404, "VIDEO_NOT_FOUND", "Video not found."];
  if (reason === "privateVideo") return [403, "PRIVATE_VIDEO", "This video is private or unavailable."];
  return [502, "VIDEO_METADATA_UNAVAILABLE", "Video metadata is temporarily unavailable."];
}

export async function onRequestPost({ request, env }) {
  if (isRateLimited(request)) return json({ error: "RATE_LIMITED", message: "Too many requests. Try again later." }, 429, { "retry-after": "600" });
  if (!env.YOUTUBE_API_KEY) return json({ error: "YOUTUBE_API_NOT_CONFIGURED", message: "YouTube metadata is not configured on the server." }, 503);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "INVALID_REQUEST", message: "Invalid request body." }, 400);
  }
  const videoId = extractYouTubeVideoId(body?.url || body?.videoUrl || "");
  if (!videoId) return json({ error: "INVALID_YOUTUBE_URL", message: "Invalid YouTube URL." }, 400);

  const cached = cache.get(videoId);
  if (cached && cached.expiresAt > Date.now()) return json(cached.value);

  const endpoint = new URL("https://www.googleapis.com/youtube/v3/videos");
  endpoint.searchParams.set("part", "snippet");
  endpoint.searchParams.set("id", videoId);
  endpoint.searchParams.set("fields", "items(id,snippet)");
  endpoint.searchParams.set("key", env.YOUTUBE_API_KEY);

  let response;
  try {
    response = await fetch(endpoint, { headers: { accept: "application/json" } });
  } catch {
    return json({ error: "VIDEO_METADATA_UNAVAILABLE", message: "Video metadata is temporarily unavailable." }, 502);
  }
  let payload = {};
  try { payload = await response.json(); } catch { /* handled below */ }
  if (!response.ok || !payload.items?.[0]) {
    const reason = payload.error?.errors?.[0]?.reason || (response.status === 404 ? "videoNotFound" : "unknown");
    const [status, error, message] = apiError(reason);
    return json({ error, message }, status);
  }

  const item = payload.items[0];
  const snippet = item.snippet || {};
  const value = {
    videoId,
    videoUrl: youtubeWatchUrl(videoId),
    title: snippet.title || "",
    description: snippet.description || "",
    channel: snippet.channelTitle || "",
    channelId: snippet.channelId || "",
    tags: Array.isArray(snippet.tags) ? snippet.tags.slice(0, 50) : [],
    thumbnails: snippet.thumbnails || {},
    publishedAt: snippet.publishedAt || null,
  };
  cache.set(videoId, { value, expiresAt: Date.now() + CACHE_TTL });
  return json(value);
}
