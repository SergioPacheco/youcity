/**
 * Extract countryCode from various sources in priority order
 * 1. Direct payload.countryCode
 * 2. From catalog city object
 * 3. From country name via lookup (if available)
 * 4. Fallback to empty string
 */
export function extractCountryCode(payload = {}, global = globalThis) {
  // 1. Direct from payload
  if (payload.countryCode && typeof payload.countryCode === "string") {
    return payload.countryCode.trim();
  }
  
  // 2. Try to get from catalog if city name is provided
  if (payload.city && typeof payload.city === "string") {
    try {
      // Look for city in catalog
      const catalog = global.CATALOG || global.YOUCITY_CATALOG;
      if (catalog && Array.isArray(catalog)) {
        const city = catalog.find(c => 
          c.name && c.name.toLowerCase() === payload.city.toLowerCase()
        );
        if (city && city.countryCode) {
          return city.countryCode.trim();
        }
      }
    } catch (error) {
      // Silently fail - fall through to other methods
      if (global.YOUCITY_AFFILIATE_CONFIG?.debug) {
        console.warn("[YouCity Analytics] CountryCode extraction from catalog failed:", error.message);
      }
    }
  }
  
  // 3. Try to get from country if mapping exists
  if (payload.country && typeof payload.country === "string") {
    // This could be extended with a country code lookup if needed
    // For now, return empty string - analytics will work without country code
  }
  
  // 4. Final fallback
  return "";
}

/**
 * Extract mode from various sources in priority order
 * 1. Direct payload.mode
 * 2. From global state.currentMode
 * 3. Fallback to empty string
 */
export function extractMode(payload = {}, global = globalThis) {
  // 1. Direct from payload
  if (payload.mode && typeof payload.mode === "string") {
    return payload.mode.trim();
  }
  
  // 2. Try to get from global state
  if (global.YouCity && global.YouCity.state && global.YouCity.state.currentMode) {
    return global.YouCity.state.currentMode.trim();
  }
  
  // Try alternative state location
  if (global.YOUCITY_STATE && global.YOUCITY_STATE.currentMode) {
    return global.YOUCITY_STATE.currentMode.trim();
  }
  
  // 3. Final fallback
  return "";
}

export function initializeYouCityAnalytics(global = globalThis) {
  const dataLayer = global.dataLayer = global.dataLayer || [];
  const previousAnalytics = global.YOUCITY_ANALYTICS;

  function track(payload = {}) {
    try {
      previousAnalytics?.track?.(payload);
    } catch (error) {
      if (global.YOUCITY_AFFILIATE_CONFIG?.debug) {
        console.warn("[YouCity Analytics] Existing analytics adapter failed:", error.message);
      }
    }

    if (!payload.event) return;

    // Extract countryCode and mode robustly
    const countryCode = extractCountryCode(payload, global);
    const mode = extractMode(payload, global);

    dataLayer.push({
      event: payload.event,
      provider: payload.provider || "",
      vertical: payload.vertical || "",
      city: payload.city || "",
      country: payload.country || "",
      country_code: countryCode,
      placement: payload.placement || "",
      variant: payload.variant || "A",
      provider_campaign: payload.providerCampaign || "",
      internal_campaign: payload.internalCampaign || "",
      mode: mode,
      language: payload.language || "",
      tone: payload.tone || ""
    });
  }

  function createEventPayload(event, overrides = {}) {
    // Extract countryCode and mode robustly from overrides
    const countryCode = overrides.countryCode && typeof overrides.countryCode === "string" 
      ? overrides.countryCode.trim() 
      : "";
      
    const mode = overrides.mode && typeof overrides.mode === "string"
      ? overrides.mode.trim()
      : "";

    return {
      event,
      provider: overrides.provider || "",
      vertical: overrides.vertical || "",
      city: overrides.city || "",
      country: overrides.country || "",
      countryCode,
      mode,
      placement: overrides.placement || "",
      variant: overrides.variant || "A",
      providerCampaign: overrides.providerCampaign || "",
      internalCampaign: overrides.internalCampaign || "",
      language: overrides.language || "",
      tone: overrides.tone || ""
    };
  }

  global.YOUCITY_ANALYTICS = { ...previousAnalytics, track, createEventPayload };
}
