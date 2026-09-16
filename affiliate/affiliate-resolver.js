(function initializeAffiliateResolver(global) {
  const verticals = {
    hotels: { label: "Stay", icon: "🛏", description: "Hotels and stays", placement: "primary" },
    "vacation-rentals": { label: "Vacation rentals", icon: "⌂", description: "Homes, apartments & short stays", placement: "primary" },
    flights: { label: "Get there", icon: "✈", description: "Compare flights", placement: "secondary" },
    cars: { label: "Get around", icon: "🚗", description: "Car rentals", placement: "primary" },
    activities: { label: "Things to do", icon: "🎟", description: "Tours, attractions & experiences", placement: "primary" },
    esim: { label: "Stay connected", icon: "📱", description: "eSIM and internet", placement: "primary" },
    insurance: { label: "Essentials", icon: "🛡", description: "Travel insurance", placement: "secondary" },
    transfers: { label: "Transfers", icon: "↔", description: "Airport and city transfers", placement: "secondary" },
    trains: { label: "Trains", icon: "🚆", description: "Train tickets", placement: "secondary" },
    buses: { label: "Buses", icon: "🚌", description: "Bus tickets", placement: "secondary" },
    cruises: { label: "Cruises", icon: "⚓", description: "Cruise options", placement: "secondary" },
    restaurants: { label: "Restaurants", icon: "🍴", description: "Places to eat", placement: "secondary" },
    tickets: { label: "Tickets", icon: "🎫", description: "Attractions and tickets", placement: "secondary" },
    events: { label: "Events", icon: "◉", description: "Local events", placement: "secondary" }
  };

  function providerEnabled(providerId, providerConfig) {
    const config = global.YOUCITY_AFFILIATE_CONFIG || {};
    return config.enabled !== false
      && providerConfig.enabled !== false
      && config.features?.providers?.[providerId] !== false
      && providerConfig.configured !== false;
  }

  function supportsVertical(provider, providerConfig, vertical) {
    const verticalsForProvider = provider.verticals || providerConfig.verticals || [];
    return verticalsForProvider.includes(vertical);
  }

  function resolve(context) {
    const normalized = global.YouCityAffiliate.normalizeContext(context?.city, context?.vertical, context);
    if (!normalized.city.name || !normalized.city.country || !normalized.vertical) return [];
    const offers = [];

    global.YouCityAffiliate.getProviders().forEach((provider) => {
      const providerConfig = global.YouCityAffiliate.getProviderConfig(provider.id);
      if (!providerEnabled(provider.id, providerConfig) || !supportsVertical(provider, providerConfig, normalized.vertical)) return;
      try {
        if (typeof provider.supports === "function" && !provider.supports(normalized.city, normalized.vertical, normalized)) return;
        const offer = provider.getOffer(normalized);
        if (!offer?.url) return;
        const url = new URL(offer.url);
        if (url.protocol !== "https:") return;
        offers.push({
          ...offer,
          provider: provider.id,
          name: offer.name || provider.name || providerConfig.name || provider.id,
          vertical: normalized.vertical,
          available: true,
          category: normalized.vertical,
          priority: Number(offer.priority ?? providerConfig.priority ?? 0),
          variant: offer.variant || "A",
          tracking: { ...providerConfig.tracking, ...offer.tracking },
          placement: offer.placement || normalized.placement
        });
      } catch (error) {
        if (global.YOUCITY_AFFILIATE_CONFIG?.debug) console.warn(`[YouCity Affiliate] ${provider.id} unavailable`, error.message);
      }
    });

    const strategyId = global.YOUCITY_AFFILIATE_CONFIG?.ranking?.strategy || "default";
    const strategy = global.YouCityAffiliate.getRankingStrategy(strategyId);
    return strategy ? strategy.rank(offers, normalized) : offers;
  }

  global.YouCityAffiliateResolver = { resolve, verticals };
  global.YouCityAffiliate.getVerticals = () => ({ ...verticals });
})(window);
