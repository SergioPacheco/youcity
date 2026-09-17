const LANGUAGES = new Set(["en", "es", "pt", "fr", "de", "it"]);

export function createCityGuideController({ window, document, elements, getCity, openLayer, ensureDiscoverCarsCatalog, sitePath, isStaticLocalPreview }) {
  let currentRequestId = 0;
  const cityGuideCache = new Map();
  const normalizeSearch = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("en-US");
  const escapeHtml = (value) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

  const CITY_GUIDE_LANGUAGES = LANGUAGES;

  function cityGuideLanguage() {
    const language = String(document.documentElement.lang || "en").toLowerCase().split("-")[0];
    return CITY_GUIDE_LANGUAGES.has(language) ? language : "en";
  }

  async function fetchCityGuideJson(endpoint, timeout = 10_000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(endpoint, { signal: controller.signal, headers: { accept: "application/json" } });
      if (!response.ok) throw new Error(`City guide request failed with status ${response.status}`);
      const payload = await response.json();
      return payload;
    } finally {
      clearTimeout(timer);
    }
  }

  function cityGuideWikipediaSearchEndpoint(city, country, language) {
    const endpoint = new URL(`https://${language}.wikipedia.org/w/rest.php/v1/search/page`);
    endpoint.searchParams.set("q", `${city}, ${country}`);
    endpoint.searchParams.set("limit", "5");
    return endpoint;
  }

  async function cityGuideWikipediaSummary(city, country, language) {
    const endpoints = [cityGuideWikipediaSearchEndpoint(city, country, language)];
    const cityOnly = new URL(endpoints[0]);
    cityOnly.searchParams.set("q", city);
    endpoints.push(cityOnly);

    let page;
    for (const endpoint of endpoints) {
      const payload = await fetchCityGuideJson(endpoint);
      page = payload.pages?.find((candidate) => candidate.title) || payload.pages?.[0];
      if (page?.title) break;
    }
    if (!page?.title) return null;

    const summaryEndpoint = new URL(`https://${language}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(page.title)}`);
    const summary = await fetchCityGuideJson(summaryEndpoint);
    return {
      title: summary.title || page.title,
      description: summary.description || "",
      extract: summary.extract || "",
      thumbnail: summary.thumbnail?.source || "",
      url: summary.content_urls?.desktop?.page || ""
    };
  }

  function cityGuideWikidataGeosearchEndpoint(latitude, longitude) {
    const endpoint = new URL("https://www.wikidata.org/w/api.php");
    endpoint.searchParams.set("action", "query");
    endpoint.searchParams.set("list", "geosearch");
    endpoint.searchParams.set("gscoord", `${latitude}|${longitude}`);
    endpoint.searchParams.set("gsradius", "10000");
    endpoint.searchParams.set("gslimit", "20");
    endpoint.searchParams.set("format", "json");
    endpoint.searchParams.set("origin", "*");
    return endpoint;
  }

  function cityGuideWikidataEntitiesEndpoint(ids, language) {
    const endpoint = new URL("https://www.wikidata.org/w/api.php");
    endpoint.searchParams.set("action", "wbgetentities");
    endpoint.searchParams.set("ids", ids.join("|"));
    endpoint.searchParams.set("props", "labels|descriptions|sitelinks");
    endpoint.searchParams.set("languages", `${language}|en`);
    endpoint.searchParams.set("sitefilter", `${language}wiki|enwiki`);
    endpoint.searchParams.set("format", "json");
    endpoint.searchParams.set("origin", "*");
    return endpoint;
  }

  function cityGuideWikipediaNearbyEndpoint(latitude, longitude, language) {
    const endpoint = new URL(`https://${language}.wikipedia.org/w/api.php`);
    endpoint.searchParams.set("action", "query");
    endpoint.searchParams.set("generator", "geosearch");
    endpoint.searchParams.set("ggscoord", `${latitude}|${longitude}`);
    endpoint.searchParams.set("ggsradius", "10000");
    endpoint.searchParams.set("ggslimit", "20");
    endpoint.searchParams.set("prop", "description|info");
    endpoint.searchParams.set("inprop", "url");
    endpoint.searchParams.set("format", "json");
    endpoint.searchParams.set("origin", "*");
    return endpoint;
  }

  async function cityGuideNearbyPlaces(city, language) {
    const [latitude, longitude] = city.coordinates || [];
    try {
      const nearby = await fetchCityGuideJson(cityGuideWikidataGeosearchEndpoint(latitude, longitude), 2_500);
      const ids = (nearby.query?.geosearch || []).map((place) => place.title).filter((id) => /^Q\d+$/.test(id));
      const entities = await fetchCityGuideJson(cityGuideWikidataEntitiesEndpoint(ids, language), 2_500);
      const genericDescription = /\b(area|district|borough|county|region|metropolitan|municipality|conurbation|event|championship|pandemic|treaty|timeline|council|historical|festival|subprefecture|prefecture|administration|authority|office|transport|bus|railway|rail|film)\b|trolley\w*/i;
      const placeDescription = /\b(attraction|building|bridge|castle|cathedral|church|column|fort|gallery|garden|landmark|market|monument|museum|palace|park|square|stadium|statue|temple|theatre|tower)\b/i;
      const places = ids.map((id) => {
        const entity = entities.entities?.[id];
        const label = entity?.labels?.[language]?.value || entity?.labels?.en?.value || "";
        const description = entity?.descriptions?.[language]?.value || entity?.descriptions?.en?.value || "";
        const article = entity?.sitelinks?.[`${language}wiki`]?.title || entity?.sitelinks?.enwiki?.title || "";
        if (!label || !article || genericDescription.test(`${label} ${description}`) || !placeDescription.test(`${label} ${description}`)) return null;
        return {
          name: label,
          description,
          url: `https://${language}.wikipedia.org/wiki/${encodeURIComponent(article.replaceAll(" ", "_"))}`
        };
      }).filter(Boolean).slice(0, 5);
      if (places.length >= 5) return places;

      const existing = new Set(places.map((place) => place.name.toLowerCase()));
      const fallback = await cityGuideWikipediaNearbyPlaces(latitude, longitude, language, city.name);
      for (const place of fallback) {
        if (existing.has(place.name.toLowerCase())) continue;
        places.push(place);
        existing.add(place.name.toLowerCase());
        if (places.length === 5) break;
      }
      if (places.length) return places;
    } catch {
      // The public Wikidata query service can be busy; use Wikipedia's
      // geosearch index as a fast, still relevant fallback.
    }

    return cityGuideWikipediaNearbyPlaces(latitude, longitude, language, city.name);
  }

  async function cityGuideWikipediaNearbyPlaces(latitude, longitude, language, cityName) {
    const payload = await fetchCityGuideJson(cityGuideWikipediaNearbyEndpoint(latitude, longitude, language));
    const genericText = /\b(built-up area|central london|metropolitan|borough|district|county|region|event|championship|pandemic|treaty|timeline|smog|high commission|bank|club|hotel|neighborhood|station|metro|council|historical|municipality|jurisdiction|archdiocese|festival|subprefecture|prefecture|administration|authority|office|transport|bus|railway|rail|film)\b|trolley\w*/i;
    return Object.values(payload.query?.pages || {})
      .sort((first, second) => (first.index || 0) - (second.index || 0))
      .filter((place) => normalizeSearch(place.title) !== normalizeSearch(cityName) && !genericText.test(`${place.title} ${place.description || ""}`))
      .slice(0, 5).map((place) => ({
        name: place.title,
        description: place.description || "Point of interest nearby",
        url: place.fullurl || place.canonicalurl || `https://${language}.wikipedia.org/wiki/${encodeURIComponent(place.title.replaceAll(" ", "_"))}`
      }));
  }

  function cityGuideCommonsImageEndpoint(placeName) {
    const endpoint = new URL("https://commons.wikimedia.org/w/api.php");
    endpoint.searchParams.set("action", "query");
    endpoint.searchParams.set("generator", "search");
    endpoint.searchParams.set("gsrsearch", placeName);
    endpoint.searchParams.set("gsrnamespace", "6");
    endpoint.searchParams.set("gsrlimit", "1");
    endpoint.searchParams.set("prop", "imageinfo");
    endpoint.searchParams.set("iiprop", "url|extmetadata");
    endpoint.searchParams.set("iiurlwidth", "240");
    endpoint.searchParams.set("format", "json");
    endpoint.searchParams.set("formatversion", "2");
    endpoint.searchParams.set("origin", "*");
    return endpoint;
  }

  async function cityGuideCommonsImage(placeName) {
    const payload = await fetchCityGuideJson(cityGuideCommonsImageEndpoint(placeName), 4_000);
    const page = payload.query?.pages?.[0];
    const image = page?.imageinfo?.[0];
    if (!image?.thumburl || !image.descriptionurl) return null;
    const artist = String(image.extmetadata?.Artist?.value || "")
      .replace(/<[^>]*>/g, "")
      .trim()
      .slice(0, 120);
    return {
      thumbnailUrl: image.thumburl,
      sourceUrl: image.descriptionurl,
      title: page.title?.replace(/^File:/i, "") || placeName,
      artist
    };
  }

  async function enrichCityGuidePlacesWithCommons(places) {
    const results = await Promise.allSettled(places.map((place) => cityGuideCommonsImage(place.name)));
    return places.map((place, index) => ({
      ...place,
      image: results[index].status === "fulfilled" ? results[index].value : null
    }));
  }

  async function fetchCityGuideDirect(city, language) {
    const [wikipediaResult, placesResult] = await Promise.allSettled([
      cityGuideWikipediaSummary(city.name, city.country, language),
      cityGuideNearbyPlaces(city, language)
    ]);
    const data = {
      city: city.name,
      country: city.country,
      language,
      wikipedia: wikipediaResult.status === "fulfilled" ? wikipediaResult.value : null,
      places: placesResult.status === "fulfilled" ? placesResult.value : []
    };
    data.places = await enrichCityGuidePlacesWithCommons(data.places);
    return data;
  }

  function trustedCityGuideUrl(value) {
    try {
      const url = new URL(value);
      const allowed = url.protocol === "https:"
        && (url.hostname === "wikidata.org" || url.hostname.endsWith(".wikidata.org") || url.hostname === "wikipedia.org" || url.hostname.endsWith(".wikipedia.org"));
      return allowed ? url.href : "";
    } catch {
      return "";
    }
  }

  function trustedCommonsImageUrl(value) {
    try {
      const url = new URL(value);
      const allowedHost = ["upload.wikimedia.org", "thumb.wikimedia.org"].includes(url.hostname);
      return url.protocol === "https:" && allowedHost ? url.href : "";
    } catch {
      return "";
    }
  }

  function trustedCommonsSourceUrl(value) {
    try {
      const url = new URL(value);
      const allowed = url.protocol === "https:"
        && (url.hostname === "commons.wikimedia.org" || url.hostname.endsWith(".commons.wikimedia.org"));
      return allowed ? url.href : "";
    } catch {
      return "";
    }
  }

  function renderCityGuide(data, city) {
    const wikipedia = data?.wikipedia;
    const places = Array.isArray(data?.places) ? data.places.slice(0, 5) : [];
    const summary = wikipedia?.extract ? wikipedia.extract.slice(0, 620) : "A short guide to this destination will be available soon.";
    const wikipediaUrl = trustedCityGuideUrl(wikipedia?.url);
    const placesMarkup = places.length
      ? `<section class="city-guide-section" aria-labelledby="city-guide-places-title"><div class="city-guide-section-heading"><span class="drawer-kicker">Worth exploring</span><h3 id="city-guide-places-title">Places to explore</h3></div><ul class="city-guide-places">${places.map((place) => {
        const url = trustedCityGuideUrl(place.url);
        const name = escapeHtml(place.name);
        const description = place.description ? `<small>${escapeHtml(place.description)}</small>` : "";
        const content = `<span class="city-guide-place-copy"><strong>${name}</strong>${description}</span>`;
        const imageUrl = trustedCommonsImageUrl(place.image?.thumbnailUrl);
        const imageSource = trustedCommonsSourceUrl(place.image?.sourceUrl) || imageUrl;
        const imageMarkup = imageUrl
          ? `<a class="city-guide-place-photo" href="${escapeHtml(imageSource)}" target="_blank" rel="noopener noreferrer" aria-label="View photo source on Wikimedia Commons"><img src="${escapeHtml(imageUrl)}" alt="" loading="lazy" /></a>`
          : "";
        const placeLink = url
          ? `<a class="city-guide-place-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${content}<span aria-hidden="true">↗</span></a>`
          : content;
        return `<li><div class="city-guide-place-row">${imageMarkup}${placeLink}</div></li>`;
      }).join("")}</ul></section>`
      : `<section class="city-guide-section city-guide-empty-section"><p>We could not find notable places nearby yet.</p></section>`;
    elements.cityGuideContent.innerHTML = `<section class="city-guide-section city-guide-about"><div class="city-guide-section-heading"><span class="drawer-kicker">A first impression</span><h3>About ${escapeHtml(city.name)}</h3></div><p>${escapeHtml(summary)}</p>${wikipediaUrl ? `<a class="city-guide-source" href="${escapeHtml(wikipediaUrl)}" target="_blank" rel="noopener noreferrer">Read more on Wikipedia ↗</a>` : ""}</section>${placesMarkup}`;
  }

  function renderCityGuideLoading() {
    elements.cityGuideContent.innerHTML = '<p class="city-guide-loading" role="status">Loading city guide…</p>';
  }

  function renderCityGuideError() {
    elements.cityGuideContent.innerHTML = '<p class="city-guide-error" role="alert">City guide data is temporarily unavailable. Try again later.</p>';
  }

  async function openCityGuide() {
    const city = getCity();
    if (!elements.travelDrawer || !elements.cityGuideContent || !city) return;
    const language = cityGuideLanguage();
    const cacheKey = `${city.id}|${language}`;
    openLayer(elements.travelDrawer);
    elements.travelButton?.setAttribute("aria-expanded", "true");
    ensureDiscoverCarsCatalog();

    const cached = cityGuideCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      renderCityGuide(cached.value, city);
      return;
    }

    const requestId = ++currentRequestId;
    renderCityGuideLoading();
    try {
      let data;
      if (isStaticLocalPreview()) {
        data = await fetchCityGuideDirect(city, language);
      } else {
        const endpoint = new URL(sitePath("/api/city-guide"), window.location.origin);
        endpoint.searchParams.set("city", city.name);
        endpoint.searchParams.set("country", city.country);
        endpoint.searchParams.set("latitude", String(city.coordinates?.[0]));
        endpoint.searchParams.set("longitude", String(city.coordinates?.[1]));
        endpoint.searchParams.set("language", language);
        data = await fetchCityGuideJson(endpoint);
      }
      if (requestId !== currentRequestId) return;
      if (!data?.wikipedia && !data?.places?.length) throw new Error("City guide returned no content");
      cityGuideCache.set(cacheKey, { value: data, expiresAt: Date.now() + 24 * 60 * 60 * 1000 });
      renderCityGuide(data, city);
    } catch (error) {
      if (requestId !== currentRequestId) return;
      renderCityGuideError();
      console.warn(`[YouCity] Could not load city guide for ${city.name}:`, error.message);
    }
  }

  // -----------------------------------------------------------------------------

  return { open: openCityGuide, invalidate: () => { currentRequestId += 1; } };
}
