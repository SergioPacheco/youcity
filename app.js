// =============================================================================
// YouCity — app.js
// Immersive urban rides with local radio
// =============================================================================

/**
 * IIFE to encapsulate all code and avoid polluting the global namespace
 */
(function() {
  'use strict';

  // -----------------------------------------------------------------------------
  // Centralized configuration (avoids magic numbers and hardcoded strings)
  // -----------------------------------------------------------------------------
  const CONFIG = {
    VIDEO_READY_DELAY: 1500,
    YOUTUBE_API_TIMEOUT: 15_000,
    VIDEO_LOAD_TIMEOUT: 12_000,
    TOAST_DURATION: 2600,
    STREET_SOUND_VOLUME: 32,
    CLOCK_INTERVAL: 60_000,
    RADIO_RETRY_DELAY: 2000,
    RADIO_LOAD_TIMEOUT: 10_000,
    RADIO_MAX_RETRIES: 4,
    VIDEO_SWITCH_DEBOUNCE: 400,
    DEFAULT_VOLUME: 64,
    AUTOPLAY_INTERVAL: 180_000, // 3 minutes
    POMODORO_DURATION: 25 * 60, // 25 minutes in seconds
    POMODORO_BREAK: 5 * 60, // 5-minute break
    VOLUME_ROTATION_FACTOR: 2.4,
    VOLUME_DRAG_SENSITIVITY: 0.5,
    VOLUME_WHEEL_STEP: 5,
    storageKeys: {
      prefs: "volta-prefs",
      playerHidden: "volta-player-hidden",
      favorites: "volta-favorites",
      stats: "volta-stats",
      theme: "volta-theme",
      onboardingSeen: "youcity-onboarding-seen",
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
    },
  };

  // Centralized messages for future i18n
  const MESSAGES = {
    nowIn: (cityName) => `Now in ${cityName}`,
    autoplayOn: "Autoplay on — switching every 3 minutes",
    autoplayOff: "Autoplay off",
    pomodoroStart: "Pomodoro started — 25 minutes of focus",
    pomodoroPause: "Pomodoro paused",
    pomodoroBreakEnd: "☕ Break over! Time to focus.",
    pomodoroComplete: "🎉 Pomodoro complete! Take a 5-minute break.",
    streetSoundOn: "Street sound on",
    streetSoundOff: "Street sound off",
    noRadio: "This city has no radio station available yet.",
    radioRetry: "The radio did not respond. Trying the next station...",
    radioUnavailable: "No radio station is available right now. Try again later.",
    noVideo: "No video is available for this city.",
    videoFallback: "Video unavailable. Loading an alternative...",
    videoUnavailable: "Video unavailable. Try another city.",
    fullscreenUnavailable: "Fullscreen is not available in this browser.",
    pipUnavailable: "PiP is not available for embedded YouTube videos",
    pipError: "Error enabling Picture-in-Picture",
    pipOff: "Picture-in-Picture off",
    linkCopied: "Link copied to clipboard!",
    linkCopyFailed: "Could not copy the link",
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
    [CONFIG.modes.DRONE]: "Drone"
  };
  const MODE_ORDER = [CONFIG.modes.DRIVE, CONFIG.modes.BIKE, CONFIG.modes.WALK, CONFIG.modes.DRONE];

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
   * Normaliza string para busca (remove acentos, converte para minúsculas)
   * @param {string} value - String a normalizar
   * @returns {string} String normalizada
   */
  function normalizeSearch(value) {
    return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("en-US");
  }

  /**
   * Creates the stable URL segment used by prerendered city pages.
   */
  function citySlug(value) {
    return window.YouCityAffiliate?.slugify?.(value) || normalizeSearch(value)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  const BASE_PATH = String(window.YOUCITY_BASE_PATH || "").replace(/\/+$/, "");

  function sitePath(path) {
    return `${BASE_PATH}${path}`;
  }

  /**
   * Sanitiza entrada de URL para prevenir XSS
   * @param {string} value - Valor a sanitizar
   * @returns {string} Valor sanitizado
   */
  function sanitizeInput(value) {
    if (!value) return "";
    return value.replace(/[<>"'&]/g, "");
  }

  // -----------------------------------------------------------------------------
  // Persistência de preferências (localStorage) com tratamento de erro apropriado
  // -----------------------------------------------------------------------------
  
  /**
   * Carrega preferências do localStorage
   * @returns {Object} Objeto de preferências ou vazio se falhar
   */
  function loadPreferences() {
    try {
      return JSON.parse(localStorage.getItem(CONFIG.storageKeys.prefs)) || {};
    } catch (error) {
      console.warn("[YouCity] Failed to load preferences:", error.message);
      return {};
    }
  }

  /**
   * Salva preferências no localStorage
   * @param {Object} prefs - Preferências a salvar
   */
  function savePreferences(prefs) {
    try {
      const current = loadPreferences();
      localStorage.setItem(CONFIG.storageKeys.prefs, JSON.stringify({ ...current, ...prefs }));
    } catch (error) {
      console.warn("[YouCity] Failed to save preferences (private mode?):", error.message);
    }
  }

  // -----------------------------------------------------------------------------
  // City catalog processing
  // -----------------------------------------------------------------------------
  const cities = (window.YOUCITY_CATALOG || window.CITY_CATALOG || []).map((item) => {
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
  });

  // -----------------------------------------------------------------------------
  // DOM element selection (cached for performance)
  // -----------------------------------------------------------------------------
  const $ = (selector) => document.querySelector(selector);

  const elements = {
    app: $("#app"),
    videoShell: $("#city-video-shell"),
    videoContainer: $("#city-video-container"),
    videoGate: $("#video-gate"),
    videoGateMode: $("#video-gate-mode"),
    videoGateTitle: $("#video-gate-title"),
    videoGateMessage: $("#video-gate-message"),
    videoOptions: $("#video-options"),
    videoList: $("#video-list"),
    startVideo: $("#start-video"),
    videoLoading: $("#video-loading"),
    videoLoadingMessage: $("#video-loading-message"),
    poster: $("#poster"),
    sourceLink: $("#source-link"),
    radio: $("#radio-player"),
    cityName: $("#city-name"),
    cityRegion: $("#city-region"),
    cityNote: $("#city-note"),
    travelPlanner: $("#travel-planner"),
    travelPrimary: $("#travel-primary"),
    travelSecondary: $("#travel-secondary"),
    travelDisclosure: $("#travel-disclosure"),
    travelPlannerLocation: $("#travel-planner-location"),
    travelPreviewBadge: $("#travel-preview-badge"),
    stay22Tools: $("#stay22-tools"),
    stay22SearchForm: $("#stay22-search-form"),
    stay22Checkin: $("#stay22-checkin"),
    stay22Checkout: $("#stay22-checkout"),
    stay22Adults: $("#stay22-adults"),
    stay22Children: $("#stay22-children"),
    stay22SearchStatus: $("#stay22-search-status"),
    stay22SearchResult: $("#stay22-search-result"),
    stay22BrowseButton: $("#stay22-browse-button"),
    stay22RentalsButton: $("#stay22-rentals-button"),
    stay22MapButton: $("#stay22-map-button"),
    stay22MapPanel: $("#stay22-map-panel"),
    stay22MapClose: $("#stay22-map-close"),
    stay22MapFrame: $("#stay22-map-frame"),
    cityIndex: $("#city-index"),
    cityTotal: $("#city-total"),
    topLocation: $("#top-location"),
    topTime: $("#top-time"),
    stationName: $("#station-name"),
    lcdMeta: $("#lcd-meta"),
    equalizer: $("#equalizer"),
    stereoLed: $("#stereo-led"),
    rdsLed: $("#rds-led"),
    play: $("#play-button"),
    volume: $("#volume"),
    volumeKnob: $("#volume-knob"),
    rail: $("#rail-track"),
    drawer: $("#city-drawer"),
    grid: $("#city-grid"),
    search: $("#city-search"),
    resultCount: $("#result-count"),
    about: $("#about-modal"),
    travelDrawer: $("#travel-drawer"),
    travelButton: $("#travel-button"),
    travelButtonFull: $("#travel-button-full"),
    travelPrompts: $("#travel-prompts"),
    travelPromptsCity: $("#travel-prompts-city"),
    travelQuickActions: $("#travel-quick-actions"),
    travelPromptsClose: $("#travel-prompts-close"),
    mapModal: $("#map-modal"),
    mapContainer: $("#world-map"),
    mapResultCount: $("#map-result-count"),
    mapDirectory: $("#map-directory"),
    mapButton: $("#map-button"),
    streetSound: $("#street-sound"),
    randomBtn: $("#random-btn"),
    toast: $("#toast"),
    playerCard: document.querySelector(".player-card"),
    playerMinimize: $("#player-minimize"),
    playerRestore: $("#player-restore"),
    radioSummaryName: $("#radio-summary-name"),
    radioSummaryPlay: $("#radio-summary-play"),
    radioExpand: $("#radio-expand"),
    moreButton: $("#more-button"),
    moreMenu: $("#more-menu"),
    // Novas funcionalidades
    favoriteBtn: $("#favorite-btn"),
    infoTimezone: $("#info-timezone"),
    infoPopulation: $("#info-population"),
    filterContinent: $("#filter-continent"),
    statsModal: $("#stats-modal"),
    pipBtn: $("#pip-button"),
    shareBtn: $("#share-button"),
    statsBtn: $("#stats-button"),
    themeBtn: $("#theme-button"),
    autoplayBtn: $("#autoplay-btn"),
    pomodoroBtn: $("#pomodoro-btn"),
    pomodoroPanel: $("#pomodoro-panel"),
    pomodoroTime: $("#pomodoro-time"),
    autoplayPanel: $("#autoplay-panel"),
    autoplayTime: $("#autoplay-time"),
    qualityBtn: $("#quality-btn"),
    // Seletores cacheados para grupos de botões
    modeButtons: document.querySelectorAll("[data-mode]"),
    speedButtons: document.querySelectorAll("[data-speed]"),
    closeDrawerButtons: document.querySelectorAll("[data-close-drawer]"),
    closeTravelButtons: document.querySelectorAll("[data-close-travel]"),
    closeAboutButtons: document.querySelectorAll("[data-close-about]"),
    closeMapButtons: document.querySelectorAll("[data-close-map]"),
    closeStatsButtons: document.querySelectorAll("[data-close-stats]"),
    shareFanButtons: document.querySelectorAll(".share-fan-item"),
    filterButtons: document.querySelectorAll("[data-filter]"),
  };

  // -----------------------------------------------------------------------------
  // Estado da aplicação (encapsulado dentro do IIFE)
  // -----------------------------------------------------------------------------
  const state = {
    cityIndex: 0,
    radioIndex: 0,
    radioPlaying: false,
    radioWantsPlay: false,
    radioAutoplayPending: false,
    streetSoundOn: false,
    currentSpeed: 1,
    currentMode: CONFIG.modes.DRIVE,
    currentVideoIndex: 0,
    currentVideoId: null,
    videoRequestId: 0,
    videoChangeTimer: null,
    playbackSessionStarted: false,
    videoReadyTimer: null,
    videoStatusTimer: null,
    videoState: VIDEO_STATES.IDLE,
    toastTimer: null,
    radioRetryCount: 0,
    radioRetryTimer: null,
    radioLoadTimer: null,
    radioRequestId: 0,
    videoUserGesture: false,
    clockIntervalId: null,
    // Novas funcionalidades
    favorites: new Set(),
    visitedCities: new Set(),
    currentFilter: CONFIG.filters.ALL,
    currentContinent: "",
    autoplayOn: false,
    autoplayTimer: null,
    autoplayRemaining: CONFIG.AUTOPLAY_INTERVAL / 1000,
    pomodoroOn: false,
    pomodoroTimer: null,
    pomodoroRemaining: CONFIG.POMODORO_DURATION,
    pomodoroIsBreak: false,
    currentTheme: CONFIG.themes.DEFAULT,
    currentQuality: CONFIG.qualities.AUTO,
    sessionStartTime: Date.now(),
    totalTravelTime: 0,
    playerHidden: false,
    radioExpanded: false,
    videoRecoveryMode: false,
    mainCtaImpressionCity: "",
    // Volume knob drag state
    volumeKnob: {
      isDragging: false,
      startY: 0,
      startVolume: 0,
    },
  };

  let worldMap = null;
  let leafletAssetsPromise = null;

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
    return MODE_ORDER.filter((mode) => city?.videos?.[mode]?.length);
  }

  function firstAvailableMode(city, preferredMode = state.currentMode) {
    if (city?.videos?.[preferredMode]?.length) return preferredMode;
    return availableModes(city)[0] || CONFIG.modes.DRIVE;
  }

  /**
   * Retorna o vídeo atual para o modo selecionado
   * @param {Object} [city] - Cidade (padrão: cidade atual)
   * @returns {Object|undefined} Objeto do vídeo ou undefined
   */
  function currentRide(city = currentCity()) {
    const modeVideos = city.videos[state.currentMode];
    if (modeVideos?.length) return modeVideos[Math.min(state.currentVideoIndex, modeVideos.length - 1)] || modeVideos[0];
    const fallbackMode = firstAvailableMode(city);
    return city.videos[fallbackMode]?.[0];
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function buildYoutubeWatchUrl(ride) {
    const url = new URL(`https://www.youtube.com/watch?v=${encodeURIComponent(ride.id)}`);
    if (Number(ride.start) > 0) url.searchParams.set("t", `${Math.floor(Number(ride.start))}s`);
    return url.toString();
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

  const affiliate = window.YouCityAffiliate;
  const TRAVEL_CATEGORIES = affiliate?.getVerticals?.() || {};
  const PRIMARY_TRAVEL_CATEGORIES = ["hotels", "activities", "cars"]
    .filter((id) => TRAVEL_CATEGORIES[id]?.placement === "primary")
    .concat(Object.entries(TRAVEL_CATEGORIES)
      .filter(([id, info]) => info.placement === "primary" && !["activities", "hotels", "cars"].includes(id))
      .map(([id]) => id));
  const SECONDARY_TRAVEL_CATEGORIES = Object.entries(TRAVEL_CATEGORIES).filter(([, info]) => info.placement === "secondary").map(([id]) => id);
  const TRAVEL_ACTION_LABELS = {
    hotels: "Find a place to stay",
    "vacation-rentals": "Find vacation rentals",
    activities: "Things to do",
    cars: "Rent a car",
    flights: "Find flights"
  };
  const QUICK_TRAVEL_CATEGORIES = ["hotels", "activities", "cars", "flights"];
  const QUICK_TRAVEL_LABELS = {
    hotels: "Stay",
    activities: "Things to do",
    cars: "Cars",
    flights: "Flights"
  };

  function affiliateContext(city, vertical, placement) {
    return affiliate.createContext(city, vertical, { placement, mode: state.currentMode });
  }

  function resolveTravelOffers(city, placement = "travel_planner") {
    const offers = {};
    [...PRIMARY_TRAVEL_CATEGORIES, ...SECONDARY_TRAVEL_CATEGORIES].forEach((vertical) => {
      offers[vertical] = affiliate.getAffiliateOffers(affiliateContext(city, vertical, placement));
    });
    return offers;
  }

  function travelOfferMarkup(entry, city, options = {}) {
    if (!entry?.url) return "";
    const providerLabel = entry.name || entry.provider;
    const label = options.minimal
      ? TRAVEL_CATEGORIES[entry.vertical]?.label || "Open"
      : entry.label || TRAVEL_ACTION_LABELS[entry.vertical] || `Explore ${TRAVEL_CATEGORIES[entry.vertical]?.label?.toLowerCase() || "options"}`;
    const metadata = `data-affiliate-offer="true" data-travel-provider="${escapeHtml(entry.provider)}" data-travel-vertical="${escapeHtml(entry.vertical)}" data-travel-city="${escapeHtml(city.id)}" data-travel-city-name="${escapeHtml(city.name)}" data-travel-country="${escapeHtml(city.rawCountry || city.country)}" data-travel-country-code="${escapeHtml(city.countryCode || "")}" data-travel-placement="${escapeHtml(entry.placement || "travel_planner")}" data-travel-variant="${escapeHtml(entry.variant || "A")}" data-travel-provider-campaign="${escapeHtml(entry.tracking?.providerCampaign || "")}" data-travel-internal-campaign="${escapeHtml(entry.tracking?.internalCampaign || "")}"`;
    const compact = options.compact ? " is-compact" : "";
    return `<a class="travel-offer-action${compact}" href="${escapeHtml(entry.url)}" target="_blank" rel="sponsored noopener noreferrer" ${metadata}><span>${escapeHtml(label)}</span><small>${escapeHtml(providerLabel)}</small><b aria-hidden="true">↗</b></a>`;
  }

  function travelQuickActionMarkup(category, entry, city) {
    if (!entry?.url || !TRAVEL_CATEGORIES[category]) return "";
    const metadata = `data-affiliate-offer="true" data-travel-provider="${escapeHtml(entry.provider)}" data-travel-vertical="${escapeHtml(entry.vertical)}" data-travel-city="${escapeHtml(city.id)}" data-travel-city-name="${escapeHtml(city.name)}" data-travel-country="${escapeHtml(city.rawCountry || city.country)}" data-travel-country-code="${escapeHtml(city.countryCode || "")}" data-travel-placement="${escapeHtml(entry.placement || "quick_travel_bar")}" data-travel-variant="${escapeHtml(entry.variant || "A")}" data-travel-provider-campaign="${escapeHtml(entry.tracking?.providerCampaign || "")}" data-travel-internal-campaign="${escapeHtml(entry.tracking?.internalCampaign || "")}"`;
    return `<a class="travel-quick-action" href="${escapeHtml(entry.url)}" target="_blank" rel="sponsored noopener noreferrer" ${metadata}><span class="travel-quick-icon" aria-hidden="true">${TRAVEL_CATEGORIES[category].icon}</span><span>${escapeHtml(QUICK_TRAVEL_LABELS[category])}</span><b aria-hidden="true">↗</b></a>`;
  }

  function trackPlanningEvent(event, city, placement) {
    affiliate.track({
      event,
      provider: "planner",
      vertical: "trip_planning",
      city: city.name,
      country: city.country,
      countryCode: city.countryCode || "",
      placement,
      variant: "A"
    });
  }

  function updateMainTravelCta(city, hasOffers) {
    if (!elements.travelButton) return;
    elements.travelButton.hidden = !hasOffers;
    elements.travelButton.setAttribute("aria-label", `Plan a trip to ${city.name}`);
    elements.travelButton.title = `Plan a trip to ${city.name}`;
    elements.travelButton.dataset.travelProvider = "planner";
    elements.travelButton.dataset.travelVertical = "trip_planning";
    elements.travelButton.dataset.travelCity = city.id;
    elements.travelButton.dataset.travelCityName = city.name;
    elements.travelButton.dataset.travelCountry = city.country;
    elements.travelButton.dataset.travelCountryCode = city.countryCode || "";
    elements.travelButton.dataset.travelPlacement = "main_cta";
    if (elements.travelButtonFull) elements.travelButtonFull.textContent = `Plan a trip to ${city.name}`;
    if (hasOffers && state.mainCtaImpressionCity !== city.id) {
      state.mainCtaImpressionCity = city.id;
      trackPlanningEvent("affiliate_impression", city, "main_cta");
    }
  }

  function renderQuickTravelActions(city, placement = "quick_travel_bar") {
    const offers = resolveTravelOffers(city, placement);
    const actions = QUICK_TRAVEL_CATEGORIES.map((category) => {
      const entry = offers[category]?.[0];
      return travelQuickActionMarkup(category, entry, city);
    }).filter(Boolean).join("");
    return { offers, actions, hasOffers: Boolean(actions) };
  }

  function renderTravelPrompts(city) {
    const { actions, hasOffers } = renderQuickTravelActions(city);
    updateMainTravelCta(city, hasOffers);
    if (!elements.travelPrompts || !elements.travelQuickActions) return;
    elements.travelPrompts.hidden = !hasOffers;
    if (!hasOffers) {
      elements.travelQuickActions.replaceChildren();
      return;
    }
    elements.travelPromptsCity.textContent = city.name;
    elements.travelQuickActions.innerHTML = actions;
    affiliate.observeImpressions(elements.travelPrompts);
    if (!window.YOUCITY_DISCOVERCARS_LOCATIONS) ensureDiscoverCarsCatalog();
  }

  function travelCategoryMarkup(category, entries, city, options = {}) {
    const categoryInfo = TRAVEL_CATEGORIES[category];
    if (!categoryInfo || !entries.length) return "";
    const actions = entries.map((entry) => travelOfferMarkup(entry, city, options)).filter(Boolean).join("");
    if (!actions) return "";
    const extraClass = options.secondary ? " is-secondary" : "";
    return `<article class="travel-category${extraClass}" data-travel-category-card="${escapeHtml(category)}"><div class="travel-category-heading"><span class="travel-category-icon" aria-hidden="true">${categoryInfo.icon}</span><div><strong>${escapeHtml(categoryInfo.label)}</strong><small>${escapeHtml(categoryInfo.description)}</small></div></div><div class="travel-category-actions">${actions}</div></article>`;
  }

  function trackStay22Action(action, extra = {}) {
    const city = currentCity();
    affiliate.track({
      event: `affiliate_${action}`,
      provider: "stay22",
      vertical: "hotels",
      action,
      city: city.name,
      country: city.country,
      countryCode: city.countryCode || "",
      placement: "travel_planner",
      ...extra
    });
  }

  function destroyStay22Map() {
    if (elements.stay22MapFrame) elements.stay22MapFrame.replaceChildren();
    if (elements.stay22MapPanel) elements.stay22MapPanel.hidden = true;
  }

  function renderStay22Tools(city) {
    try {
      const stay22 = window.YouCityStay22;
      if (!elements.stay22Tools || !stay22) return;
      destroyStay22Map();
      const hotelsEnabled = stay22.isEnabled("hotels");
      elements.stay22Tools.hidden = !hotelsEnabled;
      if (!hotelsEnabled) return;

      const stayTitle = elements.stay22Tools.querySelector("#stay22-stay-title");
      const stayDescription = elements.stay22Tools.querySelector(".stay22-tools-heading small");
      if (stayTitle) stayTitle.textContent = `Stay in ${city.name}`;
      if (stayDescription) stayDescription.textContent = "Find places to stay";

      const searchEnabled = stay22.isEnabled("searchbar");
      const mapEnabled = stay22.isEnabled("map");
      const browseUrl = stay22.createRoamUrl(affiliateContext(city, "hotels", "travel_planner"));
      const rentalsUrl = stay22.createRoamUrl(affiliateContext(city, "vacation-rentals", "travel_planner"));
      elements.stay22BrowseButton.hidden = !browseUrl;
      if (browseUrl) {
        elements.stay22BrowseButton.href = browseUrl;
        elements.stay22BrowseButton.dataset.affiliateOffer = "true";
        elements.stay22BrowseButton.dataset.travelProvider = "stay22";
        elements.stay22BrowseButton.dataset.travelVertical = "hotels";
        elements.stay22BrowseButton.dataset.travelCityName = city.name;
        elements.stay22BrowseButton.dataset.travelCountry = city.country;
        elements.stay22BrowseButton.dataset.travelCountryCode = city.countryCode || "";
        elements.stay22BrowseButton.dataset.travelPlacement = "travel_planner";
        elements.stay22BrowseButton.dataset.travelProviderCampaign = new URL(browseUrl).searchParams.get("campaign") || "";
      } else {
        elements.stay22BrowseButton.removeAttribute("href");
      }
      elements.stay22RentalsButton.hidden = !rentalsUrl;
      if (rentalsUrl) {
        elements.stay22RentalsButton.href = rentalsUrl;
        elements.stay22RentalsButton.dataset.affiliateOffer = "true";
        elements.stay22RentalsButton.dataset.travelProvider = "stay22";
        elements.stay22RentalsButton.dataset.travelVertical = "vacation-rentals";
        elements.stay22RentalsButton.dataset.travelCityName = city.name;
        elements.stay22RentalsButton.dataset.travelCountry = city.country;
        elements.stay22RentalsButton.dataset.travelCountryCode = city.countryCode || "";
        elements.stay22RentalsButton.dataset.travelPlacement = "travel_planner";
        elements.stay22RentalsButton.dataset.travelProviderCampaign = new URL(rentalsUrl).searchParams.get("campaign") || "";
      } else {
        elements.stay22RentalsButton.removeAttribute("href");
      }
      elements.stay22SearchForm.hidden = !searchEnabled;
      elements.stay22MapButton.hidden = !mapEnabled;
      elements.stay22SearchStatus.textContent = "";
      elements.stay22SearchResult.hidden = true;
      elements.stay22SearchResult.removeAttribute("href");
      elements.stay22Checkin.min = stay22.today();
      elements.stay22Checkout.min = stay22.today();
      elements.stay22SearchForm.dataset.cityId = city.id;
    } catch (error) {
      destroyStay22Map();
      if (elements.stay22Tools) elements.stay22Tools.hidden = true;
      if (window.YOUCITY_AFFILIATE_CONFIG?.debug) console.warn("[YouCity Affiliate] Stay22 tools unavailable", error.message);
    }
  }

  function renderTravelPlanner(city) {
    if (!elements.travelPlanner || !elements.travelPrimary || !elements.travelSecondary) return;
    if (elements.travelPlannerLocation) elements.travelPlannerLocation.textContent = `${city.name} · ${city.country}`;
    const plannerTitle = document.querySelector("#travel-planner-title");
    if (plannerTitle) plannerTitle.textContent = `Plan your trip to ${city.name}`;
    const offers = resolveTravelOffers(city);
    const primary = PRIMARY_TRAVEL_CATEGORIES
      .map((category) => travelCategoryMarkup(category, offers[category], city)).filter(Boolean).join("");
    const secondary = SECONDARY_TRAVEL_CATEGORIES.map((category) => travelCategoryMarkup(category, offers[category], city, { secondary: true, compact: true })).filter(Boolean).join("");

    elements.travelPrimary.innerHTML = primary;
    elements.travelSecondary.innerHTML = secondary ? `<div class="travel-secondary-heading">More travel options</div>${secondary}` : "";
    elements.travelDisclosure.textContent = window.YOUCITY_AFFILIATE_CONFIG?.disclosure?.short || "Travel options may include affiliate links.";
    elements.travelPlanner.classList.toggle("is-demo", false);
    elements.travelPreviewBadge.hidden = true;
    renderStay22Tools(city);
    affiliate.observeImpressions(elements.travelPlanner);
  }

  let discoverCarsCatalogPromise = null;

  function ensureDiscoverCarsCatalog() {
    if (window.YOUCITY_DISCOVERCARS_LOCATIONS) return Promise.resolve(true);
    if (discoverCarsCatalogPromise) return discoverCarsCatalogPromise;

    discoverCarsCatalogPromise = new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = sitePath("/discovercars-locations.js");
      script.async = true;
      script.dataset.youcityDiscoverCars = "true";
      script.addEventListener("load", () => {
        renderTravelPlanner(currentCity());
        renderTravelPrompts(currentCity());
        resolve(true);
      }, { once: true });
      script.addEventListener("error", () => {
        discoverCarsCatalogPromise = null;
        resolve(false);
      }, { once: true });
      document.head.appendChild(script);
    });

    return discoverCarsCatalogPromise;
  }

  function trackTravelClick(target) {
    if (!target) return;
    affiliate.trackClick(target, { mode: state.currentMode });
  }

  function travelRecommendationMarkup(city) {
    const offers = resolveTravelOffers(city, "map_popup");
    const categories = [...PRIMARY_TRAVEL_CATEGORIES, ...SECONDARY_TRAVEL_CATEGORIES];
    const sections = categories.map((category) => {
      const entries = offers[category] || [];
      if (!entries.length) return "";
      return entries.map((entry) => travelOfferMarkup(entry, city, { minimal: true })).filter(Boolean).join("");
    }).join("");

    return sections ? `<div class="map-travel"><span>More for this city</span><div class="map-travel-actions">${sections}</div></div>` : "";
  }

  function mapPopup(city, index) {
    const modeSections = Object.entries(city.videos)
      .filter(([, videos]) => videos?.length)
      .map(([mode, videos]) => {
        const label = MODE_LABELS[mode] || mode;
        const buttons = videos.map((ride, videoIndex) => `
          <li>
            <button type="button" data-map-play data-city="${index}" data-mode="${escapeHtml(mode)}" data-video-index="${videoIndex}">▶ Play video ${videoIndex + 1}</button>
          </li>`).join("");
        return `
          <div class="map-video-group">
            <div class="map-video-heading">
              <strong>${escapeHtml(label)}</strong>
              <span>${videos.length} ${videos.length === 1 ? "video" : "videos"}</span>
            </div>
            <ul>${buttons}</ul>
          </div>`;
      }).join("");

    const travel = travelRecommendationMarkup(city);
    return `<div class="map-popup">
      <div class="map-popup-title"><strong>${escapeHtml(city.name)}</strong><span>${escapeHtml(city.country)}</span></div>
      <div class="map-popup-availability"><span>${availableModes(city).length ? "Available" : "No video yet"}</span></div>
      <div class="map-popup-videos">${modeSections || "<p>No videos available.</p>"}</div>
      ${travel ? `<details class="map-trip-plan"><summary>Plan this trip</summary>${travel.replace("<div class=\"map-travel\">", "<div class=\"map-travel map-travel-inside\">")}</details>` : ""}
    </div>`;
  }

  function loadLeafletAssets() {
    if (window.L) return Promise.resolve(window.L);
    if (leafletAssetsPromise) return leafletAssetsPromise;

    const config = window.YOUCITY_MAP_CONFIG || {};
    const cssUrl = config.leafletCssUrl || "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    const jsUrl = config.leafletJsUrl || "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

    leafletAssetsPromise = new Promise((resolve, reject) => {
      if (!document.querySelector("link[data-youcity-leaflet]") && cssUrl) {
        const stylesheet = document.createElement("link");
        stylesheet.rel = "stylesheet";
        stylesheet.href = cssUrl;
        stylesheet.dataset.youcityLeaflet = "true";
        document.head.appendChild(stylesheet);
      }

      const existingScript = document.querySelector("script[data-youcity-leaflet]");
      if (existingScript) {
        existingScript.addEventListener("load", () => resolve(window.L), { once: true });
        existingScript.addEventListener("error", () => reject(new Error("Leaflet failed to load")), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = jsUrl;
      script.async = true;
      script.crossOrigin = "anonymous";
      script.dataset.youcityLeaflet = "true";
      script.addEventListener("load", () => resolve(window.L), { once: true });
      script.addEventListener("error", () => reject(new Error("Leaflet failed to load")), { once: true });
      document.body.appendChild(script);
    });

    return leafletAssetsPromise;
  }

  function renderMapDirectory() {
    if (!elements.mapDirectory) return;
    elements.mapDirectory.innerHTML = cities.map((city, index) => {
      const modes = Object.entries(city.videos)
        .filter(([, videos]) => videos?.length)
        .map(([mode, videos]) => {
          const buttons = videos.map((ride, videoIndex) => `<button type="button" data-map-play data-city="${index}" data-mode="${escapeHtml(mode)}" data-video-index="${videoIndex}">${escapeHtml(MODE_LABELS[mode] || mode)} ${videoIndex + 1}</button>`).join("");
          return `<div class="map-directory-mode"><strong>${escapeHtml(MODE_LABELS[mode] || mode)}</strong><span>${buttons}</span></div>`;
        }).join("");
      return `<article class="map-directory-item"><h3><button type="button" data-map-city-select="${index}">${escapeHtml(city.name)}</button><span>${escapeHtml(city.country)}</span></h3>${modes}</article>`;
    }).join("");
  }

  async function initializeWorldMap() {
    if (!elements.mapContainer || worldMap) {
      worldMap?.invalidateSize();
      return;
    }

    elements.mapContainer.innerHTML = '<p class="map-unavailable map-loading">Loading world map…</p>';
    let L;
    try {
      L = await loadLeafletAssets();
    } catch (error) {
      console.warn("[YouCity] Map library unavailable:", error.message);
      elements.mapContainer.innerHTML = '<p class="map-unavailable">The map library could not be loaded. Check your connection and try again.</p>';
      return;
    }

    if (!L) {
      elements.mapContainer.innerHTML = '<p class="map-unavailable">The map library could not be loaded. Check your connection and try again.</p>';
      return;
    }

    worldMap = L.map(elements.mapContainer, { worldCopyJump: true, minZoom: 2, maxZoom: 12, zoomControl: true }).setView([20, 0], 2);
    const mapConfig = window.YOUCITY_MAP_CONFIG || {};
    L.tileLayer(mapConfig.tileUrl || "https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: mapConfig.attribution || "&copy; OpenStreetMap contributors",
      maxZoom: mapConfig.maxZoom || 19,
      tileSize: 256
    }).addTo(worldMap);

    const bounds = [];
    let mappedCities = 0;
    cities.forEach((city, index) => {
      const coordinates = city.coordinates || window.CITY_COORDINATES?.[city.rawName];
      if (!Array.isArray(coordinates)) return;
      mappedCities += 1;
      bounds.push(coordinates);
      L.circleMarker(coordinates, {
        radius: 6,
        color: "#d7ff43",
        weight: 2,
        fillColor: "#111411",
        fillOpacity: 0.95,
        bubblingMouseEvents: false
      }).bindPopup(mapPopup(city, index), { maxWidth: 280, minWidth: 220 }).addTo(worldMap);
    });

    if (elements.mapResultCount) elements.mapResultCount.textContent = `${mappedCities} cities · ${cities.length} destinations`;
    renderMapDirectory();
    affiliate.observeImpressions(elements.mapContainer);
    if (bounds.length) worldMap.fitBounds(bounds, { padding: [28, 28], maxZoom: 3 });
    setTimeout(() => worldMap?.invalidateSize(), 50);
  }

  function playMapRide(cityIndex, mode, videoIndex = 0) {
    const videos = cities[cityIndex]?.videos[mode];
    if (!Number.isInteger(cityIndex) || !videos?.length) return;
    const parsedVideoIndex = Number(videoIndex);
    const selectedVideoIndex = Number.isInteger(parsedVideoIndex)
      ? Math.max(0, Math.min(parsedVideoIndex, videos.length - 1))
      : 0;
    closeLayer(elements.mapModal);
    selectCity(cityIndex, { silent: true, mode, videoIndex: selectedVideoIndex });
  }

  // -----------------------------------------------------------------------------
  // Controle do player de vídeo (YouTube IFrame Player API)
  // -----------------------------------------------------------------------------
  
  function buildPlayerVars(ride) {
    return {
      autoplay: 1,
      // Start muted so browsers can honor autoplay. Street sound is restored
      // after the player reaches PLAYING or after an explicit user gesture.
      mute: 1,
      controls: 0,
      loop: 1,
      playlist: ride.id,
      modestbranding: 1,
      rel: 0,
      playsinline: 1,
      disablekb: 1,
      fs: 0,
      cc_load_policy: 0,
      iv_load_policy: 3,
      hl: "en-US",
      start: Number(ride.start) || 0,
      origin: window.location.origin
    };
  }

  const youtubePlayerManager = (() => {
    let player = null;
    let initialized = false;
    let playerReady = false;
    let currentVideoId = null;
    let apiPromise = null;
    let initPromise = null;
    let readyPromise = null;

    function loadApi() {
      if (window.YT?.Player) return Promise.resolve(window.YT);
      if (apiPromise) return apiPromise;

      apiPromise = new Promise((resolve, reject) => {
        let settled = false;
        let pollTimer = null;
        let timeoutTimer = null;

        const finish = (error) => {
          if (settled) return;
          settled = true;
          if (pollTimer) clearInterval(pollTimer);
          if (timeoutTimer) clearTimeout(timeoutTimer);
          if (error) reject(error);
          else resolve(window.YT);
        };

        const checkReady = () => {
          if (window.YT?.Player) finish();
        };

        const previousReadyHandler = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = (...args) => {
          try {
            previousReadyHandler?.(...args);
          } finally {
            checkReady();
          }
        };

        const script = [...document.scripts].find((candidate) =>
          candidate.src.includes("youtube.com/iframe_api")
        );
        if (!script) {
          const apiScript = document.createElement("script");
          apiScript.src = "https://www.youtube.com/iframe_api";
          apiScript.async = true;
          apiScript.onload = checkReady;
          apiScript.onerror = () => finish(new Error("YouTube IFrame Player API failed to load"));
          document.head.appendChild(apiScript);
        } else {
          checkReady();
        }

        pollTimer = setInterval(checkReady, 50);
        timeoutTimer = setTimeout(
          () => finish(new Error("YouTube IFrame Player API did not initialize")),
          CONFIG.YOUTUBE_API_TIMEOUT
        );
      }).catch((error) => {
        // A transient API failure must not poison every subsequent video load.
        apiPromise = null;
        throw error;
      });

      return apiPromise;
    }

    async function init(ride) {
      if (playerReady && player) return player;
      if (initPromise) return initPromise;

      initPromise = (async () => {
        const YTApi = await loadApi();
        if (playerReady && player) return player;

        let resolveReady;
        let rejectReady;
        const readyTimeout = setTimeout(() => {
          rejectReady(new Error("YouTube player did not become ready"));
        }, CONFIG.VIDEO_LOAD_TIMEOUT);
        readyPromise = new Promise((resolve, reject) => {
          resolveReady = resolve;
          rejectReady = reject;
        });
        playerReady = false;

        try {
          player = new YTApi.Player(elements.videoContainer, {
            host: "https://www.youtube-nocookie.com",
            videoId: ride.id,
            playerVars: buildPlayerVars(ride),
            events: {
              onReady: (event) => {
                clearTimeout(readyTimeout);
                initialized = true;
                playerReady = true;
                currentVideoId = ride.id;
                const readyPlayer = event.target || player;
                const iframe = readyPlayer.getIframe?.();
                if (iframe) {
                  iframe.classList.add("city-video");
                  iframe.title = "City ride";
                  iframe.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
                }
                handlePlayerReady();
                resolveReady(readyPlayer);
              },
              onStateChange: (event) => {
                if (event.data === window.YT?.PlayerState?.BUFFERING) setVideoState(VIDEO_STATES.LOADING);
                if (event.data === window.YT?.PlayerState?.PLAYING) markVideoReady();
              },
              onAutoplayBlocked: () => {
                // The player starts muted. This is only a fallback for browsers
                // that block even muted autoplay or a restored audible preference.
                videoCommand("mute");
                videoCommand("playVideo");
              },
              onError: (event) => {
                const error = new Error(`YouTube player error ${event.data}`);
                error.code = event.data;
                if (!playerReady) {
                  clearTimeout(readyTimeout);
                  rejectReady(error);
                  return;
                }
                handleVideoError(event.data);
              }
            }
          });
        } catch (error) {
          clearTimeout(readyTimeout);
          rejectReady(error);
        }

        try {
          await readyPromise;
          return player;
        } catch (error) {
          player?.destroy();
          player = null;
          initialized = false;
          playerReady = false;
          currentVideoId = null;
          throw error;
        } finally {
          clearTimeout(readyTimeout);
          readyPromise = null;
        }
      })();

      try {
        return await initPromise;
      } finally {
        initPromise = null;
      }
    }

    async function load(ride) {
      if (!ride) return;
      if (!playerReady || !player) {
        await init(ride);
      }
      if (!player) throw new Error("YouTube player is unavailable");
      if (currentVideoId === ride.id) {
        player.playVideo?.();
        return;
      }
      currentVideoId = ride.id;
      player.loadVideoById({
        videoId: ride.id,
        startSeconds: Number(ride.start) || 0
      });
      player.playVideo?.();
      if (state.currentQuality !== CONFIG.qualities.AUTO) {
        player.setPlaybackQuality?.(`hd${state.currentQuality}`);
      }
    }

    function command(method, args = []) {
      if (!player || typeof player[method] !== "function") return;
      player[method](...args);
    }

    function setPlaybackQuality(quality) {
      if (!player || typeof player.setPlaybackQuality !== "function") return;
      player.setPlaybackQuality(quality);
    }

    function getCurrentVideoId() {
      return currentVideoId;
    }

    function getPlayerState() {
      return player && typeof player.getPlayerState === "function"
        ? player.getPlayerState()
        : null;
    }

    function isInitialized() {
      return initialized && playerReady && Boolean(player);
    }

    function destroy() {
      player?.destroy();
      player = null;
      initialized = false;
      playerReady = false;
      currentVideoId = null;
      readyPromise = null;
    }

    return { init, load, command, setPlaybackQuality, getCurrentVideoId, getPlayerState, isInitialized, destroy };
  })();

  /**
   * Envia um comando para a única instância do player, quando disponível.
   * @param {string} method - Método da API do player
   * @param {Array} [args] - Argumentos
   */
  function videoCommand(method, args = []) {
    youtubePlayerManager.command(method, args);
  }

  function showVideoLoading(isLoading, message = "Loading video…") {
    clearTimeout(state.videoStatusTimer);
    elements.videoLoading.classList.toggle("is-visible", isLoading);
    elements.videoLoading.setAttribute("aria-hidden", String(!isLoading));
    if (isLoading) {
      if (elements.videoLoadingMessage) elements.videoLoadingMessage.textContent = message;
      state.videoStatusTimer = setTimeout(() => {
        if (elements.videoLoading.classList.contains("is-visible")) {
          if (elements.videoLoadingMessage) elements.videoLoadingMessage.textContent = "Still loading…";
        }
      }, 4500);
    }
  }

  function setVideoState(nextState, message = "") {
    state.videoState = nextState;
    elements.videoShell.dataset.videoState = nextState.toLowerCase();
    const loadingMessages = {
      [VIDEO_STATES.LOADING]: "Loading video…",
      [VIDEO_STATES.RETRYING]: "Trying another video…"
    };
    if (nextState === VIDEO_STATES.LOADING || nextState === VIDEO_STATES.RETRYING) {
      showVideoLoading(true, message || loadingMessages[nextState]);
    } else {
      showVideoLoading(false);
    }
    if (message && elements.videoGateMessage && nextState !== VIDEO_STATES.PLAYING) {
      elements.videoGateMessage.textContent = message;
    }
  }

  function markVideoReady() {
    clearTimeout(state.videoReadyTimer);
    elements.videoShell.classList.add("is-ready");
    setVideoState(VIDEO_STATES.PLAYING);
    videoCommand("setPlaybackRate", [state.currentSpeed]);
    if (state.streetSoundOn && state.videoUserGesture) {
      videoCommand("unMute");
      videoCommand("setVolume", [CONFIG.STREET_SOUND_VOLUME]);
    } else {
      videoCommand("mute");
      videoCommand("setVolume", [0]);
    }
  }

  function startPlayback(options = {}) {
    if (state.videoRecoveryMode) {
      state.videoRecoveryMode = false;
      const alternateMode = availableModes(currentCity()).find((mode) => mode !== state.currentMode);
      if (alternateMode) switchMode(alternateMode);
      else selectRandomCity();
      return;
    }
    if (!currentRide()) {
      selectRandomCity();
      return;
    }
    if (options.userGesture) state.videoUserGesture = true;
    if (options.userGesture) {
      try { localStorage.setItem(CONFIG.storageKeys.onboardingSeen, "true"); } catch (error) {
        console.warn("[YouCity] Failed to save onboarding state:", error.message);
      }
    }
    if (state.playbackSessionStarted) {
      videoCommand("playVideo");
      return;
    }
    state.playbackSessionStarted = true;
    elements.videoGate.classList.add("is-hidden");
    updateVideo(currentCity(), { immediate: true });
  }

  function handlePlayerReady() {
    videoCommand("setPlaybackRate", [state.currentSpeed]);
    videoCommand("mute");
    videoCommand("setVolume", [0]);
    videoCommand("playVideo");
    state.videoReadyTimer = setTimeout(() => {
      if (youtubePlayerManager.getPlayerState() === window.YT?.PlayerState?.PLAYING) {
        markVideoReady();
        return;
      }
      // Some browsers report the iframe ready before the media element has
      // started buffering. A second play command prevents the frozen-poster
      // state without masking a real player error.
      videoCommand("playVideo");
    }, CONFIG.VIDEO_READY_DELAY);
  }

  /**
   * Atualiza o vídeo da cidade
   * @param {Object} city - Objeto da cidade
   */
  function updateVideo(city, options = {}) {
    const ride = currentRide(city);
    renderVideoList(city);
    updateRideSourceLink(ride);
    if (!ride) {
      // Fallback: cidade sem vídeo disponível
      setVideoState(VIDEO_STATES.UNAVAILABLE, `No ${MODE_LABELS[state.currentMode] || state.currentMode} video is currently available. Try another mode.`);
      elements.videoShell.classList.remove("is-ready");
      elements.videoGate.classList.add("is-hidden");
      elements.poster.style.backgroundImage = "";
      elements.videoGateTitle.textContent = city.name;
      elements.videoGateMode.textContent = MODE_LABELS[state.currentMode] || state.currentMode;
      elements.videoGate.classList.remove("is-hidden");
      elements.startVideo.textContent = "Try another city";
      showToast(MESSAGES.noVideo);
      return;
    }

    // Poster com fallback de qualidade
    elements.poster.style.backgroundImage = `url("https://i.ytimg.com/vi/${ride.id}/maxresdefault.jpg"), url("https://i.ytimg.com/vi/${ride.id}/hqdefault.jpg")`;
    elements.videoGateTitle.textContent = city.name;
    elements.videoGateMode.textContent = MODE_LABELS[state.currentMode] || state.currentMode;
    elements.startVideo.textContent = "▶ Start";
    state.videoRecoveryMode = false;

    if (!state.playbackSessionStarted) {
      setVideoState(VIDEO_STATES.IDLE, "Choose a mode and press play.");
      clearTimeout(state.videoChangeTimer);
      state.videoRequestId++;
      elements.videoShell.classList.remove("is-ready");
      return;
    }

    const playerVideoId = youtubePlayerManager.getCurrentVideoId() || state.currentVideoId;
    if (playerVideoId === ride.id) return;

    clearTimeout(state.videoChangeTimer);
    clearTimeout(state.videoReadyTimer);
    state.videoRequestId++;
    const requestId = state.videoRequestId;
    state.currentVideoId = null;
    elements.videoShell.classList.remove("is-ready");
    setVideoState(options.loadingState || VIDEO_STATES.LOADING, options.loadingMessage || "Loading video…");

    const loadRide = async () => {
      if (requestId !== state.videoRequestId) return;
      try {
        await youtubePlayerManager.load(ride);
        if (requestId !== state.videoRequestId) return;
        state.currentVideoId = ride.id;
        state.videoReadyTimer = setTimeout(markVideoReady, CONFIG.VIDEO_READY_DELAY);
      } catch (error) {
        if (requestId !== state.videoRequestId) return;
        setVideoState(VIDEO_STATES.ERROR, "Unable to load this ride. Try another mode to continue.");
        elements.videoGate.classList.remove("is-hidden");
        state.videoRecoveryMode = true;
        elements.startVideo.textContent = "Try another mode";
        showToast(MESSAGES.videoUnavailable);
        console.warn("[YouCity] YouTube player unavailable:", error.message);
      }
    };

    if (options.immediate) loadRide();
    else {
      state.videoChangeTimer = setTimeout(() => {
        state.videoChangeTimer = null;
        loadRide();
      }, CONFIG.VIDEO_SWITCH_DEBOUNCE);
    }
  }

  function renderVideoList(city = currentCity()) {
    if (!elements.videoList || !elements.videoOptions) return;
    const availableRideModes = MODE_ORDER.filter((mode) => city?.videos?.[mode]?.length);
    const totalVideos = availableRideModes.reduce((total, mode) => total + city.videos[mode].length, 0);
    elements.videoOptions.hidden = totalVideos < 2;
    elements.videoList.innerHTML = availableRideModes.map((mode) => `
      <section class="video-list-group" aria-labelledby="video-list-${mode}">
        <strong id="video-list-${mode}">${escapeHtml(MODE_LABELS[mode] || mode)}</strong>
        ${city.videos[mode].map((video, index) => `
          <button type="button" class="video-list-item${mode === state.currentMode && index === state.currentVideoIndex ? " is-active" : ""}" data-video-mode="${escapeHtml(mode)}" data-video-index="${index}">
            <span aria-hidden="true">▶</span>
            <span>${escapeHtml(video.title || `${MODE_LABELS[mode]} ride ${index + 1}`)}</span>
          </button>`).join("")}
      </section>`).join("");
  }

  /**
   * Trata erros de vídeo indisponível
   */
  function handleVideoError() {
    const city = currentCity();
    const modeVideos = city.videos[state.currentMode];
    
    // Tenta próximo vídeo do mesmo modo
    if (modeVideos && modeVideos.length > 1) {
      state.currentVideoIndex = (state.currentVideoIndex + 1) % modeVideos.length;
      updateVideo(city, { loadingState: VIDEO_STATES.RETRYING, loadingMessage: "Trying another video…" });
      showToast(MESSAGES.videoFallback);
      return;
    }

    const fallbackMode = availableModes(city).find((mode) => mode !== state.currentMode);
    if (fallbackMode) {
      state.currentMode = fallbackMode;
      state.currentVideoIndex = 0;
      updateModeControls();
      updateVideo(city, { loadingState: VIDEO_STATES.RETRYING, loadingMessage: "Loading another video…" });
      showToast(MESSAGES.videoFallback);
      return;
    }

    setVideoState(VIDEO_STATES.UNAVAILABLE, "No playable video found. Choose another mode to continue.");
    state.videoRecoveryMode = true;
    elements.videoGate.classList.remove("is-hidden");
    elements.startVideo.textContent = "Try another mode";
    showToast(MESSAGES.videoUnavailable);
  }

  // -----------------------------------------------------------------------------
  // Relógio sincronizado com minuto cheio
  // -----------------------------------------------------------------------------
  
  /**
   * Atualiza o relógio com o horário local da cidade
   */
  function updateClock() {
    if (!elements.topTime) return;
    try {
      elements.topTime.textContent = new Intl.DateTimeFormat("en-US", {
        timeZone: currentCity().timeZone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      }).format(new Date());
    } catch (error) {
      console.warn("[YouCity] Failed to update clock:", error.message);
      elements.topTime.textContent = "--:--";
    }
  }

  /**
   * Agenda atualização do relógio sincronizada com o minuto cheio
   */
  function scheduleClockUpdate() {
    // Limpa intervalo anterior se existir
    if (state.clockIntervalId) clearInterval(state.clockIntervalId);
    
    // Atualiza imediatamente
    updateClock();
    
    // Calcula ms até o próximo minuto cheio
    const now = new Date();
    const msToNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
    
    // Agenda primeira atualização no minuto cheio, depois a cada 60s
    setTimeout(() => {
      updateClock();
      state.clockIntervalId = setInterval(updateClock, CONFIG.CLOCK_INTERVAL);
    }, msToNextMinute);
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

  // -----------------------------------------------------------------------------
  // Controle de rádio com auto-retry
  // -----------------------------------------------------------------------------
  
  /**
   * Configura uma estação de rádio
   * @param {number} [nextIndex=0] - Índice da estação
   * @param {boolean} [shouldPlay] - Se deve tocar automaticamente
   */
  function clearRadioRetryTimer() {
    if (state.radioRetryTimer) {
      clearTimeout(state.radioRetryTimer);
      state.radioRetryTimer = null;
    }
  }

  function clearRadioLoadTimer() {
    if (state.radioLoadTimer) {
      clearTimeout(state.radioLoadTimer);
      state.radioLoadTimer = null;
    }
  }

  /**
   * Schedules one retry for the current radio failure.
   */
  function scheduleRadioRetry() {
    if (!state.radioWantsPlay || state.radioRetryTimer) return;

    if (state.radioRetryCount >= CONFIG.RADIO_MAX_RETRIES) {
      state.radioWantsPlay = false;
      state.radioRetryCount = 0;
      setPlayingState(false);
      showToast(MESSAGES.radioUnavailable);
      return;
    }

    state.radioRetryCount++;
    showToast(MESSAGES.radioRetry);
    state.radioRetryTimer = setTimeout(() => {
      state.radioRetryTimer = null;
      if (state.radioWantsPlay) setRadio(state.radioIndex + 1, true, { preserveRetries: true });
    }, CONFIG.RADIO_RETRY_DELAY);
  }

  function handleRadioMediaError() {
    if (!state.radioWantsPlay) return;
    clearRadioLoadTimer();
    const mediaError = elements.radio.error;
    const errorCode = mediaError?.code ? ` (media error ${mediaError.code})` : "";
    console.warn(`[YouCity] Radio stream unavailable${errorCode}:`, elements.radio.src);
    setPlayingState(false);
    scheduleRadioRetry();
  }

  function setRadio(nextIndex = 0, shouldPlay = state.radioPlaying, options = {}) {
    const radios = currentCity().radios;

    clearRadioRetryTimer();
    clearRadioLoadTimer();
    elements.radio.pause();
    state.radioWantsPlay = shouldPlay;
    state.radioAutoplayPending = false;
    if (!options.preserveRetries) state.radioRetryCount = 0;
    const requestId = ++state.radioRequestId;
    
    if (!radios.length) {
      elements.radio.removeAttribute("src");
      elements.radio.load();
      elements.stationName.innerHTML = "NO SIGNAL<small> --</small>";
      if (elements.radioSummaryName) elements.radioSummaryName.textContent = "No local radio";
      elements.lcdMeta.textContent = "-- · NO SIGNAL";
      elements.play.disabled = true;
      elements.stereoLed.classList.remove("is-active");
      elements.rdsLed.classList.remove("is-active");
      setPlayingState(false);
      return;
    }
    
    elements.play.disabled = false;
    state.radioIndex = (nextIndex + radios.length) % radios.length;
    
    const station = radios[state.radioIndex];
    elements.stationName.innerHTML = `${station.name}<small> FM</small>`;
    if (elements.radioSummaryName) elements.radioSummaryName.textContent = station.name;
    elements.lcdMeta.textContent = `CH-${String(state.radioIndex + 1).padStart(2, "0")} · ${currentCity().name.toUpperCase().slice(0, 12)}`;
    elements.stereoLed.classList.add("is-active");
    elements.rdsLed.classList.toggle("is-active", station.name.length > 10);
    
    elements.radio.src = station.url;
    elements.radio.volume = Number(elements.volume.value) / 100;
    // Explicitly restart resource selection after changing a live stream URL.
    // This avoids play() racing the previous station on slower browsers.
    elements.radio.load();
    
    if (shouldPlay) {
      state.radioLoadTimer = setTimeout(() => {
        state.radioLoadTimer = null;
        if (
          requestId === state.radioRequestId
          && state.radioWantsPlay
          && !state.radioAutoplayPending
          && elements.radio.readyState < HTMLMediaElement.HAVE_METADATA
        ) {
          handleRadioMediaError();
        }
      }, CONFIG.RADIO_LOAD_TIMEOUT);
      playRadioWithRetry(requestId);
    } else {
      setPlayingState(false);
    }
  }

  /**
   * Tenta reproduzir rádio com retry automático
   */
  function playRadioWithRetry(requestId = state.radioRequestId) {
    if (requestId !== state.radioRequestId || !state.radioWantsPlay) return;

    const playPromise = elements.radio.play();
    if (!playPromise || typeof playPromise.then !== "function") {
      if (!elements.radio.paused) {
        clearRadioLoadTimer();
        setPlayingState(true);
      }
      return;
    }

    playPromise
      .then(() => {
        if (requestId !== state.radioRequestId) return;
        clearRadioLoadTimer();
        state.radioAutoplayPending = false;
        setPlayingState(true);
        state.radioRetryCount = 0;
      })
      .catch((error) => {
        if (requestId !== state.radioRequestId || !state.radioWantsPlay) return;

        // Browsers commonly block audible autoplay until the first user gesture.
        // Keep the selected station ready and resume it from that gesture instead
        // of treating the policy rejection as a broken stream.
        if (error.name === "NotAllowedError") {
          state.radioAutoplayPending = true;
          setPlayingState(false);
          return;
        }

        // A source change can abort the first play() call before metadata is
        // available. Retry the same station once before moving to the next.
        if (error.name === "AbortError" && elements.radio.readyState < HTMLMediaElement.HAVE_METADATA) {
          setTimeout(() => playRadioWithRetry(requestId), 250);
          return;
        }

        console.warn("[YouCity] Failed to play radio:", error.message);
        setPlayingState(false);
        scheduleRadioRetry();
      });
  }

  function resumeRadioAfterUserGesture() {
    if (!state.radioAutoplayPending || !state.radioWantsPlay) return;
    state.radioAutoplayPending = false;
    playRadioWithRetry();
  }

  /**
   * Atualiza estado visual do player de rádio
   * @param {boolean} playing - Se está tocando
   */
  function setPlayingState(playing) {
    state.radioPlaying = playing;
    const pauseText = elements.play.querySelector(".pause-text");
    const playText = elements.play.querySelector(".play-text");
    
    if (pauseText && playText) {
      pauseText.style.display = playing ? "inline" : "none";
      playText.style.display = playing ? "none" : "inline";
    }
    
    elements.play.setAttribute("aria-label", playing ? "Pause radio" : "Play radio");
    if (elements.radioSummaryPlay) {
      elements.radioSummaryPlay.textContent = playing ? "❚❚" : "▶";
      elements.radioSummaryPlay.setAttribute("aria-label", playing ? "Pause radio" : "Play radio");
    }
    elements.equalizer.classList.toggle("is-playing", playing);
  }

  /**
   * Alterna reprodução do rádio
   */
  function toggleRadio() {
    if (!currentCity().radios.length) {
      return showToast(MESSAGES.noRadio);
    }
    
    if (state.radioPlaying) {
      state.radioWantsPlay = false;
      state.radioAutoplayPending = false;
      clearRadioRetryTimer();
      clearRadioLoadTimer();
      state.radioRequestId++;
      elements.radio.pause();
      setPlayingState(false);
    } else {
      state.radioWantsPlay = true;
      state.radioAutoplayPending = false;
      playRadioWithRetry();
    }
  }

  function toggleRadioExpanded(expanded = !state.radioExpanded) {
    state.radioExpanded = expanded;
    elements.playerCard.classList.toggle("is-expanded", expanded);
    elements.radioExpand?.setAttribute("aria-expanded", String(expanded));
    elements.radioExpand?.setAttribute("aria-label", expanded ? "Collapse radio controls" : "Expand radio controls");
  }

  // -----------------------------------------------------------------------------
  // Minimizar / Restaurar Player
  // -----------------------------------------------------------------------------
  
  /**
   * Alterna visibilidade do player
   * @param {boolean} [hide] - Forçar estado
   */
  function togglePlayer(hide) {
    state.playerHidden = hide !== undefined ? hide : !state.playerHidden;
    
    elements.playerCard.classList.toggle("is-hidden", state.playerHidden);
    elements.playerRestore.classList.toggle("is-visible", state.playerHidden);
    
    // Salva preferência
    try {
      localStorage.setItem(CONFIG.storageKeys.playerHidden, state.playerHidden);
    } catch (error) {
      console.warn("[YouCity] Failed to save player state:", error.message);
    }
  }

  /**
   * Restaura estado do player do localStorage
   */
  function restorePlayerFromStorage() {
    try {
      const saved = localStorage.getItem(CONFIG.storageKeys.playerHidden);
      if (saved === "true") {
        togglePlayer(true);
      }
    } catch (error) {
      console.warn("[YouCity] Failed to restore player state:", error.message);
    }
  }

  // -----------------------------------------------------------------------------
  // Favoritos
  // -----------------------------------------------------------------------------
  
  /**
   * Carrega favoritos do localStorage
   * @returns {Set} Set de favoritos
   */
  function loadFavorites() {
    try {
      const saved = localStorage.getItem(CONFIG.storageKeys.favorites);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch (error) {
      console.warn("[YouCity] Failed to load favorites:", error.message);
      return new Set();
    }
  }

  /**
   * Salva favoritos no localStorage
   */
  function saveFavorites() {
    try {
      localStorage.setItem(CONFIG.storageKeys.favorites, JSON.stringify([...state.favorites]));
    } catch (error) {
      console.warn("[YouCity] Failed to save favorites:", error.message);
    }
  }

  /**
   * Alterna favorito de uma cidade
   * @param {number} [index] - Índice da cidade
   */
  function toggleFavorite(index = state.cityIndex) {
    const cityKey = cities[index].rawName;
    if (state.favorites.has(cityKey)) {
      state.favorites.delete(cityKey);
      showToast(MESSAGES.favoriteRemoved(cities[index].name));
    } else {
      state.favorites.add(cityKey);
      showToast(MESSAGES.favoriteAdded(cities[index].name));
    }
    saveFavorites();
    updateFavoriteButton();
    renderGrid();
    updateStats();
  }

  /**
   * Atualiza botão de favorito
   */
  function updateFavoriteButton() {
    const isFav = state.favorites.has(cities[state.cityIndex].rawName);
    elements.favoriteBtn.classList.toggle("is-active", isFav);
    elements.favoriteBtn.setAttribute("aria-label", isFav ? "Remove from favorites" : "Add to favorites");
  }

  /**
   * Verifica se cidade é favorita
   * @param {number} index - Índice da cidade
   * @returns {boolean}
   */
  function isFavorite(index) {
    return state.favorites.has(cities[index].rawName);
  }

  // -----------------------------------------------------------------------------
  // Estatísticas
  // -----------------------------------------------------------------------------
  
  /**
   * Carrega estatísticas do localStorage
   * @returns {Object} Objeto de estatísticas
   */
  function loadStats() {
    try {
      const saved = localStorage.getItem(CONFIG.storageKeys.stats);
      return saved ? JSON.parse(saved) : { visited: [], totalTime: 0, sessions: 0 };
    } catch (error) {
      console.warn("[YouCity] Failed to load statistics:", error.message);
      return { visited: [], totalTime: 0, sessions: 0 };
    }
  }

  /**
   * Salva estatísticas no localStorage
   */
  function saveStats() {
    try {
      const stats = loadStats();
      stats.visited = [...state.visitedCities];
      stats.totalTime = state.totalTravelTime + Math.floor((Date.now() - state.sessionStartTime) / 1000);
      localStorage.setItem(CONFIG.storageKeys.stats, JSON.stringify(stats));
    } catch (error) {
      console.warn("[YouCity] Failed to save statistics:", error.message);
    }
  }

  /**
   * Atualiza exibição de estatísticas
   */
  function updateStats() {
    const stats = loadStats();
    $("#stat-cities").textContent = state.visitedCities.size;
    $("#stat-favorites").textContent = state.favorites.size;
    const totalSeconds = stats.totalTime + Math.floor((Date.now() - state.sessionStartTime) / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    $("#stat-time").textContent = `${hours}h ${minutes}m`;
    $("#stat-sessions").textContent = stats.sessions;
  }

  /**
   * Registra visita a uma cidade
   * @param {number} index - Índice da cidade
   */
  function trackVisit(index) {
    state.visitedCities.add(cities[index].rawName || cities[index].id);
    saveStats();
  }

  /**
   * Incrementa contador de sessões
   */
  function incrementSession() {
    try {
      const stats = loadStats();
      stats.sessions = (stats.sessions || 0) + 1;
      localStorage.setItem(CONFIG.storageKeys.stats, JSON.stringify(stats));
    } catch (error) {
      console.warn("[YouCity] Failed to increment session count:", error.message);
    }
  }

  // -----------------------------------------------------------------------------
  // Filtros
  // -----------------------------------------------------------------------------
  
  /**
   * Define filtro ativo
   * @param {string} filter - Filtro a aplicar
   */
  function setFilter(filter) {
    state.currentFilter = filter;
    elements.filterButtons.forEach(btn => {
      btn.classList.toggle("is-active", btn.dataset.filter === filter);
    });
    renderGrid(elements.search.value);
  }

  /**
   * Define filtro de continente
   * @param {string} continent - Continente a filtrar
   */
  function setContinent(continent) {
    state.currentContinent = continent;
    renderGrid(elements.search.value);
  }

  // -----------------------------------------------------------------------------
  // Autoplay
  // -----------------------------------------------------------------------------
  
  /**
   * Alterna modo autoplay
   */
  function toggleAutoplay() {
    state.autoplayOn = !state.autoplayOn;
    elements.autoplayBtn.classList.toggle("is-active", state.autoplayOn);
    elements.autoplayBtn.setAttribute("aria-pressed", state.autoplayOn);
    elements.autoplayPanel.classList.toggle("is-visible", state.autoplayOn);
    
    if (state.autoplayOn) {
      state.autoplayRemaining = CONFIG.AUTOPLAY_INTERVAL / 1000;
      updateAutoplayDisplay();
      state.autoplayTimer = setInterval(() => {
        state.autoplayRemaining--;
        updateAutoplayDisplay();
        if (state.autoplayRemaining <= 0) {
          selectCity(state.cityIndex + 1);
          state.autoplayRemaining = CONFIG.AUTOPLAY_INTERVAL / 1000;
        }
      }, 1000);
      showToast(MESSAGES.autoplayOn);
    } else {
      clearInterval(state.autoplayTimer);
      state.autoplayTimer = null;
      showToast(MESSAGES.autoplayOff);
    }
  }

  /**
   * Atualiza display do autoplay
   */
  function updateAutoplayDisplay() {
    const min = Math.floor(state.autoplayRemaining / 60);
    const sec = state.autoplayRemaining % 60;
    elements.autoplayTime.textContent = `${min}:${String(sec).padStart(2, "0")}`;
  }

  // -----------------------------------------------------------------------------
  // Pomodoro
  // -----------------------------------------------------------------------------
  
  /**
   * Alterna modo pomodoro
   */
  function togglePomodoro() {
    state.pomodoroOn = !state.pomodoroOn;
    elements.pomodoroBtn.classList.toggle("is-active", state.pomodoroOn);
    elements.pomodoroBtn.setAttribute("aria-pressed", state.pomodoroOn);
    elements.pomodoroPanel.classList.toggle("is-visible", state.pomodoroOn);
    
    if (state.pomodoroOn) {
      state.pomodoroRemaining = CONFIG.POMODORO_DURATION;
      state.pomodoroIsBreak = false;
      updatePomodoroDisplay();
      state.pomodoroTimer = setInterval(() => {
        state.pomodoroRemaining--;
        updatePomodoroDisplay();
        if (state.pomodoroRemaining <= 0) {
          if (state.pomodoroIsBreak) {
            state.pomodoroRemaining = CONFIG.POMODORO_DURATION;
            state.pomodoroIsBreak = false;
            showToast(MESSAGES.pomodoroBreakEnd);
            document.querySelector(".pomodoro-label").textContent = "focus";
          } else {
            state.pomodoroRemaining = CONFIG.POMODORO_BREAK;
            state.pomodoroIsBreak = true;
            selectCity(state.cityIndex + 1);
            showToast(MESSAGES.pomodoroComplete);
            document.querySelector(".pomodoro-label").textContent = "break";
          }
        }
      }, 1000);
      showToast(MESSAGES.pomodoroStart);
    } else {
      clearInterval(state.pomodoroTimer);
      state.pomodoroTimer = null;
      showToast(MESSAGES.pomodoroPause);
    }
  }

  /**
   * Atualiza display do pomodoro
   */
  function updatePomodoroDisplay() {
    const min = Math.floor(state.pomodoroRemaining / 60);
    const sec = state.pomodoroRemaining % 60;
    elements.pomodoroTime.textContent = `${min}:${String(sec).padStart(2, "0")}`;
  }

  // -----------------------------------------------------------------------------
  // Temas
  // -----------------------------------------------------------------------------
  
  /**
   * Cicla entre temas visuais
   */
  function cycleTheme() {
    const themes = [CONFIG.themes.DEFAULT, CONFIG.themes.SEPIA, CONFIG.themes.CONTRAST];
    const currentIdx = themes.indexOf(state.currentTheme);
    state.currentTheme = themes[(currentIdx + 1) % themes.length];
    
    elements.app.classList.remove(CONFIG.themes.SEPIA, CONFIG.themes.CONTRAST);
    if (state.currentTheme) elements.app.classList.add(state.currentTheme);
    
    try {
      localStorage.setItem(CONFIG.storageKeys.theme, state.currentTheme);
    } catch (error) {
      console.warn("[YouCity] Failed to save theme:", error.message);
    }
    
    showToast(THEME_NAMES[state.currentTheme]);
  }

  /**
   * Carrega tema do localStorage
   */
  function loadTheme() {
    try {
      state.currentTheme = localStorage.getItem(CONFIG.storageKeys.theme) || CONFIG.themes.DEFAULT;
      if (state.currentTheme) elements.app.classList.add(state.currentTheme);
    } catch (error) {
      console.warn("[YouCity] Failed to load theme:", error.message);
    }
  }

  // -----------------------------------------------------------------------------
  // Qualidade de vídeo (CORRIGIDO: usava loadVideo inexistente)
  // -----------------------------------------------------------------------------
  
  /**
   * Cicla entre qualidades de vídeo
   */
  function cycleQuality() {
    const qualities = [CONFIG.qualities.AUTO, CONFIG.qualities.HD720, CONFIG.qualities.HD1080];
    const currentIdx = qualities.indexOf(state.currentQuality);
    state.currentQuality = qualities[(currentIdx + 1) % qualities.length];
    
    elements.qualityBtn.textContent = state.currentQuality === CONFIG.qualities.AUTO 
      ? "HD" 
      : state.currentQuality + "p";
    
    const quality = state.currentQuality === CONFIG.qualities.AUTO
      ? "default"
      : `hd${state.currentQuality}`;
    youtubePlayerManager.setPlaybackQuality(quality);
    
    const message = state.currentQuality === CONFIG.qualities.AUTO 
      ? MESSAGES.qualityAuto 
      : MESSAGES.qualitySet(state.currentQuality);
    showToast(message);
  }

  // -----------------------------------------------------------------------------
  // Picture-in-Picture
  // -----------------------------------------------------------------------------
  
  /**
   * Alterna Picture-in-Picture
   */
  async function togglePiP() {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        showToast(MESSAGES.pipOff);
      } else {
        // Cria um vídeo temporário para PiP (iframe não suporta diretamente)
        showToast(MESSAGES.pipUnavailable);
      }
    } catch (error) {
      console.warn("[YouCity] PiP error:", error.message);
      showToast(MESSAGES.pipError);
    }
  }

  // -----------------------------------------------------------------------------
  // Compartilhar
  // -----------------------------------------------------------------------------
  
  /**
   * Alterna visibilidade do menu leque de share
   */
  function toggleShareFan() {
    const fan = $("#share-fan");
    const btn = elements.shareBtn;
    const isOpen = fan.classList.toggle("is-open");
    btn.setAttribute("aria-expanded", isOpen);
    
    // Fecha ao clicar fora
    if (isOpen) {
      setTimeout(() => {
        document.addEventListener("click", closeShareFanOnClickOutside);
      }, 10);
    }
  }
  
  /**
   * Fecha o leque ao clicar fora
   */
  function closeShareFanOnClickOutside(e) {
    const fan = $("#share-fan");
    const wrapper = e.target.closest(".share-fan-wrapper");
    if (!wrapper && fan.classList.contains("is-open")) {
      fan.classList.remove("is-open");
      elements.shareBtn.setAttribute("aria-expanded", "false");
      document.removeEventListener("click", closeShareFanOnClickOutside);
    }
  }
  
  /**
   * Fecha o leque de share
   */
  function closeShareFan() {
    const fan = $("#share-fan");
    fan.classList.remove("is-open");
    elements.shareBtn.setAttribute("aria-expanded", "false");
    document.removeEventListener("click", closeShareFanOnClickOutside);
  }

  /**
   * Gera URL de compartilhamento
   * @returns {Object} Objeto com url e text
   */
  function getShareData() {
    const city = currentCity();
    const countryName = COUNTRY_INFO[city.country]?.[0] || city.country;
    const params = new URLSearchParams({ mode: state.currentMode });
    if (state.currentVideoIndex > 0) params.set("video", String(state.currentVideoIndex + 1));
    const url = `${window.location.origin}${sitePath(`/city/${citySlug(city.rawName || city.name)}?${params.toString()}`)}`;
    const text = `🌍 Exploring ${city.name} by ${MODE_LABELS[state.currentMode].toLowerCase()} on YouCity — an immersive urban ride with local radio`;
    const title = `YouCity — ${city.name}`;
    return { url, text, title };
  }

  /**
   * Compartilha em rede social específica
   * @param {string} platform - Plataforma de compartilhamento
   */
  async function shareToSocial(platform) {
    const { url, text, title } = getShareData();
    const encodedUrl = encodeURIComponent(url);
    const encodedText = encodeURIComponent(text);
    const encodedTitle = encodeURIComponent(title);
    
    const shareUrls = {
      whatsapp: `https://api.whatsapp.com/send?text=${encodedText}%20${encodedUrl}`,
      twitter: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}`,
      telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    };
    
    if (platform === "copy") {
      try {
        await navigator.clipboard.writeText(url);
        showToast(MESSAGES.linkCopied);
      } catch (error) {
        console.warn("[YouCity] Could not copy link:", error.message);
        showToast(MESSAGES.linkCopyFailed);
      }
      closeShareFan();
      return;
    }
    
    const shareUrl = shareUrls[platform];
    if (shareUrl) {
      window.open(shareUrl, "_blank", "width=600,height=400,menubar=no,toolbar=no");
      closeShareFan();
    }
  }

  /**
   * Compartilha cidade atual (fallback para Web Share API ou abre leque)
   */
  async function shareCity() {
    // Em mobile com Web Share API nativa, usa ela diretamente
    if (navigator.share && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      const { url, text, title } = getShareData();
      try {
        await navigator.share({ title, text, url });
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.warn("[YouCity] Could not share:", error.message);
        }
      }
    } else {
      // Em desktop, abre leque com opções de redes sociais
      toggleShareFan();
    }
  }

  /**
   * Reads the canonical city, mode and ride index from the current URL.
   */
  function loadRouteFromURL() {
    try {
      const params = new URLSearchParams(window.location.search);
      const pathWithoutBase = BASE_PATH && window.location.pathname.startsWith(BASE_PATH)
        ? window.location.pathname.slice(BASE_PATH.length) || "/"
        : window.location.pathname;
      const cityPath = pathWithoutBase.match(/^\/city\/([^/]+)(?:\.html)?\/?$/i)?.[1];
      const requestedCity = cityPath ? decodeURIComponent(cityPath) : sanitizeInput(params.get("city"));
      const requestedSlug = requestedCity ? citySlug(requestedCity) : "";
      const cityIndex = requestedSlug
        ? cities.findIndex((city) => citySlug(city.name) === requestedSlug || citySlug(city.rawName) === requestedSlug)
        : null;
      const mode = params.get("mode");
      const video = Number.parseInt(params.get("video"), 10);
      return {
        cityIndex: cityIndex === -1 ? null : cityIndex,
        mode: Object.values(CONFIG.modes).includes(mode) ? mode : null,
        videoIndex: Number.isInteger(video) && video > 0 ? video - 1 : 0,
        isDeepLink: Boolean(cityPath || params.get("city") || params.get("mode") || params.get("video"))
      };
    } catch (error) {
      console.warn("[YouCity] Could not parse route:", error.message);
      return { cityIndex: null, mode: null, videoIndex: 0, isDeepLink: false };
    }
  }

  function syncURL({ replace = false } = {}) {
    const city = currentCity();
    if (!city) return;
    const params = new URLSearchParams();
    const modeVideos = city.videos[state.currentMode] || [];
    if (modeVideos.length) params.set("mode", state.currentMode);
    if (modeVideos.length > 1 && state.currentVideoIndex > 0) params.set("video", String(state.currentVideoIndex + 1));
    const query = params.toString();
    const url = `${sitePath(`/city/${citySlug(city.rawName || city.name)}`)}${query ? `?${query}` : ""}`;
    const method = replace ? "replaceState" : "pushState";
    window.history[method]({ city: city.id, mode: state.currentMode, video: state.currentVideoIndex }, "", url);
  }

  /**
   * Carrega cidade da URL (com sanitização)
   * @returns {number|null} Índice da cidade ou null
   */
  function loadCityFromURL() {
    return loadRouteFromURL().cityIndex;
  }

  // -----------------------------------------------------------------------------
  // -----------------------------------------------------------------------------
  // Info da cidade
  // -----------------------------------------------------------------------------
  
  /**
   * Atualiza informações da cidade
   */
  function updateCityInfo() {
    const city = currentCity();
    const info = COUNTRY_INFO[city.country];
    
    // Hora local
    if (info && info[2]) {
      try {
        const time = new Date().toLocaleTimeString("en-US", {
          timeZone: info[2], 
          hour: "2-digit", 
          minute: "2-digit" 
        });
        elements.infoTimezone.querySelector("b").textContent = time;
      } catch (error) {
      console.warn("[YouCity] Could not format time:", error.message);
        elements.infoTimezone.querySelector("b").textContent = "--:--";
      }
    }
    
    // População (dados simulados baseados no tamanho da cidade)
    const populations = {
      "São Paulo": "12.3M", "Tokyo": "13.9M", "New York": "8.3M", "London": "8.9M",
      "Paris": "2.1M", "Berlin": "3.6M", "Sydney": "5.3M", "Mumbai": "12.4M",
      "Beijing": "21.5M", "Moscow": "11.9M", "Cairo": "9.5M", "Lagos": "14.3M",
    };
    const pop = populations[city.name] || populations[city.rawName] || `${Math.floor(Math.random() * 5 + 1)}.${Math.floor(Math.random() * 9)}M`;
    elements.infoPopulation.querySelector("b").textContent = pop;
  }

  // -----------------------------------------------------------------------------
  // Renderização de UI
  // -----------------------------------------------------------------------------
  
  /**
   * Renderiza trilho de navegação
   */
  function renderRail() {
    const indexes = [-3, -2, -1, 0, 1, 2, 3].map(
      (offset) => (state.cityIndex + offset + cities.length) % cities.length
    );
    
    elements.rail.innerHTML = indexes.map((index) => `
      <button class="rail-dot${index === state.cityIndex ? " is-active" : ""}" 
              type="button" 
              data-city="${index}" 
              aria-label="Go to ${cities[index].name}"></button>
    `).join("");
  }

  /**
   * Renderiza grid de cidades
   * @param {string} [filter=""] - Filtro de busca
   */
  function renderGrid(filter = "") {
    const normalized = normalizeSearch(filter.trim());
    let matches = cities
      .map((city, index) => ({ city, index }))
      .filter(({ city }) =>
        normalizeSearch(`${city.name} ${city.rawName} ${city.country} ${city.rawCountry} ${city.region}`).includes(normalized)
      );
    
    // Aplica filtros adicionais
    if (state.currentFilter === CONFIG.filters.FAVORITES) {
      matches = matches.filter(({ index }) => isFavorite(index));
    }
    if (state.currentContinent) {
      matches = matches.filter(({ city }) => city.region === state.currentContinent);
    }
    
    elements.resultCount.textContent = `${matches.length} ${matches.length === 1 ? "destination" : "destinations"}`;
    
    if (!matches.length) {
      elements.grid.innerHTML = `<p class="empty-state">No cities found.</p>`;
      return;
    }
    
    const renderCards = (entries) => entries.map(({ city, index }) => {
      const thumbnailRide = MODE_ORDER
        .map((mode) => city.videos[mode]?.[0])
        .find(Boolean);
      const thumbnail = thumbnailRide?.id;
      const modes = Object.entries(city.videos)
        .filter(([, videos]) => videos.length)
        .map(([mode]) => MODE_LABELS[mode])
        .join(" · ");
      const isFav = isFavorite(index);
      
      return `
        <div class="city-card${index === state.cityIndex ? " is-current" : ""}" 
             role="button" 
             tabindex="0"
             data-city="${index}">
          ${thumbnail ? `<img src="https://i.ytimg.com/vi/${thumbnail}/hqdefault.jpg" alt="" loading="lazy" />` : '<span class="city-card-placeholder" aria-hidden="true"></span>'}
          <span class="card-favorite${isFav ? " is-active" : ""}" role="button" tabindex="0" data-favorite="${index}" aria-label="${isFav ? "Remove from favorites" : "Add to favorites"}">
            <svg viewBox="0 0 24 24"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>
          </span>
          <span class="city-card-copy">
            <span><strong>${city.name}</strong><span>${city.country} · ${modes}</span></span>
            <i>↗</i>
          </span>
        </div>`;
    }).join("");

    const shouldGroup = !normalized && state.currentFilter === CONFIG.filters.ALL && !state.currentContinent;
    if (!shouldGroup) {
      elements.grid.innerHTML = renderCards(matches);
      return;
    }

    const featured = matches.filter(({ index }) => index === state.cityIndex || isFavorite(index)).slice(0, 4);
    const recent = matches.filter(({ city }) => state.visitedCities.has(city.rawName)).slice(0, 4);
    const used = new Set([...featured, ...recent].map(({ index }) => index));
    const all = matches.filter(({ index }) => !used.has(index));
    const section = (label, entries) => entries.length
      ? `<section class="city-grid-section"><h3>${label}</h3><div class="city-grid-section-list">${renderCards(entries)}</div></section>`
      : "";
    const alphaGroups = new Map();
    all.forEach((entry) => {
      const letter = normalizeSearch(entry.city.name).charAt(0).toUpperCase() || "#";
      if (!alphaGroups.has(letter)) alphaGroups.set(letter, []);
      alphaGroups.get(letter).push(entry);
    });
    const allCities = all.length
      ? `<section class="city-grid-section"><h3>All cities</h3>${[...alphaGroups.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([letter, entries]) => `<div class="city-alpha-group"><h4>${letter}</h4><div class="city-grid-section-list">${renderCards(entries)}</div></div>`)
        .join("")}</section>`
      : "";
    elements.grid.innerHTML = `${section("Featured", featured)}${section("Recent", recent)}${allCities}`;
  }

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
    state.cityIndex = (nextIndex + cities.length) % cities.length;
    state.radioIndex = 0;
    
    const city = currentCity();
    // Cada cidade pode ter apenas alguns modos; preserve o atual quando
    // possível e selecione o primeiro modo realmente disponível caso contrário.
    state.currentMode = firstAvailableMode(city, options.mode || state.currentMode);
    state.currentVideoIndex = Number.isInteger(options.videoIndex) ? Math.max(0, options.videoIndex) : 0;
    if (!city.videos[state.currentMode]?.[state.currentVideoIndex]) state.currentVideoIndex = 0;
    
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
    setRadio(0, state.radioPlaying || state.radioWantsPlay || options.autoplayRadio);
    renderRail();
    renderGrid(elements.search.value);
    
    // Novas funcionalidades
    updateFavoriteButton();
    updateCityInfo();
    renderTravelPlanner(city);
    renderTravelPrompts(city);
    trackVisit(state.cityIndex);
    syncURL({ replace: options.replaceURL || false });
    
    // Salva preferência
    savePreferences({ cityIndex: state.cityIndex, currentMode: state.currentMode });
    
    if (!options.silent) {
      showToast(MESSAGES.nowIn(city.name));
    }
  }

  /**
   * Seleciona cidade aleatória
   */
  function selectRandomCity() {
    const randomIndex = Math.floor(Math.random() * cities.length);
    selectCity(randomIndex);
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

  // -----------------------------------------------------------------------------
  // Modais e Drawer (com focus trap)
  // -----------------------------------------------------------------------------
  
  /**
   * Retorna elementos focáveis dentro de um container
   * @param {HTMLElement} container - Container
   * @returns {NodeList} Elementos focáveis
   */
  function getFocusableElements(container) {
    return container.querySelectorAll(
      'button:not([disabled]), [href], summary, input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
  }

  /**
   * Implementa trap de foco para acessibilidade
   * @param {KeyboardEvent} event - Evento de teclado
   * @param {HTMLElement} container - Container
   */
  function trapFocus(event, container) {
    const focusable = getFocusableElements(container);
    if (!focusable.length) return;
    
    const firstFocusable = focusable[0];
    const lastFocusable = focusable[focusable.length - 1];
    
    if (event.shiftKey && document.activeElement === firstFocusable) {
      event.preventDefault();
      lastFocusable.focus();
    } else if (!event.shiftKey && document.activeElement === lastFocusable) {
      event.preventDefault();
      firstFocusable.focus();
    }
  }

  let previouslyFocusedElement = null;

  /**
   * Abre camada modal/drawer
   * @param {HTMLElement} layer - Elemento da camada
   */
  function openLayer(layer) {
    const layers = [elements.drawer, elements.travelDrawer, elements.about, elements.mapModal, elements.statsModal]
      .filter(Boolean);
    const activeElement = document.activeElement;
    const activeInsideAnotherLayer = layers.some((other) => other !== layer && other.contains(activeElement));
    layers.forEach((other) => {
      if (other === layer || !other.classList.contains("is-open")) return;
      other.classList.remove("is-open");
      other.setAttribute("aria-hidden", "true");
      if (other === elements.travelDrawer) elements.travelButton?.setAttribute("aria-expanded", "false");
      if (other._focusTrapHandler) {
        other.removeEventListener("keydown", other._focusTrapHandler);
        delete other._focusTrapHandler;
      }
    });
    previouslyFocusedElement = activeInsideAnotherLayer ? null : activeElement;
    if (activeInsideAnotherLayer) activeElement.blur();
    layer.classList.add("is-open");
    layer.setAttribute("aria-hidden", "false");
    
    // Foca no primeiro elemento focável
    const panel = layer.querySelector(".drawer-panel, .about-card, .map-card");
    if (panel) {
      const focusable = getFocusableElements(panel);
      if (focusable.length) {
        setTimeout(() => focusable[0].focus(), 100);
      }
    }
    
    // Adiciona trap de foco
    layer._focusTrapHandler = (e) => {
      if (e.key === "Tab") {
        trapFocus(e, panel || layer);
      }
    };
    layer.addEventListener("keydown", layer._focusTrapHandler);
  }

  /**
   * Fecha camada modal/drawer
   * @param {HTMLElement} layer - Elemento da camada
   */
  function closeLayer(layer) {
    layer.classList.remove("is-open");
    layer.setAttribute("aria-hidden", "true");
    if (layer === elements.travelDrawer) elements.travelButton?.setAttribute("aria-expanded", "false");
    
    // Remove trap de foco
    if (layer._focusTrapHandler) {
      layer.removeEventListener("keydown", layer._focusTrapHandler);
      delete layer._focusTrapHandler;
    }
    
    // Restaura foco anterior
    if (previouslyFocusedElement) {
      previouslyFocusedElement.focus();
      previouslyFocusedElement = null;
    }
  }

  function closeMoreMenu() {
    elements.moreMenu?.classList.remove("is-open");
    elements.moreButton?.setAttribute("aria-expanded", "false");
  }

  function runOverflowAction(action) {
    closeMoreMenu();
    const actions = {
      share: shareCity,
      map: () => { openLayer(elements.mapModal); initializeWorldMap(); },
      theme: cycleTheme,
      fullscreen: () => $("#fullscreen-button").click(),
      about: () => openLayer(elements.about),
      stats: () => { updateStats(); openLayer(elements.statsModal); },
      random: selectRandomCity
    };
    actions[action]?.();
  }

  // -----------------------------------------------------------------------------
  // Toast (notificações)
  // -----------------------------------------------------------------------------
  
  /**
   * Exibe notificação toast
   * @param {string} message - Mensagem a exibir
   */
  function showToast(message) {
    clearTimeout(state.toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.add("is-visible");
    state.toastTimer = setTimeout(() => {
      elements.toast.classList.remove("is-visible");
    }, CONFIG.TOAST_DURATION);
  }

  // -----------------------------------------------------------------------------
  // Volume Knob (CORRIGIDO: listeners com cleanup apropriado)
  // -----------------------------------------------------------------------------
  
  /**
   * Atualiza volume a partir do knob
   * @param {number} newVolume - Novo volume (0-100)
   */
  function updateVolumeFromKnob(newVolume) {
    const vol = Math.max(0, Math.min(100, newVolume));
    elements.volume.value = vol;
    elements.radio.volume = vol / 100;
    elements.volumeKnob.setAttribute("aria-valuenow", vol);
    elements.volumeKnob.style.transform = `rotate(${(vol - 50) * CONFIG.VOLUME_ROTATION_FACTOR}deg)`;
    savePreferences({ volume: vol });
  }

  /**
   * Handler para movimento do mouse durante drag do knob
   * @param {MouseEvent} e - Evento
   */
  function handleKnobMouseMove(e) {
    if (!state.volumeKnob.isDragging) return;
    const delta = (state.volumeKnob.startY - e.clientY) * CONFIG.VOLUME_DRAG_SENSITIVITY;
    updateVolumeFromKnob(state.volumeKnob.startVolume + delta);
  }

  /**
   * Handler para soltar o mouse após drag do knob
   */
  function handleKnobMouseUp() {
    if (!state.volumeKnob.isDragging) return;
    state.volumeKnob.isDragging = false;
    // CORREÇÃO: Remove listeners quando não mais necessários
    document.removeEventListener("mousemove", handleKnobMouseMove);
    document.removeEventListener("mouseup", handleKnobMouseUp);
  }

  /**
   * Configura event listeners do volume knob
   */
  function setupVolumeKnobListeners() {
    elements.volumeKnob.addEventListener("mousedown", (e) => {
      state.volumeKnob.isDragging = true;
      state.volumeKnob.startY = e.clientY;
      state.volumeKnob.startVolume = Number(elements.volume.value);
      e.preventDefault();
      
      // CORREÇÃO: Adiciona listeners apenas durante o drag
      document.addEventListener("mousemove", handleKnobMouseMove);
      document.addEventListener("mouseup", handleKnobMouseUp);
    });

    elements.volumeKnob.addEventListener("wheel", (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -CONFIG.VOLUME_WHEEL_STEP : CONFIG.VOLUME_WHEEL_STEP;
      updateVolumeFromKnob(Number(elements.volume.value) + delta);
    });

    // Inicializa rotação do knob
    const initialVolume = Number(elements.volume.value);
    elements.volumeKnob.style.transform = `rotate(${(initialVolume - 50) * CONFIG.VOLUME_ROTATION_FACTOR}deg)`;
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
    
    // Carrega preferências salvas
    const prefs = loadPreferences();
    
    // Carrega dados das novas funcionalidades
    state.favorites = loadFavorites();
    const stats = loadStats();
    state.visitedCities = new Set(stats.visited || []);
    state.totalTravelTime = stats.totalTime || 0;
    incrementSession();
    loadTheme();
    
    // Restaura estado
    if (prefs.volume !== undefined) {
      elements.volume.value = prefs.volume;
      elements.volumeKnob.style.transform = `rotate(${(prefs.volume - 50) * CONFIG.VOLUME_ROTATION_FACTOR}deg)`;
      elements.volumeKnob.setAttribute("aria-valuenow", prefs.volume);
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

    let onboardingSeen = false;
    try { onboardingSeen = localStorage.getItem(CONFIG.storageKeys.onboardingSeen) === "true"; } catch (error) {
      console.warn("[YouCity] Failed to read onboarding state:", error.message);
    }
    // Deep links prepare the selected ride but never autoplay it.
    if (onboardingSeen && !route.isDeepLink) startPlayback();
    else elements.videoGate.classList.remove("is-hidden");
    
    // Preview mode para QA
    const previewMode = new URLSearchParams(window.location.search).get("preview");
    if (previewMode === "drawer") openLayer(elements.drawer);
    if (previewMode === "travel") {
      openLayer(elements.travelDrawer);
      ensureDiscoverCarsCatalog();
    }
    
    // Salva estatísticas ao fechar a página
    window.addEventListener("beforeunload", saveStats);
    
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

    elements.travelButton.addEventListener("click", () => {
      trackTravelClick(elements.travelButton);
      openLayer(elements.travelDrawer);
      elements.travelButton.setAttribute("aria-expanded", "true");
      ensureDiscoverCarsCatalog();
    });

    elements.travelPrompts?.addEventListener("click", (event) => {
      const offer = event.target.closest("[data-travel-provider]");
      if (offer) trackTravelClick(offer);
    });

    elements.travelPromptsClose?.addEventListener("click", () => {
      elements.travelPrompts.hidden = true;
    });

    elements.mapButton.addEventListener("click", () => {
      openLayer(elements.mapModal);
      initializeWorldMap();
    });

    elements.travelPlanner.addEventListener("click", (event) => {
      const offer = event.target.closest("[data-travel-provider]");
      if (!offer) return;
      trackTravelClick(offer);
    });

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
      }, { placement: "travel_planner" });
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
      elements.stay22SearchResult.dataset.travelPlacement = "travel_planner";
      elements.stay22SearchResult.dataset.travelProviderCampaign = new URL(url).searchParams.get("campaign") || "";
      elements.stay22SearchStatus.textContent = "Opening stay search…";
      trackStay22Action("search_submit", {
        checkinProvided: Boolean(checkin),
        checkoutProvided: Boolean(checkout),
        adultsProvided: elements.stay22Adults.value !== "",
        childrenProvided: elements.stay22Children.value !== ""
      });
      trackTravelClick(elements.stay22SearchResult);
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
      const url = window.YouCityStay22?.createMapUrl(city, { placement: "map" });
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

    elements.mapContainer.addEventListener("click", (event) => {
      const playButton = event.target.closest("[data-map-play]");
      const offer = event.target.closest("[data-travel-provider]");
      if (offer) {
        trackTravelClick(offer);
        return;
      }
      if (!playButton) return;

      event.preventDefault();
      playMapRide(Number(playButton.dataset.city), playButton.dataset.mode, playButton.dataset.videoIndex);
    });

    elements.mapDirectory.addEventListener("click", (event) => {
      const playButton = event.target.closest("[data-map-play]");
      if (playButton) {
        event.preventDefault();
        playMapRide(Number(playButton.dataset.city), playButton.dataset.mode, playButton.dataset.videoIndex);
        return;
      }

      const cityButton = event.target.closest("[data-map-city-select]");
      if (cityButton) {
        closeLayer(elements.mapModal);
        selectCity(Number(cityButton.dataset.mapCitySelect), { silent: true });
      }
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
      if (dot) selectCity(Number(dot.dataset.city));
    });
    
    // Busca
    elements.search.addEventListener("input", () => renderGrid(elements.search.value));
    
    // Navegação prev/next
    $("#previous-city").addEventListener("click", () => selectCity(state.cityIndex - 1));
    $("#next-city").addEventListener("click", () => selectCity(state.cityIndex + 1));
    
    // Navegação hint (botões ← →)
    $("#hint-prev").addEventListener("click", () => selectCity(state.cityIndex - 1));
    $("#hint-next").addEventListener("click", () => selectCity(state.cityIndex + 1));
    
    // Minimizar / Restaurar player
    elements.playerMinimize.addEventListener("click", () => togglePlayer(true));
    elements.playerRestore.addEventListener("click", () => togglePlayer(false));
    elements.radioExpand?.addEventListener("click", () => toggleRadioExpanded());
    elements.radioSummaryPlay?.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleRadio();
    });
    $("#radio-summary")?.addEventListener("click", (event) => {
      if (!event.target.closest("button")) toggleRadioExpanded();
    });
    
    // Controles de rádio
    elements.play.addEventListener("click", toggleRadio);
    $("#radio-previous").addEventListener("click", () => setRadio(state.radioIndex - 1, true));
    $("#radio-next").addEventListener("click", () => setRadio(state.radioIndex + 1, true));
    document.addEventListener("pointerdown", resumeRadioAfterUserGesture, { passive: true });
    document.addEventListener("keydown", resumeRadioAfterUserGesture, { passive: true });
    
    // Modos de passeio
    elements.modeButtons.forEach((button) => {
      button.addEventListener("click", () => switchMode(button.dataset.mode));
    });
    
    // Volume (input hidden ainda funciona para acessibilidade)
    elements.volume.addEventListener("input", () => {
      const value = Number(elements.volume.value);
      elements.radio.volume = value / 100;
      elements.volumeKnob.style.transform = `rotate(${(value - 50) * CONFIG.VOLUME_ROTATION_FACTOR}deg)`;
      elements.volumeKnob.setAttribute("aria-valuenow", value);
      savePreferences({ volume: value });
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
    
    // A reprodução automática começa sem som; um clique libera também o áudio.
    elements.startVideo.addEventListener("click", () => startPlayback({ userGesture: true }));
    elements.videoList?.addEventListener("click", (event) => {
      const item = event.target.closest("[data-video-index]");
      if (!item) return;
      const selectedIndex = Number(item.dataset.videoIndex);
      if (!Number.isInteger(selectedIndex)) return;
      const selectedMode = item.dataset.videoMode || state.currentMode;
      if (!currentCity().videos[selectedMode]?.[selectedIndex]) return;
      state.currentMode = selectedMode;
      state.currentVideoIndex = selectedIndex;
      updateModeControls();
      renderVideoList();
      updateVideo(currentCity(), { immediate: state.playbackSessionStarted });
      if (state.playbackSessionStarted) elements.videoGate.classList.add("is-hidden");
      syncURL();
    });
    
    // Radio errors share the same guarded retry scheduler as play() failures.
    elements.radio.addEventListener("error", handleRadioMediaError);
    elements.radio.addEventListener("playing", () => {
      if (state.radioWantsPlay) {
        clearRadioLoadTimer();
        state.radioAutoplayPending = false;
        setPlayingState(true);
      }
    });
    elements.radio.addEventListener("ended", () => {
      if (state.radioWantsPlay) scheduleRadioRetry();
    });
    
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
      selectCity(Number(card.dataset.city));
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
    
    // Autoplay
    elements.autoplayBtn.addEventListener("click", toggleAutoplay);
    
    // Pomodoro
    elements.pomodoroBtn.addEventListener("click", togglePomodoro);
    
    // Tema
    elements.themeBtn.addEventListener("click", cycleTheme);
    
    // Qualidade
    elements.qualityBtn.addEventListener("click", cycleQuality);
    
    // PiP
    elements.pipBtn.addEventListener("click", togglePiP);
    
    // Compartilhar
    elements.shareBtn.addEventListener("click", shareCity);
    
    // Botões do leque de share
    elements.shareFanButtons.forEach(btn => {
      btn.addEventListener("click", () => shareToSocial(btn.dataset.share));
    });
    
    // Estatísticas
    elements.statsBtn.addEventListener("click", () => {
      updateStats();
      openLayer(elements.statsModal);
    });
    
    elements.closeStatsButtons.forEach(btn => {
      btn.addEventListener("click", () => closeLayer(elements.statsModal));
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
          selectCity(state.cityIndex + 1);
          break;
        case "ArrowLeft":
          selectCity(state.cityIndex - 1);
          break;
        case " ":
          event.preventDefault();
          toggleRadio();
          break;
        case "Escape":
          closeLayer(elements.drawer);
          destroyStay22Map();
          closeLayer(elements.travelDrawer);
          closeLayer(elements.about);
          closeLayer(elements.mapModal);
          closeLayer(elements.statsModal);
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
        case "p":
        case "P":
          togglePiP();
          break;
        case "a":
        case "A":
          toggleAutoplay();
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
          selectCity(state.cityIndex + 1);
        } else {
          selectCity(state.cityIndex - 1);
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
        toggleRadio();
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

})();
