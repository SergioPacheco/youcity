import { createRadioBrowserClient } from "./radio-browser.mjs";

export function createRadioBrowserFeature({
  document,
  elements,
  getCity,
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

  function renderStations(stations) {
    elements.results.replaceChildren();
    if (!stations.length) {
      setStatus("No verified local stations found for this city.");
      return;
    }
    stations.forEach((station) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "radio-browser-station";
      button.dataset.stationUuid = station.stationuuid;
      const name = document.createElement("strong");
      name.textContent = station.name;
      const meta = document.createElement("small");
      const details = [station.language, station.codec, station.bitrate ? `${station.bitrate} kbps` : ""].filter(Boolean);
      meta.textContent = details.join(" · ") || "Radio Browser station";
      button.append(name, meta);
      elements.results.append(button);
    });
    setStatus(`${stations.length} local stations found. Select one to listen.`);
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
    const currentRequestId = ++requestId;
    currentCityKey = cityKey(city);
    elements.panel.hidden = false;
    elements.trigger.setAttribute("aria-expanded", "true");
    elements.trigger.disabled = true;
    setStatus("Searching verified local stations…", true);
    elements.results.replaceChildren();
    try {
      const stations = await client.findForCity(city, { signal: requestController.signal });
      if (currentRequestId !== requestId || currentCityKey !== cityKey(getCity?.())) return;
      radioController.setAdditionalStations(stations);
      renderStations(stations);
    } catch (error) {
      if (error.name === "AbortError") return;
      setStatus("Local radio search is unavailable. Your current stations are still available.");
      showToast?.("Could not load local radio stations.");
    } finally {
      if (currentRequestId === requestId) elements.trigger.disabled = false;
    }
  }

  function selectStation(stationUuid) {
    const station = radioController.getAdditionalStations().find((item) => item.stationuuid === stationUuid);
    if (!station) return;
    radioController.playStation(station);
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
      const station = event.target.closest("[data-station-uuid]");
      if (station) selectStation(station.dataset.stationUuid);
    });
  }

  initialize();
  return { search, reset };
}
