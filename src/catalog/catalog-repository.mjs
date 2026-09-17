const MODE_ORDER = ["drive", "bike", "walk", "beach_walk", "drone"];

export function createCatalogRepository(rawCatalog = []) {
  const cities = rawCatalog.map((city) => ({
    ...city,
    videos: Object.fromEntries(MODE_ORDER.map((mode) => [
      mode,
      Array.isArray(city?.videos?.[mode]) ? city.videos[mode] : []
    ])),
    radios: Array.isArray(city?.radios) ? city.radios : []
  }));

  function getCity(index) {
    return cities[index];
  }

  function availableModes(city) {
    return MODE_ORDER.filter((mode) => city?.videos?.[mode]?.length > 0);
  }

  function firstAvailableMode(city, preferredMode) {
    const modes = availableModes(city);
    return modes.includes(preferredMode) ? preferredMode : modes[0];
  }

  function selectRide({ cityIndex = 0, mode, videoIndex = 0 } = {}) {
    const city = getCity(cityIndex);
    if (!city) return undefined;
    const selectedMode = firstAvailableMode(city, mode);
    const videos = city.videos[selectedMode] || [];
    if (!videos.length) return undefined;
    const index = Number.isInteger(videoIndex) ? Math.max(0, Math.min(videoIndex, videos.length - 1)) : 0;
    return videos[index];
  }

  return {
    list: () => cities,
    getCity,
    availableModes,
    firstAvailableMode,
    selectRide
  };
}

export { MODE_ORDER };
