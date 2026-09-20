const CACHE_TTL = 24 * 60 * 60 * 1000;
const RATE_WINDOW = 10 * 60 * 1000;
const MAX_REQUESTS = 30;
const MAX_NEARBY_DISTANCE_METERS = 10_000;
const cache = new Map();
const rateLimits = new Map();
const SUPPORTED_LANGUAGES = new Set(["en", "es", "pt", "fr", "de", "it"]);

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": status === 200 ? "public, max-age=3600, s-maxage=86400" : "no-store",
      ...headers
    }
  });
}

function clientKey(request) {
  return request.headers.get("cf-connecting-ip")
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "anonymous";
}

function isRateLimited(request) {
  const key = clientKey(request);
  const now = Date.now();
  const current = rateLimits.get(key) || { startedAt: now, count: 0 };
  if (now - current.startedAt > RATE_WINDOW) {
    rateLimits.set(key, { startedAt: now, count: 1 });
    return false;
  }
  current.count += 1;
  rateLimits.set(key, current);
  return current.count > MAX_REQUESTS;
}

function coordinate(value, min, max) {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

function normalizedLanguage(value) {
  const language = String(value || "en").toLowerCase().split("-")[0];
  return SUPPORTED_LANGUAGES.has(language) ? language : "en";
}

function comparable(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function distanceInMeters(firstLatitude, firstLongitude, secondLatitude, secondLongitude) {
  const radians = Math.PI / 180;
  const latitudeDelta = (secondLatitude - firstLatitude) * radians;
  const longitudeDelta = (secondLongitude - firstLongitude) * radians;
  const firstLatitudeRadians = firstLatitude * radians;
  const secondLatitudeRadians = secondLatitude * radians;
  const arc = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(firstLatitudeRadians) * Math.cos(secondLatitudeRadians) * Math.sin(longitudeDelta / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(arc), Math.sqrt(1 - arc));
}

function isNearbyCoordinate(cityLatitude, cityLongitude, candidateLatitude, candidateLongitude) {
  return Number.isFinite(candidateLatitude)
    && Number.isFinite(candidateLongitude)
    && distanceInMeters(cityLatitude, cityLongitude, candidateLatitude, candidateLongitude) <= MAX_NEARBY_DISTANCE_METERS;
}

async function fetchJson(endpoint, timeout = 8_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(endpoint, {
      signal: controller.signal,
      headers: {
        accept: "application/json",
        "user-agent": "YouCity/1.0 (https://youcity.app)"
      }
    });
    let payload = {};
    try { payload = await response.json(); } catch { /* handled below */ }
    if (!response.ok) throw new Error(`City guide request failed with status ${response.status}`);
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

function wikipediaSearchEndpoint(city, country, language) {
  const endpoint = new URL(`https://${language}.wikipedia.org/w/rest.php/v1/search/page`);
  endpoint.searchParams.set("q", `${city}, ${country}`);
  endpoint.searchParams.set("limit", "5");
  return endpoint;
}

async function wikipediaSummary(city, country, language) {
  const searches = [wikipediaSearchEndpoint(city, country, language)];
  const cityOnly = new URL(searches[0]);
  cityOnly.searchParams.set("q", city);
  searches.push(cityOnly);

  let page;
  for (const endpoint of searches) {
    const payload = await fetchJson(endpoint);
    page = payload.pages?.find((candidate) => candidate.title) || payload.pages?.[0];
    if (page?.title) break;
  }
  if (!page?.title) return null;

  const summaryEndpoint = new URL(`https://${language}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(page.title)}`);
  const summary = await fetchJson(summaryEndpoint);
  return {
    title: summary.title || page.title,
    description: summary.description || "",
    extract: summary.extract || "",
    thumbnail: summary.thumbnail?.source || "",
    url: summary.content_urls?.desktop?.page || `https://${language}.wikipedia.org/wiki/${encodeURIComponent(page.title.replaceAll(" ", "_"))}`
  };
}

function wikidataGeosearchEndpoint(latitude, longitude) {
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

function wikidataEntitiesEndpoint(ids, language) {
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

async function nearbyPlaces(latitude, longitude, language, city) {
  try {
    const nearby = await fetchJson(wikidataGeosearchEndpoint(latitude, longitude), 2_500);
    const geosearch = nearby.query?.geosearch || [];
    const ids = geosearch.map((place) => place.title).filter((id) => /^Q\d+$/.test(id));
    const locations = new Map(geosearch.map((place) => [place.title, place]));
    const entities = await fetchJson(wikidataEntitiesEndpoint(ids, language), 2_500);
    const genericDescription = /\b(area|district|borough|county|region|metropolitan|municipality|conurbation|event|championship|pandemic|treaty|timeline|council|historical|festival|subprefecture|prefecture|administration|authority|office|transport|bus|railway|rail|film)\b|trolley\w*/i;
    const placeDescription = /\b(attraction|building|bridge|castle|cathedral|church|column|fort|gallery|garden|landmark|market|monument|museum|palace|park|square|stadium|statue|temple|theatre|tower)\b/i;
    const places = ids.map((id) => {
      const entity = entities.entities?.[id];
      const location = locations.get(id);
      const label = entity?.labels?.[language]?.value || entity?.labels?.en?.value || "";
      const description = entity?.descriptions?.[language]?.value || entity?.descriptions?.en?.value || "";
      const article = entity?.sitelinks?.[`${language}wiki`]?.title || entity?.sitelinks?.enwiki?.title || "";
      if (!isNearbyCoordinate(latitude, longitude, Number(location?.lat), Number(location?.lon))
        || !label || !article || genericDescription.test(`${label} ${description}`) || !placeDescription.test(`${label} ${description}`)) return null;
      return {
        name: label,
        description,
        url: `https://${language}.wikipedia.org/wiki/${encodeURIComponent(article.replaceAll(" ", "_"))}`
      };
    }).filter(Boolean).slice(0, 5);
    if (places.length >= 5) return places;

    const existing = new Set(places.map((place) => place.name.toLowerCase()));
    const fallback = await wikipediaNearbyPlaces(latitude, longitude, language, city);
    for (const place of fallback) {
      if (existing.has(place.name.toLowerCase())) continue;
      places.push(place);
      existing.add(place.name.toLowerCase());
      if (places.length === 5) break;
    }
    if (places.length) return places;
  } catch {
    // Wikidata's public query service can be busy; use the Wikipedia index below.
  }

  return wikipediaNearbyPlaces(latitude, longitude, language, city);
}

async function wikipediaNearbyPlaces(latitude, longitude, language, city) {
  const endpoint = new URL(`https://${language}.wikipedia.org/w/api.php`);
  endpoint.searchParams.set("action", "query");
  endpoint.searchParams.set("generator", "geosearch");
  endpoint.searchParams.set("ggscoord", `${latitude}|${longitude}`);
  endpoint.searchParams.set("ggsradius", "10000");
  endpoint.searchParams.set("ggslimit", "20");
  endpoint.searchParams.set("prop", "coordinates|description|info");
  endpoint.searchParams.set("inprop", "url");
  endpoint.searchParams.set("format", "json");
  endpoint.searchParams.set("origin", "*");
  const payload = await fetchJson(endpoint);
  const genericText = /\b(built-up area|central london|metropolitan|borough|district|county|region|event|championship|pandemic|treaty|timeline|smog|high commission|bank|club|hotel|neighborhood|station|metro|council|historical|municipality|jurisdiction|archdiocese|festival|subprefecture|prefecture|administration|authority|office|transport|bus|railway|rail|film)\b|trolley\w*/i;
  return Object.values(payload.query?.pages || {})
    .sort((first, second) => (first.index || 0) - (second.index || 0))
    .filter((place) => comparable(place.title) !== comparable(city) && !genericText.test(`${place.title} ${place.description || ""}`))
    .filter((place) => {
      const location = place.coordinates?.[0];
      return isNearbyCoordinate(latitude, longitude, Number(location?.lat), Number(location?.lon));
    })
    .slice(0, 5).map((place) => ({
      name: place.title,
      description: place.description || "Point of interest nearby",
      url: place.fullurl || place.canonicalurl || `https://${language}.wikipedia.org/wiki/${encodeURIComponent(place.title.replaceAll(" ", "_"))}`
  }));
}

async function commonsImage(placeName) {
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
  const payload = await fetchJson(endpoint, 4_000);
  const page = payload.query?.pages?.[0];
  const image = page?.imageinfo?.[0];
  if (!image?.thumburl || !image.descriptionurl) return null;
  const artist = image.extmetadata?.Artist?.value?.replace(/<[^>]*>/g, "").trim().slice(0, 120) || "";
  return {
    thumbnailUrl: image.thumburl,
    sourceUrl: image.descriptionurl,
    title: page.title?.replace(/^File:/i, "") || placeName,
    artist
  };
}

async function enrichPlacesWithCommons(places) {
  const results = await Promise.allSettled(places.map((place) => commonsImage(place.name)));
  return places.map((place, index) => ({
    ...place,
    image: results[index].status === "fulfilled" ? results[index].value : null
  }));
}

export async function onRequestGet({ request }) {
  if (isRateLimited(request)) {
    return json({ error: "RATE_LIMITED", message: "Too many city guide requests. Try again later." }, 429, {
      "retry-after": "600"
    });
  }

  const requestUrl = new URL(request.url);
  const city = String(requestUrl.searchParams.get("city") || "").trim().slice(0, 120);
  const country = String(requestUrl.searchParams.get("country") || "").trim().slice(0, 120);
  const language = normalizedLanguage(requestUrl.searchParams.get("language"));
  const latitude = coordinate(requestUrl.searchParams.get("latitude"), -90, 90);
  const longitude = coordinate(requestUrl.searchParams.get("longitude"), -180, 180);
  if (!city || !country || latitude === null || longitude === null) {
    return json({ error: "INVALID_CITY_GUIDE_REQUEST", message: "City, country, and valid coordinates are required." }, 400);
  }

  const cacheKey = `${city.toLowerCase()}|${country.toLowerCase()}|${language}|${latitude.toFixed(4)},${longitude.toFixed(4)}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return json(cached.value);

  const [wikipediaResult, placesResult] = await Promise.allSettled([
    wikipediaSummary(city, country, language),
    nearbyPlaces(latitude, longitude, language, city)
  ]);
  const places = placesResult.status === "fulfilled" ? await enrichPlacesWithCommons(placesResult.value) : [];
  const value = {
    city,
    country,
    language,
    wikipedia: wikipediaResult.status === "fulfilled" ? wikipediaResult.value : null,
    places
  };
  if (!value.wikipedia && !value.places.length) {
    return json({ error: "CITY_GUIDE_UNAVAILABLE", message: "City guide data is temporarily unavailable." }, 502);
  }

  cache.set(cacheKey, { value, expiresAt: Date.now() + CACHE_TTL });
  return json(value);
}
