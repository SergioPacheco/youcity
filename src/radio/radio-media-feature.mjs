import { createNowPlayingClient } from "./radio-now-playing.mjs";
import { createYouTubeSearchClient } from "./radio-youtube.mjs";

function stationKey(station) {
  return station?.stationRef || "";
}

function unavailableMessage(reason) {
  switch (reason) {
    case "UNSUPPORTED_HLS_METADATA":
      return "This HLS station does not expose current-song metadata.";
    case "STREAM_UNAVAILABLE":
      return "The station stream is unavailable for song identification.";
    case "METADATA_TIMEOUT":
      return "The station metadata request timed out.";
    case "STATION_NOT_FOUND":
      return "This station could not be resolved for song identification.";
    default:
      return "This station is not sending current-song metadata.";
  }
}

export function createRadioMediaFeature({
  document,
  elements,
  getStation,
  nowPlayingClient = createNowPlayingClient(),
  youtubeClient = createYouTubeSearchClient(),
  showToast
} = {}) {
  let requestController = null;
  let requestId = 0;
  let currentStationKey = "";
  let currentTrack = null;
  let currentResults = [];

  function setStatus(message, busy = false) {
    elements.status.textContent = message || "";
    elements.status.classList.toggle("is-busy", busy);
  }

  function setPanelVisible(visible) {
    elements.panel.hidden = !visible;
    elements.identifyButton.setAttribute("aria-expanded", String(visible));
  }

  function clearVideo() {
    elements.videoHost.replaceChildren();
    elements.videoHost.hidden = true;
  }

  function renderResults(results) {
    currentResults = results;
    elements.results.replaceChildren();
    results.forEach((result) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "radio-youtube-result";
      button.dataset.videoId = result.videoId;
      if (result.thumbnail) {
        const image = document.createElement("img");
        image.src = result.thumbnail;
        image.alt = "";
        image.loading = "lazy";
        button.append(image);
      }
      const copy = document.createElement("span");
      const title = document.createElement("strong");
      title.textContent = result.title;
      const channel = document.createElement("small");
      channel.textContent = result.channel || "YouTube";
      copy.append(title, channel);
      button.append(copy);
      elements.results.append(button);
    });
  }

  function embedResult(result) {
    clearVideo();
    const iframe = document.createElement("iframe");
    iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(result.videoId)}?rel=0`;
    iframe.title = `${result.title} — YouTube`;
    iframe.loading = "lazy";
    iframe.allow = "accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    elements.videoHost.append(iframe);
    elements.videoHost.hidden = false;
    setStatus(`Video selected: ${result.title}`);
  }

  async function searchVideosForTrack(track, station, activeRequestId, signal) {
    const query = [track.artist, track.title, "official music video"].filter(Boolean).join(" ");
    const options = { signal };
    const regionCode = station.countryCode || station.countrycode || "";
    if (regionCode) options.regionCode = regionCode;
    setStatus("Finding YouTube music videos…", true);
    const results = await youtubeClient.search(query, options);
    if (activeRequestId !== requestId || currentStationKey !== stationKey(getStation?.())) return;
    renderResults(results);
    setStatus(results.length ? `${track.display} · Choose a video to load it here.` : `${track.display} · No matching YouTube videos found.`);
  }

  async function identify() {
    const station = getStation?.();
    if (!station) {
      setPanelVisible(true);
      setStatus("No radio station selected.");
      return;
    }
    requestController?.abort();
    requestController = new AbortController();
    const activeRequestId = ++requestId;
    currentStationKey = stationKey(station);
    currentTrack = null;
    currentResults = [];
    elements.identifyButton.disabled = true;
    if (elements.searchButton) elements.searchButton.disabled = true;
    elements.results.replaceChildren();
    clearVideo();
    setPanelVisible(true);
    setStatus("Identifying the current song…", true);
    try {
      const track = await nowPlayingClient.findForStation(station, { signal: requestController.signal });
      if (activeRequestId !== requestId || currentStationKey !== stationKey(getStation?.())) return;
      currentTrack = track;
      if (!track) {
        setStatus(unavailableMessage(nowPlayingClient.getReason?.(station)));
        return;
      }
      setStatus(track.display);
      await searchVideosForTrack(track, station, activeRequestId, requestController.signal);
    } catch (error) {
      if (error.name === "AbortError") return;
      setStatus(currentTrack ? "YouTube search is unavailable." : "Could not identify the current song.");
      showToast?.(currentTrack ? "Could not search YouTube right now." : "Current song information is unavailable.");
    } finally {
      if (activeRequestId === requestId) {
        requestController = null;
        elements.identifyButton.disabled = false;
        if (elements.searchButton) elements.searchButton.disabled = !currentTrack;
      }
    }
  }

  async function searchVideos() {
    const station = getStation?.();
    if (!currentTrack || !station || currentStationKey !== stationKey(station)) return;
    requestController?.abort();
    requestController = new AbortController();
    const activeRequestId = ++requestId;
    currentStationKey = stationKey(station);
    if (elements.searchButton) elements.searchButton.disabled = true;
    try {
      await searchVideosForTrack(currentTrack, station, activeRequestId, requestController.signal);
    } catch (error) {
      if (error.name === "AbortError") return;
      setStatus("YouTube search is unavailable.");
      showToast?.("Could not search YouTube right now.");
    } finally {
      if (activeRequestId === requestId) {
        requestController = null;
        if (elements.searchButton) elements.searchButton.disabled = false;
      }
    }
  }

  function selectVideo(videoId) {
    const result = currentResults.find((item) => item.videoId === videoId);
    if (result) embedResult(result);
  }

  function reset() {
    requestId += 1;
    requestController?.abort();
    requestController = null;
    currentStationKey = "";
    currentTrack = null;
    currentResults = [];
    elements.identifyButton.disabled = false;
    if (elements.searchButton) elements.searchButton.disabled = true;
    elements.results.replaceChildren();
    clearVideo();
    setStatus("");
    setPanelVisible(false);
  }

  function close() {
    reset();
  }

  function destroy() {
    reset();
    elements.identifyButton.removeEventListener("click", identify);
    elements.searchButton?.removeEventListener("click", searchVideos);
    elements.closeButton?.removeEventListener("click", close);
    elements.results.removeEventListener("click", handleResultClick);
  }

  function handleResultClick(event) {
    const result = event.target.closest?.("[data-video-id]");
    if (result) selectVideo(result.dataset.videoId);
  }

  elements.identifyButton.addEventListener("click", identify);
  elements.searchButton?.addEventListener("click", searchVideos);
  elements.closeButton?.addEventListener("click", close);
  elements.results.addEventListener("click", handleResultClick);
  reset();
  return { identify, searchVideos, selectVideo, reset, close, destroy };
}
