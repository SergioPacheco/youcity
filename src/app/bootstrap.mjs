import { getEffectiveStartSeconds } from "../core/video-policy.mjs";
import { slugify as slugifyContract } from "../core/url.mjs";
import { createRadioController } from "../radio/radio-controller.mjs";
import { createRadioPanelController } from "../radio/radio-panel.mjs";
import { createRadioBrowserClient } from "../radio/radio-browser.mjs";
import { createRadioBrowserFeature } from "../radio/radio-browser-feature.mjs";
import { createRadioStationRepository } from "../radio/radio-station-repository.mjs";
import { createNowPlayingClient } from "../radio/radio-now-playing.mjs";
import { createYouTubeSearchClient } from "../radio/radio-youtube.mjs";
import { createRadioMediaFeature } from "../radio/radio-media-feature.mjs";
import { createVideoController } from "../player/video-controller.mjs";
import { createCatalogRepository } from "../catalog/catalog-repository.mjs";
import { createCitySelection } from "../city/city-selection.mjs";
import { createStorage } from "../core/storage.mjs";
import { createAppStore } from "../state/store.mjs";
import { loadCommentAssistant } from "../features/comment-assistant/comment-assistant-loader.mjs";
import { createWeatherController } from "../weather/weather-controller.mjs";
import { createLazyModuleLoader } from "../core/lazy-module.mjs";
import { createLayersController } from "../ui/layers-controller.mjs";
import { createSharingController } from "../sharing/sharing-controller.mjs";
import { findShareComment } from "../sharing/comment-share.mjs";
import { createNavigationController } from "../navigation/navigation-controller.mjs";
import { createCityBrowser } from "../ui/city-browser.mjs";
import { createMediaControls } from "../ui/media-controls.mjs";
import { createTravelController } from "../features/travel/travel-controller.mjs";
import { createMapFeatureLoader } from "../features/map/map-feature-loader.mjs";
import { createDom, createSitePath, hasAdminRole } from "./dom.mjs";
import CATALOG from "../catalog/catalog.mjs";
import MAP_CONFIG from "../features/map/map-config.mjs";

// =============================================================================
// YouCity application runtime
// Immersive urban rides with local radio
// =============================================================================

/**
 * Application composition root. Feature modules are loaded by this entrypoint
 * and all runtime state remains inside this invocation.
 */
export function startApplication() {
  'use strict';

  // -----------------------------------------------------------------------------
  // Centralized configuration (avoids magic numbers and hardcoded strings)
  // -----------------------------------------------------------------------------
  const CONFIG = {
    VIDEO_READY_DELAY: 1500,
    YOUTUBE_API_TIMEOUT: 15_000,
    VIDEO_LOAD_TIMEOUT: 12_000,
    MIN_VIDEO_START_SECONDS: 15,
    TOAST_DURATION: 2600,
    STREET_SOUND_VOLUME: 32,
    CLOCK_INTERVAL: 60_000,
    RADIO_RETRY_DELAY: 2000,
    RADIO_LOAD_TIMEOUT: 10_000,
    RADIO_MAX_RETRIES: 4,
    VIDEO_SWITCH_DEBOUNCE: 400,
    DEFAULT_VOLUME: 64,
    VOLUME_ROTATION_FACTOR: 2.4,
    VOLUME_DRAG_SENSITIVITY: 0.5,
    VOLUME_WHEEL_STEP: 5,
    storageKeys: {
      prefs: "volta-prefs",
      playerHidden: "volta-player-hidden",
      favorites: "volta-favorites",
      recentCities: "volta-recent-cities",
      theme: "volta-theme",
      swipeHintSeen: "youcity-swipe-hint-seen",
    },
    filters: {
      ALL: "all",
      FAVORITES: "favorites",
    },
    themes: {
      DEFAULT: "",
      SEPIA: "theme-sepia",
      CONTRAST: "theme-contrast",
    },
    qualities: {
      AUTO: "auto",
      HD720: "720",
      HD1080: "1080",
    },
    modes: {
      DRIVE: "drive",
      BIKE: "bike",
      WALK: "walk",
      DRONE: "drone",
      BEACH_WALK: "beach_walk",
    },
  };

  // Centralized messages for future i18n
  const MESSAGES = {
    nowIn: (cityName) => `Now in ${cityName}`,
    streetSoundOn: "Street sound on",
    streetSoundOff: "Street sound off",
    noRadio: "This city has no radio station available yet.",
    radioRetry: "The radio did not respond. Trying the next station...",
    radioUnavailable: "No radio station is available right now. Try again later.",
    noVideo: "No video is available for this city.",
    videoFallback: "Video unavailable. Loading an alternative...",
    videoUnavailable: "Video unavailable. Try another city.",
    fullscreenUnavailable: "Fullscreen is not available in this browser.",
    linkCopied: "Link copied to clipboard!",
    linkCopyFailed: "Could not copy the link",
    shareTextCopied: "Generated comment copied. Paste it into Facebook.",
    shareTextCopyFailed: "Copy the generated comment before posting.",
    favoriteAdded: (city) => `${city} added to favorites ♥`,
    favoriteRemoved: (city) => `${city} removed from favorites`,
    randomDestination: (city) => `Random destination: ${city}`,
    rideSpeed: (speed) => `Ride speed: ${speed}`,
    qualityAuto: "Quality: Auto",
    qualitySet: (quality) => `Quality: ${quality}p`,
    themeDefault: "Theme: Default",
    themeSepia: "Theme: Sepia",
    themeContrast: "Theme: High contrast",
    modeSwitch: (mode, city) => `${mode} in ${city}`,
  };

  const VIDEO_STATES = Object.freeze({
    IDLE: "IDLE",
    LOADING: "LOADING",
    PLAYING: "PLAYING",
    RETRYING: "RETRYING",
    UNAVAILABLE: "UNAVAILABLE",
    ERROR: "ERROR"
  });

  // -----------------------------------------------------------------------------
  // Dados estáticos
  // -----------------------------------------------------------------------------
  const COUNTRY_INFO = {
    Argentina: ["Argentina", "South America", "America/Argentina/Buenos_Aires"],
    Australia: ["Australia", "Oceania", "Australia/Sydney"],
    Austria: ["Austria", "Europe", "Europe/Vienna"],
    Brazil: ["Brazil", "South America", "America/Sao_Paulo"],
    Bulgaria: ["Bulgaria", "Europe", "Europe/Sofia"],
    Canada: ["Canada", "North America", "America/Toronto"],
    China: ["China", "Asia", "Asia/Shanghai"],
    Cuba: ["Cuba", "Caribbean", "America/Havana"],
    Czechia: ["Czechia", "Europe", "Europe/Prague"],
    "Dominican Republic": ["Dominican Republic", "Caribbean", "America/Santo_Domingo"],
    Egypt: ["Egypt", "Africa", "Africa/Cairo"],
    England: ["England", "Europe", "Europe/London"],
    France: ["France", "Europe", "Europe/Paris"],
    Germany: ["Germany", "Europe", "Europe/Berlin"],
    Greece: ["Greece", "Europe", "Europe/Athens"],
    Guatemala: ["Guatemala", "Central America", "America/Guatemala"],
    Hungary: ["Hungary", "Europe", "Europe/Budapest"],
    India: ["India", "Asia", "Asia/Kolkata"],
    Indonesia: ["Indonesia", "Asia", "Asia/Jakarta"],
    Iran: ["Iran", "Asia", "Asia/Tehran"],
    Ireland: ["Ireland", "Europe", "Europe/Dublin"],
    Israel: ["Israel", "Asia", "Asia/Jerusalem"],
    Italy: ["Italy", "Europe", "Europe/Rome"],
    Japan: ["Japan", "Asia", "Asia/Tokyo"],
    Korea: ["South Korea", "Asia", "Asia/Seoul"],
    Malaysia: ["Malaysia", "Asia", "Asia/Kuala_Lumpur"],
    Mexico: ["Mexico", "North America", "America/Mexico_City"],
    Monaco: ["Monaco", "Europe", "Europe/Monaco"],
    Netherlands: ["Netherlands", "Europe", "Europe/Amsterdam"],
    "New Zealand": ["New Zealand", "Oceania", "Pacific/Auckland"],
    "Northern Ireland": ["Northern Ireland", "Europe", "Europe/London"],
    Norway: ["Norway", "Europe", "Europe/Oslo"],
    Pakistan: ["Pakistan", "Asia", "Asia/Karachi"],
    Philippines: ["Philippines", "Asia", "Asia/Manila"],
    Poland: ["Poland", "Europe", "Europe/Warsaw"],
    Portugal: ["Portugal", "Europe", "Europe/Lisbon"],
    Qatar: ["Qatar", "Asia", "Asia/Qatar"],
    Russia: ["Russia", "Europe/Asia", "Europe/Moscow"],
    Senegal: ["Senegal", "Africa", "Africa/Dakar"],
    Singapore: ["Singapore", "Asia", "Asia/Singapore"],
    Slovenia: ["Slovenia", "Europe", "Europe/Ljubljana"],
    "South Africa": ["South Africa", "Africa", "Africa/Johannesburg"],
    Spain: ["Spain", "Europe", "Europe/Madrid"],
    Sweden: ["Sweden", "Europe", "Europe/Stockholm"],
    Switzerland: ["Switzerland", "Europe", "Europe/Zurich"],
    Taiwan: ["Taiwan", "Asia", "Asia/Taipei"],
    Turkey: ["Turkey", "Europe/Asia", "Europe/Istanbul"],
    UAE: ["United Arab Emirates", "Asia", "Asia/Dubai"],
    UK: ["United Kingdom", "Europe", "Europe/London"],
    USA: ["United States", "North America", "America/New_York"],
    Ukraine: ["Ukraine", "Europe", "Europe/Kyiv"],
    Uruguay: ["Uruguay", "South America", "America/Montevideo"],
    Uzbekistan: ["Uzbekistan", "Asia", "Asia/Tashkent"]
  };

  const CITY_NAMES = {
    "Sao Paulo": "São Paulo", Tokyo: "Tokyo", "New York City": "New York City",
    "Rio De Janeiro": "Rio de Janeiro", London: "London", Seoul: "Seoul", Lisbon: "Lisbon",
    Rome: "Rome", Moscow: "Moscow", Munich: "Munich", Vienna: "Vienna", Warsaw: "Warsaw",
    Athens: "Athens", Beijing: "Beijing", "Mexico City": "Mexico City", Milan: "Milan",
    Cologne: "Cologne", Florence: "Florence", Brussels: "Brussels", Istanbul: "Istanbul"
  };

  const CITY_TIME_ZONES = {
    Albuquerque: "America/Denver", Anchorage: "America/Anchorage", Aspen: "America/Denver",
    Austin: "America/Chicago", Chicago: "America/Chicago", Dallas: "America/Chicago",
    Denver: "America/Denver", Hawaii: "Pacific/Honolulu", Houston: "America/Chicago",
    "Las Vegas": "America/Los_Angeles", "Los Angeles": "America/Los_Angeles",
    Minneapolis: "America/Chicago", Nashville: "America/Chicago", "New Orleans": "America/Chicago",
    Phoenix: "America/Phoenix", "San Diego": "America/Los_Angeles", "San Francisco": "America/Los_Angeles",
    Seattle: "America/Los_Angeles", Vancouver: "America/Vancouver", Brisbane: "Australia/Brisbane",
    "Gold Coast": "Australia/Brisbane", Melbourne: "Australia/Melbourne", Dunedin: "Pacific/Auckland",
    Cancun: "America/Cancun", Tijuana: "America/Tijuana", Novosibirsk: "Asia/Novosibirsk",
    Yekaterinburg: "Asia/Yekaterinburg", "St. Petersburg": "Europe/Moscow", Granada: "Europe/Madrid"
  };

  const CITY_NOTES = {
    "Sao Paulo": "Concrete, light, and the constant pulse of the largest city in the Southern Hemisphere.",
    Tokyo: "Neon, precise silence, and roads crossing a city that feels almost futuristic.",
    Paris: "Stone boulevards, golden light, and corners that call for a longer route.",
    "New York City": "Traffic lights, bridges, and the electric hum of a city always on the move.",
    "Rio De Janeiro": "The city meets the sea between tunnels, hills, and a light that changes everything.",
    London: "Fine rain, old brick, and the calm rhythm of streets along the Thames.",
    Seoul: "Dawn reflects on the asphalt between markets, signs, and wide avenues.",
    Lisbon: "Hills, tiled facades, and the Atlantic appearing at the end of every narrow street.",
    Granada: "The Alhambra and Generalife, Albaicín, Sacromonte, Mirador de San Nicolás, and Sierra Nevada meet in a city made for wandering."
  };

  const MODE_LABELS = {
    [CONFIG.modes.DRIVE]: "Drive",
    [CONFIG.modes.BIKE]: "Bike",
    [CONFIG.modes.WALK]: "Walk",
    [CONFIG.modes.DRONE]: "Drone",
    [CONFIG.modes.BEACH_WALK]: "Beach Walk"
  };
  const MODE_ORDER = [CONFIG.modes.DRIVE, CONFIG.modes.BIKE, CONFIG.modes.WALK, CONFIG.modes.BEACH_WALK, CONFIG.modes.DRONE];

  const WEATHER_CONFIG = Object.freeze({
    CACHE_TTL: 15 * 60 * 1000,
    REQUEST_TIMEOUT: 8_000,
    PUBLIC_ENDPOINT: "https://api.open-meteo.com/v1/forecast"
  });

  const THEME_NAMES = {
    [CONFIG.themes.DEFAULT]: MESSAGES.themeDefault,
    [CONFIG.themes.SEPIA]: MESSAGES.themeSepia,
    [CONFIG.themes.CONTRAST]: MESSAGES.themeContrast,
  };

  // -----------------------------------------------------------------------------
  // Utilitários
  // -----------------------------------------------------------------------------

  /**
   * Gera uma marca de 2 letras a partir do nome da estação de rádio
   * @param {string} name - Nome da estação
   * @returns {string} Marca de 2 letras (ex: "FM", "AN")
   */
  function stationMark(name) {
    const words = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").match(/[A-Za-z0-9]+/g) || [];
    return (words.length > 1 ? words.map((word) => word[0]).join("") : words[0] || "FM").slice(0, 2).toUpperCase();
  }

  /**
   * Creates the stable URL segment used by prerendered city pages.
   */
  function citySlug(value) {
    return slugifyContract(value);
  }

  const { basePath: BASE_PATH, sitePath } = createSitePath(window);

  // -----------------------------------------------------------------------------
  // Persistência de preferências (localStorage) com tratamento de erro apropriado
  // -----------------------------------------------------------------------------

  let browserStorage = null;
  try { browserStorage = window.localStorage; } catch { /* storage is optional */ }
  const appStorage = createStorage(browserStorage);

  /**
   * Carrega preferências do localStorage
   * @returns {Object} Objeto de preferências ou vazio se falhar
   */
  function loadPreferences() {
    return appStorage.readJson(CONFIG.storageKeys.prefs, {}) || {};
  }

  /**
   * Salva preferências no localStorage
   * @param {Object} prefs - Preferências a salvar
   */
  function savePreferences(prefs) {
    appStorage.writeJson(CONFIG.storageKeys.prefs, { ...loadPreferences(), ...prefs });
  }

  // -----------------------------------------------------------------------------
  // City catalog processing
  // -----------------------------------------------------------------------------
  const catalogRepository = createCatalogRepository(CATALOG.map((item) => {
    const [country, region, countryTimeZone] = COUNTRY_INFO[item.country] || [item.country, "World", "UTC"];
    return {
      ...item,
      id: citySlug(item.name),
      rawName: item.name,
      rawCountry: item.country,
      name: CITY_NAMES[item.name] || item.name,
      country,
      region,
      timeZone: CITY_TIME_ZONES[item.name] || countryTimeZone,
      note: CITY_NOTES[item.name] || `Real streets, local radio, and the rhythm of ${CITY_NAMES[item.name] || item.name} through the window.`,
      videos: item.videos,
      radios: (item.radios || []).map((radio) => ({ ...radio, mark: stationMark(radio.name) }))
    };
  }));
  const cities = catalogRepository.list();
  const citySelection = createCitySelection(catalogRepository);

  const { $, elements } = createDom(document);

  // -----------------------------------------------------------------------------
  // Estado da aplicação (encapsulado dentro do IIFE)
  // -----------------------------------------------------------------------------
  const appStore = createAppStore({
    cityIndex: 0,
    radioIndex: 0,
    radioPlaying: false,
    radioWantsPlay: false,
    streetSoundOn: false,
    currentSpeed: 1,
    currentMode: CONFIG.modes.DRIVE,
    currentVideoIndex: 0,
    currentVideoId: null,
    playbackSessionStarted: false,
    videoState: VIDEO_STATES.IDLE,
    isAdmin: hasAdminRole(window),
    videoUserGesture: false,
    // Novas funcionalidades
    favorites: [],
    visitedCities: [],
    currentFilter: CONFIG.filters.ALL,
    currentContinent: "",
    currentTheme: CONFIG.themes.DEFAULT,
    currentQuality: CONFIG.qualities.AUTO,
    playerHidden: false,
    radioExpanded: false,
    mainCtaImpressionCity: "",
  });
  const state = appStore.getState();
  const lazyModules = createLazyModuleLoader();
  let commentAssistant = null;
  let radioBrowserFeature = null;
  let radioMediaFeature = null;
  let lastRadioIndex = state.radioIndex;

  // -----------------------------------------------------------------------------
  // Funções auxiliares
  // -----------------------------------------------------------------------------

  /**
   * Formata índice com zeros à esquerda
   * @param {number} value - Valor a formatar
   * @returns {string} Valor formatado
   */
  function pad(value) {
    return String(value).padStart(String(cities.length).length, "0");
  }

  /**
   * Retorna a cidade atual
   * @returns {Object} Objeto da cidade atual
   */
  function currentCity() {
    return cities[state.cityIndex];
  }

  function availableModes(city) {
    return catalogRepository.availableModes(city);
  }

  /**
   * Retorna o vídeo atual para o modo selecionado
   * @param {Object} [city] - Cidade (padrão: cidade atual)
   * @returns {Object|undefined} Objeto do vídeo ou undefined
   */
  function currentRide(city = currentCity()) {
    const cityIndex = cities.indexOf(city);
    return catalogRepository.selectRide({
      cityIndex: cityIndex < 0 ? state.cityIndex : cityIndex,
      mode: state.currentMode,
      videoIndex: state.currentVideoIndex
    });
  }

  function buildYoutubeWatchUrl(ride) {
    const url = new URL(`https://www.youtube.com/watch?v=${encodeURIComponent(ride.id)}`);
    url.searchParams.set("t", `${Math.floor(getVideoStartSeconds(ride))}s`);
    return url.toString();
  }

  function getVideoStartSeconds(ride) {
    return getEffectiveStartSeconds(ride, CONFIG.MIN_VIDEO_START_SECONDS);
  }

  function updateRideSourceLink(ride) {
    if (!elements.sourceLink) return;

    if (!ride?.id) {
      elements.sourceLink.removeAttribute("href");
      elements.sourceLink.setAttribute("aria-disabled", "true");
      elements.sourceLink.setAttribute("aria-label", "No source video is available for this ride");
      return;
    }

    elements.sourceLink.href = buildYoutubeWatchUrl(ride);
    elements.sourceLink.removeAttribute("aria-disabled");
    elements.sourceLink.setAttribute("aria-label", `View the source video for ${currentCity().name}`);
  }

  // -----------------------------------------------------------------------------
  // Ride mode controls (Drive/Bike/Walk/Drone)
  // -----------------------------------------------------------------------------

  /**
   * Atualiza os controles de modo baseado na disponibilidade
   */
  function updateModeControls() {
    elements.modeButtons.forEach((button) => {
      const mode = button.dataset.mode;
      const available = currentCity().videos[mode]?.length > 0;
      button.hidden = !available;
      button.disabled = false;
      button.classList.toggle("is-active", mode === state.currentMode);
      button.title = available
        ? `${MODE_LABELS[mode]} in ${currentCity().name}`
        : "";
    });
    elements.cityRegion.textContent = `${currentCity().region} · ${MODE_LABELS[state.currentMode]}`;
  }

  const mediaControls = createMediaControls({
    window,
    document,
    elements,
    state,
    storage: appStorage,
    storageKeys: CONFIG.storageKeys,
    config: CONFIG,
    themeNames: THEME_NAMES,
    messages: MESSAGES,
    setPlaybackQuality: (quality) => youtubePlayerManager.setPlaybackQuality(quality)
  });
  const {
    showToast,
    togglePlayer,
    restorePlayerFromStorage,
    cycleTheme,
    loadTheme,
    cycleQuality,
    updateVolumeFromKnob,
    setupVolumeKnobListeners
  } = mediaControls;

  // -----------------------------------------------------------------------------
  const radioStationRepository = createRadioStationRepository({ getCity: currentCity });
  const radioController = createRadioController({
    audio: elements.radio,
    elements,
    getCity: currentCity,
    getStations: () => radioStationRepository.getStations(),
    getVolume: () => Number(elements.volume.value),
    messages: MESSAGES,
    showToast,
    config: CONFIG,
    onStateChange: (next) => {
      state.radioIndex = next.radioIndex;
      state.radioWantsPlay = next.radioWantsPlay;
      if (next.radioIndex !== lastRadioIndex) {
        lastRadioIndex = next.radioIndex;
        radioMediaFeature?.reset();
      }
    },
    onPlayingChange: (playing) => { state.radioPlaying = playing; }
  });

  const radioPanelController = createRadioPanelController({
    playerCard: elements.playerCard,
    playerCardMain: elements.playerCardMain,
    expandButton: elements.radioExpand,
    collapseButton: elements.radioCollapse,
    initialExpanded: window.matchMedia?.("(min-width: 801px)")?.matches === true
  });
  radioBrowserFeature = createRadioBrowserFeature({
    document,
    elements: {
      trigger: elements.radioBrowserDiscover,
      panel: elements.radioBrowserPanel,
      closeButton: elements.radioBrowserClose,
      status: elements.radioBrowserStatus,
      results: elements.radioBrowserResults
    },
    getCity: currentCity,
    stationRepository: radioStationRepository,
    radioController,
    client: createRadioBrowserClient({ basePath: BASE_PATH }),
    showToast
  });
  radioMediaFeature = createRadioMediaFeature({
    document,
    elements: {
      identifyButton: elements.radioNowPlaying,
      panel: elements.radioMediaPanel,
      closeButton: elements.radioMediaClose,
      status: elements.radioNowPlayingStatus,
      results: elements.radioYouTubeResults,
      videoHost: elements.radioYouTubePlayer
    },
    getStation: () => radioController.getCurrentStation(),
    nowPlayingClient: createNowPlayingClient({ basePath: BASE_PATH }),
    youtubeClient: createYouTubeSearchClient({ basePath: BASE_PATH }),
    showToast
  });

  const videoController = createVideoController({
    window,
    document,
    elements,
    state,
    config: CONFIG,
    messages: MESSAGES,
    videoStates: VIDEO_STATES,
    modeLabels: MODE_LABELS,
    getCurrentCity: currentCity,
    getCurrentRide: currentRide,
    availableModes,
    getStartSeconds: getVideoStartSeconds,
    updateSourceLink: updateRideSourceLink,
    showToast,
    radioController,
    onModeChange: updateModeControls,
    onNoRide: () => selectRandomCity({ autoplayRadio: false })
  });
  const {
    command: videoCommand,
    playerManager: youtubePlayerManager,
    updateVideo,
    startPlayback,
    scheduleClockUpdate
  } = videoController;

  const cityBrowser = createCityBrowser({
    cities,
    state,
    elements,
    storage: appStorage,
    storageKeys: CONFIG.storageKeys,
    config: CONFIG,
    modeLabels: MODE_LABELS,
    modeOrder: MODE_ORDER,
    messages: MESSAGES,
    showToast,
    getCurrentCityIndex: () => state.cityIndex
  });
  const {
    loadFavorites,
    loadRecentCities,
    toggleFavorite,
    updateFavoriteButton,
    isFavorite,
    trackVisit,
    setFilter,
    syncDrawerFilterToRide,
    setContinent,
    renderRail,
    renderGrid
  } = cityBrowser;

  // -----------------------------------------------------------------------------
  const sharingController = createSharingController({
    window,
    document,
    navigator,
    elements: { ...elements, shareFan: $("#share-fan") },
    getCity: currentCity,
    getState: () => state,
    getShareComment: (filters) => commentAssistant?.getShareComment?.(filters) || findShareComment(browserStorage, filters),
    countryInfo: COUNTRY_INFO,
    slugify: citySlug,
    sitePath,
    modeLabels: MODE_LABELS,
    showToast,
    messages: MESSAGES
  });
  const { shareCity, shareToSocial, closeShareFan } = sharingController;

  const navigationController = createNavigationController({
    window,
    cities,
    state,
    basePath: BASE_PATH,
    slugify: citySlug
  });
  const loadRouteFromURL = navigationController.loadRoute;
  const syncURL = ({ replace = false } = {}) => navigationController.syncUrl({ city: currentCity(), replace });

  const layersController = createLayersController({
    document,
    elements,
    onBeforeDrawerOpen: () => syncDrawerFilterToRide()
  });
  const { open: openLayer, close: closeLayer, closeMoreMenu } = layersController;

  const travelController = createTravelController({
    window,
    document,
    elements,
    state,
    cities,
    sitePath,
    lazyModules,
    modeLabels: MODE_LABELS,
    availableModes,
    currentCity,
    openLayer,
    closeLayer,
    selectCity,
    showToast,
    isStaticLocalPreview: () => ["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(window.location.hostname)
  });
  const {
    renderTravelPlanner,
    renderTravelPrompts,
    ensureDiscoverCarsCatalog,
    trackTravelClick,
    openFlightOffer,
    trackStay22Action,
    destroyStay22Map,
    mapPopup,
    openCityGuide,
    invalidateCityGuide
  } = travelController;
  const mapFeatureLoader = createMapFeatureLoader({
    window,
    document,
    elements,
    cities,
    state,
    lazyModules,
    mapConfig: MAP_CONFIG,
    buildPopup: mapPopup,
    trackTravelClick,
    observeImpressions: (root) => window.YouCityAffiliate?.observeImpressions?.(root),
    closeLayer,
    selectCity,
    availableModes
  });
  const initializeWorldMap = mapFeatureLoader.initialize;
  const playMapRide = mapFeatureLoader.playRide;

  /**
   * Carrega cidade da URL (com sanitização)
   * @returns {number|null} Índice da cidade ou null
   */
  // -----------------------------------------------------------------------------
  // -----------------------------------------------------------------------------
  // Info da cidade
  // -----------------------------------------------------------------------------

  /**
   * Atualiza informações da cidade
   */
  function updateCityInfo() {
    const city = currentCity();
    if (!city || !elements.infoTimezone) return;
    const timeTarget = elements.infoTimezone.querySelector("b");
    const timeZone = city.timeZone || COUNTRY_INFO[city.rawCountry]?.[2] || "UTC";
    try {
      timeTarget.textContent = new Intl.DateTimeFormat("en-US", {
        timeZone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
      }).format(new Date());
    } catch (error) {
      console.warn(`[YouCity] Could not format time for ${city.name}:`, error.message);
      timeTarget.textContent = "--:-- --";
    }
  }

  const WEATHER_LABELS = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Foggy",
    48: "Rime fog",
    51: "Light drizzle",
    53: "Drizzle",
    55: "Heavy drizzle",
    56: "Freezing drizzle",
    57: "Heavy freezing drizzle",
    61: "Light rain",
    63: "Rain",
    65: "Heavy rain",
    66: "Freezing rain",
    67: "Heavy freezing rain",
    71: "Light snow",
    73: "Snow",
    75: "Heavy snow",
    77: "Snow grains",
    80: "Light showers",
    81: "Showers",
    82: "Heavy showers",
    85: "Light snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with hail",
    99: "Heavy thunderstorm with hail"
  };

  function weatherLabel(code) {
    return WEATHER_LABELS[Number(code)] || "Weather update";
  }

  function weatherEndpoint(latitude, longitude) {
    const endpoint = new URL(WEATHER_CONFIG.PUBLIC_ENDPOINT);
    endpoint.searchParams.set("latitude", String(latitude));
    endpoint.searchParams.set("longitude", String(longitude));
    endpoint.searchParams.set("current", "temperature_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation,is_day");
    endpoint.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code,sunrise,sunset");
    endpoint.searchParams.set("forecast_days", "3");
    endpoint.searchParams.set("timezone", "auto");
    endpoint.searchParams.set("temperature_unit", "celsius");
    endpoint.searchParams.set("wind_speed_unit", "kmh");
    return endpoint;
  }

  function isStaticLocalPreview() {
    return ["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(window.location.hostname);
  }

  function setWeatherState(stateName, label = "") {
    if (!elements.infoTimezone) return;
    elements.infoTimezone.dataset.state = stateName;
    if (label) elements.infoWeatherLabel.textContent = label;
  }

  function renderWeather(weather) {
    const temperature = Number(weather?.current?.temperature_2m);
    const code = Number(weather?.current?.weather_code);
    if (!Number.isFinite(temperature)) throw new Error("Weather temperature is unavailable");
    elements.infoWeatherTemperature.textContent = `${Math.round(temperature)}°C`;
    elements.infoWeatherLabel.textContent = weatherLabel(code);
    elements.infoTimezone.title = `Current weather: ${weatherLabel(code)}`;
    setWeatherState("ready");
  }

  const weatherController = createWeatherController({
    timeout: WEATHER_CONFIG.REQUEST_TIMEOUT,
    cacheTtl: WEATHER_CONFIG.CACHE_TTL,
    getEndpoints: (latitude, longitude) => {
      if (isStaticLocalPreview()) return { primary: weatherEndpoint(latitude, longitude) };
      const apiEndpoint = new URL(sitePath("/api/weather"), window.location.origin);
      apiEndpoint.searchParams.set("latitude", String(latitude));
      apiEndpoint.searchParams.set("longitude", String(longitude));
      return { primary: apiEndpoint, fallback: weatherEndpoint(latitude, longitude) };
    },
    render: {
      loading: () => {
        if (!elements.infoTimezone) return;
        elements.infoWeatherTemperature.textContent = "--°C";
        setWeatherState("loading", "Loading weather…");
      },
      ready: renderWeather,
      error: () => {
        if (!elements.infoTimezone) return;
        elements.infoWeatherTemperature.textContent = "--°C";
        setWeatherState("error", "Weather unavailable");
      }
    },
    onError: (error, city) => console.warn(`[YouCity] Could not load weather for ${city.name}:`, error.message)
  });

  // -----------------------------------------------------------------------------
  // Navegação entre cidades
  // -----------------------------------------------------------------------------

  /**

   * Seleciona uma cidade
   * @param {number} nextIndex - Índice da cidade
   * @param {Object} [options] - Opções
   * @param {boolean} [options.silent] - Não mostrar toast
   * @param {boolean} [options.autoplayRadio] - Iniciar rádio automaticamente
   */
  function selectCity(nextIndex, options = {}) {
    invalidateCityGuide();
    const selection = citySelection.select({
      cityIndex: nextIndex,
      mode: options.mode || state.currentMode,
      videoIndex: Number.isInteger(options.videoIndex) ? Math.max(0, options.videoIndex) : 0
    });
    if (!selection) return;
    state.cityIndex = selection.cityIndex;
    state.radioIndex = 0;
    radioBrowserFeature?.reset();
    radioMediaFeature?.reset();

    const city = currentCity();
    // Cada cidade pode ter apenas alguns modos; preserve o atual quando
    // possível e selecione o primeiro modo realmente disponível caso contrário.
    state.currentMode = selection.mode;
    state.currentVideoIndex = selection.videoIndex;

    // Atualiza UI
    elements.cityName.textContent = city.name;
    elements.cityNote.textContent = city.note;
    elements.cityIndex.textContent = pad(state.cityIndex + 1);
    if (elements.topLocation) {
      elements.topLocation.textContent = `${city.name}, ${city.country}`;
    }
    document.title = `${city.name} — YouCity`;

    updateModeControls();
    updateVideo(city);
    scheduleClockUpdate();
    radioController.setRadio(0, state.radioPlaying || state.radioWantsPlay || options.autoplayRadio);
    renderRail();
    renderGrid(elements.search.value);

    // Novas funcionalidades
    updateFavoriteButton();
    updateCityInfo();
    weatherController.update(city);
    renderTravelPlanner(city);
    renderTravelPrompts(city);
    trackVisit(state.cityIndex);
    syncURL({ replace: options.replaceURL || false });

    // Salva preferência
    savePreferences({ cityIndex: state.cityIndex, currentMode: state.currentMode });

    // Analytics: city_view
    window.YOUCITY_ANALYTICS?.track?.({
      event: "city_view",
      city: city.name,
      country: city.country,
      countryCode: city.countryCode || "",
      mode: state.currentMode
    });

    if (!options.silent) {
      showToast(MESSAGES.nowIn(city.name));
    }
  }

  /**
   * Seleciona cidade aleatória
   */
  function selectRandomCity(options = { autoplayRadio: true }) {
    const randomIndex = Math.floor(Math.random() * cities.length);
    selectCity(randomIndex, options);
    showToast(MESSAGES.randomDestination(cities[randomIndex].name));
  }

  /**
   * Troca modo de passeio
   * @param {string} mode - Mode (drive/bike/walk/drone)
   */
  function switchMode(mode) {
    if (!currentCity().videos[mode]?.length || mode === state.currentMode) return;

    state.currentMode = mode;
    state.currentVideoIndex = 0;
    updateModeControls();
    updateVideo(currentCity());
    savePreferences({ currentMode: state.currentMode });
    syncURL();
    showToast(MESSAGES.modeSwitch(MODE_LABELS[mode], currentCity().name));
  }

  async function openCommentAssistantForCurrentRide() {
    if (!state.isAdmin) return;
    let assistant;
    try {
      assistant = await loadCommentAssistant({
        enabled: state.isAdmin,
        window,
        document,
        navigator,
        fetchImpl: window.fetch?.bind(window),
        catalog: CATALOG,
        basePath: BASE_PATH,
        analytics: window.YOUCITY_ANALYTICS,
        isAdmin: state.isAdmin,
        storage: browserStorage
      });
      commentAssistant = assistant;
    } catch (error) {
      showToast("Comment Assistant is unavailable. Try again later.");
      console.warn("[YouCity] Comment Assistant failed to load:", error.message);
      return;
    }
    const city = currentCity();
    const ride = currentRide();
    const rideMode = Object.entries(city?.videos || {}).find(([, videos]) =>
      videos?.some((video) => video?.id === ride?.id)
    )?.[0] || state.currentMode;
    const videoUrl = ride?.id ? buildYoutubeWatchUrl(ride) : "";
    assistant?.open?.({
      videoUrl,
      catalogContext: ride?.id ? {
        videoId: ride.id,
        title: ride.title || `${city.name} ${MODE_LABELS[rideMode] || "City Ride"}`,
        description: `A ${MODE_LABELS[rideMode] || "city"} video from ${city.name}, ${city.country}.`,
        channel: "YouCity catalog",
        city: city.name,
        country: city.country,
        mode: rideMode
      } : null
    });
  }

  function configureCommentAssistantAccess() {
    const enabled = state.isAdmin;
    elements.commentAssistantButton?.toggleAttribute("hidden", !enabled);
    elements.commentAssistantMenuItem?.toggleAttribute("hidden", !enabled);
  }

  function runOverflowAction(action) {
    closeMoreMenu();
    const actions = {
      share: shareCity,
      map: () => { openLayer(elements.mapModal); initializeWorldMap(); },
      theme: cycleTheme,
      fullscreen: () => $("#fullscreen-button").click(),
      about: () => openLayer(elements.about),
      "comment-assistant": openCommentAssistantForCurrentRide,
      random: selectRandomCity,
      privacy: () => window.YOUCITY_CONSENT?.showSettings?.()
    };
    actions[action]?.();
  }

  // -----------------------------------------------------------------------------
  // Inicialização
  // -----------------------------------------------------------------------------

  /**
   * Inicializa a aplicação
   */
  function initApp() {
    // Verifica se catálogo carregou
    if (!cities.length) {
      showCatalogError();
      return;
    }

    window.YOUCITY_COMMENT_ASSISTANT_ADMIN = state.isAdmin;
    configureCommentAssistantAccess();

    // Carrega preferências salvas
    const prefs = loadPreferences();

    // Carrega dados das novas funcionalidades
    state.favorites = loadFavorites();
    state.visitedCities = loadRecentCities();
    loadTheme();

    // Restaura estado
    if (prefs.volume !== undefined) {
      elements.volume.value = prefs.volume;
      elements.volumeKnob.style.transform = `rotate(${(prefs.volume - 50) * CONFIG.VOLUME_ROTATION_FACTOR}deg)`;
      elements.volumeAccessible.value = prefs.volume;
    }

    if (prefs.currentMode && Object.values(CONFIG.modes).includes(prefs.currentMode)) {
      state.currentMode = prefs.currentMode;
    }

    if (prefs.currentSpeed) {
      state.currentSpeed = prefs.currentSpeed;
      elements.speedButtons.forEach((btn) => {
        btn.classList.toggle("is-active", Number(btn.dataset.speed) === state.currentSpeed);
      });
    }

    if (prefs.streetSoundOn) {
      state.streetSoundOn = true;
      elements.streetSound.classList.add("is-active");
      elements.streetSound.setAttribute("aria-pressed", "true");
    }

    // Restaura estado do player (minimizado ou não)
    restorePlayerFromStorage();

    // Inicializa UI
    elements.cityTotal.textContent = pad(cities.length);
    renderRail();
    renderGrid();

    // Seleciona a rota compartilhada ou uma cidade aleatória ao abrir o site.
    const route = loadRouteFromURL();
    const initialCity = route.cityIndex !== null
      ? route.cityIndex
      : Math.floor(Math.random() * cities.length);
    selectCity(initialCity, {
      silent: true,
      mode: route.mode || undefined,
      videoIndex: route.videoIndex,
      replaceURL: true
    });

    // Start the muted video immediately. The radio is released on the first
    // user gesture when the browser allows audible media.
    startPlayback();

    // Preview mode para QA
    const previewMode = new URLSearchParams(window.location.search).get("preview");
    if (previewMode === "drawer") openLayer(elements.drawer);
    if (previewMode === "travel") {
      openLayer(elements.travelDrawer);
      ensureDiscoverCarsCatalog();
    }

    // Configura event listeners
    setupEventListeners();
  }

  /**
   * Exibe erro quando catálogo não carrega
   */
  function showCatalogError() {
    // UI amigável quando catálogo não carrega
    elements.app.innerHTML = `
      <section class="catalog-error" role="alert">
        <h1>Ops!</h1>
        <p>Could not load the city catalog. Check your connection and reload the page.</p>
        <button type="button" onclick="location.reload()">Try again</button>
      </section>
    `;
  }

  // -----------------------------------------------------------------------------
  // Event Listeners
  // -----------------------------------------------------------------------------

  /**
   * Configura todos os event listeners da aplicação
   */
  function setupEventListeners() {
    elements.moreButton?.addEventListener("click", (event) => {
      event.stopPropagation();
      const isOpen = elements.moreMenu.classList.toggle("is-open");
      elements.moreButton.setAttribute("aria-expanded", String(isOpen));
    });
    elements.moreMenu?.addEventListener("click", (event) => {
      const action = event.target.closest("[data-overflow-action]")?.dataset.overflowAction;
      if (action) runOverflowAction(action);
    });
    document.addEventListener("click", (event) => {
      if (!event.target.closest(".overflow-menu-wrapper")) closeMoreMenu();
    });

    // Navegação de cidades
    $("#cities-button").addEventListener("click", () => {
      openLayer(elements.drawer);
      setTimeout(() => elements.search.focus(), 100);
    });

    $("#about-button").addEventListener("click", () => openLayer(elements.about));

    elements.privacySettingsButton?.addEventListener("click", () => {
      window.YOUCITY_CONSENT?.showSettings?.();
    });

    elements.commentAssistantButton?.addEventListener("click", openCommentAssistantForCurrentRide);

    elements.travelButton.addEventListener("click", () => {
      // Internal navigation only: opening the city guide is not an affiliate
      // click. It is tracked as travel_planner_open by openCityGuide().
      openCityGuide();
    });

    const handleTravelOfferClick = (event) => {
      const offer = event.target.closest("[data-travel-provider]");
      if (!offer) return;
      trackTravelClick(offer);
      if (offer.dataset.travelFlightOrigin === "true") {
        event.preventDefault();
        openFlightOffer(offer);
      }
    };

    elements.travelPrompts?.addEventListener("click", handleTravelOfferClick);

    elements.travelPromptsClose?.addEventListener("click", () => {
      elements.travelPrompts.hidden = true;
    });

    elements.mapButton.addEventListener("click", () => {
      openLayer(elements.mapModal);
      initializeWorldMap();
    });

    elements.travelPlanner.addEventListener("click", handleTravelOfferClick);

    elements.stay22SearchForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const stay22 = window.YouCityStay22;
      const city = currentCity();
      const checkin = elements.stay22Checkin.value;
      const checkout = elements.stay22Checkout.value;
      const valid = stay22?.validAccommodationDates(checkin, checkout);
      if (!valid) {
        elements.stay22SearchStatus.textContent = "Choose valid dates: today or later, with check-out after check-in.";
        elements.stay22SearchResult.hidden = true;
        return;
      }
      const url = stay22.createAccommodationSearchUrl(city, {
        checkin,
        checkout,
        adults: elements.stay22Adults.value,
        children: elements.stay22Children.value
      }, { placement: "city_guide_stay" });
      if (!url) {
        elements.stay22SearchStatus.textContent = "Stay search is temporarily unavailable.";
        return;
      }
      elements.stay22SearchResult.href = url;
      elements.stay22SearchResult.hidden = false;
      elements.stay22SearchResult.dataset.affiliateOffer = "true";
      elements.stay22SearchResult.dataset.travelProvider = "stay22";
      elements.stay22SearchResult.dataset.travelVertical = "hotels";
      elements.stay22SearchResult.dataset.travelCityName = city.name;
      elements.stay22SearchResult.dataset.travelCountry = city.country;
      elements.stay22SearchResult.dataset.travelCountryCode = city.countryCode || "";
      elements.stay22SearchResult.dataset.travelPlacement = "city_guide_stay";
      elements.stay22SearchResult.dataset.travelProviderCampaign = new URL(url).searchParams.get("campaign") || "";
      elements.stay22SearchStatus.textContent = "Opening stay search…";
      trackStay22Action("search_submit", {
        checkinProvided: Boolean(checkin),
        checkoutProvided: Boolean(checkout),
        adultsProvided: elements.stay22Adults.value !== "",
        childrenProvided: elements.stay22Children.value !== ""
      });
      // No affiliate_click here: the search opens programmatically, no click
      // happened yet. A real user click on the result link is tracked by the
      // stay22SearchResult click listener below.
      const searchWindow = window.open(url, "_blank", "noopener,noreferrer");
      if (!searchWindow) {
        elements.stay22SearchResult.hidden = false;
        elements.stay22SearchStatus.textContent = "Popup blocked. Open stay search.";
        elements.stay22SearchResult.focus();
      }
    });

    elements.stay22SearchResult.addEventListener("click", (event) => {
      if (!elements.stay22SearchResult.href) return;
      trackTravelClick(elements.stay22SearchResult);
      event.stopPropagation();
    });

    elements.stay22BrowseButton.addEventListener("click", () => {
      trackStay22Action("browse_open", { action: "browse" });
    });

    elements.stay22Checkin.addEventListener("change", () => {
      elements.stay22Checkout.min = elements.stay22Checkin.value || window.YouCityStay22?.today?.() || "";
    });

    elements.stay22MapButton.addEventListener("click", () => {
      const city = currentCity();
      const url = window.YouCityStay22?.createMapUrl(city, { placement: "city_guide_stay" });
      if (!url) return;
      destroyStay22Map();
      const iframe = document.createElement("iframe");
      iframe.src = url;
      iframe.loading = "lazy";
      iframe.title = `Accommodation map for ${city.name}`;
      iframe.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
      elements.stay22MapFrame.appendChild(iframe);
      elements.stay22MapPanel.hidden = false;
      trackStay22Action("map_open", { action: "map" });
      elements.stay22MapClose.focus();
    });

    elements.stay22MapClose.addEventListener("click", () => {
      destroyStay22Map();
      elements.stay22MapButton.focus();
    });

    elements.closeMapButtons.forEach((button) => {
      button.addEventListener("click", () => closeLayer(elements.mapModal));
    });

    elements.closeDrawerButtons.forEach((button) => {
      button.addEventListener("click", () => closeLayer(elements.drawer));
    });

    elements.closeTravelButtons.forEach((button) => {
      button.addEventListener("click", () => {
        destroyStay22Map();
        closeLayer(elements.travelDrawer);
        elements.travelButton?.setAttribute("aria-expanded", "false");
      });
    });

    elements.closeAboutButtons.forEach((button) => {
      button.addEventListener("click", () => closeLayer(elements.about));
    });

    // Rail de navegação
    elements.rail.addEventListener("click", (event) => {
      const dot = event.target.closest("[data-city]");
      if (dot) selectCity(Number(dot.dataset.city), { autoplayRadio: true });
    });

    // Busca
    elements.search.addEventListener("input", () => renderGrid(elements.search.value));

    // Navegação prev/next
    $("#previous-city").addEventListener("click", () => selectCity(state.cityIndex - 1, { autoplayRadio: true }));
    $("#next-city").addEventListener("click", () => selectCity(state.cityIndex + 1, { autoplayRadio: true }));

    // Navegação hint (botões ← →)
    $("#hint-prev").addEventListener("click", () => selectCity(state.cityIndex - 1, { autoplayRadio: true }));
    $("#hint-next").addEventListener("click", () => selectCity(state.cityIndex + 1, { autoplayRadio: true }));

    // Minimizar / Restaurar player
    elements.playerMinimize.addEventListener("click", () => togglePlayer(true));
    elements.playerRestore.addEventListener("click", () => togglePlayer(false));
    elements.radioExpand?.addEventListener("click", () => radioPanelController.toggle());
    elements.radioCollapse?.addEventListener("click", () => radioPanelController.setExpanded(false));
    elements.radioSummaryPrevious?.addEventListener("click", (event) => {
      event.stopPropagation();
      radioController.setRadio(state.radioIndex - 1, state.radioWantsPlay || state.radioPlaying);
    });
    elements.radioSummaryNext?.addEventListener("click", (event) => {
      event.stopPropagation();
      radioController.setRadio(state.radioIndex + 1, state.radioWantsPlay || state.radioPlaying);
    });
    elements.radioSummaryPlay?.addEventListener("click", (event) => {
      event.stopPropagation();
      radioController.toggle();
    });
    $("#radio-summary")?.addEventListener("click", (event) => {
      if (!event.target.closest("button")) radioPanelController.toggle();
    });

    // Controles de rádio
    elements.play.addEventListener("click", () => radioController.toggle());
    $("#radio-previous").addEventListener("click", () => radioController.setRadio(state.radioIndex - 1, true));
    $("#radio-next").addEventListener("click", () => radioController.setRadio(state.radioIndex + 1, true));
    document.addEventListener("pointerdown", () => radioController.resumeAfterUserGesture(), { passive: true });
    document.addEventListener("keydown", () => radioController.resumeAfterUserGesture(), { passive: true });

    // Modos de passeio
    elements.modeButtons.forEach((button) => {
      button.addEventListener("click", () => switchMode(button.dataset.mode));
    });

    // Volume (input hidden ainda funciona para acessibilidade)
    elements.volume.addEventListener("input", () => {
      const value = Number(elements.volume.value);
      elements.radio.volume = value / 100;
      elements.volumeKnob.style.transform = `rotate(${(value - 50) * CONFIG.VOLUME_ROTATION_FACTOR}deg)`;
      elements.volumeAccessible.value = value;
      savePreferences({ volume: value });
    });
    elements.volumeAccessible.addEventListener("input", () => {
      updateVolumeFromKnob(Number(elements.volumeAccessible.value));
    });

    // Som da rua
    elements.streetSound.addEventListener("click", () => {
      state.streetSoundOn = !state.streetSoundOn;
      state.videoUserGesture = true;
      elements.streetSound.classList.toggle("is-active", state.streetSoundOn);
      elements.streetSound.setAttribute("aria-pressed", String(state.streetSoundOn));
      videoCommand(state.streetSoundOn ? "unMute" : "mute");
      videoCommand("setVolume", [state.streetSoundOn ? CONFIG.STREET_SOUND_VOLUME : 0]);
      savePreferences({ streetSoundOn: state.streetSoundOn });
      showToast(state.streetSoundOn ? MESSAGES.streetSoundOn : MESSAGES.streetSoundOff);
    });

    // Velocidade
    elements.speedButtons.forEach((button) => {
      button.addEventListener("click", () => {
        state.currentSpeed = Number(button.dataset.speed);
        elements.speedButtons.forEach((item) => {
          item.classList.toggle("is-active", item === button);
        });
        videoCommand("setPlaybackRate", [state.currentSpeed]);
        savePreferences({ currentSpeed: state.currentSpeed });
        showToast(MESSAGES.rideSpeed(button.textContent));
      });
    });

    // Botão RDM - cidade aleatória
    elements.randomBtn.addEventListener("click", selectRandomCity);

    // Volume knob - controle por drag/scroll (com cleanup apropriado)
    setupVolumeKnobListeners();

    // Tela cheia
    $("#fullscreen-button").addEventListener("click", async () => {
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        } else {
          await document.exitFullscreen();
        }
      } catch (error) {
        console.warn("[YouCity] Fullscreen unavailable:", error.message);
        showToast(MESSAGES.fullscreenUnavailable);
      }
    });

    // Radio lifecycle listeners are owned by radioController.

    // =========================================================================
    // NOVAS FUNCIONALIDADES - Event Listeners
    // =========================================================================

    // Favoritos
    elements.favoriteBtn.addEventListener("click", () => toggleFavorite());

    // Favoritos no grid (delegação)
    elements.grid.addEventListener("click", (event) => {
      const favBtn = event.target.closest("[data-favorite]");
      if (favBtn) {
        event.stopPropagation();
        toggleFavorite(Number(favBtn.dataset.favorite));
        return;
      }
      const card = event.target.closest("[data-city]");
      if (!card) return;
      selectCity(Number(card.dataset.city), { autoplayRadio: true });
      closeLayer(elements.drawer);
    });

    // Filtros
    elements.filterButtons.forEach(btn => {
      btn.addEventListener("click", () => setFilter(btn.dataset.filter));
    });

    if (elements.filterContinent) {
      elements.filterContinent.addEventListener("change", (e) => setContinent(e.target.value));
    } else {
      console.warn("[YouCity] filter-continent element not found");
    }

    // Tema
    elements.themeBtn.addEventListener("click", cycleTheme);

    // Qualidade
    elements.qualityBtn.addEventListener("click", cycleQuality);

    // Compartilhar
    elements.shareBtn.addEventListener("click", shareCity);

    // Botões do leque de share
    elements.shareFanButtons.forEach(btn => {
      btn.addEventListener("click", () => shareToSocial(btn.dataset.share));
    });

    window.addEventListener("popstate", () => {
      const nextRoute = loadRouteFromURL();
      if (nextRoute.cityIndex === null) return;
      selectCity(nextRoute.cityIndex, {
        silent: true,
        mode: nextRoute.mode || undefined,
        videoIndex: nextRoute.videoIndex,
        replaceURL: true
      });
    });

    // Atalhos de teclado
    document.addEventListener("keydown", (event) => {
      // Ignora se estiver em input
      if (event.target.matches("input, textarea")) return;

      switch (event.key) {
        case "ArrowRight":
          selectCity(state.cityIndex + 1, { autoplayRadio: true });
          break;
        case "ArrowLeft":
          selectCity(state.cityIndex - 1, { autoplayRadio: true });
          break;
        case " ":
          event.preventDefault();
          radioController.toggle();
          break;
        case "Escape":
          closeLayer(elements.drawer);
          destroyStay22Map();
          closeLayer(elements.travelDrawer);
          closeLayer(elements.about);
          closeLayer(elements.mapModal);
          closeShareFan();
          closeMoreMenu();
          break;
        case "m":
        case "M":
          openLayer(elements.mapModal);
          initializeWorldMap();
          break;
        case "r":
        case "R":
          selectRandomCity();
          break;
        case "h":
        case "H":
          togglePlayer();
          break;
        case "f":
        case "F":
          toggleFavorite();
          break;
        case "t":
        case "T":
          cycleTheme();
          break;
      }
    });

    // Touch/Swipe gestures para mobile
    setupTouchGestures();
  }

  // -----------------------------------------------------------------------------
  // Touch Gestures para Mobile
  // -----------------------------------------------------------------------------

  /**
   * Configura gestos de toque para navegação mobile
   */
  function setupTouchGestures() {
    const touchState = {
      startX: 0,
      startY: 0,
      startTime: 0,
      isScrolling: null,
    };

    const SWIPE_THRESHOLD = 50; // pixels mínimos para considerar swipe
    const SWIPE_TIME_LIMIT = 300; // ms máximo para swipe
    const VELOCITY_THRESHOLD = 0.3; // pixels/ms

    // Área principal para swipe (exclui player e drawer)
    const swipeArea = elements.app;
    const mobileHint = document.querySelector(".hint-mobile");
    try {
      if (localStorage.getItem(CONFIG.storageKeys.swipeHintSeen) === "true") mobileHint?.classList.add("is-hidden");
    } catch (error) {
      console.warn("[YouCity] Failed to read swipe hint state:", error.message);
    }
    const hideSwipeHint = () => {
      mobileHint?.classList.add("is-hidden");
      try { localStorage.setItem(CONFIG.storageKeys.swipeHintSeen, "true"); } catch (error) {
        console.warn("[YouCity] Failed to save swipe hint state:", error.message);
      }
    };

    swipeArea.addEventListener("touchstart", (e) => {
      hideSwipeHint();
      // Ignora se tocar em controles interativos
      if (e.target.closest(".player-card, .drawer, .about-modal, .map-modal, button, input, a")) {
        return;
      }

      const touch = e.touches[0];
      touchState.startX = touch.clientX;
      touchState.startY = touch.clientY;
      touchState.startTime = Date.now();
      touchState.isScrolling = null;
    }, { passive: true });

    swipeArea.addEventListener("touchmove", (e) => {
      if (touchState.startX === 0) return;

      const touch = e.touches[0];
      const deltaX = touch.clientX - touchState.startX;
      const deltaY = touch.clientY - touchState.startY;

      // Determina se é scroll vertical ou swipe horizontal
      if (touchState.isScrolling === null) {
        touchState.isScrolling = Math.abs(deltaY) > Math.abs(deltaX);
      }
    }, { passive: true });

    swipeArea.addEventListener("touchend", (e) => {
      if (touchState.startX === 0 || touchState.isScrolling) {
        touchState.startX = 0;
        return;
      }

      // Ignora se tocar em controles interativos
      if (e.target.closest(".player-card, .drawer, .about-modal, button, input, a")) {
        touchState.startX = 0;
        return;
      }

      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchState.startX;
      const deltaTime = Date.now() - touchState.startTime;
      const velocity = Math.abs(deltaX) / deltaTime;

      // Verifica se é um swipe válido
      if (Math.abs(deltaX) >= SWIPE_THRESHOLD &&
          deltaTime <= SWIPE_TIME_LIMIT &&
          velocity >= VELOCITY_THRESHOLD) {

        // Swipe para esquerda = próxima cidade
        // Swipe para direita = cidade anterior
        if (deltaX < 0) {
          selectCity(state.cityIndex + 1, { autoplayRadio: true });
        } else {
          selectCity(state.cityIndex - 1, { autoplayRadio: true });
        }
        hideSwipeHint();
      }

      touchState.startX = 0;
      touchState.isScrolling = null;
    }, { passive: true });

    // Double tap para play/pause rádio
    let lastTap = 0;
    swipeArea.addEventListener("touchend", (e) => {
      // Ignora se tocar em controles
      if (e.target.closest(".player-card, .drawer, .about-modal, button, input, a")) {
        return;
      }

      const now = Date.now();
      const DOUBLE_TAP_DELAY = 300;

      if (now - lastTap < DOUBLE_TAP_DELAY) {
          radioController.toggle();
        lastTap = 0;
      } else {
        lastTap = now;
      }
    }, { passive: true });
  }

  // -----------------------------------------------------------------------------
  // Inicializa a aplicação
  // -----------------------------------------------------------------------------
  initApp();
}
