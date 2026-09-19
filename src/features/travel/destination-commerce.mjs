const QUICK_CATEGORIES = ["hotels", "activities", "cars", "flights"];
const QUICK_LABELS = {
  hotels: "Stay",
  activities: "Things to do",
  cars: "Cars",
  flights: "Flights"
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function createDestinationCommerce({
  categories = {},
  resolveOffers = () => ({}),
  renderOffer = () => "",
  secondaryCategories = []
} = {}) {
  function firstOffer(city, vertical, placement) {
    const entries = resolveOffers(city, placement)?.[vertical];
    return Array.isArray(entries) ? entries.find((entry) => entry?.url) || null : null;
  }

  function renderedOffer(entry, city, options) {
    return entry?.url ? String(renderOffer(entry, city, options) || "") : "";
  }

  function topActions(city) {
    const links = QUICK_CATEGORIES.map((vertical) => {
      const entry = firstOffer(city, vertical, "city_guide_top");
      return renderedOffer(entry, city, {
        className: "city-guide-quick-action",
        label: QUICK_LABELS[vertical],
        icon: categories[vertical]?.icon || ""
      });
    }).filter(Boolean).join("");

    return links
      ? `<nav class="city-guide-quick-actions" aria-label="Plan your visit">${links}</nav>`
      : "";
  }

  function afterPlaces(city) {
    const entry = firstOffer(city, "activities", "city_guide_after_places");
    const link = renderedOffer(entry, city, {
      className: "city-guide-commerce-link",
      label: "Explore activities →"
    });
    if (!link) return "";
    return `<section class="city-guide-commerce-card city-guide-activities-cta" aria-label="Things to do">
      <span class="city-guide-commerce-icon" aria-hidden="true">🎟</span>
      <div class="city-guide-commerce-copy">
        <strong>Things to do in ${escapeHtml(city.name)}</strong>
        <p>Tours, attractions and local experiences.</p>
      </div>
      ${link}
    </section>`;
  }

  function accommodation(city, { richAccommodationAvailable = false } = {}) {
    if (richAccommodationAvailable) return "";
    const entry = firstOffer(city, "hotels", "city_guide_stay");
    const link = renderedOffer(entry, city, {
      className: "city-guide-commerce-link",
      label: `Search stays in ${city.name}`
    });
    return link
      ? `<section class="city-guide-generic-accommodation"><span class="drawer-kicker">Where to stay</span>${link}</section>`
      : "";
  }

  function transport(city) {
    const entry = firstOffer(city, "cars", "city_guide_transport");
    const link = renderedOffer(entry, city, {
      className: "city-guide-commerce-link",
      label: "Compare car rentals →"
    });
    if (!link) return "";
    return `<section class="city-guide-commerce-card city-guide-transport-cta" aria-label="Get around">
      <span class="city-guide-commerce-icon" aria-hidden="true">🚗</span>
      <div class="city-guide-commerce-copy">
        <strong>Explore ${escapeHtml(city.name)} by car</strong>
        <p>Compare rental cars for your trip.</p>
      </div>
      ${link}
    </section>`;
  }

  function secondary(city) {
    const links = secondaryCategories.map((vertical) => {
      const entry = firstOffer(city, vertical, "city_guide_bottom");
      return renderedOffer(entry, city, {
        className: "city-guide-secondary-link",
        label: categories[vertical]?.label || vertical,
        compact: true
      });
    }).filter(Boolean).join("");

    return links
      ? `<section class="city-guide-secondary-slot">
        <span class="drawer-kicker">More for your trip</span>
        <div class="city-guide-secondary-actions">${links}</div>
      </section>`
      : "";
  }

  return { topActions, afterPlaces, accommodation, transport, secondary };
}
