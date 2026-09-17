export function createDom(document) {
  const $ = (selector) => document.querySelector(selector);
  return {
    $,
    elements: {
      app: $("#app"), videoShell: $("#city-video-shell"), videoContainer: $("#city-video-container"),
      videoLoading: $("#video-loading"), videoLoadingMessage: $("#video-loading-message"), poster: $("#poster"), sourceLink: $("#source-link"),
      radio: $("#radio-player"), cityName: $("#city-name"), cityRegion: $("#city-region"), cityNote: $("#city-note"),
      travelPlanner: $("#travel-planner"), travelPrimary: $("#travel-primary"), travelSecondary: $("#travel-secondary"), travelDisclosure: $("#travel-disclosure"),
      travelPlannerLocation: $("#travel-planner-location"), travelPreviewBadge: $("#travel-preview-badge"), stay22Tools: $("#stay22-tools"),
      stay22SearchForm: $("#stay22-search-form"), stay22Checkin: $("#stay22-checkin"), stay22Checkout: $("#stay22-checkout"), stay22Adults: $("#stay22-adults"), stay22Children: $("#stay22-children"),
      stay22SearchStatus: $("#stay22-search-status"), stay22SearchResult: $("#stay22-search-result"), stay22BrowseButton: $("#stay22-browse-button"), stay22RentalsButton: $("#stay22-rentals-button"),
      stay22MapButton: $("#stay22-map-button"), stay22MapPanel: $("#stay22-map-panel"), stay22MapClose: $("#stay22-map-close"), stay22MapFrame: $("#stay22-map-frame"),
      cityIndex: $("#city-index"), cityTotal: $("#city-total"), topLocation: $("#top-location"), topTime: $("#top-time"), stationName: $("#station-name"),
      lcdMeta: $("#lcd-meta"), equalizer: $("#equalizer"), stereoLed: $("#stereo-led"), rdsLed: $("#rds-led"), play: $("#play-button"), volume: $("#volume"),
      volumeKnob: $("#volume-knob"), volumeAccessible: $("#volume-accessible"), rail: $("#rail-track"), drawer: $("#city-drawer"), grid: $("#city-grid"), search: $("#city-search"),
      resultCount: $("#result-count"), about: $("#about-modal"), travelDrawer: $("#travel-drawer"), travelButton: $("#travel-button"), travelPrompts: $("#travel-prompts"),
      travelPromptsCity: $("#travel-prompts-city"), travelQuickActions: $("#travel-quick-actions"), travelPromptsClose: $("#travel-prompts-close"), cityGuideContent: $("#city-guide-content"),
      mapModal: $("#map-modal"), mapContainer: $("#world-map"), mapResultCount: $("#map-result-count"), mapDirectory: $("#map-directory"), mapButton: $("#map-button"),
      streetSound: $("#street-sound"), randomBtn: $("#random-btn"), toast: $("#toast"), playerCard: document.querySelector(".player-card"), playerCardMain: document.querySelector(".player-card-main"),
      playerMinimize: $("#player-minimize"), playerRestore: $("#player-restore"), radioSummaryName: $("#radio-summary-name"), radioSummaryPrevious: $("#radio-summary-previous"), radioSummaryNext: $("#radio-summary-next"),
      radioSummaryPlay: $("#radio-summary-play"), radioExpand: $("#radio-expand"), moreButton: $("#more-button"), moreMenu: $("#more-menu"), commentAssistantButton: $("#comment-assistant-button"),
      radioBrowserDiscover: $("#radio-browser-discover"), radioBrowserPanel: $("#radio-browser-panel"), radioBrowserStatus: $("#radio-browser-status"), radioBrowserResults: $("#radio-browser-results"),
      radioNowPlaying: $("#radio-now-playing"), radioMediaPanel: $("#radio-media-panel"), radioNowPlayingStatus: $("#radio-now-playing-status"), radioYouTubeSearch: $("#radio-youtube-search"), radioYouTubeResults: $("#radio-youtube-results"), radioYouTubePlayer: $("#radio-youtube-player"),
      commentAssistantMenuItem: $("#more-menu [data-overflow-action=\"comment-assistant\"]"), favoriteBtn: $("#favorite-btn"), infoTimezone: $("#info-timezone"),
      infoWeatherTemperature: $("#info-weather-temperature"), infoWeatherLabel: $("#info-weather-label"), filterContinent: $("#filter-continent"), shareBtn: $("#share-button"), themeBtn: $("#theme-button"), qualityBtn: $("#quality-btn"),
      modeButtons: document.querySelectorAll("[data-mode]"), speedButtons: document.querySelectorAll("[data-speed]"), closeDrawerButtons: document.querySelectorAll("[data-close-drawer]"),
      closeTravelButtons: document.querySelectorAll("[data-close-travel]"), closeAboutButtons: document.querySelectorAll("[data-close-about]"), closeMapButtons: document.querySelectorAll("[data-close-map]"),
      shareFanButtons: document.querySelectorAll(".share-fan-item"), filterButtons: document.querySelectorAll("[data-filter]")
    }
  };
}

export function hasAdminRole(window) {
  return new URLSearchParams(window.location.search).get("role")?.toLowerCase() === "admin";
}

export function createSitePath(window) {
  const basePath = String(window.YOUCITY_BASE_PATH || "").replace(/\/+$/, "");
  return { basePath, sitePath: (path) => `${basePath}${path}` };
}
