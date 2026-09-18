(function initializeAffiliateTracking(global) {
  const observedElements = new WeakSet();

  function config() {
    return global.YOUCITY_AFFILIATE_CONFIG || {};
  }

  function developmentLog(message, error) {
    if (config().debug || /localhost|127\.0\.0\.1/.test(global.location?.hostname || "")) {
      console.warn(`[YouCity Affiliate] ${message}`, error || "");
    }
  }

  function track(payload) {
    try {
      global.YOUCITY_ANALYTICS?.track?.(payload);
    } catch (error) {
      developmentLog("Analytics failed; navigation continues.", error.message);
    }
  }

  function payloadFromElement(element, event) {
    const data = element?.dataset || {};
    return {
      event,
      provider: data.travelProvider || data.affiliateProvider,
      vertical: data.travelVertical || data.travelCategory || data.affiliateVertical,
      city: data.travelCityName || data.travelCity,
      country: data.travelCountry,
      countryCode: data.travelCountryCode,
      placement: data.travelPlacement || "travel_planner",
      variant: data.travelVariant || "A",
      providerCampaign: data.travelProviderCampaign || "",
      internalCampaign: data.travelInternalCampaign || "",
      mode: data.travelMode || ""
    };
  }

  function trackImpression(element) {
    if (!element || observedElements.has(element)) return;
    observedElements.add(element);
    track(payloadFromElement(element, "affiliate_impression"));
  }

  function observeImpressions(root) {
    if (!root) return;
    const observe = (element) => {
      if (!element.matches?.("[data-affiliate-offer]")) return;
      if (global.IntersectionObserver) {
        const observer = new IntersectionObserver((entries, instance) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && entry.intersectionRatio >= 0.25) {
              trackImpression(element);
              instance.unobserve(element);
            }
          });
        }, { threshold: [0.25] });
        observer.observe(element);
      } else {
        trackImpression(element);
      }
    };
    root.querySelectorAll?.("[data-affiliate-offer]").forEach(observe);
    if (root.matches?.("[data-affiliate-offer]")) observe(root);
    if (!global.MutationObserver || root.dataset.affiliateObserverAttached) return;
    root.dataset.affiliateObserverAttached = "true";
    new MutationObserver(() => root.querySelectorAll("[data-affiliate-offer]").forEach(observe)).observe(root, { childList: true, subtree: true });
  }

  function trackClick(element, extra = {}) {
    track({ ...payloadFromElement(element, "affiliate_click"), ...extra });
  }

  function decorateUrl(value, providerConfig, context) {
    if (!value) return "";
    try {
      const url = new URL(value);
      const query = providerConfig?.tracking?.query || {};
      Object.entries(query).forEach(([parameter, contextKey]) => {
        const valueFromContext = context?.tracking?.[contextKey];
        if (valueFromContext) url.searchParams.set(parameter, valueFromContext);
      });
      return url.toString();
    } catch {
      return "";
    }
  }

  global.YouCityAffiliateTracking = { track, trackImpression, observeImpressions, trackClick, decorateUrl };
})(window);
