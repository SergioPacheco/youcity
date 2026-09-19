#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createCityGuideController } from "../src/features/city-guide/city-guide-controller.mjs";

const root = resolve(new URL(".", import.meta.url).pathname, "..");
const indexHtml = readFileSync(resolve(root, "index.html"), "utf8");
const stylesCss = readFileSync(resolve(root, "styles.css"), "utf8");
assert.match(indexHtml, /id="city-guide-stay-slot"/);
assert.match(indexHtml, /id="city-guide-transport-slot"/);
assert.match(indexHtml, /id="city-guide-secondary-slot"/);
assert.match(indexHtml, /id="stay22-search-form"/);
assert.match(indexHtml, /id="stay22-map-button"/);
assert.match(indexHtml, /View stays on map/);
assert.match(stylesCss, /@media \(min-width: 900px\)[\s\S]*\.travel-drawer \.travel-panel/);
assert.match(stylesCss, /@media \(max-width: 899px\)[\s\S]*\.travel-drawer \.travel-panel/);
assert.match(stylesCss, /\.city-guide-place-card/);

const city = {
  id: "granada",
  name: "Granada",
  country: "Spain",
  note: "Moorish palaces, historic streets and the Sierra Nevada.",
  coordinates: [37.1773, -3.5986]
};

const editorialData = {
  city: "Granada",
  country: "Spain",
  wikipedia: {
    description: "Andalusian city known for the Alhambra.",
    extract: "Granada is a city in Andalusia with a long history and a dramatic landscape.",
    url: "https://en.wikipedia.org/wiki/Granada"
  },
  places: [{
    name: "Alhambra",
    description: "Palace and fortress complex overlooking Granada.",
    url: "https://en.wikipedia.org/wiki/Alhambra",
    image: {
      thumbnailUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/alhambra.jpg",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:Alhambra.jpg",
      artist: "A Wikimedia photographer"
    }
  }]
};

function createElements() {
  return {
    travelDrawer: {},
    cityGuideContent: { innerHTML: "" },
    travelButton: { setAttribute() {} }
  };
}

function createDocument() {
  return { documentElement: { lang: "en" } };
}

function createController({ getCity = () => city, fetchImpl, commerce = {} } = {}) {
  const elements = createElements();
  const previousFetch = globalThis.fetch;
  globalThis.fetch = fetchImpl || (async () => ({ ok: true, json: async () => editorialData }));
  const controller = createCityGuideController({
    window: { location: { origin: "http://localhost" }, YOUCITY_ANALYTICS: { track() {} } },
    document: createDocument(),
    elements,
    getCity,
    openLayer() {},
    ensureDiscoverCarsCatalog() {},
    sitePath: (path) => path,
    isStaticLocalPreview: () => false,
    renderCommerce: commerce
  });
  return { controller, elements, restoreFetch: () => { globalThis.fetch = previousFetch; } };
}

const commerce = {
  topActions: (destination) => `<nav class="city-guide-quick-actions">Stay in ${destination.name}</nav>`,
  afterPlaces: () => `<section class="city-guide-after-places">city-guide-after-places</section>`
};

{
  const { controller, elements, restoreFetch } = createController({ commerce });
  try {
    await controller.open();
    const html = elements.cityGuideContent.innerHTML;
    assert.match(html, /Granada/);
    assert.match(html, /Alhambra/);
    assert.match(html, /Learn more/);
    assert.match(html, /Source: Wikipedia/);
    assert.match(html, /city-guide-quick-actions/);
    assert.match(html, /city-guide-after-places/);
    assert.match(html, /href="https:\/\/en\.wikipedia\.org\/wiki\/Alhambra"/);
    assert.doesNotMatch(html, /class="city-guide-place-photo" href="https:\/\/commons\.wikimedia\.org/);
    assert.match(html, /data-city-guide-place-click="true"/);

    const placesIndex = html.indexOf("city-guide-places");
    const afterPlacesIndex = html.indexOf("city-guide-after-places");
    const aboutIndex = html.indexOf("city-guide-about");
    assert.ok(placesIndex >= 0 && placesIndex < afterPlacesIndex && afterPlacesIndex < aboutIndex, "destination sections should follow the approved order");
  } finally {
    restoreFetch();
  }
}

{
  const longExtract = Array.from({ length: 60 }, (_, index) => `Sentence ${index + 1} describes this destination.`).join(" ");
  const { controller, elements, restoreFetch } = createController({
    commerce,
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ wikipedia: { description: "A city.", extract: longExtract, url: "https://en.wikipedia.org/wiki/Granada" }, places: [] })
    })
  });
  try {
    await controller.open();
    const aboutText = elements.cityGuideContent.innerHTML.match(/city-guide-about[\s\S]*?<p>([^<]*)<\/p>/)?.[1] || "";
    assert.ok(aboutText.length <= 430, `About excerpt should stay short: ${aboutText.length}`);
    assert.ok(/[.!?…]$/.test(aboutText), "About excerpt should end at a sentence or truncation boundary");
  } finally {
    restoreFetch();
  }
}

{
  const { controller, elements, restoreFetch } = createController({
    commerce,
    fetchImpl: async () => { throw new Error("Wikipedia unavailable"); }
  });
  try {
    await controller.open();
    assert.match(elements.cityGuideContent.innerHTML, /Granada/);
    assert.match(elements.cityGuideContent.innerHTML, /city-guide-quick-actions/);
    assert.match(elements.cityGuideContent.innerHTML, /temporarily unavailable/);
    assert.match(elements.cityGuideContent.innerHTML, /city-guide-after-places/);
  } finally {
    restoreFetch();
  }
}

{
  let currentCity = { ...city };
  const pending = new Map();
  const { controller, elements, restoreFetch } = createController({
    getCity: () => currentCity,
    commerce,
    fetchImpl: (endpoint) => new Promise((resolve) => {
      const name = new URL(endpoint).searchParams.get("city");
      pending.set(name, resolve);
    })
  });
  try {
    const oldRequest = controller.open();
    currentCity = { ...city, id: "malaga", name: "Málaga", note: "Sea light and old streets." };
    const newRequest = controller.open();
    pending.get("Málaga")({ ok: true, json: async () => ({ wikipedia: { description: "A coastal city.", extract: "Málaga is a coastal city.", url: "https://en.wikipedia.org/wiki/M%C3%A1laga" }, places: [] }) });
    await newRequest;
    pending.get("Granada")({ ok: true, json: async () => editorialData });
    await oldRequest;
    assert.match(elements.cityGuideContent.innerHTML, /Málaga/);
    assert.doesNotMatch(elements.cityGuideContent.innerHTML, /Alhambra/);
  } finally {
    restoreFetch();
  }
}

console.log("City Guide tests passed: destination hierarchy, safe links, truncation, editorial failure, and stale-request protection.");
