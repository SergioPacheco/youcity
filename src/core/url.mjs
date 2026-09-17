const MODES = new Set(["drive", "bike", "walk", "drone", "beach_walk"]);

function normalizeBasePath(basePath = "") {
  const value = String(basePath || "").trim();
  if (!value || value === "/") return "";
  return `/${value.replace(/^\/+|\/+$/g, "")}`;
}

export function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function parseRoute(location, basePath = "") {
  const params = new URLSearchParams(location?.search || "");
  const base = normalizeBasePath(basePath);
  const pathname = String(location?.pathname || "/");
  const pathWithoutBase = base && (pathname === base || pathname.startsWith(`${base}/`))
    ? pathname.slice(base.length) || "/"
    : pathname;
  const cityPath = pathWithoutBase.match(/^\/city\/([^/]+)(?:\.html)?\/?$/i)?.[1];
  let requestedCity = cityPath || params.get("city") || "";
  try {
    requestedCity = decodeURIComponent(requestedCity);
  } catch {
    requestedCity = "";
  }
  const mode = MODES.has(params.get("mode")) ? params.get("mode") : null;
  const video = Number.parseInt(params.get("video"), 10);

  return {
    citySlug: requestedCity ? slugify(requestedCity) : "",
    mode,
    videoIndex: Number.isInteger(video) && video > 0 ? video - 1 : 0,
    isDeepLink: Boolean(cityPath || params.get("city") || params.get("mode") || params.get("video"))
  };
}

export function buildCityUrl({ slug, mode = "", videoIndex = 0 }, basePath = "") {
  const base = normalizeBasePath(basePath);
  const params = new URLSearchParams();
  if (mode && MODES.has(mode)) params.set("mode", mode);
  if (Number.isInteger(videoIndex) && videoIndex > 0) params.set("video", String(videoIndex + 1));
  const query = params.toString();
  return `${base}/city/${slugify(slug)}${query ? `?${query}` : ""}`;
}

export { MODES };
