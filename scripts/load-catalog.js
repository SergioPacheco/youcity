const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { runInNewContext } = require("node:vm");

const CATALOG_SOURCES = [
  "cities-data.js",
  "map-catalog.js",
  "drone-videos.js",
  "beach-walk-videos.js",
  "radio-catalog.js",
  "radio-extra-catalog.js",
  "catalog-runtime.js"
];

function loadCatalogContext(rootDir) {
  const context = { window: {} };
  for (const file of CATALOG_SOURCES) {
    const sourcePath = resolve(rootDir, file);
    // These files are fixed, repository-owned browser catalog assets.
    runInNewContext(readFileSync(sourcePath, "utf8"), context, { filename: file }); // NOSONAR
  }
  return context;
}

function loadCatalog(rootDir) {
  const context = loadCatalogContext(rootDir);
  return context.window.YOUCITY_CATALOG || context.window.CITY_CATALOG || [];
}

module.exports = { CATALOG_SOURCES, loadCatalog, loadCatalogContext };
