#!/usr/bin/env node

/**
 * Builds the deployable Cloudflare Pages directory and prerenders one SEO page
 * for every city in the catalog. No network access or third-party dependency
 * is required during the build.
 */
const { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const { spawnSync } = require("node:child_process");
const { dirname, join, resolve, relative } = require("node:path");
const { loadCatalog: loadCanonicalCatalog } = require("./load-catalog");

const ROOT_DIR = resolve(__dirname, "..");
const OUTPUT_DIR = resolve(ROOT_DIR, "dist");
const DEFAULT_SITE_URL = "https://youcity.app";

function trimTrailingSlashes(value) {
  let result = String(value);
  while (result.endsWith("/")) result = result.slice(0, -1);
  return result;
}

function trimOuterSlashes(value) {
  let result = String(value);
  while (result.startsWith("/")) result = result.slice(1);
  while (result.endsWith("/")) result = result.slice(0, -1);
  return result;
}

const SITE_URL = trimTrailingSlashes(process.env.SEO_SITE_URL || DEFAULT_SITE_URL);
const BASE_PATH = trimOuterSlashes(String(process.env.SEO_BASE_PATH || "").trim());
const SITE_PATH = BASE_PATH ? `/${BASE_PATH}` : "";
const CITY_SUFFIX = String(process.env.SEO_CITY_SUFFIX || "");
const SITE_NAME = "YouCity";
const SOCIAL_IMAGE = `${SITE_URL}${SITE_PATH}/assets/hero-saopaulo.webp`;
const SOCIAL_ALT = "YouCity — immersive city rides around the world";
const STATIC_ASSETS = [
  "styles.css",
  "src/catalog/catalog.mjs",
  "src/features/map/map-config.mjs",
  "affiliate/affiliate-config.js",
  "affiliate/affiliate-overrides.js",
  "affiliate/affiliate-engine.js",
  "affiliate/affiliate-catalog.js",
  "affiliate/affiliate-tracking.js",
  "src/integrations/analytics.mjs",
  "src/integrations/consent.mjs",
  "affiliate/affiliate-experiments.js",
  "affiliate/affiliate-resolver.js",
  "affiliate/providers/expedia.js",
  "affiliate/providers/booking.js",
  "affiliate/providers/viator.js",
  "affiliate/providers/discovercars.js",
  "affiliate/providers/travelpayouts.js",
  "affiliate/providers/airalo.js",
  "affiliate/providers/heymondo.js",
  "affiliate/providers/stay22.js",
  "src/features/travel/discovercars-locations.js",
  "src/features/comment-assistant/comment-assistant-controller.mjs",
  "src/features/comment-assistant/core.mjs",
  "src/features/comment-assistant/history.mjs",
  "src/features/comment-assistant/comments.mjs",
  "src/features/comment-assistant/share-destinations.mjs",
  "data/comment-templates.mjs",
  "src/main.mjs",
  "src/app/bootstrap.mjs",
  "src/app/dom.mjs",
  "src/navigation/navigation-controller.mjs",
  "src/sharing/sharing-controller.mjs",
  "src/sharing/comment-share.mjs",
  "src/ui/layers-controller.mjs",
  "src/ui/city-browser.mjs",
  "src/ui/media-controls.mjs",
  "src/core/video-policy.mjs",
  "src/core/async-guard.mjs",
  "src/core/lazy-module.mjs",
  "src/core/url.mjs",
  "src/core/storage.mjs",
  "src/catalog/catalog-repository.mjs",
  "src/city/city-selection.mjs",
  "src/state/store.mjs",
  "src/player/youtube-player.mjs",
  "src/player/video-controller.mjs",
  "src/radio/radio-controller.mjs",
  "src/radio/radio-panel.mjs",
  "src/radio/radio-browser.mjs",
  "src/radio/radio-browser-feature.mjs",
  "src/radio/radio-now-playing.mjs",
  "src/radio/radio-now-playing-server.mjs",
  "src/radio/radio-youtube.mjs",
  "src/radio/radio-media-feature.mjs",
  "src/radio/radio-station.mjs",
  "src/radio/radio-station-repository.mjs",
  "src/radio/radio-catalog-index.mjs",
  "src/features/comment-assistant/comment-assistant-loader.mjs",
  "src/features/map/map-controller.mjs",
  "src/features/map/map-feature-loader.mjs",
  "src/features/city-guide/city-guide-controller.mjs",
  "src/features/travel/destination-commerce.mjs",
  "src/features/travel/flight-origin.mjs",
  "src/features/travel/secondary-providers-loader.mjs",
  "src/features/travel/travel-controller.mjs",
  "src/weather/weather-controller.mjs"
];
const STATIC_FILES = STATIC_ASSETS;

function assetVersion() {
  const supplied = String(process.env.ASSET_VERSION || process.env.GITHUB_SHA || "").trim();
  return supplied.replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 32) || "dev";
}

const ASSET_VERSION = assetVersion();
const staticAssetPattern = STATIC_ASSETS.map((file) => file.replaceAll(".", String.raw`\.`)).join("|");
const STATIC_ASSET_PATTERN = new RegExp(
  String.raw`((?:href|src)=["'])([^"']*\/(?:${staticAssetPattern})(?:\?[^"']*)?)(["'])`,
  "g"
);

function versionStaticAssets(html) {
  return html.replace(STATIC_ASSET_PATTERN, (_, prefix, url, suffix) => {
    const separator = url.includes("?") ? "&" : "?";
    return `${prefix}${url}${separator}v=${encodeURIComponent(ASSET_VERSION)}${suffix}`;
  });
}

function versionModuleImports(source) {
  const version = encodeURIComponent(ASSET_VERSION);
  const addVersion = (url) => url.includes("?") ? `${url}&v=${version}` : `${url}?v=${version}`;
  return source
    .replace(/(from\s+["'])(\.[^"']+\.(?:mjs|js))(["'])/g, (_, prefix, url, suffix) => `${prefix}${addVersion(url)}${suffix}`)
    .replace(/(import\s+["'])(\.[^"']+\.(?:mjs|js))(["'])/g, (_, prefix, url, suffix) => `${prefix}${addVersion(url)}${suffix}`)
    .replace(/(import\(\s*["'])(\.[^"']+\.(?:mjs|js))(["'])/g, (_, prefix, url, suffix) => `${prefix}${addVersion(url)}${suffix}`);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function jsonForHtml(value) {
  return JSON.stringify(value).replaceAll("<", String.raw`\u003c`);
}

function slugify(value) {
  let slug = String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
  while (slug.startsWith("-")) slug = slug.slice(1);
  while (slug.endsWith("-")) slug = slug.slice(0, -1);
  return slug;
}

function loadDiscoverCarsCatalog() {
  const file = resolve(ROOT_DIR, "data/discovercars-locations.json");
  if (!existsSync(file)) return {};
  return JSON.parse(readFileSync(file, "utf8")).locations || {};
}

function writeAffiliateOverridesAsset() {
  const source = resolve(ROOT_DIR, "data/affiliate-overrides.json");
  const overrides = existsSync(source) ? JSON.parse(readFileSync(source, "utf8")) : {};
  writeFileSync(
    join(OUTPUT_DIR, "affiliate/affiliate-overrides.js"),
    `// Generated from data/affiliate-overrides.json.\nwindow.YOUCITY_AFFILIATE_OVERRIDES = ${JSON.stringify(overrides)};\n`
  );
}

function countryName(country) {
  return {
    USA: "United States",
    UAE: "United Arab Emirates",
    UK: "United Kingdom",
    Korea: "South Korea",
    Russia: "Russia",
    Turkey: "Türkiye"
  }[country] || country;
}

function displayCityName(city) {
  return { "Sao Paulo": "São Paulo" }[city.name] || city.name;
}

function sitePath(path) {
  return `${SITE_PATH}${path}`;
}

function cityPath(city) {
  return sitePath(`/city/${slugify(city.name)}${CITY_SUFFIX}`);
}

function cityNote(city) {
  const name = displayCityName(city);
  const modes = cityModes(city);
  const modeText = modes.length ? modes.join(", ") : "city";
  return `Explore ${name}, ${countryName(city.country)} through real streets, local radio, and immersive ${modeText} rides.`;
}

function cityModes(city) {
  return [
    city.videos?.drive?.length ? "Drive" : null,
    city.videos?.bike?.length ? "Bike" : null,
    city.videos?.walk?.length ? "Walk" : null,
    city.videos?.beach_walk?.length ? "Beach Walk" : null,
    city.videos?.drone?.length ? "Drone" : null
  ].filter(Boolean);
}

function hasVideoExperience(city) {
  return Object.values(city.videos || {}).some((rides) => Array.isArray(rides) && rides.length > 0);
}

function citySeo(city) {
  const name = displayCityName(city);
  const country = countryName(city.country);
  const path = cityPath(city);
  const canonical = `${SITE_URL}${path}`;
  const description = cityNote(city);
  return {
    id: slugify(city.name),
    rawCountry: city.country,
    countryCode: city.countryCode || null,
    title: `${name} — YouCity`,
    description,
    canonical,
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: `${name} — YouCity`,
        description,
        url: canonical,
        isPartOf: { "@type": "WebSite", name: SITE_NAME, url: `${SITE_URL}${sitePath("/")}` }
      },
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: SITE_NAME, item: `${SITE_URL}${sitePath("/")}` },
          { "@type": "ListItem", position: 2, name, item: canonical }
        ]
      }
    ],
    name,
    country,
    path,
    modes: cityModes(city)
  };
}

function homeSeo(catalog) {
  const description = `Explore ${catalog.length} cities around the world through immersive Drive, Bike, Walk, Beach Walk, and Drone rides with local radio.`;
  return {
    title: "YouCity — cities in motion",
    description,
    canonical: `${SITE_URL}${sitePath("/")}`,
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: SITE_NAME,
        url: `${SITE_URL}${sitePath("/")}`,
        logo: `${SITE_URL}${sitePath("/assets/favicon.svg")}`
      },
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: SITE_NAME,
        url: `${SITE_URL}${sitePath("/")}`,
        description
      }
    ],
    name: "Cities in motion",
    country: "Around the world",
    path: "/",
    modes: ["Drive", "Bike", "Walk", "Beach Walk", "Drone"]
  };
}

function replaceMeta(html, attribute, value) {
  const escapedAttribute = attribute.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
  const pattern = new RegExp(String.raw`<meta\b(?=[^>]*${escapedAttribute})[^>]*>`, "i");
  const tag = `<meta ${attribute} content="${escapeHtml(value)}" />`;
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace("</head>", `    ${tag}\n  </head>`);
}

function replaceLink(html, relation, href) {
  const pattern = new RegExp(String.raw`<link\b(?=[^>]*rel=["']${relation}["'])[^>]*>`, "i");
  const tag = `<link rel="${relation}" href="${escapeHtml(href)}" />`;
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace("</head>", `    ${tag}\n  </head>`);
}

function replaceTitle(html, title) {
  return html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
}

function replaceJsonLd(html, jsonLd) {
  const tag = `<script type="application/ld+json" data-seo-jsonld>${jsonForHtml(jsonLd)}</script>`;
  const pattern = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*data-seo-jsonld[^>]*>[\s\S]*?<\/script>/i;
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace("</head>", `    ${tag}\n  </head>`);
}

function rewriteInternalPaths(html) {
  if (!SITE_PATH) return html;
  return html.replace(/\b(href|src)=(['"])\/(?!\/)/g, `$1=$2${SITE_PATH}/`);
}

function injectRuntimeBasePath(html) {
  const script = `<script>window.YOUCITY_BASE_PATH = ${jsonForHtml(SITE_PATH)}; window.YOUCITY_ASSET_VERSION = ${jsonForHtml(ASSET_VERSION)};</script>`;
  return html.replace("</head>", `    ${script}\n  </head>`);
}

function replaceElementText(html, tagName, id, value) {
  const pattern = new RegExp(String.raw`(<${tagName}\b[^>]*id=["']${id}["'][^>]*>)[\s\S]*?(<\/${tagName}>)`, "i");
  return html.replace(pattern, `$1${value}$2`);
}

function replaceStaticCity(html, seo, index, total) {
  let output = html;
  output = replaceElementText(output, "span", "city-index", String(index).padStart(String(total).length, "0"));
  output = replaceElementText(output, "span", "city-total", String(total));
  output = replaceElementText(output, "p", "city-region", `${escapeHtml(seo.country)} · Now`);
  output = replaceElementText(output, "h1", "city-name", escapeHtml(seo.name));
  output = replaceElementText(output, "p", "city-note", escapeHtml(seo.description));
  output = replaceElementText(output, "span", "travel-button-full", `Plan a trip to ${escapeHtml(seo.name)}`);
  output = replaceElementText(output, "h2", "travel-planner-title", `Plan your trip to ${escapeHtml(seo.name)}`);
  return output;
}

function replaceSeoFallback(html, body) {
  const pattern = /<noscript\b[^>]*data-seo-fallback[^>]*>[\s\S]*?<\/noscript>/i;
  const content = `<noscript data-seo-fallback>${body}</noscript>`;
  return pattern.test(html) ? html.replace(pattern, content) : html.replace("</body>", `  ${content}\n</body>`);
}

function renderPage(baseHtml, seo, fallback) {
  let html = replaceTitle(baseHtml, seo.title);
  html = replaceMeta(html, 'name="description"', seo.description);
  html = replaceMeta(html, 'name="robots"', "index,follow");
  html = replaceMeta(html, 'property="og:title"', seo.title);
  html = replaceMeta(html, 'property="og:description"', seo.description);
  html = replaceMeta(html, 'property="og:url"', seo.canonical);
  html = replaceMeta(html, 'property="og:image"', SOCIAL_IMAGE);
  html = replaceMeta(html, 'property="og:image:alt"', SOCIAL_ALT);
  html = replaceMeta(html, 'name="twitter:title"', seo.title);
  html = replaceMeta(html, 'name="twitter:description"', seo.description);
  html = replaceMeta(html, 'name="twitter:image"', SOCIAL_IMAGE);
  html = replaceMeta(html, 'name="twitter:image:alt"', SOCIAL_ALT);
  html = replaceLink(html, "canonical", seo.canonical);
  html = replaceJsonLd(html, seo.jsonLd);
  if (fallback) html = replaceSeoFallback(html, fallback);
  return html;
}

function xmlEscape(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function buildSitemap(catalog) {
  const sitemapCatalog = catalog.filter(hasVideoExperience);
  const urls = [
    `${SITE_URL}${sitePath("/")}`,
    ...sitemapCatalog.map((city) => `${SITE_URL}${cityPath(city)}`)
  ];
  const entries = urls.map((url) => `  <url>\n    <loc>${xmlEscape(url)}</loc>\n  </url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
}

function buildRobots() {
  return `User-agent: *\nAllow: /\n\n# Query-string variants are client-side state; city pages use stable paths.\nDisallow: /*?city=\nDisallow: /*?preview=\nDisallow: /*?*\n\nSitemap: ${SITE_URL}${sitePath("/sitemap.xml")}\n`;
}

function buildNotFound() {
  return versionStaticAssets(`<!doctype html>\n<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Page not found — YouCity</title><meta name="robots" content="noindex,follow"><link rel="stylesheet" href="${sitePath("/styles.css")}"></head><body><main class="seo-fallback"><h1>Page not found</h1><p>The city page you requested does not exist.</p><p><a href="${sitePath("/")}">Return to YouCity</a></p></main></body></html>\n`);
}

function cityFallback(seo, catalog, discoverCarsCatalog) {
  const links = catalog.map((city) => {
    const name = displayCityName(city);
    return `<li><a href="${cityPath(city)}">${escapeHtml(name)}</a></li>`;
  }).join("");
  const planner = [
    ["Things to do", "Viator"],
    ["Stay", "Booking.com · Expedia · Travelpayouts"],
    ["Stay connected", "Airalo"],
    ["More travel options", "Heymondo · Travelpayouts flights"]
  ];
  const discoverCars = Object.values(discoverCarsCatalog || {}).find((location) =>
    location.youCityId === seo.id && location.country === seo.rawCountry
  );
  if (discoverCars?.status === "VERIFIED" && discoverCars.available) {
    planner.splice(2, 0, ["Get around", "DiscoverCars"]);
  }
  const plannerMarkup = planner.map(([label, providers]) => `<li><strong>${label}</strong> — ${providers} <em>(preview)</em></li>`).join("");
  return `<section class="seo-fallback"><h2>${escapeHtml(seo.name)}, ${escapeHtml(seo.country)}</h2><p>${escapeHtml(seo.description)}</p><p>Available modes: ${escapeHtml(seo.modes.join(", "))}.</p><h2>Plan your trip to ${escapeHtml(seo.name)}</h2><ul>${plannerMarkup}</ul><p>Travel options preview. Affiliate links will be added after provider approval.</p><p><a href="${sitePath("/")}">Explore all cities</a></p><h2>More destinations</h2><ul>${links}</ul></section>`;
}

function homeFallback(catalog) {
  const links = catalog.map((city) => `<li><a href="${cityPath(city)}">${escapeHtml(displayCityName(city))}, ${escapeHtml(countryName(city.country))}</a></li>`).join("");
  return `<section class="seo-fallback"><h2>Explore ${catalog.length} cities around the world</h2><p>YouCity is an interactive collection of immersive Drive, Bike, Walk, Beach Walk, and Drone rides with local radio.</p><ul>${links}</ul></section>`;
}

function stripQuery(url) {
  return url.split("?")[0];
}

function listModuleFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = join(directory, entry.name);
    if (entry.isDirectory()) return listModuleFiles(filePath);
    return /\.(?:mjs|js)$/.test(entry.name) ? [filePath] : [];
  });
}

function validateModuleImports(outputDir = OUTPUT_DIR, { checkRequired = outputDir === OUTPUT_DIR } = {}) {
  const modulePattern = /(?:from\s+|import\s*(?:\(\s*)?)["'](\.[^"']+\.(?:mjs|js)(?:\?[^"']*)?)["']/g;
  
  const requiredFiles = [
    "src/main.mjs",
    "src/integrations/analytics.mjs",
    "src/integrations/consent.mjs",
    "src/app/bootstrap.mjs",
    "styles.css",
    "privacy.html",
    "terms.html"
  ];

  if (checkRequired) {
    for (const file of requiredFiles) {
      const filePath = resolve(outputDir, file);
      if (!existsSync(filePath)) {
        throw new Error(
          `Build validation failed: missing required file in dist/\n` +
          `Expected: ${file}\n` +
          `Full path: ${filePath}`
        );
      }
    }
  }

  for (const filePath of listModuleFiles(resolve(outputDir, "src"))) {
    const source = readFileSync(filePath, "utf8");
    const matches = [...source.matchAll(modulePattern)];

    for (const match of matches) {
      const importPath = match[1];
      const cleanImport = stripQuery(importPath);
      const resolved = resolve(dirname(filePath), cleanImport);

      if (!existsSync(resolved)) {
        const importer = relative(outputDir, filePath);
        throw new Error(
          `Build validation failed: missing module in build output\n` +
          `Importer: dist/${importer}\n` +
          `Import: ${importPath}\n` +
          `Expected: dist/${relative(outputDir, resolved)}`
        );
      }
    }
  }

  console.log("✓ Module import validation passed");
}

module.exports = { validateModuleImports };

function main() {
  const catalogBuild = spawnSync(process.execPath, [resolve(ROOT_DIR, "scripts/build-catalog.js")], { stdio: "inherit" });
  if (catalogBuild.status !== 0) throw new Error("Catalog build failed.");
  const catalog = loadCanonicalCatalog(ROOT_DIR);
  const discoverCarsCatalog = loadDiscoverCarsCatalog();
  if (!catalog.length) throw new Error("The city catalog is empty.");

  rmSync(OUTPUT_DIR, { recursive: true, force: true });
  mkdirSync(OUTPUT_DIR, { recursive: true });
  mkdirSync(join(OUTPUT_DIR, "assets"), { recursive: true });
  mkdirSync(join(OUTPUT_DIR, "city"), { recursive: true });

  for (const file of STATIC_FILES) {
    const destination = join(OUTPUT_DIR, file);
    mkdirSync(dirname(destination), { recursive: true });
    cpSync(resolve(ROOT_DIR, file), destination);
    if (/\.(?:mjs|js)$/.test(file)) {
      writeFileSync(destination, versionModuleImports(readFileSync(destination, "utf8")));
    }
  }
  writeAffiliateOverridesAsset();
  cpSync(resolve(ROOT_DIR, "assets"), join(OUTPUT_DIR, "assets"), { recursive: true });
  for (const file of ["_headers", "_redirects"]) {
    if (existsSync(resolve(ROOT_DIR, file))) cpSync(resolve(ROOT_DIR, file), join(OUTPUT_DIR, file));
  }

  // Copy required static HTML pages
  const STATIC_HTML_PAGES = ["privacy.html", "terms.html"];
  for (const file of STATIC_HTML_PAGES) {
    const source = resolve(ROOT_DIR, file);
    const destination = join(OUTPUT_DIR, file);
    if (!existsSync(source)) {
      throw new Error(`Required static page not found: ${file}`);
    }
    cpSync(source, destination);
  }

  const baseHtml = versionStaticAssets(
    injectRuntimeBasePath(rewriteInternalPaths(readFileSync(resolve(ROOT_DIR, "index.html"), "utf8")))
  );
  writeFileSync(join(OUTPUT_DIR, "index.html"), renderPage(baseHtml, homeSeo(catalog), homeFallback(catalog)));

  catalog.forEach((city, index) => {
    const seo = citySeo(city);
    const cityHtml = replaceStaticCity(
      renderPage(baseHtml, seo, cityFallback(seo, catalog, discoverCarsCatalog)),
      seo,
      index + 1,
      catalog.length
    );
    writeFileSync(join(OUTPUT_DIR, "city", `${slugify(city.name)}.html`), cityHtml);
  });

  writeFileSync(join(OUTPUT_DIR, "robots.txt"), buildRobots());
  writeFileSync(join(OUTPUT_DIR, "sitemap.xml"), buildSitemap(catalog));
  writeFileSync(join(OUTPUT_DIR, "404.html"), buildNotFound());
  writeFileSync(join(OUTPUT_DIR, ".nojekyll"), "");
  
  // Validate build output
  validateModuleImports();
  
  const sitemapCityCount = catalog.filter(hasVideoExperience).length;
  console.log(`Built ${catalog.length + 1} SEO pages in ${OUTPUT_DIR} using ${SITE_URL} (sitemap: ${sitemapCityCount + 1} URLs, assets: ${ASSET_VERSION})`);
}

if (require.main === module) main();
