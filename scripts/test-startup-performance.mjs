#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const bootstrap = readFileSync(resolve(root, "src/app/bootstrap.mjs"), "utf8");
const selectCity = bootstrap.slice(bootstrap.indexOf("function selectCity"), bootstrap.indexOf("function selectRandomCity"));
const initialization = bootstrap.slice(bootstrap.indexOf("// Inicializa UI"), bootstrap.indexOf("// Configura event listeners"));

assert.match(selectCity, /if\s*\(isCityDrawerOpen\(\)\)\s*renderGrid\(elements\.search\.value\)/);
assert.doesNotMatch(initialization, /renderGrid\(\)/);
assert.match(bootstrap, /onBeforeDrawerOpen:\s*\(\)\s*=>\s*resetForOpen\(\)/);

const video = readFileSync(resolve(root, "src/player/video-controller.mjs"), "utf8");
const html = readFileSync(resolve(root, "index.html"), "utf8");
const css = readFileSync(resolve(root, "styles.css"), "utf8");
const headers = readFileSync(resolve(root, "_headers"), "utf8");

assert.doesNotMatch(video, /maxresdefault\.jpg/);
assert.doesNotMatch(video, /i\.ytimg\.com\/vi\/\$\{ride\.id\}\/hqdefault\.jpg/, "video loading poster should not use noisy YouTube thumbnails");
assert.match(video, /assets\/hero-saopaulo\.webp/, "video loading poster should use the curated YouCity placeholder image");
assert.match(html, /class="source-link"[^>]*aria-label="View ride source"/);
assert.match(bootstrap, /setAttribute\("aria-label", "View ride source"\)/);
assert.match(css, /\.rail-dot\s*\{[^}]*width:\s*24px[^}]*height:\s*24px/s);
assert.match(headers, /\/styles\.css\n\s+Cache-Control: public, max-age=31536000, immutable/);
assert.match(headers, /\/\*\.js\n\s+Cache-Control: public, max-age=31536000, immutable/);
assert.match(headers, /\/\*\.mjs\n\s+Cache-Control: public, max-age=31536000, immutable/);
assert.match(headers, /\/api\/\*[\s\S]*Cache-Control: no-store/);

console.log("Startup performance contracts passed: startup, poster, controls, and cache behavior are guarded.");
