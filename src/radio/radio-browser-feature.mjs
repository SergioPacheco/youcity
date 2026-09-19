import { createRadioBrowserClient } from "./radio-browser.mjs";

export function createRadioBrowserFeature({
  document,
  elements,
  getCity,
  stationRepository,
  radioController,
  client = createRadioBrowserClient(),
  showToast
} = {}) {
  let requestController = null;
  let requestId = 0;
  let currentCityKey = "";

  function cityKey(city) {
    return `${city?.name || ""}|${city?.country || ""}`;
  }

  function setStatus(message, busy = false) {
    elements.status.textContent = message || "";
    elements.status.classList.toggle("is-busy", busy);
  }

  function createGroupHeading(label, group) {
    const heading = document.createElement("strong");
    heading.className = "radio-browser-group-heading";
    heading.dataset.stationGroup = group;
    heading.textContent = label;
    return heading;
  }

  function createStationButton(station) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "radio-browser-station";
    button.dataset.stationRef = station.stationRef;
    const name = document.createElement("strong");
    name.textContent = station.name;
    const meta = document.createElement("small");
    const details = [station.language, station.codec, station.bitrate ? `${station.bitrate} kbps` : ""].filter(Boolean);
    meta.textContent = details.join(" · ") || (station.curated ? "Recommended station" : "Radio Browser station");
    button.append(name, meta);
    return button;
  }

  function renderStations({ searching = false } = {}) {
    const recommended = stationRepository?.getCatalogStations?.() || [];
    const nearby = stationRepository?.getDiscoveredStations?.() || [];
    elements.results.replaceChildren();
    if (recommended.length) {
      elements.results.append(createGroupHeading("Recommended", "recommended"));
      recommended.forEach((station) => elements.results.append(createStationButton(station)));
    }
    elements.results.append(createGroupHeading("More nearby", "nearby"));
    if (searching) {
      const status = document.createElement("span");
      status.className = "radio-browser-nearby-status";
      status.dataset.stationGroup = "nearby-status";
      status.textContent = "Searching…";
      elements.results.append(status);
    } else {
      nearby.forEach((station) => elements.results.append(createStationButton(station)));
    }
  }

  async function search() {
    if (!elements.panel.hidden) {
      reset();
      return;
    }
    const city = getCity?.();
    if (!city) return;
    requestController?.abort();
    requestController = new AbortController();
    const activeRequestId = ++requestId;
    currentCityKey = cityKey(city);
    elements.panel.hidden = false;
    elements.trigger.setAttribute("aria-expanded", "true");
    elements.trigger.disabled = true;
    renderStations({ searching: true });
    setStatus("Searching additional nearby stations…", true);
    try {
      const stations = await client.findForCity(city, { signal: requestController.signal });
      if (activeRequestId !== requestId || currentCityKey !== cityKey(getCity?.())) return;
      stationRepository?.mergeDiscoveredStations?.(stations);
      const nearby = stationRepository?.getDiscoveredStations?.() || [];
      renderStations();
      setStatus(nearby.length ? `${nearby.length} additional nearby stations found.` : "No additional nearby stations found.");
    } catch (error) {
      if (error.name === "AbortError") return;
      renderStations();
      setStatus("Local radio search is unavailable. Your recommended stations are still available.");
      showToast?.("Could not load local radio stations.");
    } finally {
      if (activeRequestId === requestId) {
        elements.trigger.disabled = false;
        requestController = null;
      }
    }
  }

  function selectStation(stationRef) {
    const station = stationRepository?.findStationByRef?.(stationRef);
    if (!station) return;
    radioController?.playStation?.(station);
    setStatus(`${station.name} selected.`);
  }

  function reset() {
    requestId += 1;
    requestController?.abort();
    requestController = null;
    currentCityKey = "";
    elements.panel.hidden = true;
    elements.trigger.disabled = false;
    elements.trigger.setAttribute("aria-expanded", "false");
    elements.results.replaceChildren();
    setStatus("");
  }

  function initialize() {
    elements.trigger.addEventListener("click", search);
    elements.results.addEventListener("click", (event) => {
      const station = event.target.closest?.("[data-station-ref]");
      if (station) selectStation(station.dataset.stationRef);
    });
  }

  initialize();
  return { search, reset };
}
