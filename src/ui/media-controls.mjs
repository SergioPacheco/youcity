export function createMediaControls({
  window,
  document,
  elements,
  state,
  storage,
  storageKeys,
  config,
  themeNames,
  messages,
  showQuality,
  setPlaybackQuality,
  showToast: externalToast
} = {}) {
  let toastTimer = null;
  const knobState = { isDragging: false, startY: 0, startVolume: 0 };

  function showToast(message) {
    if (externalToast) return externalToast(message);
    clearTimeout(toastTimer);
    if (!elements.toast) return;
    elements.toast.textContent = message;
    elements.toast.classList.add("is-visible");
    toastTimer = setTimeout(() => elements.toast.classList.remove("is-visible"), config.TOAST_DURATION);
  }

  function togglePlayer(hide) {
    state.playerHidden = hide !== undefined ? hide : !state.playerHidden;
    elements.playerCard?.classList.toggle("is-hidden", state.playerHidden);
    elements.playerRestore?.classList.toggle("is-visible", state.playerHidden);
    storage.writeJson(storageKeys.playerHidden, state.playerHidden);
  }

  function restorePlayerFromStorage() {
    if (storage.readJson(storageKeys.playerHidden, false) === true) togglePlayer(true);
  }

  function cycleTheme() {
    const themes = [config.themes.DEFAULT, config.themes.SEPIA, config.themes.CONTRAST];
    const currentIndex = themes.indexOf(state.currentTheme);
    state.currentTheme = themes[(currentIndex + 1) % themes.length];
    elements.app?.classList.remove(config.themes.SEPIA, config.themes.CONTRAST);
    if (state.currentTheme) elements.app?.classList.add(state.currentTheme);
    storage.writeJson(storageKeys.theme, state.currentTheme);
    showToast(themeNames[state.currentTheme]);
  }

  function loadTheme() {
    state.currentTheme = storage.readJson(storageKeys.theme, config.themes.DEFAULT) || config.themes.DEFAULT;
    if (state.currentTheme) elements.app?.classList.add(state.currentTheme);
  }

  function cycleQuality() {
    const qualities = [config.qualities.AUTO, config.qualities.HD720, config.qualities.HD1080];
    const currentIndex = qualities.indexOf(state.currentQuality);
    state.currentQuality = qualities[(currentIndex + 1) % qualities.length];
    if (elements.qualityBtn) elements.qualityBtn.textContent = state.currentQuality === config.qualities.AUTO ? "HD" : `${state.currentQuality}p`;
    setPlaybackQuality(state.currentQuality === config.qualities.AUTO ? "default" : `hd${state.currentQuality}`);
    showToast(state.currentQuality === config.qualities.AUTO ? messages.qualityAuto : messages.qualitySet(state.currentQuality));
    showQuality?.(state.currentQuality);
  }

  function updateVolumeFromKnob(newVolume) {
    const volume = Math.max(0, Math.min(100, newVolume));
    if (elements.volume) elements.volume.value = volume;
    if (elements.volumeAccessible) elements.volumeAccessible.value = volume;
    if (elements.radio) elements.radio.volume = volume / 100;
    if (elements.volumeKnob) elements.volumeKnob.style.transform = `rotate(${(volume - 50) * config.VOLUME_ROTATION_FACTOR}deg)`;
    storage.writeJson(storageKeys.prefs, { ...storage.readJson(storageKeys.prefs, {}), volume });
  }

  function handleKnobMouseMove(event) {
    if (!knobState.isDragging) return;
    const delta = (knobState.startY - event.clientY) * config.VOLUME_DRAG_SENSITIVITY;
    updateVolumeFromKnob(knobState.startVolume + delta);
  }

  function handleKnobMouseUp() {
    if (!knobState.isDragging) return;
    knobState.isDragging = false;
    document.removeEventListener("mousemove", handleKnobMouseMove);
    document.removeEventListener("mouseup", handleKnobMouseUp);
  }

  function setupVolumeKnobListeners() {
    elements.volumeKnob?.addEventListener("mousedown", (event) => {
      knobState.isDragging = true;
      knobState.startY = event.clientY;
      knobState.startVolume = Number(elements.volume?.value || 0);
      event.preventDefault();
      document.addEventListener("mousemove", handleKnobMouseMove);
      document.addEventListener("mouseup", handleKnobMouseUp);
    });
    elements.volumeKnob?.addEventListener("wheel", (event) => {
      event.preventDefault();
      updateVolumeFromKnob(Number(elements.volume?.value || 0) + (event.deltaY > 0 ? -config.VOLUME_WHEEL_STEP : config.VOLUME_WHEEL_STEP));
    });
    updateVolumeFromKnob(Number(elements.volume?.value || 0));
  }

  return {
    showToast,
    togglePlayer,
    restorePlayerFromStorage,
    cycleTheme,
    loadTheme,
    cycleQuality,
    updateVolumeFromKnob,
    setupVolumeKnobListeners
  };
}
