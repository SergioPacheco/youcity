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

  function createEventPayload(event, overrides = {}) {
    const city = overrides.city || "";
    const country = overrides.country || "";
    const countryCode = overrides.countryCode || "";
    const mode = overrides.mode || "";
    const provider = overrides.provider || "";
    const vertical = overrides.vertical || "";
    const placement = overrides.placement || "";
    const variant = overrides.variant || "A";
    const providerCampaign = overrides.providerCampaign || "";
    const internalCampaign = overrides.internalCampaign || "";
    const language = overrides.language || "";
    const tone = overrides.tone || "";

    return {
      event,
      provider,
      vertical,
      city,
      country,
      countryCode,
      mode,
      placement,
      variant,
      providerCampaign,
      internalCampaign,
      language,
      tone
    };
  }

  global.YOUCITY_ANALYTICS = { ...previousAnalytics, track, createEventPayload };
}
