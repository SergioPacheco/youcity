#!/usr/bin/env node

import assert from "node:assert/strict";
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
const state = {
  currentMode: "walk",
  currentVideoIndex: 0,
  currentVideoId: null,
  currentSpeed: 1,
  currentQuality: "auto",
  streetSoundOn: false,
  videoUserGesture: false,
  playbackSessionStarted: false
};
const windowRef = {
  location: { origin: "http://localhost" },
  YT: {
    Player: FakeYouTubePlayer,
    PlayerState: { BUFFERING: 3, PLAYING: 1, ENDED: 0 }
  }
};

const controller = createVideoController({
  window: windowRef,
  document: { scripts: [] },
  elements: {
    videoContainer: {},
    videoShell: { classList: { add() {}, remove() {} }, dataset: {} }
  },
  state,
  config: {
    VIDEO_READY_DELAY: 0,
    VIDEO_SWITCH_DEBOUNCE: 0,
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

const originalRandom = Math.random;
Math.random = () => 0;
try {
  controller.startPlayback();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(fakePlayer.loadedIds, ["walk-current"]);

  fakePlayer.options.events.onStateChange({ data: windowRef.YT.PlayerState.ENDED });
  await new Promise((resolve) => setTimeout(resolve, 5));

  assert.equal(state.currentVideoIndex, 1);
  assert.deepEqual(fakePlayer.loadedIds, ["walk-current", "walk-next"]);
} finally {
  Math.random = originalRandom;
  controller.destroy();
}

console.log("Video playback tests passed: an ended ride selects and loads another video.");
