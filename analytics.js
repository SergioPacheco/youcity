(function initializeYouCityAnalytics(global) {
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

    dataLayer.push({
      event: payload.event,
      provider: payload.provider || "",
      vertical: payload.vertical || "",
      city: payload.city || "",
      country: payload.country || "",
      country_code: payload.countryCode || "",
      placement: payload.placement || "",
      variant: payload.variant || "A",
      provider_campaign: payload.providerCampaign || "",
      internal_campaign: payload.internalCampaign || "",
      mode: payload.mode || "",
      language: payload.language || "",
      tone: payload.tone || ""
    });
  }

  global.YOUCITY_ANALYTICS = { ...previousAnalytics, track };
})(window);
