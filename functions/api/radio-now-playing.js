import { handleNowPlayingRequest } from "../../src/radio/radio-now-playing-server.mjs";

const RATE_WINDOW = 10 * 60 * 1000;
const MAX_REQUESTS = 30;
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

export async function onRequestGet({ request }) {
  if (isRateLimited(request)) return json({ error: "RATE_LIMITED", message: "Too many metadata requests. Try again later." }, 429, { "retry-after": "600" });
  const requestUrl = new URL(request.url);
  const result = await handleNowPlayingRequest({
    stationRef: requestUrl.searchParams.get("stationRef"),
    signal: request.signal
  });
  return json(result.body, result.status);
}
