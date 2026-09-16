(function registerStay22(global) {
  const ENDPOINTS = {
    hotels: "https://www.stay22.com/allez/roam",
    activities: "https://www.stay22.com/allez/getyourguide"
  };
  const SEARCHBAR_ENDPOINT = "https://www.stay22.com/allez/searchbar";
  const MAP_ENDPOINT = "https://www.stay22.com/embed/gm";
  const VERTICAL_ENDPOINTS = {
    hotels: "hotels",
    "vacation-rentals": "hotels",
    activities: "activities"
  };
  const VERTICALS = Object.keys(VERTICAL_ENDPOINTS);
  const ROAM_PROVIDERS = new Set(["booking", "expedia", "hotelscom", "vrbo", "agoda", "kayak"]);

  function providerConfig() {
    return global.YouCityAffiliate.getProviderConfig("stay22");
  }

  function featureEnabled(feature) {
    const config = global.YOUCITY_AFFILIATE_CONFIG || {};
    const provider = providerConfig();
    return config.features?.stay22?.[feature] !== false
      && provider.features?.[feature] !== false;
  }

  function isEnabled(feature) {
    const config = global.YOUCITY_AFFILIATE_CONFIG || {};
    const provider = providerConfig();
    return config.enabled !== false
      && config.features?.providers?.stay22 !== false
      && provider.enabled !== false
      && provider.configured === true
      && featureEnabled(feature);
  }

  function supports(city, vertical) {
    return isEnabled(vertical === "vacation-rentals" ? "hotels" : vertical)
      && VERTICALS.includes(vertical)
      && Boolean(city?.name)
      && Boolean(city?.country);
  }

  function normalizedPlacement(placement) {
    if (placement === "travel_planner") return "travelplanner";
    if (placement === "map_popup") return "map";
    return global.YouCityAffiliate.slugify(placement || "travelplanner").replaceAll("-", "");
  }

  function createCampaign(context, vertical = context?.vertical, placement = context?.placement) {
    const citySlug = global.YouCityAffiliate.slugify(context?.city?.name);
    const countryCode = global.YouCityAffiliate.slugify(context?.city?.countryCode || context?.city?.country);
    return `yc_${citySlug}_${countryCode}_${vertical}_${normalizedPlacement(placement)}`;
  }

  function validProvider(provider) {
    return typeof provider === "string" && ROAM_PROVIDERS.has(provider);
  }

  function routingOptions(context) {
    const config = providerConfig();
    const roam = config.roam || {};
    let forceProvider = validProvider(roam.forceProvider) ? roam.forceProvider : null;
    let variant = "stay22_roam";
    if (!forceProvider && context?.vertical === "vacation-rentals") {
      forceProvider = "vrbo";
      variant = "stay22_vrbo";
    }
    const experimentRouting = global.YouCityAffiliateExperiments?.getStay22Routing?.(context);
    if (!forceProvider && validProvider(experimentRouting?.forceProvider)) {
      forceProvider = experimentRouting.forceProvider;
      variant = experimentRouting.variant;
    }
    const excludeProviders = [...new Set((Array.isArray(roam.excludeProviders) ? roam.excludeProviders : [])
      .filter(validProvider))];
    return { forceProvider, excludeProviders, variant };
  }

  function createRoamUrl(context) {
    if (!supports(context?.city, context?.vertical)) return "";
    const config = providerConfig();
    if (!config.aid) return "";
    const endpoint = VERTICAL_ENDPOINTS[context.vertical];
    const url = new URL(ENDPOINTS[endpoint]);
    url.searchParams.set("aid", config.aid);
    url.searchParams.set("address", `${context.city.name}, ${context.city.country}`);
    const routing = routingOptions(context);
    if (routing.forceProvider) url.searchParams.set("provider", routing.forceProvider);
    if (routing.excludeProviders.length) url.searchParams.set("excludeproviders", routing.excludeProviders.join(","));
    url.searchParams.set("campaign", createCampaign(context));
    return url.toString();
  }

  function dateString(value) {
    return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
  }

  function validDate(value) {
    if (!dateString(value)) return false;
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return !Number.isNaN(date.getTime())
      && date.getUTCFullYear() === year
      && date.getUTCMonth() === month - 1
      && date.getUTCDate() === day;
  }

  function today() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function validAccommodationDates(checkin, checkout) {
    return validDate(checkin) && validDate(checkout)
      && checkin >= today()
      && checkout > checkin;
  }

  function setOptionalNumber(url, name, value, minimum) {
    if (value === "" || value === null || value === undefined) return;
    const number = Number(value);
    if (Number.isInteger(number) && number >= minimum) url.searchParams.set(name, String(number));
  }

  function createAccommodationSearchUrl(city, search = {}, options = {}) {
    if (!isEnabled("searchbar") || !city?.name || !city?.country || !providerConfig().aid) return "";
    if (!validAccommodationDates(search.checkin, search.checkout)) return "";
    const url = new URL(SEARCHBAR_ENDPOINT);
    url.searchParams.set("aid", providerConfig().aid);
    url.searchParams.set("address", `${city.name}, ${city.country}`);
    url.searchParams.set("checkin", search.checkin);
    url.searchParams.set("checkout", search.checkout);
    setOptionalNumber(url, "adults", search.adults, 1);
    setOptionalNumber(url, "children", search.children, 0);
    const placement = options.placement || "travel_planner";
    url.searchParams.set("campaign", createCampaign({ city, vertical: "hotel-search", placement }, "hotel-search", placement));
    return url.toString();
  }

  function createMapUrl(city, options = {}) {
    if (!isEnabled("map") || !city?.name || !city?.country || !providerConfig().aid) return "";
    const url = new URL(MAP_ENDPOINT);
    url.searchParams.set("aid", providerConfig().aid);
    url.searchParams.set("address", `${city.name}, ${city.country}`);
    const placement = options.placement || "map";
    url.searchParams.set("campaign", createCampaign({ city, vertical: "hotels", placement }, "hotels", placement));
    return url.toString();
  }

  const provider = {
    id: "stay22",
    name: "Stay22",
    verticals: VERTICALS,
    supports,
    createUrl: createRoamUrl,
    getOffer(context) {
      const url = createRoamUrl(context);
      if (!url) return null;
      const routing = routingOptions(context);
      return {
        provider: "stay22",
        vertical: context.vertical,
        url,
        available: true,
        variant: routing.variant,
        tracking: { providerCampaign: createCampaign(context) },
        label: getOfferLabel(context)
      };
    }
  };

  function getOfferLabel(context) {
    if (context.vertical === "activities") return `Things to do in ${context.city.name}`;
    if (context.vertical === "vacation-rentals") return `Vacation rentals in ${context.city.name}`;
    return `Hotels in ${context.city.name}`;
  }

  global.YouCityAffiliate.registerProvider(provider);
  global.YouCityStay22 = {
    endpoints: { ...ENDPOINTS, searchbar: SEARCHBAR_ENDPOINT, map: MAP_ENDPOINT },
    isEnabled,
    createCampaign,
    createRoamUrl,
    createAccommodationSearchUrl,
    createMapUrl,
    validAccommodationDates,
    today,
    allowedRoamProviders: [...ROAM_PROVIDERS]
  };
})(window);
