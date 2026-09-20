#!/usr/bin/env node

import assert from "node:assert/strict";
import { createDestinationCommerce } from "../src/features/travel/destination-commerce.mjs";
import { createTravelController } from "../src/features/travel/travel-controller.mjs";

const city = { id: "granada", name: "Granada", country: "Spain" };
const fixtureCategories = {
  hotels: { label: "Stay", icon: "🏨" },
  activities: { label: "Things to do", icon: "🎟" },
  cars: { label: "Cars", icon: "🚗" },
  flights: { label: "Flights", icon: "✈" },
  esim: { label: "eSIM", icon: "📱" },
  insurance: { label: "Insurance", icon: "🛡" }
};

function offer(provider, vertical, placement) {
  return { provider, vertical, placement, url: `https://example.test/${provider}/${vertical}` };
}

const fixtureOffers = {
  city_guide_top: {
    hotels: [offer("stay22", "hotels", "city_guide_top")],
    activities: [offer("stay22", "activities", "city_guide_top")],
    cars: [offer("discovercars", "cars", "city_guide_top")],
    flights: []
  },
  city_guide_after_places: {
    activities: [offer("stay22", "activities", "city_guide_after_places")]
  },
  city_guide_stay: {
    hotels: [offer("stay22", "hotels", "city_guide_stay")]
  },
  city_guide_transport: {
    cars: [offer("discovercars", "cars", "city_guide_transport")]
  },
  city_guide_bottom: {
    insurance: [offer("heymondo", "insurance", "city_guide_bottom")],
    esim: []
  }
};

const requestedPlacements = [];
const commerce = createDestinationCommerce({
  categories: fixtureCategories,
  resolveOffers: (destination, placement) => {
    assert.equal(destination, city);
    requestedPlacements.push(placement);
    return fixtureOffers[placement] || {};
  },
  renderOffer: (entry, destination, options) => `<a class="${options.className}" data-travel-placement="${entry.placement}">${options.label}</a>`,
  secondaryCategories: ["flights", "esim", "insurance"]
});

const top = commerce.topActions(city);
assert.match(top, /Stay/);
assert.match(top, /Things to do/);
assert.match(top, /Cars/);
assert.doesNotMatch(top, /Flights/);
assert.match(top, /city_guide_top/);

const afterPlaces = commerce.afterPlaces(city);
assert.match(afterPlaces, /Things to do in Granada/);
assert.match(afterPlaces, /city_guide_after_places/);

assert.equal(commerce.accommodation(city, { richAccommodationAvailable: true }), "");
assert.match(commerce.accommodation(city, { richAccommodationAvailable: false }), /city_guide_stay/);

const transport = commerce.transport(city);
assert.match(transport, /Explore Granada by car/);
assert.match(transport, /city_guide_transport/);

const secondary = commerce.secondary(city);
assert.match(secondary, /Insurance/);
assert.match(secondary, /city_guide_bottom/);
assert.doesNotMatch(secondary, /Flights/);

assert.deepEqual([...new Set(requestedPlacements)].sort(), [
  "city_guide_after_places",
  "city_guide_bottom",
  "city_guide_stay",
  "city_guide_top",
  "city_guide_transport"
].sort());

const emptyCommerce = createDestinationCommerce({
  categories: fixtureCategories,
  resolveOffers: () => ({}),
  renderOffer: () => "",
  secondaryCategories: ["flights", "esim", "insurance"]
});
assert.equal(emptyCommerce.topActions(city), "");
assert.equal(emptyCommerce.afterPlaces(city), "");
assert.equal(emptyCommerce.accommodation(city), "");
assert.equal(emptyCommerce.transport(city), "");
assert.equal(emptyCommerce.secondary(city), "");

{
  const categories = {
    hotels: { label: "Stay", icon: "🏨", description: "Hotels and stays", placement: "primary" },
    activities: { label: "Things to do", icon: "🎟", description: "Tours and experiences", placement: "primary" },
    cars: { label: "Get around", icon: "🚗", description: "Car rentals", placement: "primary" },
    flights: { label: "Get there", icon: "✈", description: "Compare flights", placement: "secondary" },
    insurance: { label: "Insurance", icon: "🛡", description: "Travel insurance", placement: "secondary" }
  };
  const affiliate = {
    getVerticals: () => categories,
    createContext: (destination, vertical, options) => ({ city: destination, vertical, placement: options.placement }),
    getAffiliateOffers: (context) => {
      const available = { hotels: "stay22", activities: "stay22", cars: "discovercars", flights: "stay22", insurance: "heymondo" };
      if (!available[context.vertical]) return [];
      return [{
        provider: available[context.vertical],
        vertical: context.vertical,
        placement: context.placement,
        url: `https://example.test/${context.vertical}`,
        label: context.vertical
      }];
    },
    observeImpressions() {},
    track() {},
    trackClick() {}
  };
  const elements = {
    travelPlanner: { classList: { remove() {} } },
    travelPrimary: { innerHTML: "" },
    travelSecondary: { innerHTML: "" },
    travelDisclosure: { textContent: "" },
    travelPreviewBadge: { hidden: false },
    travelPlannerLocation: { textContent: "" },
    travelPrompts: { hidden: false },
    travelQuickActions: { innerHTML: "" },
    travelPromptsCity: { textContent: "" },
    cityGuideStaySlot: { hidden: false },
    cityGuideStayFallback: { innerHTML: "" },
    cityGuideTransportSlot: { hidden: false, innerHTML: "" },
    cityGuideSecondarySlot: { hidden: false, innerHTML: "" },
    stay22Tools: null
  };
  const popup = { closed: false, location: { href: "" } };
  const integrationWindow = {
    YOUCITY_AFFILIATE_CONFIG: { disclosure: { short: "Disclosure" } },
    YOUCITY_DISCOVERCARS_LOCATIONS: {
      "sao-paulo-br": {
        youCityId: "sao-paulo",
        youCityName: "São Paulo",
        latitude: -23.5505,
        longitude: -46.6333,
        discoverCars: { airports: [{ name: "CGH" }] }
      },
      "granada-es": {
        youCityId: "granada",
        youCityName: "Granada",
        latitude: 37.1773,
        longitude: -3.5986,
        discoverCars: { airports: [{ name: "GRX" }] }
      }
    },
    navigator: {
      geolocation: {
        getCurrentPosition(success) {
          success({ coords: { latitude: -23.5505, longitude: -46.6333 } });
        }
      }
    },
    open: () => popup
  };
  const travel = createTravelController({
    window: integrationWindow,
    document: { querySelector: () => null },
    elements,
    state: { currentMode: "drive" },
    affiliate,
    sitePath: (path) => path,
    lazyModules: { load: async () => ({}) },
    modeLabels: {},
    availableModes: () => [],
    currentCity: () => city,
    openLayer() {},
    closeLayer() {},
    selectCity() {},
    showToast() {}
  });
  travel.renderTravelPlanner(city);
  travel.renderTravelPrompts(city);
  assert.equal(elements.travelPrompts.hidden, true, "travel prompt should stay hidden before the planner is opened");
  travel.renderTravelPrompts(city, { reveal: true });
  assert.equal(elements.travelPrompts.hidden, false, "travel prompt should appear after the planner is opened");
  assert.match(elements.cityGuideStayFallback.innerHTML, /data-travel-placement="city_guide_stay"/);
  assert.equal(elements.cityGuideStaySlot.hidden, false);
  assert.match(elements.cityGuideTransportSlot.innerHTML, /data-travel-placement="city_guide_transport"/);
  assert.equal(elements.cityGuideTransportSlot.hidden, false);
  assert.match(elements.cityGuideSecondarySlot.innerHTML, /data-travel-placement="city_guide_bottom"/);
  assert.equal(elements.cityGuideSecondarySlot.hidden, false);
  assert.match(elements.cityGuideTransportSlot.innerHTML, /rel="sponsored noopener noreferrer"/);
  assert.doesNotMatch(elements.cityGuideStayFallback.innerHTML, /travel_planner/);
  assert.match(elements.travelQuickActions.innerHTML, /data-travel-vertical="flights"/);
  assert.match(elements.travelQuickActions.innerHTML, /data-travel-flight-origin="true"/);
  const openedFlightUrl = await travel.openFlightOffer({ href: "https://example.test/flights?category=flight" }, city);
  assert.equal(new URL(openedFlightUrl).searchParams.get("fromiata"), "CGH");
  assert.equal(new URL(openedFlightUrl).searchParams.get("toiata"), "GRX");
  assert.equal(popup.location.href, openedFlightUrl);

  const slowPopup = {
    closed: false,
    location: { href: "" },
    document: { title: "", body: { textContent: "" } }
  };
  const slowTravel = createTravelController({
    window: {
      YOUCITY_DISCOVERCARS_LOCATIONS: integrationWindow.YOUCITY_DISCOVERCARS_LOCATIONS,
      navigator: {
        geolocation: {
          getCurrentPosition(success) {
            setTimeout(() => success({ coords: { latitude: -23.5505, longitude: -46.6333 } }), 50);
          }
        }
      },
      open: () => slowPopup
    },
    document: { querySelector: () => null },
    elements,
    state: { currentMode: "drive" },
    affiliate,
    currentCity: () => city,
    flightOriginWaitMs: 1
  });
  const fastFallbackUrl = await slowTravel.openFlightOffer({ href: "https://example.test/flights?category=flight" }, city);
  assert.equal(new URL(fastFallbackUrl).searchParams.get("fromiata"), null, "slow location lookup must not block the flight search");
  assert.equal(new URL(fastFallbackUrl).searchParams.get("toiata"), "GRX");
  assert.match(slowPopup.document.body.textContent, /Opening flight search/);
}

{
  const elements = {
    travelPlanner: { classList: { remove() {} } },
    travelPrimary: { innerHTML: "" },
    travelSecondary: { innerHTML: "" },
    travelDisclosure: { textContent: "" },
    travelPreviewBadge: { hidden: false },
    travelPlannerLocation: { textContent: "" },
    cityGuideStaySlot: { hidden: false },
    cityGuideStayFallback: { innerHTML: "" },
    cityGuideTransportSlot: { hidden: false, innerHTML: "" },
    cityGuideSecondarySlot: { hidden: false, innerHTML: "" },
    stay22Tools: null
  };
  const travel = createTravelController({
    window: { YOUCITY_AFFILIATE_CONFIG: { disclosure: { short: "Disclosure" } } },
    document: { querySelector: () => null },
    elements,
    state: { currentMode: "drive" },
    affiliate: {
      getVerticals: () => fixtureCategories,
      createContext: () => ({}),
      getAffiliateOffers: () => [],
      observeImpressions() {},
      track() {},
      trackClick() {}
    },
    sitePath: (path) => path,
    lazyModules: { load: async () => ({}) },
    modeLabels: {},
    availableModes: () => [],
    currentCity: () => city,
    openLayer() {},
    closeLayer() {},
    selectCity() {},
    showToast() {}
  });
  travel.renderTravelPlanner(city);
  assert.equal(elements.cityGuideStaySlot.hidden, true);
  assert.equal(elements.cityGuideTransportSlot.hidden, true);
  assert.equal(elements.cityGuideSecondarySlot.hidden, true);
}

console.log("Destination commerce tests passed: valid offers, placements, partial availability, and Stay22 suppression.");
