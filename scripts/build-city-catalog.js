const fs = require("node:fs");
const path = require("node:path");

const inputPath = process.argv[2];
if (!inputPath) throw new Error("Provide the path to the source bundle.");

const source = fs.readFileSync(inputPath, "utf8");
const starts = [...source.matchAll(/{"city":"/g)].map((match) => match.index);
const parsed = [];

function findJsonEnd(value, start, opening, closing) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < value.length; index += 1) {
    const character = value[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === "\"") inString = false;
      continue;
    }
    if (character === "\"") inString = true;
    else if (character === opening) depth += 1;
    else if (character === closing && --depth === 0) return index + 1;
  }
  return -1;
}

for (const start of starts) {
  const end = findJsonEnd(source, start, "{", "}");
  if (end < 0) continue;
  const json = source
    .slice(start, end)
    .replaceAll(/\\x([0-9a-fA-F]{2})/g, String.raw`\u00$1`)
    .replaceAll(String.raw`\'`, "'");

  try {
    const item = JSON.parse(json);
    if (Array.isArray(item.video_id)) parsed.push(item);
  } catch {
    // The bundle also contains unrelated city-shaped objects; ignore them.
  }
}

const modeVideos = (item, mode) => {
  const sourceItem = mode === "drive" ? item : item.experiences?.[mode];
  const ids = mode === "drive" ? item.video_id : sourceItem?.video_id;
  if (!Array.isArray(ids)) return [];
  return ids.map((id, index) => ({
    id,
    start: sourceItem?.start_times?.[index] ?? item.start_times?.[index] ?? 20
  }));
};

const parsedCatalog = [...new Map(
  parsed.map((item) => [`${item.city}\u0000${item.country}`, item])
).values()]
  .map((item) => ({
    name: item.city,
    country: item.country,
    videos: {
      drive: modeVideos(item, "drive"),
      bike: modeVideos(item, "bike"),
      walk: modeVideos(item, "walk")
    },
    radios: (item.radio_url || []).slice(0, 5).map((url, index) => ({
      name: item.name?.[index] || `Local radio ${index + 1}`,
      url
    }))
  }))
  .sort((left, right) => {
    if (left.name === "Sao Paulo") return -1;
    if (right.name === "Sao Paulo") return 1;
    return left.name.localeCompare(right.name, "en");
  });

if (parsedCatalog.length !== 179) {
  throw new Error(`Incomplete source catalog: ${parsedCatalog.length} of 179 cities.`);
}

// Keep curated records that are intentionally maintained in data/catalog.json
// (for example cities and modes added after the upstream source bundle).
const currentCatalogPath = path.resolve(__dirname, "..", "data/catalog.json");
const currentCatalog = fs.existsSync(currentCatalogPath)
  ? JSON.parse(fs.readFileSync(currentCatalogPath, "utf8"))
  : [];

const cityKey = (city) => `${city.name}\u0000${city.country}`;
const currentByKey = new Map(currentCatalog.map((city) => [cityKey(city), city]));
const sourceCatalog = parsedCatalog.map((city) => {
  const current = currentByKey.get(cityKey(city));
  if (!current) return city;
  return {
    ...current,
    ...city,
    videos: {
      ...current.videos,
      drive: city.videos.drive,
      bike: city.videos.bike,
      walk: city.videos.walk
    },
    radios: city.radios.length ? city.radios : current.radios
  };
});
const sourceKeys = new Set(sourceCatalog.map(cityKey));
const curatedCities = currentCatalog.filter((city) => !sourceKeys.has(cityKey(city)));
const catalog = [...sourceCatalog, ...curatedCities];

const outputPath = path.resolve(__dirname, "..", "data/catalog.json");
fs.writeFileSync(outputPath, `${JSON.stringify(catalog, null, 2)}\n`);

const counts = {
  cities: catalog.length,
  drive: catalog.filter((city) => city.videos.drive.length).length,
  bike: catalog.filter((city) => city.videos.bike.length).length,
  walk: catalog.filter((city) => city.videos.walk.length).length,
  drone: catalog.filter((city) => city.videos.drone?.length).length,
  beach_walk: catalog.filter((city) => city.videos.beach_walk?.length).length
};
console.log(JSON.stringify(counts));
