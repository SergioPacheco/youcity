// Pure, testable selectors over the curated street-food catalog.
//
// The catalog is keyed by city slug (city.id at runtime, built as
// citySlug(name) in bootstrap.mjs) because data/catalog.json records
// have no stable numeric id. Only `status === "published"` records are
// ever rendered; anything else stays an editorial draft.

export const STREET_FOOD_SCHEMA_VERSION = 1;
export const STREET_FOOD_STATUSES = new Set(["published", "draft"]);
export const STREET_FOOD_PLACE_KINDS = new Set(["market", "restaurant", "street_stall", "food_hall"]);

export function getStreetFoodEntry(streetCatalog, slug) {
  const cities = Array.isArray(streetCatalog?.cities) ? streetCatalog.cities : [];
  return cities.find((entry) => entry?.slug === slug) || null;
}

function published(items) {
  return (Array.isArray(items) ? items : []).filter((item) => item?.status === "published");
}

export function hasVerifiedCoordinates(place) {
  const lat = place?.coordinates?.lat;
  const lng = place?.coordinates?.lng;
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

export function getPublishedStreetFood(streetCatalog, slug) {
  const entry = getStreetFoodEntry(streetCatalog, slug);
  if (!entry) return { dishes: [], places: [], videos: [] };
  return {
    dishes: published(entry.dishes),
    // Pins and map links require verified coordinates; list-only places
    // without coordinates never become pins.
    places: published(entry.places).filter(
      (place) => STREET_FOOD_PLACE_KINDS.has(place?.kind) && hasVerifiedCoordinates(place)
    ),
    videos: published(entry.videos)
  };
}

export function placesForDish(places, dishId) {
  return (Array.isArray(places) ? places : []).filter((place) =>
    Array.isArray(place?.dishIds) ? place.dishIds.includes(dishId) : false
  );
}

export function videosForDish(videos, dishId) {
  return (Array.isArray(videos) ? videos : []).filter((video) =>
    Array.isArray(video?.dishIds) ? video.dishIds.includes(dishId) : false
  );
}

export function hasPublishedStreetFood(streetCatalog, slug) {
  const { dishes, places, videos } = getPublishedStreetFood(streetCatalog, slug);
  return dishes.length > 0 || places.length > 0 || videos.length > 0;
}
