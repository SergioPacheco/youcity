export function createRadioController({
  audio,
  elements,
  getCity,
  getVolume,
  messages,
  showToast,
  config,
  onStateChange,
  onPlayingChange
}) {
  let radioIndex = 0;
  let radioPlaying = false;
  let radioWantsPlay = false;
  let radioAutoplayPending = false;
  let initialAutoplayPending = true;
  let retryCount = 0;
  let requestId = 0;
  let retryTimer = null;
  let loadTimer = null;
  let additionalStations = [];

  function availableStations() {
    return [...(getCity()?.radios || []), ...additionalStations];
  }

  function publish() {
    onStateChange?.({ radioIndex, radioWantsPlay, radioAutoplayPending, radioRetryCount: retryCount, radioRequestId: requestId });
  }

  function setPlayingState(playing) {
    radioPlaying = playing;
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
    onPlayingChange?.(playing);
    publish();
  }

  function clearRetryTimer() {
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
  }

  function clearLoadTimer() {
    if (loadTimer) clearTimeout(loadTimer);
    loadTimer = null;
  }

  function scheduleRetry() {
    if (!radioWantsPlay || retryTimer) return;
    if (retryCount >= config.RADIO_MAX_RETRIES) {
      radioWantsPlay = false;
      retryCount = 0;
      setPlayingState(false);
      showToast(messages.radioUnavailable);
      return;
    }
    retryCount += 1;
    showToast(messages.radioRetry);
    retryTimer = setTimeout(() => {
      retryTimer = null;
      if (radioWantsPlay) setRadio(radioIndex + 1, true, { preserveRetries: true });
    }, config.RADIO_RETRY_DELAY);
    publish();
  }

  function handleMediaError() {
    if (!radioWantsPlay) return;
    clearLoadTimer();
    const mediaError = audio.error;
    const errorCode = mediaError?.code ? ` (media error ${mediaError.code})` : "";
    console.warn(`[YouCity] Radio stream unavailable${errorCode}:`, audio.src);
    setPlayingState(false);
    scheduleRetry();
  }

  function playWithRetry(expectedRequestId = requestId) {
    if (expectedRequestId !== requestId || !radioWantsPlay) return;
    const playPromise = audio.play();
    if (!playPromise || typeof playPromise.then !== "function") {
      if (!audio.paused) {
        clearLoadTimer();
        setPlayingState(true);
      }
      return;
    }
    playPromise.then(() => {
      if (expectedRequestId !== requestId) return;
      clearLoadTimer();
      radioAutoplayPending = false;
      setPlayingState(true);
      retryCount = 0;
    }).catch((error) => {
      if (expectedRequestId !== requestId || !radioWantsPlay) return;
      if (error.name === "NotAllowedError") {
        radioAutoplayPending = true;
        setPlayingState(false);
        return;
      }
      if (error.name === "AbortError" && audio.readyState < HTMLMediaElement.HAVE_METADATA) {
        setTimeout(() => playWithRetry(expectedRequestId), 250);
        return;
      }
      console.warn("[YouCity] Failed to play radio:", error.message);
      setPlayingState(false);
      scheduleRetry();
    });
  }

  function setRadio(nextIndex = 0, shouldPlay = radioPlaying, options = {}) {
    const radios = availableStations();
    clearRetryTimer();
    clearLoadTimer();
    audio.pause();
    radioWantsPlay = shouldPlay;
    radioAutoplayPending = false;
    if (!options.preserveRetries) retryCount = 0;
    requestId += 1;
    radioIndex = radios.length ? (nextIndex + radios.length) % radios.length : 0;
    publish();

    if (!radios.length) {
      audio.removeAttribute("src");
      audio.load();
      elements.stationName.innerHTML = "NO SIGNAL<small> --</small>";
      if (elements.radioSummaryName) elements.radioSummaryName.textContent = "No local radio";
      elements.lcdMeta.textContent = "-- · NO SIGNAL";
      elements.play.disabled = true;
      elements.radioSummaryPrevious?.setAttribute("disabled", "true");
      elements.radioSummaryNext?.setAttribute("disabled", "true");
      elements.stereoLed.classList.remove("is-active");
      elements.rdsLed.classList.remove("is-active");
      setPlayingState(false);
      return;
    }

    elements.play.disabled = false;
    elements.radioSummaryPrevious?.toggleAttribute("disabled", radios.length < 2);
    elements.radioSummaryNext?.toggleAttribute("disabled", radios.length < 2);
    const station = radios[radioIndex];
    elements.stationName.innerHTML = `${station.name}<small> FM</small>`;
    if (elements.radioSummaryName) elements.radioSummaryName.textContent = station.name;
    elements.lcdMeta.textContent = `CH-${String(radioIndex + 1).padStart(2, "0")} · ${getCity().name.toUpperCase().slice(0, 12)}`;
    elements.stereoLed.classList.add("is-active");
    elements.rdsLed.classList.toggle("is-active", station.name.length > 10);
    audio.src = station.url;
    audio.volume = getVolume() / 100;
    audio.load();
    if (shouldPlay) {
      const expectedRequestId = requestId;
      loadTimer = setTimeout(() => {
        loadTimer = null;
        if (expectedRequestId === requestId && radioWantsPlay && !radioAutoplayPending && audio.readyState < HTMLMediaElement.HAVE_METADATA) handleMediaError();
      }, config.RADIO_LOAD_TIMEOUT);
      playWithRetry(expectedRequestId);
    } else {
      setPlayingState(false);
    }
    publish();
  }

  function toggle() {
    if (!availableStations().length) return showToast(messages.noRadio);
    initialAutoplayPending = false;
    if (radioPlaying) {
      radioWantsPlay = false;
      radioAutoplayPending = false;
      clearRetryTimer();
      clearLoadTimer();
      requestId += 1;
      audio.pause();
      setPlayingState(false);
    } else {
      radioWantsPlay = true;
      radioAutoplayPending = false;
      playWithRetry();
    }
    publish();
  }

  function resumeAfterUserGesture() {
    if (!availableStations().length) return;
    if (radioAutoplayPending && radioWantsPlay) {
      radioAutoplayPending = false;
      playWithRetry();
      return;
    }
    if (!initialAutoplayPending) return;
    initialAutoplayPending = false;
    if (!radioPlaying && !radioWantsPlay) setRadio(radioIndex, true);
  }

  function initializeForUserGesture() {
    if (!availableStations().length) return;
    initialAutoplayPending = false;
    if (radioAutoplayPending) {
      resumeAfterUserGesture();
      return;
    }
    if (!radioPlaying && !radioWantsPlay) setRadio(radioIndex, true);
  }

  function destroy() {
    clearRetryTimer();
    clearLoadTimer();
    requestId += 1;
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
  }

  function setAdditionalStations(stations = []) {
    additionalStations = Array.isArray(stations) ? stations.filter((station) => station?.url && station?.name) : [];
    setRadio(radioIndex, radioWantsPlay);
  }

  function clearAdditionalStations() {
    additionalStations = [];
  }

  function playStation(station) {
    const index = availableStations().findIndex((candidate) => candidate.stationuuid && candidate.stationuuid === station?.stationuuid);
    if (index >= 0) setRadio(index, true);
  }

  function getCurrentStation() {
    return availableStations()[radioIndex] || null;
  }

  audio.addEventListener("error", handleMediaError);
  audio.addEventListener("playing", () => {
    clearLoadTimer();
    if (radioWantsPlay) setPlayingState(true);
  });
  audio.addEventListener("ended", () => {
    if (radioWantsPlay) scheduleRetry();
  });
  audio.addEventListener("stalled", () => {
    if (radioWantsPlay) scheduleRetry();
  });

  return {
    setRadio,
    toggle,
    resumeAfterUserGesture,
    initializeForUserGesture,
    handleMediaError,
    destroy,
    setAdditionalStations,
    clearAdditionalStations,
    getAdditionalStations: () => [...additionalStations],
    playStation,
    getCurrentStation,
    isPlaying: () => radioPlaying,
    getIndex: () => radioIndex
  };
}
