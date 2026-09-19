import { loadSecondaryProviders } from "./secondary-providers-loader.mjs";
import { createDestinationCommerce } from "./destination-commerce.mjs";
import { airportsFromDiscoverCars, buildFlightSearchUrl, createFlightOriginResolver } from "./flight-origin.mjs";

const PRIMARY_DEFAULTS = ["hotels", "activities", "cars"];
const QUICK_CATEGORIES = ["hotels", "activities", "cars", "flights"];
const DEFAULT_FLIGHT_ORIGIN_WAIT_MS = 1_200;
const ACTION_LABELS = {
  hotels: "Find a place to stay",
  "vacation-rentals": "Find vacation rentals",
  activities: "Things to do",
  cars: "Rent a car",
  flights: "Find flights"
};
const QUICK_LABELS = { hotels: "Stay", activities: "Things to do", cars: "Cars", flights: "Flights" };

function escapeHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function createTravelController({
  window,
  document,
  elements,
  state,
  cities,
  affiliate = window.YouCityAffiliate,
  sitePath,
  lazyModules,
  modeLabels,
  availableModes,
  currentCity,
  openLayer,
  closeLayer,
  selectCity,
  showToast,
  loadStay22 = async () => false,
  flightOriginWaitMs = DEFAULT_FLIGHT_ORIGIN_WAIT_MS,
  isStaticLocalPreview = () => false
} = {}) {
  const categories = affiliate?.getVerticals?.() || {};
  const primaryCategories = PRIMARY_DEFAULTS.filter((id) => categories[id]?.placement === "primary")
    .concat(Object.entries(categories).filter(([id, info]) => info.placement === "primary" && !PRIMARY_DEFAULTS.includes(id)).map(([id]) => id));
  const secondaryCategories = Object.entries(categories).filter(([, info]) => info.placement === "secondary").map(([id]) => id);
  let discoverCarsCatalogPromise = null;
  let cityGuidePromise = null;
  const flightOriginResolver = createFlightOriginResolver({
    geolocation: window?.navigator?.geolocation,
    getAirports: () => airportsFromDiscoverCars(window?.YOUCITY_DISCOVERCARS_LOCATIONS)
  });

  function affiliateContext(city, vertical, placement) {
    return affiliate.createContext(city, vertical, { placement, mode: state.currentMode });
  }

  function resolveTravelOffers(city, placement = "travel_planner") {
    const offers = {};
    [...primaryCategories, ...secondaryCategories].forEach((vertical) => {
      offers[vertical] = affiliate.getAffiliateOffers(affiliateContext(city, vertical, placement));
    });
    return offers;
  }

  function affiliateMetadata(entry, city, placementFallback = "travel_planner") {
    return `data-affiliate-offer="true" data-travel-provider="${escapeHtml(entry.provider)}" data-travel-vertical="${escapeHtml(entry.vertical)}" data-travel-city="${escapeHtml(city.id)}" data-travel-city-name="${escapeHtml(city.name)}" data-travel-country="${escapeHtml(city.rawCountry || city.country)}" data-travel-country-code="${escapeHtml(city.countryCode || "")}" data-travel-placement="${escapeHtml(entry.placement || placementFallback)}" data-travel-variant="${escapeHtml(entry.variant || "A")}" data-travel-provider-campaign="${escapeHtml(entry.tracking?.providerCampaign || "")}" data-travel-internal-campaign="${escapeHtml(entry.tracking?.internalCampaign || "")}" data-travel-mode="${escapeHtml(state.currentMode)}"`;
  }

  function offerMarkup(entry, city, options = {}) {
    if (!entry?.url) return "";
    const label = options.label || (options.minimal ? categories[entry.vertical]?.label || "Open" : entry.label || ACTION_LABELS[entry.vertical] || `Explore ${categories[entry.vertical]?.label?.toLowerCase() || "options"}`);
    const className = options.className || `travel-offer-action${options.compact ? " is-compact" : ""}`;
    const icon = options.icon ? `<span class="travel-quick-icon" aria-hidden="true">${escapeHtml(options.icon)}</span>` : "";
    const provider = options.showProvider === false ? "" : `<small>${escapeHtml(entry.name || entry.provider)}</small>`;
    const metadata = affiliateMetadata(entry, city, options.placement || "travel_planner");
    const flightOrigin = entry.vertical === "flights" ? ' data-travel-flight-origin="true"' : "";
    return `<a class="${escapeHtml(className)}" href="${escapeHtml(entry.url)}" target="_blank" rel="sponsored noopener noreferrer" ${metadata}${flightOrigin}>${icon}<span>${escapeHtml(label)}</span>${provider}<b aria-hidden="true">↗</b></a>`;
  }

  function quickActionMarkup(category, entry, city) {
    if (!entry?.url || !categories[category]) return "";
    return offerMarkup(entry, city, {
      className: "travel-quick-action",
      label: QUICK_LABELS[category],
      icon: categories[category].icon,
      placement: "quick_travel_bar",
      showProvider: false
    });
  }

  function trackPlanningEvent(event, city, placement) {
    affiliate.track({ event, provider: "planner", vertical: "trip_planning", city: city.name, country: city.country, countryCode: city.countryCode || "", placement, variant: "A", mode: state.currentMode });
  }

  function updateMainTravelCta(city, hasOffers) {
    if (!elements.travelButton) return;
    elements.travelButton.hidden = false;
    elements.travelButton.setAttribute("aria-label", `Explore ${city.name} city guide and trip planning`);
    elements.travelButton.title = `City guide, stays and things to do in ${city.name}`;
    Object.assign(elements.travelButton.dataset, {
      travelProvider: "planner", travelVertical: "trip_planning", travelCity: city.id,
      travelCityName: city.name, travelCountry: city.country, travelCountryCode: city.countryCode || "", travelPlacement: "main_cta", travelMode: state.currentMode
    });
    if (hasOffers && state.mainCtaImpressionCity !== city.id) {
      state.mainCtaImpressionCity = city.id;
      trackPlanningEvent("affiliate_impression", city, "main_cta");
    }
  }

  function renderQuickTravelActions(city, placement = "quick_travel_bar") {
    const offers = resolveTravelOffers(city, placement);
    const actions = QUICK_CATEGORIES.map((category) => quickActionMarkup(category, offers[category]?.[0], city)).filter(Boolean).join("");
    return { offers, actions, hasOffers: Boolean(actions) };
  }

  function renderTravelPrompts(city) {
    const { actions, hasOffers } = renderQuickTravelActions(city);
    updateMainTravelCta(city, hasOffers);
    if (!elements.travelPrompts || !elements.travelQuickActions) return;
    elements.travelPrompts.hidden = !hasOffers;
    if (!hasOffers) {
      elements.travelQuickActions.replaceChildren();
      return;
    }
    elements.travelPromptsCity.textContent = city.name;
    elements.travelQuickActions.innerHTML = actions;
    affiliate.observeImpressions(elements.travelPrompts);
    if (!window.YOUCITY_DISCOVERCARS_LOCATIONS) ensureDiscoverCarsCatalog();
  }

  function categoryMarkup(category, entries, city, options = {}) {
    const info = categories[category];
    if (!info || !entries?.length) return "";
    const actions = entries.map((entry) => offerMarkup(entry, city, options)).filter(Boolean).join("");
    if (!actions) return "";
    return `<article class="travel-category${options.secondary ? " is-secondary" : ""}" data-travel-category-card="${escapeHtml(category)}"><div class="travel-category-heading"><span class="travel-category-icon" aria-hidden="true">${info.icon}</span><div><strong>${escapeHtml(info.label)}</strong><small>${escapeHtml(info.description)}</small></div></div><div class="travel-category-actions">${actions}</div></article>`;
  }

  function trackStay22Action(action, extra = {}) {
    const city = currentCity();
    affiliate.track({ event: `affiliate_${action}`, provider: "stay22", vertical: "hotels", action, city: city.name, country: city.country, countryCode: city.countryCode || "", placement: "city_guide_stay", mode: state.currentMode, ...extra });
  }

  function destroyStay22Map() {
    elements.stay22MapFrame?.replaceChildren();
    if (elements.stay22MapPanel) elements.stay22MapPanel.hidden = true;
  }

  function renderStay22Tools(city) {
    try {
      const stay22 = window.YouCityStay22;
      if (!elements.stay22Tools || !stay22) return false;
      destroyStay22Map();
      const hotelsEnabled = stay22.isEnabled("hotels");
      elements.stay22Tools.hidden = !hotelsEnabled;
      if (!hotelsEnabled) return false;
      const title = elements.stay22Tools.querySelector("#stay22-stay-title");
      const description = elements.stay22Tools.querySelector(".stay22-tools-heading small");
      if (title) title.textContent = `Stay in ${city.name}`;
      if (description) description.textContent = "Find places to stay";
      const searchEnabled = stay22.isEnabled("searchbar");
      const mapEnabled = stay22.isEnabled("map");
      const browseUrl = stay22.createRoamUrl(affiliateContext(city, "hotels", "city_guide_stay"));
      const rentalsUrl = stay22.createRoamUrl(affiliateContext(city, "vacation-rentals", "city_guide_stay"));
      const applyLink = (element, url, vertical) => {
        element.hidden = !url;
        if (!url) { element.removeAttribute("href"); return; }
        element.href = url;
        Object.assign(element.dataset, { affiliateOffer: "true", travelProvider: "stay22", travelVertical: vertical, travelCity: city.id, travelCityName: city.name, travelCountry: city.country, travelCountryCode: city.countryCode || "", travelPlacement: "city_guide_stay", travelProviderCampaign: new URL(url).searchParams.get("campaign") || "", travelMode: state.currentMode });
      };
      applyLink(elements.stay22BrowseButton, browseUrl, "hotels");
      applyLink(elements.stay22RentalsButton, rentalsUrl, "vacation-rentals");
      elements.stay22SearchForm.hidden = !searchEnabled;
      elements.stay22MapButton.hidden = !mapEnabled;
      elements.stay22SearchStatus.textContent = "";
      elements.stay22SearchResult.hidden = true;
      elements.stay22SearchResult.removeAttribute("href");
      elements.stay22Checkin.min = stay22.today();
      elements.stay22Checkout.min = stay22.today();
      elements.stay22SearchForm.dataset.cityId = city.id;
      return true;
    } catch (error) {
      destroyStay22Map();
      if (elements.stay22Tools) elements.stay22Tools.hidden = true;
      if (window.YOUCITY_AFFILIATE_CONFIG?.debug) console.warn("[YouCity Affiliate] Stay22 tools unavailable", error.message);
      return false;
    }
  }

  const commerce = createDestinationCommerce({
    categories,
    resolveOffers: resolveTravelOffers,
    renderOffer: offerMarkup,
    secondaryCategories
  });

  function renderDestinationCommerce(city) {
    if (!city) return;
    const richAccommodationAvailable = Boolean(window.YouCityStay22?.isEnabled?.("hotels") && elements.stay22Tools);
    const accommodationFallback = commerce.accommodation(city, { richAccommodationAvailable });
    const transport = commerce.transport(city);
    const secondary = commerce.secondary(city);
    if (elements.cityGuideStayFallback) elements.cityGuideStayFallback.innerHTML = accommodationFallback;
    if (elements.cityGuideTransportSlot) elements.cityGuideTransportSlot.innerHTML = transport;
    if (elements.cityGuideSecondarySlot) elements.cityGuideSecondarySlot.innerHTML = secondary;
    const richAccommodationRendered = renderStay22Tools(city);
    if (elements.cityGuideStaySlot) elements.cityGuideStaySlot.hidden = !(richAccommodationRendered || accommodationFallback);
    if (elements.cityGuideTransportSlot) elements.cityGuideTransportSlot.hidden = !transport;
    if (elements.cityGuideSecondarySlot) elements.cityGuideSecondarySlot.hidden = !secondary;
    affiliate.observeImpressions(elements.travelPlanner);
  }

  function renderTravelPlanner(city) {
    if (!elements.travelPlanner) return;
    if (elements.travelPlannerLocation) elements.travelPlannerLocation.textContent = `${city.name} · ${city.country}`;
    const title = document.querySelector("#travel-planner-title");
    if (title) title.textContent = `Explore ${city.name}`;
    elements.travelDisclosure.textContent = window.YOUCITY_AFFILIATE_CONFIG?.disclosure?.short || "Travel options may include affiliate links.";
    elements.travelPlanner.classList.remove("is-demo");
    elements.travelPreviewBadge.hidden = true;
    renderDestinationCommerce(city);
  }

  function ensureDiscoverCarsCatalog() {
    if (window.YOUCITY_DISCOVERCARS_LOCATIONS) return Promise.resolve(true);
    if (discoverCarsCatalogPromise) return discoverCarsCatalogPromise;
    discoverCarsCatalogPromise = new Promise((resolve) => {
      const script = document.createElement("script");
      const version = String(window.YOUCITY_ASSET_VERSION || "").trim();
      script.src = `${sitePath("/src/features/travel/discovercars-locations.js")}${version ? `?v=${encodeURIComponent(version)}` : ""}`;
      script.async = true;
      script.dataset.youcityDiscoverCars = "true";
      script.addEventListener("load", () => { refreshDestinationHub(currentCity()); renderTravelPrompts(currentCity()); resolve(true); }, { once: true });
      script.addEventListener("error", () => { discoverCarsCatalogPromise = null; resolve(false); }, { once: true });
      document.head.appendChild(script);
    });
    return discoverCarsCatalogPromise;
  }

  function trackTravelClick(target) {
    if (target) affiliate.trackClick(target, { mode: state.currentMode });
  }

  function destinationAirport(city) {
    const airports = airportsFromDiscoverCars(window?.YOUCITY_DISCOVERCARS_LOCATIONS);
    return airports.find((airport) => airport.cityId === city?.id)
      || airports.find((airport) => airport.cityName && airport.cityName.toLowerCase() === String(city?.name || "").toLowerCase())
      || null;
  }

  function resolveFlightOriginQuickly() {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      };
      const timer = setTimeout(() => finish(null), Math.max(0, Number(flightOriginWaitMs) || 0));
      flightOriginResolver.resolve().then(finish).catch(() => finish(null));
    });
  }

  function showFlightLoading(popup, city) {
    try {
      if (!popup?.document?.body) return;
      popup.document.title = `Opening flights to ${city?.name || "your destination"}`;
      popup.document.body.textContent = `Opening flight search for ${city?.name || "your destination"}…`;
    } catch {}
  }

  async function openFlightOffer(target, city = currentCity()) {
    if (!target?.href) return "";
    const destination = destinationAirport(city);
    const fallbackUrl = buildFlightSearchUrl(target.href, { toIata: destination?.code });
    if (!fallbackUrl) return "";
    const popup = (() => {
      try { return window.open?.("", "_blank", "noopener,noreferrer"); } catch { return null; }
    })();
    showFlightLoading(popup, city);
    const origin = await resolveFlightOriginQuickly();
    const fromIata = origin?.code && origin.code !== destination?.code ? origin.code : "";
    const url = buildFlightSearchUrl(fallbackUrl, { fromIata, toIata: destination?.code });
    if (!url) return "";
    if (popup && !popup.closed) {
      popup.location.href = url;
    } else if (window.location?.assign) {
      window.location.assign(url);
    }
    return url;
  }

  function refreshDestinationHub(city) {
    if (!city) return;
    renderTravelPlanner(city);
    if (!elements.travelDrawer?.classList?.contains?.("is-open")) return;
    cityGuidePromise?.then((controller) => {
      if (currentCity()?.id === city.id) controller.refresh?.();
    }).catch(() => {});
  }

  function travelRecommendationMarkup(city) {
    const offers = resolveTravelOffers(city, "map_popup");
    const sections = [...primaryCategories, ...secondaryCategories].flatMap((category) => (offers[category] || []).map((entry) => offerMarkup(entry, city, { minimal: true }))).filter(Boolean).join("");
    return sections ? `<div class="map-travel"><span>More for this city</span><div class="map-travel-actions">${sections}</div></div>` : "";
  }

  function mapPopup(city, index) {
    const modeSections = Object.entries(city.videos).filter(([, videos]) => videos?.length).map(([mode, videos]) => `<div class="map-video-group"><div class="map-video-heading"><strong>${escapeHtml(modeLabels[mode] || mode)}</strong><span>${videos.length} ${videos.length === 1 ? "video" : "videos"}</span></div><ul>${videos.map((_, videoIndex) => `<li><button type="button" data-map-play data-city="${index}" data-mode="${escapeHtml(mode)}" data-video-index="${videoIndex}">▶ Play video ${videoIndex + 1}</button></li>`).join("")}</ul></div>`).join("");
    const travel = travelRecommendationMarkup(city);
    return `<div class="map-popup"><div class="map-popup-title"><strong>${escapeHtml(city.name)}</strong><span>${escapeHtml(city.country)}</span></div><div class="map-popup-availability"><span>${availableModes(city).length ? "Available" : "No video yet"}</span></div><div class="map-popup-videos">${modeSections || "<p>No videos available.</p>"}</div>${travel ? `<details class="map-trip-plan"><summary>Plan this trip</summary>${travel.replace('<div class="map-travel">', '<div class="map-travel map-travel-inside">')}</details>` : ""}</div>`;
  }

  async function openCityGuide() {
    if (!elements.travelDrawer || !elements.cityGuideContent || !currentCity()) return;
    const stay22Promise = Promise.resolve(loadStay22()).catch(() => false);
    if (!cityGuidePromise) {
      cityGuidePromise = lazyModules.load("city-guide-controller", () => import("../city-guide/city-guide-controller.mjs")).then(({ createCityGuideController }) => createCityGuideController({
        window, document, elements, getCity: currentCity, openLayer, sitePath, isStaticLocalPreview,
        renderCommerce: {
          topActions: (city) => commerce.topActions(city),
          afterPlaces: (city) => commerce.afterPlaces(city)
        }
      }));
    }
    try {
      const controller = await cityGuidePromise;
      await controller.open();
      const city = currentCity();
      renderTravelPlanner(city);
      ensureDiscoverCarsCatalog();
      await stay22Promise;
      refreshDestinationHub(currentCity());
      renderTravelPrompts(currentCity());

      // Analytics: travel_planner_open
      window.YOUCITY_ANALYTICS?.track?.({
        event: "travel_planner_open",
        city: city.name,
        country: city.country,
        countryCode: city.countryCode || "",
        mode: state.currentMode
      });
      window.YOUCITY_ANALYTICS?.track?.({
        event: "city_guide_open",
        city: city.name,
        country: city.country,
        countryCode: city.countryCode || "",
        mode: state.currentMode
      });

      loadSecondaryProviders({ document, sitePath }).then(() => { refreshDestinationHub(currentCity()); renderTravelPrompts(currentCity()); }).catch((error) => console.warn("[YouCity] Optional travel providers unavailable:", error.message));
    } catch (error) {
      cityGuidePromise = null;
      elements.cityGuideContent.innerHTML = '<p class="city-guide-error" role="alert">City guide data is temporarily unavailable. Try again later.</p>';
      console.warn("[YouCity] Could not load city guide:", error.message);
    }
  }

  function invalidateCityGuide() {
    cityGuidePromise?.then((controller) => controller.invalidate?.()).catch(() => {});
  }

  return { renderTravelPlanner, renderDestinationCommerce, renderTravelPrompts, ensureDiscoverCarsCatalog, trackTravelClick, openFlightOffer, trackStay22Action, destroyStay22Map, mapPopup, openCityGuide, invalidateCityGuide };
}
