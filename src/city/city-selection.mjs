export function createCitySelection(repository) {
  function select({ cityIndex = 0, mode, videoIndex = 0 } = {}) {
    const cities = repository.list();
    if (!cities.length) return null;
    const normalizedCityIndex = ((Number(cityIndex) || 0) % cities.length + cities.length) % cities.length;
    const city = repository.getCity(normalizedCityIndex);
    const selectedMode = repository.firstAvailableMode(city, mode);
    const videos = city?.videos?.[selectedMode] || [];
    const normalizedVideoIndex = videos.length
      ? Math.max(0, Math.min(Number.isInteger(videoIndex) ? videoIndex : 0, videos.length - 1))
      : 0;
    return { cityIndex: normalizedCityIndex, mode: selectedMode, videoIndex: normalizedVideoIndex, city };
  }

  return { select };
}
