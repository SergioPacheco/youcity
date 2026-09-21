import { createYouTubePlayer } from "./youtube-player.mjs";

export function createVideoController({
  window,
  document,
  elements,
  state,
  config,
  messages,
  videoStates,
  modeLabels,
  getCurrentCity,
  getCurrentRide,
  availableModes,
  getStartSeconds,
  updateSourceLink,
  showToast,
  radioController,
  onModeChange = () => {},
  onNoRide = () => {}
} = {}) {
  const runtime = { requestId: 0, changeTimer: null, startTimer: null, readyTimer: null, statusTimer: null, clockTimeout: null, clockInterval: null };

  function command(method, args = []) { playerManager.command(method, args); }
  function buildPlayerVars(ride) {
    return { autoplay: 1, mute: 1, controls: 0, loop: 0, playlist: ride.id, modestbranding: 1, rel: 0, playsinline: 1, disablekb: 1, fs: 0, cc_load_policy: 0, iv_load_policy: 3, hl: "en-US", start: Math.floor(getStartSeconds(ride)), origin: window.location.origin };
  }
  function normalizeAspectRatio(value) {
    const match = String(value || "").trim().match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/);
    if (!match) return "";
    const width = Number(match[1]);
    const height = Number(match[2]);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return "";
    return `${width} / ${height}`;
  }
  function applyVideoAspectRatio(ride) {
    const aspectRatio = normalizeAspectRatio(ride?.aspectRatio);
    if (aspectRatio) elements.videoShell?.style?.setProperty("--city-video-aspect-ratio", aspectRatio);
    else elements.videoShell?.style?.removeProperty("--city-video-aspect-ratio");
  }
  function showVideoLoading(loading, message = "Loading video…") {
    clearTimeout(runtime.statusTimer);
    elements.videoLoading?.classList.toggle("is-visible", loading);
    elements.videoLoading?.setAttribute("aria-hidden", String(!loading));
    if (loading) {
      if (elements.videoLoadingMessage) elements.videoLoadingMessage.textContent = message;
      runtime.statusTimer = setTimeout(() => {
        if (elements.videoLoading?.classList.contains("is-visible") && elements.videoLoadingMessage) elements.videoLoadingMessage.textContent = "Still loading…";
      }, 4500);
    }
  }
  function setVideoState(nextState, message = "") {
    state.videoState = nextState;
    if (elements.videoShell) elements.videoShell.dataset.videoState = nextState.toLowerCase();
    const loadingMessages = { [videoStates.LOADING]: "Loading video…", [videoStates.RETRYING]: "Trying another video…" };
    if (nextState === videoStates.LOADING || nextState === videoStates.RETRYING) showVideoLoading(true, message || loadingMessages[nextState]);
    else showVideoLoading(false);
  }
  function markReady() {
    clearTimeout(runtime.readyTimer);
    elements.videoShell?.classList.add("is-ready");
    setVideoState(videoStates.PLAYING);
    command("setPlaybackRate", [state.currentSpeed]);
    if (state.streetSoundOn && state.videoUserGesture) {
      command("unMute");
      command("setVolume", [config.STREET_SOUND_VOLUME]);
    } else {
      command("mute");
      command("setVolume", [0]);
    }

    // Analytics: ride_start
    const city = getCurrentCity();
    const ride = getCurrentRide(city);
    if (city && ride) {
      window.YOUCITY_ANALYTICS?.track?.({
        event: "ride_start",
        city: city.name,
        country: city.country,
        countryCode: city.countryCode || "",
        mode: state.currentMode
      });
    }
  }
  function handleReady() {
    command("setPlaybackRate", [state.currentSpeed]);
    command("mute");
    command("setVolume", [0]);
    command("playVideo");
    runtime.readyTimer = setTimeout(() => {
      if (playerManager.getPlayerState() === window.YT?.PlayerState?.PLAYING) markReady();
      else command("playVideo");
    }, config.VIDEO_READY_DELAY);
  }
  function updateVideo(city, options = {}) {
    const ride = getCurrentRide(city);
    updateSourceLink(ride);
    if (!ride) {
      applyVideoAspectRatio(null);
      setVideoState(videoStates.UNAVAILABLE, `No ${modeLabels[state.currentMode] || state.currentMode} video is currently available. Try another mode.`);
      elements.videoShell?.classList.remove("is-ready");
      if (elements.poster) elements.poster.style.backgroundImage = "";
      showToast(messages.noVideo);
      return;
    }
    applyVideoAspectRatio(ride);
    if (elements.poster) elements.poster.style.backgroundImage = `url("https://i.ytimg.com/vi/${ride.id}/hqdefault.jpg")`;
    if ((playerManager.getCurrentVideoId() || state.currentVideoId) === ride.id) return;
    clearTimeout(runtime.changeTimer);
    clearTimeout(runtime.readyTimer);
    runtime.requestId += 1;
    const requestId = runtime.requestId;
    state.currentVideoId = null;
    elements.videoShell?.classList.remove("is-ready");
    setVideoState(options.loadingState || videoStates.LOADING, options.loadingMessage || "Loading video…");
    const loadRide = async () => {
      if (requestId !== runtime.requestId) return;
      try {
        await playerManager.load(ride);
        if (requestId !== runtime.requestId) return;
        state.currentVideoId = ride.id;
        runtime.readyTimer = setTimeout(markReady, config.VIDEO_READY_DELAY);
      } catch (error) {
        if (requestId !== runtime.requestId) return;
        setVideoState(videoStates.ERROR, "Unable to load this ride. Choose another mode to continue.");
        showToast(messages.videoUnavailable);
        console.warn("[YouCity] YouTube player unavailable:", error.message);
      }
    };
    if (options.immediate) loadRide();
    else runtime.changeTimer = setTimeout(() => { runtime.changeTimer = null; loadRide(); }, config.VIDEO_SWITCH_DEBOUNCE);
  }
  function handleError() {
    const city = getCurrentCity();
    const videos = city.videos[state.currentMode];
    if (videos?.length > 1) {
      state.currentVideoIndex = (state.currentVideoIndex + 1) % videos.length;
      updateVideo(city, { loadingState: videoStates.RETRYING, loadingMessage: "Trying another video…" });
      showToast(messages.videoFallback);
      return;
    }
    const fallbackMode = availableModes(city).find((mode) => mode !== state.currentMode);
    if (fallbackMode) {
      state.currentMode = fallbackMode;
      state.currentVideoIndex = 0;
      onModeChange();
      updateVideo(city, { loadingState: videoStates.RETRYING, loadingMessage: "Loading another video…" });
      showToast(messages.videoFallback);
      return;
    }
    setVideoState(videoStates.UNAVAILABLE, "No playable video found. Choose another mode to continue.");
    showToast(messages.videoUnavailable);
  }
  function handleEnded() {
    const city = getCurrentCity();
    const videos = city?.videos?.[state.currentMode] || [];
    const alternativeIndexes = videos
      .map((_, index) => index)
      .filter((index) => index !== state.currentVideoIndex);

    if (alternativeIndexes.length) {
      state.currentVideoIndex = alternativeIndexes[Math.floor(Math.random() * alternativeIndexes.length)];
      updateVideo(city, { loadingState: videoStates.RETRYING, loadingMessage: "Loading another video…" });
      return;
    }

    const alternativeModes = (availableModes(city) || []).filter((mode) => mode !== state.currentMode);
    if (alternativeModes.length) {
      state.currentMode = alternativeModes[Math.floor(Math.random() * alternativeModes.length)];
      const modeVideos = city.videos[state.currentMode] || [];
      state.currentVideoIndex = Math.floor(Math.random() * modeVideos.length);
      onModeChange();
      updateVideo(city, { loadingState: videoStates.RETRYING, loadingMessage: "Loading another video…" });
      return;
    }

    const ride = getCurrentRide(city);
    if (ride) {
      command("seekTo", [getStartSeconds(ride), true]);
      command("playVideo");
    }
  }
  const playerManager = createYouTubePlayer({
    window,
    document,
    container: elements.videoContainer,
    apiTimeout: config.YOUTUBE_API_TIMEOUT,
    loadTimeout: config.VIDEO_LOAD_TIMEOUT,
    getPlayerVars: buildPlayerVars,
    getStartSeconds,
    getQuality: () => state.currentQuality,
    onReady: handleReady,
    onBuffering: () => setVideoState(videoStates.LOADING),
    onPlaying: markReady,
    onEnded: handleEnded,
    onAutoplayBlocked: () => { command("mute"); command("playVideo"); },
    onError: () => handleError()
  });
  function isMobileViewport() {
    return window.matchMedia?.("(max-width: 800px)")?.matches === true;
  }
  function clearStartupTimers() {
    clearTimeout(runtime.startTimer);
    runtime.startTimer = null;
    clearTimeout(runtime.changeTimer);
    runtime.changeTimer = null;
  }
  function beginPlayback() {
    runtime.startTimer = null;
    updateVideo(getCurrentCity(), { immediate: true });
  }
  function startPlayback(options = {}) {
    if (!getCurrentRide()) {
      onNoRide();
      return;
    }
    const userGesture = options.userGesture === true;
    if (userGesture) {
      state.videoUserGesture = true;
      radioController?.initializeForUserGesture?.();
    }
    if (state.playbackSessionStarted) {
      if (userGesture && !playerManager.getCurrentVideoId()) {
        clearStartupTimers();
        beginPlayback();
      } else {
        command("playVideo");
      }
      return;
    }
    state.playbackSessionStarted = true;
    clearStartupTimers();
    if (!userGesture && isMobileViewport()) {
      runtime.startTimer = setTimeout(beginPlayback, Math.max(0, Number(config.MOBILE_VIDEO_START_DELAY) || 0));
      return;
    }
    beginPlayback();
  }
  function updateClock() {
    if (!elements.topTime) return;
    try {
      elements.topTime.textContent = new Intl.DateTimeFormat("en-US", { timeZone: getCurrentCity().timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
    } catch (error) {
      console.warn("[YouCity] Failed to update clock:", error.message);
      elements.topTime.textContent = "--:--";
    }
  }
  function scheduleClockUpdate() {
    clearTimeout(runtime.clockTimeout);
    if (runtime.clockInterval) clearInterval(runtime.clockInterval);
    updateClock();
    const now = new Date();
    const delay = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
    runtime.clockTimeout = setTimeout(() => { updateClock(); runtime.clockInterval = setInterval(updateClock, config.CLOCK_INTERVAL); }, delay);
  }
  return { command, playerManager, setVideoState, updateVideo, startPlayback, handleReady, markReady, updateClock, scheduleClockUpdate, destroy: () => { clearTimeout(runtime.changeTimer); clearTimeout(runtime.startTimer); clearTimeout(runtime.readyTimer); clearTimeout(runtime.statusTimer); clearTimeout(runtime.clockTimeout); if (runtime.clockInterval) clearInterval(runtime.clockInterval); playerManager.destroy(); } };
}
