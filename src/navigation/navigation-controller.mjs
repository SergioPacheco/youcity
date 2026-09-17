import { parseRoute } from "../core/url.mjs";

export function createNavigationController({ window, cities, state, basePath = "", slugify } = {}) {
  function loadRoute() {
    try {
      const route = parseRoute(window.location, basePath);
      const cityIndex = route.citySlug
        ? cities.findIndex((city) => slugify(city.name) === route.citySlug || slugify(city.rawName) === route.citySlug)
        : null;
      return {
        cityIndex: cityIndex === -1 ? null : cityIndex,
        mode: route.mode,
        videoIndex: route.videoIndex,
        isDeepLink: route.isDeepLink
      };
    } catch (error) {
      console.warn("[YouCity] Could not parse route:", error.message);
      return { cityIndex: null, mode: null, videoIndex: 0, isDeepLink: false };
    }
  }

  function syncUrl({ city, replace = false } = {}) {
    if (!city) return;
    const modeVideos = city.videos[state.currentMode] || [];
    const params = new URLSearchParams();
    if (modeVideos.length) params.set("mode", state.currentMode);
    if (modeVideos.length > 1 && state.currentVideoIndex > 0) params.set("video", String(state.currentVideoIndex + 1));
    if (state.isAdmin) params.set("role", "admin");
    const query = params.toString();
    const url = `${basePath}/city/${slugify(city.rawName || city.name)}${query ? `?${query}` : ""}`;
    const method = replace ? "replaceState" : "pushState";
    window.history[method]({ city: city.id, mode: state.currentMode, video: state.currentVideoIndex }, "", url);
  }

  return { loadRoute, syncUrl };
}
