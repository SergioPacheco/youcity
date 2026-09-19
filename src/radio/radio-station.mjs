import { slugify } from "../core/url.mjs";

function text(value) {
  return String(value || "").trim();
}

export function normalizeStreamUrl(value) {
  return text(value).replace(/\/+$/, "").toLowerCase();
}

function cityDetails(city) {
  const cityId = slugify(city?.name || "");
  return {
    cityId,
    city: text(city?.name),
    country: text(city?.country),
    countryCode: text(city?.countryCode || city?.countrycode)
  };
}

function commonStationFields(city, radio) {
  const details = cityDetails(city);
  return {
    name: text(radio?.name),
    url: text(radio?.url_resolved || radio?.url),
    cityId: details.cityId,
    city: details.city,
    country: text(radio?.country || details.country),
    countryCode: text(radio?.countryCode || radio?.countrycode || details.countryCode),
    stationuuid: text(radio?.stationuuid),
    homepage: text(radio?.homepage),
    favicon: text(radio?.favicon),
    language: text(radio?.language),
    tags: text(radio?.tags),
    codec: text(radio?.codec),
    bitrate: Number(radio?.bitrate) || 0
  };
}

export function normalizeCatalogStation(city, radio, index) {
  const { cityId } = cityDetails(city);
  const sourceId = `${cityId}:${index}`;
  return {
    id: `catalog:${sourceId}`,
    stationRef: `catalog:${sourceId}`,
    source: "catalog",
    sourceId,
    ...commonStationFields(city, radio),
    curated: true
  };
}

export function normalizeRadioBrowserStation(city, station) {
  const stationuuid = text(station?.stationuuid);
  const sourceId = stationuuid || normalizeStreamUrl(station?.url_resolved || station?.url);
  const normalized = commonStationFields(city, station);
  return {
    id: `radio-browser:${sourceId}`,
    stationRef: `radio-browser:${sourceId}`,
    source: "radio-browser",
    sourceId,
    ...normalized,
    curated: false
  };
}
