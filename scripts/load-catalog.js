const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");

function loadCatalog(rootDir) {
  const sourcePath = resolve(rootDir, "data/catalog.json");
  const catalog = JSON.parse(readFileSync(sourcePath, "utf8"));
  if (!Array.isArray(catalog)) throw new Error("data/catalog.json must contain an array");
  return catalog;
}

module.exports = { loadCatalog };
