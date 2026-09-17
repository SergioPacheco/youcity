import { loadSecondaryProviders } from "./secondary-providers-loader.mjs";

const PRIMARY_DEFAULTS = ["hotels", "activities", "cars"];
const QUICK_CATEGORIES = ["hotels", "activities", "cars", "flights"];
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
  isStaticLocalPreview = () => false
} = {}) {
  const categories = affiliate?.getVerticals?.() || {};
  const primaryCategories = PRIMARY_DEFAULTS.filter((id) => categories[id]?.placement === "primary")
    .concat(Object.entries(categories).filter(([id, info]) => info.placement === "primary" && !PRIMARY_DEFAULTS.includes(id)).map(([id]) => id));
  const secondaryCategories = Object.entries(categories).filter(([, info]) => info.placement === "secondary").map(([id]) => id);
  let discoverCarsCatalogPromise = null;
  let cityGuidePromise = null;

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

  function offerMarkup(entry, city, options = {}) {
    if (!entry?.url) return "";
    const label = options.minimal ? categories[entry.vertical]?.label || "Open" : entry.label || ACTION_LABELS[entry.vertical] || `Explore ${categories[entry.vertical]?.label?.toLowerCase() || "options"}`;
    const metadata = `data-affiliate-offer="true" data-travel-provider="${escapeHtml(entry.provider)}" data-travel-vertical="${escapeHtml(entry.vertical)}" data-travel-city="${escapeHtml(city.id)}" data-travel-city-name="${escapeHtml(city.name)}" data-travel-country="${escapeHtml(city.rawCountry || city.country)}" data-travel-country-code="${escapeHtml(city.countryCode || "")}" data-travel-placement="${escapeHtml(entry.placement || "travel_planner")}" data-travel-variant="${escapeHtml(entry.variant || "A")}" data-travel-provider-campaign="${escapeHtml(entry.tracking?.providerCampaign || "")}" data-travel-internal-campaign="${escapeHtml(entry.tracking?.internalCampaign || "")}"`;
    return `<a class="travel-offer-action${options.compact ? " is-compact" : ""}" href="${escapeHtml(entry.url)}" target="_blank" rel="sponsored noopener noreferrer" ${metadata}><span>${escapeHtml(label)}</span><small>${escapeHtml(entry.name || entry.provider)}</small><b aria-hidden="true">↗</b></a>`;
  }

  function quickActionMarkup(category, entry, city) {
    if (!entry?.url || !categories[category]) return "";
    const metadata = `data-affiliate-offer="true" data-travel-provider="${escapeHtml(entry.provider)}" data-travel-vertical="${escapeHtml(entry.vertical)}" data-travel-city="${escapeHtml(city.id)}" data-travel-city-name="${escapeHtml(city.name)}" data-travel-country="${escapeHtml(city.rawCountry || city.country)}" data-travel-country-code="${escapeHtml(city.countryCode || "")}" data-travel-placement="${escapeHtml(entry.placement || "quick_travel_bar")}" data-travel-variant="${escapeHtml(entry.variant || "A")}" data-travel-provider-campaign="${escapeHtml(entry.tracking?.providerCampaign || "")}" data-travel-internal-campaign="${escapeHtml(entry.tracking?.internalCampaign || "")}"`;
    return `<a class="travel-quick-action" href="${escapeHtml(entry.url)}" target="_blank" rel="sponsored noopener noreferrer" ${metadata}><span class="travel-quick-icon" aria-hidden="true">${categories[category].icon}</span><span>${escapeHtml(QUICK_LABELS[category])}</span><b aria-hidden="true">↗</b></a>`;
  }

  function trackPlanningEvent(event, city, placement) {
    affiliate.track({ event, provider: "planner", vertical: "trip_planning", city: city.name, country: city.country, countryCode: city.countryCode || "", placement, variant: "A" });
  }

  function updateMainTravelCta(city, hasOffers) {
    if (!elements.travelButton) return;
    elements.travelButton.hidden = false;
    elements.travelButton.setAttribute("aria-label", `Explore ${city.name}`);
    elements.travelButton.title = `City guide and trip planning for ${city.name}`;
    Object.assign(elements.travelButton.dataset, {
      travelProvider: "planner", travelVertical: "trip_planning", travelCity: city.id,
      travelCityName: city.name, travelCountry: city.country, travelCountryCode: city.countryCode || "", travelPlacement: "main_cta"
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
    affiliate.track({ event: `affiliate_${action}`, provider: "stay22", vertical: "hotels", action, city: city.name, country: city.country, countryCode: city.countryCode || "", placement: "travel_planner", ...extra });
  }

  function destroyStay22Map() {
    elements.stay22MapFrame?.replaceChildren();
    if (elements.stay22MapPanel) elements.stay22MapPanel.hidden = true;
  }

  function renderStay22Tools(city) {
    try {
      const stay22 = window.YouCityStay22;
      if (!elements.stay22Tools || !stay22) return;
      destroyStay22Map();
      const hotelsEnabled = stay22.isEnabled("hotels");
      elements.stay22Tools.hidden = !hotelsEnabled;
      if (!hotelsEnabled) return;
      const title = elements.stay22Tools.querySelector("#stay22-stay-title");
      const description = elements.stay22Tools.querySelector(".stay22-tools-heading small");
      if (title) title.textContent = `Stay in ${city.name}`;
      if (description) description.textContent = "Find places to stay";
      const searchEnabled = stay22.isEnabled("searchbar");
      const mapEnabled = stay22.isEnabled("map");
      const browseUrl = stay22.createRoamUrl(affiliateContext(city, "hotels", "travel_planner"));
      const rentalsUrl = stay22.createRoamUrl(affiliateContext(city, "vacation-rentals", "travel_planner"));
      const applyLink = (element, url, vertical) => {
        element.hidden = !url;
        if (!url) { element.removeAttribute("href"); return; }
        element.href = url;
        Object.assign(element.dataset, { affiliateOffer: "true", travelProvider: "stay22", travelVertical: vertical, travelCityName: city.name, travelCountry: city.country, travelCountryCode: city.countryCode || "", travelPlacement: "travel_planner", travelProviderCampaign: new URL(url).searchParams.get("campaign") || "" });
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
    } catch (error) {
      destroyStay22Map();
      if (elements.stay22Tools) elements.stay22Tools.hidden = true;
      if (window.YOUCITY_AFFILIATE_CONFIG?.debug) console.warn("[YouCity Affiliate] Stay22 tools unavailable", error.message);
    }
  }

  function renderTravelPlanner(city) {
    if (!elements.travelPlanner || !elements.travelPrimary || !elements.travelSecondary) return;
    if (elements.travelPlannerLocation) elements.travelPlannerLocation.textContent = `${city.name} · ${city.country}`;
    const title = document.querySelector("#travel-planner-title");
    if (title) title.textContent = `Explore ${city.name}`;
    const offers = resolveTravelOffers(city);
    elements.travelPrimary.innerHTML = primaryCategories.map((category) => categoryMarkup(category, offers[category], city)).filter(Boolean).join("");
    const secondary = secondaryCategories.map((category) => categoryMarkup(category, offers[category], city, { secondary: true, compact: true })).filter(Boolean).join("");
    elements.travelSecondary.innerHTML = secondary ? `<div class="travel-secondary-heading">More travel options</div>${secondary}` : "";
    elements.travelDisclosure.textContent = window.YOUCITY_AFFILIATE_CONFIG?.disclosure?.short || "Travel options may include affiliate links.";
    elements.travelPlanner.classList.remove("is-demo");
    elements.travelPreviewBadge.hidden = true;
    renderStay22Tools(city);
    affiliate.observeImpressions(elements.travelPlanner);
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
      script.addEventListener("load", () => { renderTravelPlanner(currentCity()); renderTravelPrompts(currentCity()); resolve(true); }, { once: true });
      script.addEventListener("error", () => { discoverCarsCatalogPromise = null; resolve(false); }, { once: true });
      document.head.appendChild(script);
    });
    return discoverCarsCatalogPromise;
  }

  function trackTravelClick(target) {
    if (target) affiliate.trackClick(target, { mode: state.currentMode });
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
    if (!cityGuidePromise) {
      cityGuidePromise = lazyModules.load("city-guide-controller", () => import("../city-guide/city-guide-controller.mjs")).then(({ createCityGuideController }) => createCityGuideController({
        window, document, elements, getCity: currentCity, openLayer, ensureDiscoverCarsCatalog, sitePath, isStaticLocalPreview
      }));
    }
    try {
      const controller = await cityGuidePromise;
      await controller.open();
      loadSecondaryProviders({ document, sitePath }).then(() => { renderTravelPlanner(currentCity()); renderTravelPrompts(currentCity()); }).catch((error) => console.warn("[YouCity] Optional travel providers unavailable:", error.message));
    } catch (error) {
      cityGuidePromise = null;
      elements.cityGuideContent.innerHTML = '<p class="city-guide-error" role="alert">City guide data is temporarily unavailable. Try again later.</p>';
      console.warn("[YouCity] Could not load city guide:", error.message);
    }
  }

  function invalidateCityGuide() {
    cityGuidePromise?.then((controller) => controller.invalidate?.()).catch(() => {});
  }

  return { renderTravelPlanner, renderTravelPrompts, ensureDiscoverCarsCatalog, trackTravelClick, trackStay22Action, destroyStay22Map, mapPopup, openCityGuide, invalidateCityGuide };
}
