export function createMapFeatureLoader({
  window,
  document,
  elements,
  cities,
  state,
  lazyModules,
  mapConfig,
  buildPopup,
  trackTravelClick,
  observeImpressions,
  closeLayer,
  selectCity,
  availableModes
} = {}) {
  let controllerPromise = null;

  function playRide(cityIndex, mode, videoIndex = 0) {
    const videos = cities[cityIndex]?.videos?.[mode];
    if (!Number.isInteger(cityIndex) || !videos?.length) return;
    const parsedIndex = Number(videoIndex);
    const selectedIndex = Number.isInteger(parsedIndex) ? Math.max(0, Math.min(parsedIndex, videos.length - 1)) : 0;
    closeLayer(elements.mapModal);
    selectCity(cityIndex, { silent: true, mode, videoIndex: selectedIndex, autoplayRadio: true });
  }

  async function initialize() {
    if (!controllerPromise) {
      controllerPromise = lazyModules.load("map-controller", () => import("./map-controller.mjs")).then(({ createMapController }) => createMapController({
        window,
        document,
        elements,
        cities,
        getCurrentCityIndex: () => state.cityIndex,
        mapConfig,
        buildPopup,
        onPlayRide: playRide,
        onTrackClick: trackTravelClick,
        onSelectCity: (index) => {
          closeLayer(elements.mapModal);
          selectCity(index, { silent: true, autoplayRadio: true });
        },
        observeImpressions
      }));
    }
    try {
      const active = await controllerPromise;
      await active.initialize();
      // Plain opens never inherit venues from another city; the focus flow
      // re-adds its venue right after this.
      active.clearFoodVenues();
    } catch (error) {
      controllerPromise = null;
      console.warn("[YouCity] Map library unavailable:", error.message);
    }
  }

  // STREET venue pins. No-ops until the Leaflet map initializes.
  async function showFoodVenues(venues) {
    await initialize();
    if (!controllerPromise) return 0;
    return (await controllerPromise).showFoodVenues(venues);
  }

  async function clearFoodVenues() {
    if (!controllerPromise) return;
    try {
      (await controllerPromise).clearFoodVenues();
    } catch {}
  }

  async function focusFoodVenue(venue) {
    await initialize();
    if (!controllerPromise) return false;
    return (await controllerPromise).focusFoodVenue(venue);
  }

  return { initialize, playRide, availableModes, showFoodVenues, clearFoodVenues, focusFoodVenue };
}
