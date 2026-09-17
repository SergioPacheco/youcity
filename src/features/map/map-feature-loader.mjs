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
      await (await controllerPromise).initialize();
    } catch (error) {
      controllerPromise = null;
      console.warn("[YouCity] Map library unavailable:", error.message);
    }
  }

  return { initialize, playRide, availableModes };
}
