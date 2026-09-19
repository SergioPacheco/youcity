import {
  normalizeCatalogStation,
  normalizeRadioBrowserStation,
  normalizeStreamUrl
} from "./radio-station.mjs";
import { slugify } from "../core/url.mjs";

function text(value) {
  return String(value || "").trim().toLowerCase();
}

function cityKey(city) {
  return `${slugify(city?.name || "")}\u0000${text(city?.country)}`;
}

function normalizedName(station) {
  return text(station?.name).replace(/\s+/g, " ");
}

function sameStation(first, second) {
  if (!first || !second) return false;
  if (first.stationuuid && second.stationuuid && first.stationuuid === second.stationuuid) return true;

  const firstUrl = normalizeStreamUrl(first.url);
  const secondUrl = normalizeStreamUrl(second.url);
  if (firstUrl && secondUrl && firstUrl === secondUrl) return true;

  const firstHomepage = normalizeStreamUrl(first.homepage);
  const secondHomepage = normalizeStreamUrl(second.homepage);
  if (firstHomepage && secondHomepage && firstHomepage === secondHomepage && normalizedName(first) === normalizedName(second)) {
    return true;
  }

  return Boolean(
    normalizedName(first)
    && normalizedName(first) === normalizedName(second)
    && first.cityId === second.cityId
    && first.countryCode === second.countryCode
  );
}

function normalizeDiscovered(city, station) {
  return station?.source === "radio-browser" && station?.stationRef
    ? normalizeRadioBrowserStation(city, station)
    : normalizeRadioBrowserStation(city, station);
}

export function createRadioStationRepository({ getCity } = {}) {
  const discoveredByCity = new Map();

  function currentCity() {
    return getCity?.() || null;
  }

  function getCatalogStations() {
    const city = currentCity();
    return Array.isArray(city?.radios)
      ? city.radios.map((radio, index) => normalizeCatalogStation(city, radio, index)).filter((station) => station.name && station.url)
      : [];
  }

  function getDiscoveredStations() {
    return [...(discoveredByCity.get(cityKey(currentCity())) || [])];
  }

  function getStations() {
    return [...getCatalogStations(), ...getDiscoveredStations()];
  }

  function mergeDiscoveredStations(stations = []) {
    const city = currentCity();
    if (!city) return [];
    const catalogStations = getCatalogStations();
    const existing = discoveredByCity.get(cityKey(city)) || [];
    const next = [...existing];
    for (const candidate of Array.isArray(stations) ? stations : []) {
      const station = normalizeDiscovered(city, candidate);
      if (!station.name || !station.url) continue;
      if (catalogStations.some((curated) => sameStation(curated, station))) continue;
      if (next.some((discovered) => sameStation(discovered, station))) continue;
      next.push(station);
    }
    discoveredByCity.set(cityKey(city), next);
    return [...next];
  }

  function clearDiscoveredStations() {
    const city = currentCity();
    if (city) discoveredByCity.delete(cityKey(city));
  }

  function findStationByRef(stationRef) {
    return getStations().find((station) => station.stationRef === stationRef) || null;
  }

  return {
    getCatalogStations,
    getDiscoveredStations,
    getStations,
    mergeDiscoveredStations,
    clearDiscoveredStations,
    findStationByRef
  };
}
