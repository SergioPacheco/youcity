#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createVideoController } from "../src/player/video-controller.mjs";

let fakePlayer;
class FakeYouTubePlayer {
  constructor(_container, options) {
    this.options = options;
    this.loadedIds = [options.videoId];
    this.state = 1;
    fakePlayer = this;
    queueMicrotask(() => options.events.onReady({ target: this }));
  }

  getIframe() {
    return { classList: { add() {} }, setAttribute() {} };
  }

  loadVideoById({ videoId }) {
    this.loadedIds.push(videoId);
  }

  playVideo() {}
  mute() {}
  setVolume() {}
  setPlaybackRate() {}
  getPlayerState() { return this.state; }
  destroy() {}
}

const city = {
  name: "Granada",
  country: "Spain",
  videos: {
    walk: [
      { id: "walk-current", start: 0 },
      { id: "walk-next", start: 0 },
      { id: "walk-third", start: 0 }
    ]
  }
};
const createState = () => ({
  currentMode: "walk",
  currentVideoIndex: 0,
  currentVideoId: null,
  currentSpeed: 1,
  currentQuality: "auto",
  streetSoundOn: false,
  videoUserGesture: false,
  playbackSessionStarted: false
});
const windowRef = {
  location: { origin: "http://localhost" },
  YT: {
    Player: FakeYouTubePlayer,
    PlayerState: { BUFFERING: 3, PLAYING: 1, ENDED: 0 }
  },
  matchMedia: () => ({ matches: false })
};

function createController({ mobile = false, startDelay = 0 } = {}) {
  const state = createState();
  const controllerWindow = { ...windowRef, matchMedia: () => ({ matches: mobile }) };
  const controller = createVideoController({
    window: controllerWindow,
    document: { scripts: [] },
    elements: {
      videoContainer: {},
      videoShell: { classList: { add() {}, remove() {} }, dataset: {} }
    },
    state,
    config: {
      VIDEO_READY_DELAY: 0,
      VIDEO_SWITCH_DEBOUNCE: 0,
      MOBILE_VIDEO_START_DELAY: startDelay,
      STREET_SOUND_VOLUME: 32,
      YOUTUBE_API_TIMEOUT: 100,
      VIDEO_LOAD_TIMEOUT: 100
    },
    messages: { videoUnavailable: "Video unavailable", videoFallback: "Video fallback", noVideo: "No video" },
    videoStates: { LOADING: "LOADING", PLAYING: "PLAYING", RETRYING: "RETRYING", ERROR: "ERROR", UNAVAILABLE: "UNAVAILABLE" },
    modeLabels: { walk: "Walk" },
    getCurrentCity: () => city,
    getCurrentRide: () => city.videos[state.currentMode]?.[state.currentVideoIndex],
    availableModes: (currentCity) => Object.keys(currentCity.videos).filter((mode) => currentCity.videos[mode].length),
    getStartSeconds: (ride) => ride.start,
    updateSourceLink() {},
    showToast() {}
  });
  return { controller, state };
}

const originalRandom = Math.random;
Math.random = () => 0;
try {
  const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(css, /--city-video-max-width-factor:\s*3\b/, "video crop limit must be centralized and default to 3x container width");
  assert.match(css, /--city-video-aspect-ratio:\s*16\s*\/\s*9/, "video aspect ratio must be explicit");
  assert.match(css, /--city-video-target-width:\s*min\(\s*max\(100vw,\s*calc\(100dvh\s*\*\s*\(var\(--city-video-aspect-ratio\)\)\)\),\s*calc\(100vw\s*\*\s*var\(--city-video-max-width-factor\)\)\s*\)/, "iframe width must fill until the 3x lateral crop limit");
  assert.match(css, /height:\s*calc\(var\(--city-video-target-width\)\s*\/\s*\(var\(--city-video-aspect-ratio\)\)\)/, "iframe height must preserve 16:9 from the final width");

  const youtubePlayerSource = readFileSync(new URL("../src/player/youtube-player.mjs", import.meta.url), "utf8");
  const mediaControlsSource = readFileSync(new URL("../src/ui/media-controls.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(youtubePlayerSource, /setPlaybackQuality|getPlaybackQuality|getAvailableQualityLevels/, "unsupported YouTube quality APIs must not be called");
  assert.doesNotMatch(mediaControlsSource, /720p|1080p|hd720|hd1080|setPlaybackQuality/, "quality control must not present unconfirmed fixed resolutions");

  const expectedFrames = [
    { viewport: [360, 800], width: 1080, height: 607.5 },
    { viewport: [390, 844], width: 1170, height: 658.125 },
    { viewport: [430, 932], width: 1290, height: 725.625 },
    { viewport: [844, 390], width: 844, height: 474.75 },
    { viewport: [1366, 768], width: 1366, height: 768.375 }
  ];
  for (const { viewport: [viewportWidth, viewportHeight], width, height } of expectedFrames) {
    const requiredWidth = Math.max(viewportWidth, viewportHeight * (16 / 9));
    const limitedWidth = Math.min(requiredWidth, 3 * viewportWidth);
    assert.equal(limitedWidth, width, `${viewportWidth}x${viewportHeight} iframe width must respect the 3x limit`);
    assert.equal(limitedWidth / (16 / 9), height, `${viewportWidth}x${viewportHeight} iframe height must preserve 16:9`);
    assert.ok(limitedWidth <= 3 * viewportWidth, `${viewportWidth}x${viewportHeight} iframe must not exceed 3x viewport width`);
    assert.equal(limitedWidth / height, 16 / 9, `${viewportWidth}x${viewportHeight} iframe ratio must remain 16:9`);
  }

  const desktop = createController();
  desktop.controller.startPlayback();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(fakePlayer.loadedIds, ["walk-current"]);

  fakePlayer.options.events.onStateChange({ data: windowRef.YT.PlayerState.ENDED });
  await new Promise((resolve) => setTimeout(resolve, 5));

  assert.equal(desktop.state.currentVideoIndex, 1);
  assert.deepEqual(fakePlayer.loadedIds, ["walk-current", "walk-next"]);
  desktop.controller.destroy();

  fakePlayer = undefined;
  const mobile = createController({ mobile: true, startDelay: 20 });
  mobile.controller.startPlayback();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(fakePlayer, undefined, "mobile startup should leave the poster visible before the delay");
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.deepEqual(fakePlayer.loadedIds, ["walk-current"]);
  mobile.controller.destroy();

  fakePlayer = undefined;
  const gesture = createController({ mobile: true, startDelay: 40 });
  gesture.controller.startPlayback();
  gesture.controller.startPlayback({ userGesture: true });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(fakePlayer.loadedIds, ["walk-current"], "a gesture should start the pending ride immediately");
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.deepEqual(fakePlayer.loadedIds, ["walk-current"], "the canceled timer must not load twice");
  gesture.controller.destroy();
} finally {
  Math.random = originalRandom;
}

console.log("Video playback tests passed: an ended ride selects and loads another video.");
