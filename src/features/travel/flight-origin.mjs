const DEFAULT_MAX_DISTANCE_KM = 250;

function finiteCoordinate(value) {
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function distanceKm(firstLatitude, firstLongitude, secondLatitude, secondLongitude) {
  const latitudeDelta = (secondLatitude - firstLatitude) * Math.PI / 180;
  const longitudeDelta = (secondLongitude - firstLongitude) * Math.PI / 180;
  const firstRadians = firstLatitude * Math.PI / 180;
  const secondRadians = secondLatitude * Math.PI / 180;
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(firstRadians) * Math.cos(secondRadians) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function nearestAirport(airports, latitude, longitude, maxDistanceKm = DEFAULT_MAX_DISTANCE_KM) {
  const targetLatitude = finiteCoordinate(latitude);
  const targetLongitude = finiteCoordinate(longitude);
  if (targetLatitude === null || targetLongitude === null || !Array.isArray(airports)) return null;

  return airports.reduce((nearest, airport) => {
    const airportLatitude = finiteCoordinate(airport?.latitude);
    const airportLongitude = finiteCoordinate(airport?.longitude);
    if (!airport?.code || airportLatitude === null || airportLongitude === null) return nearest;
    const distance = distanceKm(targetLatitude, targetLongitude, airportLatitude, airportLongitude);
    if (distance > maxDistanceKm || (nearest && distance >= nearest.distanceKm)) return nearest;
    return { ...airport, distanceKm: Math.round(distance * 10) / 10 };
  }, null);
}

export function airportsFromDiscoverCars(locations) {
  return Object.values(locations || {}).flatMap((location) => {
    const latitude = finiteCoordinate(location?.latitude);
    const longitude = finiteCoordinate(location?.longitude);
    if (latitude === null || longitude === null) return [];
    return (location?.discoverCars?.airports || [])
      .map((airport) => {
        const code = String(airport?.name || "").trim().toUpperCase();
        return /^[A-Z]{3}$/.test(code)
          ? { code, name: airport.name, cityId: location.youCityId || "", cityName: location.youCityName || "", latitude, longitude }
          : null;
      })
      .filter(Boolean);
  });
}

export function buildFlightSearchUrl(value, { fromIata = "", toIata = "" } = {}) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return "";
    if (/^[A-Z]{3}$/i.test(String(fromIata))) url.searchParams.set("fromiata", String(fromIata).toUpperCase());
    if (/^[A-Z]{3}$/i.test(String(toIata))) url.searchParams.set("toiata", String(toIata).toUpperCase());
    return url.toString();
  } catch {
    return "";
  }
}

export function createFlightOriginResolver({ geolocation, getAirports = () => [] } = {}) {
  function resolve() {
    if (typeof geolocation?.getCurrentPosition !== "function") return Promise.resolve(null);
    return new Promise((resolveOrigin) => {
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        resolveOrigin(value);
      };
      try {
        geolocation.getCurrentPosition(
          (position) => finish(nearestAirport(getAirports(), position?.coords?.latitude, position?.coords?.longitude)),
          () => finish(null),
          { enableHighAccuracy: false, maximumAge: 15 * 60 * 1000, timeout: 3_500 }
        );
      } catch {
        finish(null);
      }
    });
  }

  return { resolve };
}
