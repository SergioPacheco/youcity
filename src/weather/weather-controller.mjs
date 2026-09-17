export function createWeatherController({
  fetchImpl = globalThis.fetch,
  timeout = 8_000,
  cacheTtl = 15 * 60 * 1000,
  getEndpoints,
  render,
  onError
}) {
  let requestId = 0;
  const cache = new Map();

  async function fetchWeather(endpoint) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetchImpl(endpoint, { signal: controller.signal, headers: { accept: "application/json" } });
      if (!response.ok) throw new Error(`Weather request failed with status ${response.status}`);
      const payload = await response.json();
      if (payload?.error || !payload?.current) throw new Error("Weather response is incomplete");
      return payload;
    } finally {
      clearTimeout(timer);
    }
  }

  async function update(city) {
    const currentRequestId = ++requestId;
    const coordinates = Array.isArray(city?.coordinates) ? city.coordinates : [];
    const latitude = Number(coordinates[0]);
    const longitude = Number(coordinates[1]);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      render.error();
      return;
    }

    const cacheKey = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      render.ready(cached.value);
      return;
    }

    render.loading();
    try {
      const endpoints = getEndpoints(latitude, longitude);
      let weather;
      try {
        weather = await fetchWeather(endpoints.primary);
      } catch (error) {
        if (!endpoints.fallback || !/status 404/.test(error.message)) throw error;
        weather = await fetchWeather(endpoints.fallback);
      }
      if (currentRequestId !== requestId) return;
      cache.set(cacheKey, { value: weather, expiresAt: Date.now() + cacheTtl });
      render.ready(weather);
    } catch (error) {
      if (currentRequestId !== requestId) return;
      render.error();
      onError?.(error, city);
    }
  }

  return {
    update,
    invalidate() { requestId += 1; },
    clearCache() { cache.clear(); },
    destroy() { requestId += 1; cache.clear(); }
  };
}
