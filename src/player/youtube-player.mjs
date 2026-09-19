export function createYouTubePlayer({
  window,
  document,
  container,
  apiTimeout = 15_000,
  loadTimeout = 12_000,
  getPlayerVars,
  getStartSeconds,
  getQuality,
  onReady,
  onBuffering,
  onPlaying,
  onEnded,
  onAutoplayBlocked,
  onError
}) {
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
        try { previousReadyHandler?.(...args); } finally { checkReady(); }
      };
      const script = [...document.scripts].find((candidate) => candidate.src.includes("youtube.com/iframe_api"));
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
      timeoutTimer = setTimeout(() => finish(new Error("YouTube IFrame Player API did not initialize")), apiTimeout);
    }).catch((error) => {
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
      const readyTimeout = setTimeout(() => rejectReady(new Error("YouTube player did not become ready")), loadTimeout);
      readyPromise = new Promise((resolve, reject) => {
        resolveReady = resolve;
        rejectReady = reject;
      });
      playerReady = false;
      try {
        player = new YTApi.Player(container, {
          host: "https://www.youtube-nocookie.com",
          videoId: ride.id,
          playerVars: getPlayerVars(ride),
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
              onReady?.(readyPlayer);
              resolveReady(readyPlayer);
            },
            onStateChange: (event) => {
              if (event.data === window.YT?.PlayerState?.BUFFERING) onBuffering?.();
              if (event.data === window.YT?.PlayerState?.PLAYING) onPlaying?.();
              if (event.data === window.YT?.PlayerState?.ENDED) onEnded?.();
            },
            onAutoplayBlocked: () => onAutoplayBlocked?.(),
            onError: (event) => {
              const error = new Error(`YouTube player error ${event.data}`);
              error.code = event.data;
              if (!playerReady) {
                clearTimeout(readyTimeout);
                rejectReady(error);
                return;
              }
              onError?.(error);
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
    try { return await initPromise; } finally { initPromise = null; }
  }

  async function load(ride) {
    if (!ride) return;
    if (!playerReady || !player) await init(ride);
    if (!player) throw new Error("YouTube player is unavailable");
    if (currentVideoId === ride.id) {
      player.playVideo?.();
      return;
    }
    currentVideoId = ride.id;
    player.loadVideoById({ videoId: ride.id, startSeconds: getStartSeconds(ride) });
    player.playVideo?.();
    const quality = getQuality?.();
    if (quality && quality !== "auto") player.setPlaybackQuality?.(`hd${quality}`);
  }

  function command(method, args = []) {
    if (!player || typeof player[method] !== "function") return;
    player[method](...args);
  }

  function getPlayerState() {
    return player && typeof player.getPlayerState === "function" ? player.getPlayerState() : null;
  }

  function setPlaybackQuality(quality) {
    if (player && typeof player.setPlaybackQuality === "function") player.setPlaybackQuality(quality);
  }

  function destroy() {
    player?.destroy();
    player = null;
    initialized = false;
    playerReady = false;
    currentVideoId = null;
    readyPromise = null;
    initPromise = null;
  }

  return {
    init,
    load,
    command,
    setPlaybackQuality,
    getCurrentVideoId: () => currentVideoId,
    getPlayerState,
    isInitialized: () => initialized && playerReady && Boolean(player),
    destroy
  };
}
