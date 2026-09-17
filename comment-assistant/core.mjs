const DEFAULT_SITE_URL = "https://youcity.app";
const DEFAULT_MODE = "drive";
const SUPPORTED_MODES = ["drive", "bike", "walk", "drone", "beach_walk"];
const MODE_LABELS = {
  drive: "Driving Tour",
  bike: "Bike Ride",
  walk: "Walking Tour",
  drone: "Drone / Aerial",
  beach_walk: "Beach Walk"
};

const COUNTRY_NAMES = {
  USA: "United States",
  UAE: "United Arab Emirates",
  UK: "United Kingdom",
  Korea: "South Korea",
  Russia: "Russia",
  Turkey: "Türkiye"
};

const VIDEO_CONTEXT_STOPWORDS = new Set([
  "a", "an", "and", "at", "by", "city", "day", "evening", "explore", "exploring", "full",
  "hd", "in", "live", "night", "of", "on", "tour", "the", "through", "to", "walk", "walking",
  "view", "views", "4k", "8k", "drive", "driving", "drone", "aerial", "bike", "cycling", "street",
  "downtown", "road", "roads", "trip", "video"
]);

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function phraseInText(text, phrase) {
  const normalizedText = ` ${normalizeText(text)} `;
  const normalizedPhrase = ` ${normalizeText(phrase)} `;
  return Boolean(normalizedPhrase.trim()) && normalizedText.includes(normalizedPhrase);
}

function slugify(value) {
  let slug = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
  while (slug.startsWith("-")) slug = slug.slice(1);
  while (slug.endsWith("-")) slug = slug.slice(0, -1);
  return slug;
}

function countryName(country) {
  return COUNTRY_NAMES[country] || country || "";
}

function cityTerms(city) {
  const name = String(city?.name || "").trim();
  const words = name.split(/\s+/).filter(Boolean);
  const withoutCitySuffix = name.replace(/\s+city$/i, "").trim();
  const acronym = words.length > 1 ? words.map((word) => word[0]).join("") : "";
  return [...new Set([
    name,
    withoutCitySuffix !== name ? withoutCitySuffix : "",
    acronym.length >= 3 ? acronym : ""
  ].filter(Boolean))];
}

function extractYouTubeVideoId(value) {
  let url;
  try {
    url = new URL(String(value || "").trim());
  } catch {
    return null;
  }

  const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  if (hostname === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    return /^[A-Za-z0-9_-]{6,20}$/.test(id || "") ? id : null;
  }
  if (hostname !== "youtube.com" && hostname !== "m.youtube.com" && hostname !== "music.youtube.com") return null;

  let id = null;
  if (url.pathname === "/watch") id = url.searchParams.get("v");
  if (url.pathname.startsWith("/shorts/")) id = url.pathname.split("/")[2];
  if (url.pathname.startsWith("/embed/")) id = url.pathname.split("/")[2];
  return /^[A-Za-z0-9_-]{6,20}$/.test(id || "") ? id : null;
}

function youtubeWatchUrl(videoId) {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
}

function detectVideoMode(title = "", description = "") {
  const text = normalizeText(`${title} ${description}`);
  if (/\b(drone|aerial|flyover|from above|4k aerial)\b/.test(text)) return "drone";
  if (/\b(bike|bicycle|cycling|cycle tour)\b/.test(text)) return "bike";
  if (/\b(driving|drive|driving downtown|by car|car tour|road trip)\b/.test(text)) return "drive";
  if (/\b(walk|walking|walk tour|street walk|city walk|night walk|walking tour)\b/.test(text)) return "walk";
  return DEFAULT_MODE;
}

function detectArea(title = "", description = "", city = null) {
  const cityName = String(city?.name || "").trim();
  if (!cityName) return "";
  const ignoredWords = new Set([
    ...VIDEO_CONTEXT_STOPWORDS,
    ...countryName(city.country).split(/\s+/).map(normalizeText),
    ...String(city.country || "").split(/\s+/).map(normalizeText)
  ]);
  for (const text of [title, description]) {
    const words = String(text).match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || [];
    const cityWords = cityName.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || [];
    const normalizedWords = words.map(normalizeText);
    const normalizedCityWords = cityWords.map(normalizeText);
    const cityStart = normalizedWords.findIndex((_, index) =>
      normalizedCityWords.length > 0 && normalizedWords.slice(index, index + normalizedCityWords.length).join(" ") === normalizedCityWords.join(" ")
    );
    if (cityStart < 0) continue;

    const before = words.slice(0, cityStart).filter((word) => !ignoredWords.has(normalizeText(word)));
    const after = words.slice(cityStart + cityWords.length).filter((word) => !ignoredWords.has(normalizeText(word)));
    const nearby = before.length ? before.slice(-4) : after.slice(0, 4);
    const area = nearby.join(" ").trim();
    if (area && normalizeText(area) !== normalizeText(cityName)) return area;
  }
  return "";
}

function guessCityCandidate(title = "", description = "") {
  const source = String(title || description || "").replace(/\s+/g, " ").trim();
  const match = source.match(/^(.+?)\s+(?:walking|walk|driving|drive|bike|cycling|drone|aerial|city)\b/i);
  if (match?.[1]) return match[1].replace(/[|,:-]+$/, "").trim();
  return "";
}

function matchCity(title = "", description = "", catalog = []) {
  const titleText = String(title || "");
  const descriptionText = String(description || "");
  const allText = `${titleText} ${descriptionText}`;
  const candidates = catalog.map((city) => {
    let score = 0;
    for (const term of cityTerms(city)) {
      if (phraseInText(titleText, term)) score = Math.max(score, normalizeText(term) === normalizeText(city.name) ? 120 : 115);
      else if (phraseInText(descriptionText, term)) score = Math.max(score, normalizeText(term) === normalizeText(city.name) ? 75 : 70);
      else if (phraseInText(allText, term)) score = Math.max(score, normalizeText(term) === normalizeText(city.name) ? 50 : 45);
    }
    const country = countryName(city.country);
    if (country && phraseInText(allText, country)) score += 8;
    return { city, score };
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score);

  const best = candidates[0];
  if (!best) {
    return {
      city: null,
      cityCandidate: guessCityCandidate(titleText, descriptionText),
      country: "",
      area: "",
      confidence: "none"
    };
  }
  return {
    city: best.city,
    cityCandidate: best.city.name,
    country: countryName(best.city.country),
    area: detectArea(titleText, descriptionText, best.city),
    confidence: best.score >= 100 ? "high" : best.score >= 60 ? "medium" : "low"
  };
}

function detectLanguage(title = "", description = "") {
  const text = normalizeText(`${title} ${description}`);
  const spanish = (text.match(/\b(el|la|los|las|una|un|calle|ciudad|paseo|recorrido|espana|espanol|viaje|noche)\b/g) || []).length;
  const portuguese = (text.match(/\b(o|a|os|as|uma|um|rua|cidade|passeio|brasil|portugues|viagem|noite)\b/g) || []).length;
  if (spanish > portuguese && spanish >= 2) return "es";
  if (portuguese >= 2) return "pt";
  return "en";
}

function buildYouCityUrl(city, mode = DEFAULT_MODE, siteUrl = DEFAULT_SITE_URL) {
  if (!city?.name || !SUPPORTED_MODES.includes(mode)) return null;
  const base = String(siteUrl || DEFAULT_SITE_URL).replace(/\/+$/, "");
  return `${base}/city/${slugify(city.name)}?mode=${encodeURIComponent(mode)}`;
}

function resolveMode(city, requestedMode, detectedMode = DEFAULT_MODE) {
  const available = SUPPORTED_MODES.filter((mode) => city?.videos?.[mode]?.length);
  const preferred = requestedMode && requestedMode !== "auto" ? requestedMode : detectedMode;
  if (available.includes(preferred)) return preferred;
  if (available.includes(detectedMode)) return detectedMode;
  if (available.includes(DEFAULT_MODE)) return DEFAULT_MODE;
  return available[0] || DEFAULT_MODE;
}

function buildCommentContext({ metadata, detection, mode, language, tone, cta, options = {}, siteUrl = DEFAULT_SITE_URL }) {
  const city = detection?.city || null;
  return {
    city: city?.name || detection?.cityCandidate || "",
    country: city ? countryName(city.country) : detection?.country || "",
    area: detection?.area || "",
    videoTitle: String(metadata?.title || "").slice(0, 500),
    videoDescription: String(metadata?.description || "").slice(0, 3000),
    channel: String(metadata?.channel || "").slice(0, 160),
    videoType: mode,
    language,
    tone,
    cta,
    mentionSpecific: Boolean(options.mentionSpecific),
    mentionYouCity: Boolean(options.mentionYouCity),
    includeCityUrl: Boolean(options.includeCityUrl),
    mentionPlanTrip: Boolean(options.mentionPlanTrip),
    youCityUrl: city && options.includeCityUrl ? buildYouCityUrl(city, mode, siteUrl) : null
  };
}

export {
  DEFAULT_MODE,
  DEFAULT_SITE_URL,
  MODE_LABELS,
  SUPPORTED_MODES,
  buildCommentContext,
  buildYouCityUrl,
  countryName,
  detectArea,
  detectLanguage,
  detectVideoMode,
  extractYouTubeVideoId,
  matchCity,
  normalizeText,
  resolveMode,
  slugify,
  youtubeWatchUrl
};
