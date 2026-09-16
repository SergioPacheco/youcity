// Canonical runtime catalog.
// The source catalogs remain separate because they have different ownership
// and update rules; the application consumes this normalized view only.
(function initializeCanonicalCatalog(global) {
  const modes = ["drive", "bike", "walk", "drone", "beach_walk"];

  function keyFor(city) {
    return `${city.name}\u0000${city.country}`;
  }

  function copyVideos(sourceCity) {
    return Object.fromEntries(modes.map((mode) => [mode, [...(sourceCity.videos?.[mode] || [])]]));
  }

  function createCity(sourceCity) {
    return {
      ...sourceCity,
      videos: copyVideos(sourceCity),
      radios: [...(sourceCity.radios || [])]
    };
  }

  function mergeSourceCity(cityByKey, sourceCity) {
    const key = keyFor(sourceCity);
    const current = cityByKey.get(key);
    if (!current) {
      cityByKey.set(key, createCity(sourceCity));
      return;
    }
    modes.forEach((mode) => current.videos[mode].push(...(sourceCity.videos?.[mode] || [])));
    current.radios.push(...(sourceCity.radios || []));
  }

  function uniqueById(items) {
    const seen = new Set();
    return items.filter((item) => {
      if (!item?.id || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }

  function normalizeCity(city, droneCatalog, radioCatalog, radioExtraCatalog) {
    city.videos.drone.push(...(droneCatalog[city.name] || []).map((ride) =>
      typeof ride === "string" ? { id: ride, start: 0 } : { ...ride }
    ));

    const radios = [
      ...city.radios,
      ...(radioCatalog[city.name] || []),
      ...(radioExtraCatalog[city.name] || [])
    ];
    const seenRadioUrls = new Set();
    city.radios = radios.filter((radio) => {
      if (!radio?.url || seenRadioUrls.has(radio.url)) return false;
      seenRadioUrls.add(radio.url);
      return true;
    }).slice(0, 5);
    city.coordinates = global.CITY_COORDINATES?.[city.name] || city.coordinates || null;
    modes.forEach((mode) => {
      city.videos[mode] = uniqueById(city.videos[mode]);
    });
  }

  function addBeachWalkRide(cityByKey, ride) {
    if (!ride?.city || !ride?.country || !ride?.id) return;
    const sourceCity = {
      name: ride.city,
      country: ride.country,
      videos: {},
      radios: [],
      coordinates: ride.coordinates || null
    };
    let city = cityByKey.get(keyFor(sourceCity));
    if (!city) {
      city = createCity(sourceCity);
      cityByKey.set(keyFor(sourceCity), city);
    }
    city.videos.beach_walk.push({
      id: ride.id,
      start: ride.start ?? 0,
      title: ride.title || ride.city
    });
    if (!city.coordinates && ride.coordinates) city.coordinates = ride.coordinates;
  }

  function finalizeBeachWalk(city) {
    city.coordinates = global.CITY_COORDINATES?.[city.name] || city.coordinates || null;
    city.videos.beach_walk = uniqueById(city.videos.beach_walk);
  }

  const cityByKey = new Map();
  (global.CITY_CATALOG || []).forEach((sourceCity) => mergeSourceCity(cityByKey, sourceCity));

  const droneCatalog = global.DRONE_CATALOG || {};
  const radioCatalog = global.RADIO_CATALOG || {};
  const radioExtraCatalog = global.RADIO_EXTRA_CATALOG || {};
  cityByKey.forEach((city) => normalizeCity(city, droneCatalog, radioCatalog, radioExtraCatalog));
  (global.BEACH_WALK_CATALOG || []).forEach((ride) => addBeachWalkRide(cityByKey, ride));
  cityByKey.forEach(finalizeBeachWalk);

  global.YOUCITY_CATALOG = [...cityByKey.values()];
})(window);
