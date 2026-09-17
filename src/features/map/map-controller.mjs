export function createMapController({
  window,
  document,
  elements,
  cities,
  getCurrentCityIndex,
  mapConfig = {},
  sitePath,
  buildPopup,
  onPlayRide,
  onSelectCity,
  onTrackClick,
  observeImpressions
}) {
  let worldMap = null;
  let markers = new Map();
  let assetsPromise = null;

  function loadLeafletAssets() {
    if (window.L) return Promise.resolve(window.L);
    if (assetsPromise) return assetsPromise;
    const cssUrl = mapConfig.leafletCssUrl || "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    const jsUrl = mapConfig.leafletJsUrl || "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    assetsPromise = new Promise((resolve, reject) => {
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
        existingScript.addEventListener("error", () => {
          existingScript.remove();
          reject(new Error("Leaflet failed to load"));
        }, { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = jsUrl;
      script.async = true;
      script.crossOrigin = "anonymous";
      script.dataset.youcityLeaflet = "true";
      script.addEventListener("load", () => resolve(window.L), { once: true });
      script.addEventListener("error", () => {
        script.remove();
        reject(new Error("Leaflet failed to load"));
      }, { once: true });
      document.body.appendChild(script);
    }).catch((error) => {
      assetsPromise = null;
      throw error;
    });
    return assetsPromise;
  }

  function coordinates(city) {
    return Array.isArray(city?.coordinates) && city.coordinates.length >= 2 ? city.coordinates : null;
  }

  function renderDirectory() {
    if (!elements.mapDirectory) return;
    elements.mapDirectory.innerHTML = cities.map((city, index) => {
      const modes = Object.entries(city.videos || {}).filter(([, videos]) => videos?.length).map(([mode, videos]) => {
        const buttons = videos.map((_, videoIndex) => `<button type="button" data-map-play data-city="${index}" data-mode="${mode}" data-video-index="${videoIndex}">${mode} ${videoIndex + 1}</button>`).join("");
        return `<div class="map-directory-mode"><strong>${mode}</strong><span>${buttons}</span></div>`;
      }).join("");
      return `<article class="map-directory-item"><h3><button type="button" data-map-city-select="${index}">${city.name}</button><span>${city.country}</span></h3>${modes}</article>`;
    }).join("");
  }

  function updateCurrentCity() {
    const currentIndex = getCurrentCityIndex();
    markers.forEach((marker, index) => {
      const current = index === currentIndex;
      marker.setStyle({ radius: current ? 10 : 6, color: current ? "#ffffff" : "#d7ff43", weight: current ? 3 : 2, fillColor: current ? "#d7ff43" : "#111411", fillOpacity: 0.95 });
      if (current) {
        if (!marker.getTooltip()) marker.bindTooltip("You are here", { className: "map-current-label", direction: "top", offset: [0, -8], permanent: true });
        marker.openTooltip();
      } else if (marker.getTooltip()) marker.unbindTooltip();
    });
  }

  function focusCurrentCity(openPopup = true) {
    if (!worldMap) return;
    const index = getCurrentCityIndex();
    const marker = markers.get(index);
    const point = coordinates(cities[index]);
    if (!marker || !point) return;
    updateCurrentCity();
    worldMap.setView(point, Math.max(worldMap.getZoom(), 5), { animate: true });
    if (openPopup) marker.openPopup();
  }

  async function initialize() {
    if (!elements.mapContainer) return;
    if (worldMap) {
      worldMap.invalidateSize();
      focusCurrentCity();
      return;
    }
    elements.mapContainer.innerHTML = '<p class="map-unavailable map-loading">Loading world map…</p>';
    let L;
    try { L = await loadLeafletAssets(); } catch (error) {
      elements.mapContainer.innerHTML = '<p class="map-unavailable">The map library could not be loaded. Check your connection and try again.</p>';
      throw error;
    }
    worldMap = L.map(elements.mapContainer, { worldCopyJump: true, minZoom: 2, maxZoom: 12, zoomControl: true }).setView([20, 0], 2);
    L.tileLayer(mapConfig.tileUrl || "https://tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: mapConfig.attribution || "&copy; OpenStreetMap contributors", maxZoom: mapConfig.maxZoom || 19, tileSize: 256 }).addTo(worldMap);
    const bounds = [];
    markers = new Map();
    cities.forEach((city, index) => {
      const point = coordinates(city);
      if (!point) return;
      bounds.push(point);
      const marker = L.circleMarker(point, { radius: 6, color: "#d7ff43", weight: 2, fillColor: "#111411", fillOpacity: 0.95, bubblingMouseEvents: false })
        .bindPopup(buildPopup(city, index), { maxWidth: 280, minWidth: 220 })
        .addTo(worldMap);
      markers.set(index, marker);
    });
    if (elements.mapResultCount) elements.mapResultCount.textContent = `${markers.size} cities · ${cities.length} destinations`;
    renderDirectory();
    observeImpressions?.(elements.mapContainer);
    if (bounds.length) worldMap.fitBounds(bounds, { padding: [28, 28], maxZoom: 3 });
    focusCurrentCity();
    setTimeout(() => worldMap?.invalidateSize(), 50);
  }

  function handleClick(event) {
    const offer = event.target.closest("[data-travel-provider]");
    if (offer) {
      onTrackClick?.(offer);
      return;
    }
    const playButton = event.target.closest("[data-map-play]");
    if (playButton) {
      event.preventDefault();
      onPlayRide(Number(playButton.dataset.city), playButton.dataset.mode, playButton.dataset.videoIndex);
      return;
    }
    const cityButton = event.target.closest("[data-map-city-select]");
    if (cityButton) onSelectCity(Number(cityButton.dataset.mapCitySelect));
  }

  elements.mapContainer?.addEventListener("click", handleClick);
  elements.mapDirectory?.addEventListener("click", handleClick);

  function destroy() {
    elements.mapContainer?.removeEventListener("click", handleClick);
    elements.mapDirectory?.removeEventListener("click", handleClick);
    worldMap?.remove();
    worldMap = null;
    markers.clear();
  }

  return { initialize, updateCurrentCity, destroy };
}
