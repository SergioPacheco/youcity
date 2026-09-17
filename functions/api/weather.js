const CACHE_TTL = 15 * 60 * 1000;
const RATE_WINDOW = 10 * 60 * 1000;
const MAX_REQUESTS = 60;
const cache = new Map();
const rateLimits = new Map();

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": status === 200 ? "public, max-age=900, s-maxage=900" : "no-store",
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

function parseCoordinate(value, min, max) {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

export async function onRequestGet({ request }) {
  if (isRateLimited(request)) {
    return json({ error: "RATE_LIMITED", message: "Too many weather requests. Try again later." }, 429, {
      "retry-after": "600"
    });
  }

  const requestUrl = new URL(request.url);
  const latitude = parseCoordinate(requestUrl.searchParams.get("latitude"), -90, 90);
  const longitude = parseCoordinate(requestUrl.searchParams.get("longitude"), -180, 180);
  if (latitude === null || longitude === null) {
    return json({ error: "INVALID_COORDINATES", message: "Valid city coordinates are required." }, 400);
  }

  const cacheKey = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return json(cached.value);

  const endpoint = new URL("https://api.open-meteo.com/v1/forecast");
  endpoint.searchParams.set("latitude", String(latitude));
  endpoint.searchParams.set("longitude", String(longitude));
  endpoint.searchParams.set("current", [
    "temperature_2m",
    "apparent_temperature",
    "weather_code",
    "wind_speed_10m",
    "precipitation",
    "is_day"
  ].join(","));
  endpoint.searchParams.set("daily", [
    "temperature_2m_max",
    "temperature_2m_min",
    "precipitation_probability_max",
    "weather_code",
    "sunrise",
    "sunset"
  ].join(","));
  endpoint.searchParams.set("forecast_days", "3");
  endpoint.searchParams.set("timezone", "auto");
  endpoint.searchParams.set("temperature_unit", "celsius");
  endpoint.searchParams.set("wind_speed_unit", "kmh");

  let response;
  try {
    response = await fetch(endpoint, { headers: { accept: "application/json" } });
  } catch {
    return json({ error: "WEATHER_UNAVAILABLE", message: "Weather data is temporarily unavailable." }, 502);
  }

  let payload = {};
  try { payload = await response.json(); } catch { /* handled below */ }
  if (!response.ok || payload.error) {
    return json({ error: "WEATHER_UNAVAILABLE", message: "Weather data is temporarily unavailable." }, 502);
  }

  cache.set(cacheKey, { value: payload, expiresAt: Date.now() + CACHE_TTL });
  return json(payload);
}
