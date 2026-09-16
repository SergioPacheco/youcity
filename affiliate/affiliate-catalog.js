(function initializeAffiliateCatalog(global) {
  function cityKey(city) {
    const id = city?.id || city?.cityId || "";
    const countryCode = city?.countryCode || "";
    return countryCode ? `${id}-${countryCode.toLowerCase()}` : id;
  }

  function overrideFor(providerId, city) {
    const overrides = global.YOUCITY_AFFILIATE_OVERRIDES || {};
    const keys = [cityKey(city), city?.id].filter(Boolean);
    let entry;
    for (const key of keys) {
      if (Object.hasOwn(overrides, key)) {
        entry = overrides[key];
        break;
      }
    }
    if (entry === null) return null;
    if (entry?.provider === providerId) return entry;
    return entry?.[providerId] || undefined;
  }

  function discoverCarsEntry(city) {
    const locations = global.YOUCITY_DISCOVERCARS_LOCATIONS || {};
    const directKey = cityKey(city);
    if (directKey && locations[directKey]) return locations[directKey];
    return Object.values(locations).find((location) =>
      location.youCityId === city?.id
      && (
        location.country === (city?.rawCountry || city?.country)
        || location.countryCode === city?.countryCode
      )
    ) || null;
  }

  global.YouCityAffiliateCatalog = {
    cityKey,
    getOverride: overrideFor,
    getLocation(providerId, city) {
      if (providerId === "discovercars") return discoverCarsEntry(city);
      return global.YOUCITY_AFFILIATE_CATALOGS?.[providerId]?.[cityKey(city)] || null;
    }
  };
})(window);
