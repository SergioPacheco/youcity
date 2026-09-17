import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const requiredFiles = [
  "src/main.mjs",
  "src/app/bootstrap.mjs",
  "src/app/dom.mjs",
  "src/catalog/catalog.mjs",
  "src/integrations/analytics.mjs",
  "src/navigation/navigation-controller.mjs",
  "src/sharing/sharing-controller.mjs",
  "src/sharing/comment-share.mjs",
  "src/ui/layers-controller.mjs",
  "src/ui/city-browser.mjs",
  "src/ui/media-controls.mjs",
  "src/features/map/map-controller.mjs",
  "src/features/map/map-config.mjs",
  "src/features/city-guide/city-guide-controller.mjs",
  "src/features/travel/secondary-providers-loader.mjs",
  "src/features/travel/discovercars-locations.js",
  "affiliate/affiliate-overrides.js",
  "src/features/comment-assistant/comment-assistant-loader.mjs",
  "src/features/comment-assistant/comment-assistant-controller.mjs",
  "src/features/comment-assistant/core.mjs",
  "src/features/comment-assistant/comments.mjs",
  "src/features/comment-assistant/history.mjs",
  "src/features/comment-assistant/share-destinations.mjs",
  "src/radio/radio-controller.mjs",
  "src/radio/radio-panel.mjs",
  "src/radio/radio-browser.mjs",
  "src/radio/radio-browser-feature.mjs",
  "src/radio/radio-now-playing.mjs",
  "src/radio/radio-youtube.mjs",
  "src/radio/radio-media-feature.mjs",
  "functions/api/radio-now-playing.js",
  "functions/api/youtube-search.js",
  "functions/api/radio-stations.js"
];

for (const file of requiredFiles) {
  assert.equal(existsSync(resolve(root, file)), true, `missing architectural module: ${file}`);
}

for (const file of [
  "src/app/app-runtime.mjs",
  "src/admin/comment-assistant-loader.mjs",
  "src/map/map-controller.mjs",
  "src/city-guide/city-guide-controller.mjs",
  "src/travel/secondary-providers-loader.mjs",
  "catalog.js",
  "analytics.js",
  "map-config.js",
  "affiliate-overrides.js",
  "discovercars-locations.js",
  "travel-config.js",
  "comment-assistant.js",
  "comment-assistant/core.mjs",
  "comment-assistant/comments.mjs",
  "comment-assistant/history.mjs",
  "comment-assistant/publisher.mjs"
]) {
  assert.equal(existsSync(resolve(root, file)), false, `legacy module remains: ${file}`);
}

console.log(`Architecture layout OK (${requiredFiles.length} required modules)`);
