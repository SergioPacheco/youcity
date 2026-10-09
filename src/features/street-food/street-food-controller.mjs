// STREET section renderer for the Destination Hub (city guide drawer).
//
// Renders "Explore Local Food" from the curated catalog. Only
// `status === "published"` records reach the DOM; drafts are invisible.
// Third-party text is always HTML-escaped. Videos use click-to-play
// privacy-enhanced embeds (no second global player instance).
// Venue pins on the Leaflet map are a follow-up: places render with an
// OpenStreetMap link until the map controller exposes a venue-pin API.

import {
  getPublishedStreetFood,
  hasPublishedStreetFood,
  placesForDish,
  videosForDish
} from "./street-food-repository.mjs";
import { loadStreetFoodCatalog } from "./street-food-loader.mjs";

const SECTION_SELECTOR = "[data-street-food-section]";

function nodeToken(node) {
  return node?.dataset?.streetToken || node?.dataset?.streetFoodSection || "";
}

function findLiveSection(root, token) {
  const nodes = root?.querySelectorAll?.(SECTION_SELECTOR);
  const list = nodes ? Array.from(nodes) : [];
  const matches = list.filter((node) => nodeToken(node) === token);
  // Prefer the connected node: after a guide refresh() the old node is
  // detached and a new placeholder (stamped with the same token) is live.
  return matches.find((node) => node?.isConnected !== false) || matches[0] || null;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function isStreetFoodEnabled(window) {
  return window?.YOUCITY_AFFILIATE_CONFIG?.features?.streetFood?.enabled === true;
}

// Sync placeholder so the city guide can render without waiting for the
// catalog. Content is hydrated lazily via hydrateStreetFoodSection().
// data-street-token mirrors data-street-food-section so hydrate can adopt
// the live node after a guide refresh() replaces it mid-fetch.
export function streetFoodPlaceholder(city) {
  const slug = escapeHtml(city?.id || "");
  return `<section class="city-guide-section street-food-section" data-street-food-section="${slug}" data-street-token="${slug}" aria-label="Local food"><p class="city-guide-loading" role="status">Loading local food…</p></section>`;
}

function placesList(places) {
  return places.length
    ? `<ul class="street-food-places">${places
        .map((place) => {
          const osmUrl = `https://www.openstreetmap.org/?mlat=${place.coordinates.lat}&mlon=${place.coordinates.lng}#map=16/${place.coordinates.lat}/${place.coordinates.lng}`;
          return `<li><button type="button" class="street-food-place" data-street-map-click="${escapeHtml(place.id)}" data-street-osm="${escapeHtml(osmUrl)}" aria-label="Show ${escapeHtml(place.name)} on map"><strong>${escapeHtml(place.name)}</strong><span>${escapeHtml(placeKindLabel(place.kind))} · map</span></button></li>`;
        })
        .join("")}</ul>`
    : "";
}

function videosList(videos) {
  return videos.length
    ? `<ul class="street-food-videos">${videos
        .map(
          (video) =>
            `<li><button type="button" class="street-food-video" data-street-video="${escapeHtml(video.id)}" aria-label="Play food video"><img src="${escapeHtml(videoThumbnail(video.id))}" alt="" loading="lazy" /><span aria-hidden="true">▶</span></button></li>`
        )
        .join("")}</ul>`
    : "";
}

function dishCard(dish, places, videos) {
  const dietMarkup =
    Array.isArray(dish.dietaryClaims) && dish.dietaryClaims.length
      ? `<p class="street-food-diet">Dietary notes: ${dish.dietaryClaims.map(escapeHtml).join(", ")} — confirm at the venue.</p>`
      : "";
  const sourceUrl = Array.isArray(dish.sources) && dish.sources[0]?.url ? dish.sources[0].url : "";
  const sourceMarkup = sourceUrl
    ? `<p class="street-food-source"><a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">Source ↗</a></p>`
    : "";
  return `<article class="street-food-card" data-street-dish="${escapeHtml(dish.id)}"><h4>${escapeHtml(dish.name)}</h4><p>${escapeHtml(dish.description)}</p>${dietMarkup}${placesList(places)}${videosList(videos)}${sourceMarkup}</article>`;
}

function placeKindLabel(kind) {
  return { market: "Market", restaurant: "Restaurant", street_stall: "Street stall", food_hall: "Food hall" }[kind] || "Local spot";
}

function videoThumbnail(videoId) {
  return `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`;
}

function foodTourOffers(affiliate, city, mode) {
  // Compatible with the documented affiliate contract; uses the existing
  // `activities` vertical because no restaurant partner is configured.
  // Callers must label generic offers as "activities", never as food tours.
  if (!affiliate?.createContext || !affiliate?.getAffiliateOffers) return [];
  const context = affiliate.createContext(city, "activities", { placement: "street_food", mode });
  return affiliate.getAffiliateOffers(context).filter((offer) => offer?.available !== false && /^https:\/\//i.test(offer?.url || ""));
}

function sectionMarkup(city, { dishes, places, videos }, { offers = [], renderOffer = () => "" } = {}) {
  const filterMarkup =
    dishes.length > 1
      ? `<div class="street-food-filters" role="group" aria-label="Filter by dish">${["all", ...dishes.map((dish) => dish.id)]
          .map(
            (id, index) =>
              `<button type="button" data-street-filter="${escapeHtml(id)}" aria-pressed="${index === 0}">${escapeHtml(id === "all" ? "All" : dishes[index - 1].name)}</button>`
          )
          .join("")}</div>`
      : "";
  const cards = dishes
    .map((dish) => dishCard(dish, placesForDish(places, dish.id), videosForDish(videos, dish.id)))
    .join("");
  const publishedDishIds = new Set(dishes.map((dish) => dish.id));
  const withoutPublishedDish = (record) => !record.dishIds?.some((id) => publishedDishIds.has(id));
  const cityPlaces = places.filter(withoutPublishedDish);
  const cityVideos = videos.filter(withoutPublishedDish);
  const cityPlacesMarkup = cityPlaces.length
    ? `<article class="street-food-card"><h4>Places around the city</h4>${placesList(cityPlaces)}</article>`
    : "";
  const cityVideosMarkup = cityVideos.length
    ? `<article class="street-food-card"><h4>More food videos</h4>${videosList(cityVideos)}</article>`
    : "";
  const offerMarkup = offers.length
    ? `<div class="street-food-tours"><span class="drawer-kicker">Guided experiences</span>${offers
        .slice(0, 2)
        .map((offer) => renderOffer(offer, city, { className: "city-guide-commerce-link", label: "Explore activities →", placement: "street_food" }))
        .filter(Boolean)
        .join("")}</div>`
    : "";
  return `<div class="street-food-content"><div class="city-guide-section-heading"><span class="drawer-kicker">Taste the city</span><h3>Explore Local Food</h3></div>${filterMarkup}<div class="street-food-cards">${cards}${cityPlacesMarkup}${cityVideosMarkup}</div>${offerMarkup}</div>`;
}

function trackEvent(window, event, city, extra = {}) {
  try {
    window?.YOUCITY_ANALYTICS?.track?.({
      event,
      city: city?.name || "",
      country: city?.country || "",
      countryCode: city?.countryCode || "",
      placement: "street_food",
      ...extra
    });
  } catch {}
}

function bindSection(section, city, { window: win, document: doc, venues = [], mapVenues = null } = {}) {
  if (typeof section?.addEventListener !== "function") return;
  const ownerDocument = doc || (typeof document !== "undefined" ? document : null);
  const venueById = new Map((Array.isArray(venues) ? venues : []).map((venue) => [venue?.id, venue]));
  section.addEventListener("click", (event) => {
    const filter = event.target?.closest?.("[data-street-filter]");
    if (filter && section.contains(filter)) {
      const id = filter.dataset.streetFilter;
      section.querySelectorAll("[data-street-filter]").forEach((button) => {
        button.setAttribute("aria-pressed", String(button === filter));
      });
      section.querySelectorAll("[data-street-dish]").forEach((card) => {
        card.hidden = id !== "all" && card.dataset.streetDish !== id;
      });
      trackEvent(win, "street_food_dish_select", city, { dish: id });
      return;
    }
    const video = event.target?.closest?.("[data-street-video]");
    if (video && section.contains(video)) {
      const videoId = video.dataset.streetVideo;
      if (!ownerDocument) return;
      const frame = ownerDocument.createElement("iframe");
      frame.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?autoplay=1&rel=0`;
      frame.title = "Food video";
      frame.loading = "lazy";
      frame.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
      frame.allowFullscreen = true;
      video.replaceWith(frame);
      trackEvent(win, "street_food_video_open", city, { video: videoId });
      return;
    }
    const place = event.target?.closest?.("[data-street-map-click]");
    if (place && section.contains(place)) {
      const venue = venueById.get(place.dataset.streetMapClick);
      trackEvent(win, "street_food_map_click", city, { place: place.dataset.streetMapClick });
      // Prefer the in-app Leaflet map; fall back to OpenStreetMap externally.
      if (venue && typeof mapVenues?.openVenue === "function") {
        Promise.resolve()
          .then(() => mapVenues.openVenue(venue))
          .catch(() => win?.open?.(place.dataset.streetOsm, "_blank", "noopener,noreferrer"));
      } else {
        win?.open?.(place.dataset.streetOsm, "_blank", "noopener,noreferrer");
      }
    }
  });
}

export async function hydrateStreetFoodSection(
  root,
  city,
  { window, document: documentRef = document, sitePath = (path) => path, affiliate, mode = "walk", mapVenues = null, renderOffer = () => "" } = {}
) {
  const section = root?.querySelector?.(SECTION_SELECTOR);
  if (!section || !city?.id) return false;
  // The token is stamped on the placeholder at render time, so after the
  // async fetch we adopt whatever node is live: the city guide re-renders
  // its content (refresh) and may have replaced our node meanwhile.
  const token = `${city.id}`;
  section.dataset.streetToken = token;
  try {
    const catalog = await loadStreetFoodCatalog({ fetchImpl: window?.fetch?.bind(window) || fetch, sitePath });
    const live = findLiveSection(root, token);
    if (!live || live.isConnected === false) return false; // stale city, discard
    if (!hasPublishedStreetFood(catalog, city.id)) {
      live.remove();
      return true;
    }
    if (live.querySelector?.(".street-food-content")) return true; // already rendered
    const data = getPublishedStreetFood(catalog, city.id);
    const offers = foodTourOffers(affiliate, city, mode);
    const venues = data.places.map((place) => ({
      ...place,
      dishNames: data.dishes.filter((dish) => place.dishIds?.includes(dish.id)).map((dish) => dish.name)
    }));
    live.innerHTML = sectionMarkup(city, data, { offers, renderOffer });
    bindSection(live, city, { window, document: documentRef, venues, mapVenues });
    trackEvent(window, "street_food_view", city, { dishes: data.dishes.length });
    return true;
  } catch {
    const live = findLiveSection(root, token);
    if (live && nodeToken(live) === token && !live.querySelector?.(".street-food-content")) {
      live.innerHTML = `<p class="city-guide-error" role="alert">Local food is temporarily unavailable.</p>`;
    }
    return false;
  }
}

export { SECTION_SELECTOR };
