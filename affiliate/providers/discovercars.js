(function registerDiscoverCars(global) {
  const HOST = "https://www.discovercars.com";

  function locationFor(context) {
    const override = global.YouCityAffiliateCatalog.getOverride("discovercars", context.city);
    if (override === null) return null;
    const location = global.YouCityAffiliateCatalog.getLocation("discovercars", context.city);
    if (location?.status !== "VERIFIED" || !location?.available) return null;
    if (override?.path) {
      return { ...location, discoverCars: { ...location.discoverCars, path: override.path, url: `${HOST}${override.path}` } };
    }
    return location;
  }

  const provider = {
    id: "discovercars",
    name: "DiscoverCars",
    verticals: ["cars"],
    supports: (city, vertical, context) => vertical === "cars" && Boolean(locationFor(context || { city })),
    createUrl: (context) => {
      const location = locationFor(context);
      const affiliateId = global.YouCityAffiliate.getProviderConfig("discovercars").affiliateId;
      if (!location?.discoverCars?.url || !affiliateId) return "";
      try {
        const url = new URL(location.discoverCars.url);
        if (url.origin !== HOST || !url.pathname) return "";
        url.searchParams.set("a_aid", affiliateId);
        const providerConfig = global.YouCityAffiliate.getProviderConfig("discovercars");
        return global.YouCityAffiliate.decorateUrl(url.toString(), providerConfig, {
          ...context,
          tracking: { ...providerConfig.tracking, ...context.tracking }
        });
      } catch {
        return "";
      }
    },
    getOffer: (context) => {
      const url = provider.createUrl(context);
      if (!url) return null;
      return {
        url,
        label: `Rent a car in ${context.city.name}`,
        description: "Compare rental car prices"
      };
    }
  };

  global.YouCityAffiliate.registerProvider(provider);
})(window);
