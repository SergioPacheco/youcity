(function initializeAffiliateEngine(global) {
  const providers = new Map();
  const rankingStrategies = new Map();

  function config() {
    return global.YOUCITY_AFFILIATE_CONFIG || {};
  }

  function registerProvider(provider) {
    if (!provider?.id || typeof provider.getOffer !== "function") {
      throw new Error("Affiliate providers require an id and getOffer(context)");
    }
    providers.set(provider.id, provider);
  }

  function registerRankingStrategy(id, strategy) {
    if (!id || typeof strategy?.rank !== "function") {
      throw new Error("Affiliate ranking strategies require an id and rank(offers, context)");
    }
    rankingStrategies.set(id, strategy);
  }

  function getProvider(id) {
    return providers.get(id);
  }

  function getProviderConfig(id) {
    return config().providers?.[id] || {};
  }

  function getProviders() {
    return [...providers.values()];
  }

  function getRankingStrategy(id = "default") {
    return rankingStrategies.get(id) || rankingStrategies.get("default");
  }

  function slugify(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+/, "")
      .replace(/-+$/, "");
  }

  function createConfiguredUrl(providerId, context) {
    const providerConfig = getProviderConfig(providerId);
    const template = String(providerConfig.urlTemplate || "").trim();
    if (!template) return "";
    const replacements = {
      city: context.city.name,
      cityId: context.city.id,
      country: context.city.country,
      countryCode: context.city.countryCode,
      vertical: context.vertical
    };
    const rendered = template.replace(/\{(city|cityId|country|countryCode|vertical)\}/g, (_, key) => encodeURIComponent(replacements[key] || ""));
    try {
      const url = new URL(rendered);
      if (providerConfig.affiliateId && providerConfig.affiliateIdParam) {
        url.searchParams.set(providerConfig.affiliateIdParam, providerConfig.affiliateId);
      }
      const trackingContext = { ...context, tracking: { ...providerConfig.tracking, ...context.tracking } };
      return global.YouCityAffiliateTracking?.decorateUrl(url.toString(), providerConfig, trackingContext) || url.toString();
    } catch {
      return "";
    }
  }

  function normalizeContext(city, vertical, options = {}) {
    const source = city || {};
    const rawCountry = source.rawCountry || source.country || "";
    const countryCode = source.countryCode
      || config().countryCodes?.[rawCountry]
      || config().countryCodes?.[source.country]
      || "";
    return {
      city: {
        id: source.id || source.cityId || "",
        name: source.name || source.rawName || "",
        rawName: source.rawName || source.name || "",
        rawCountry,
        country: source.country || rawCountry,
        countryCode
      },
      vertical: String(vertical || "").toLowerCase(),
      placement: options.placement || "travel_planner",
      language: options.language || global.document?.documentElement?.lang || "en",
      device: options.device || (global.matchMedia?.("(max-width: 700px)").matches ? "mobile" : "desktop"),
      mode: options.mode || "",
      tracking: { ...options.tracking }
    };
  }

  const api = {
    registerProvider,
    registerRankingStrategy,
    getProvider,
    getProviderConfig,
    getProviders,
    getRankingStrategy,
    createConfiguredUrl,
    slugify,
    normalizeContext,
    createContext: normalizeContext,
    getAffiliateOffers(context) {
      return global.YouCityAffiliateResolver?.resolve?.(context) || [];
    },
    trackImpression(...args) {
      return global.YouCityAffiliateTracking?.trackImpression?.(...args);
    },
    trackClick(...args) {
      return global.YouCityAffiliateTracking?.trackClick?.(...args);
    },
    track(...args) {
      return global.YouCityAffiliateTracking?.track?.(...args);
    },
    observeImpressions(...args) {
      return global.YouCityAffiliateTracking?.observeImpressions?.(...args);
    },
    decorateUrl(...args) {
      return global.YouCityAffiliateTracking?.decorateUrl?.(...args);
    }
  };

  global.YouCityAffiliate = api;
})(window);
