#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [indexHtml, stylesCss] = await Promise.all([
  readFile(resolve(root, "index.html"), "utf8"),
  readFile(resolve(root, "styles.css"), "utf8")
]);

const overflowMenu = indexHtml.match(/<div class="overflow-menu" id="more-menu"[\s\S]*?<\/div>/)?.[0] || "";
for (const action of ["share", "about", "random", "map", "theme"]) {
  assert.doesNotMatch(overflowMenu, new RegExp(`data-overflow-action="${action}"`), `${action} should not be in More Options`);
}
assert.match(overflowMenu, /data-overflow-action="fullscreen"/);
assert.doesNotMatch(overflowMenu, /data-overflow-action="privacy"/, "Privacy settings should live in About YouCity");
const topbar = indexHtml.match(/<header class="topbar">[\s\S]*?<\/header>/)?.[0] || "";
assert.doesNotMatch(topbar, /id="privacy-settings-button"/, "Privacy settings should not remain in the top actions");
const aboutCard = indexHtml.match(/<div class="about-card">[\s\S]*?<!-- World map with city video links -->/)?.[0] || "";
assert.match(aboutCard, /id="privacy-settings-button"/, "Privacy settings should appear inside About YouCity");
assert.match(aboutCard, /aria-label="Privacy & cookie settings"/, "Privacy settings should retain its accessible label");

const mobileCss = stylesCss.match(/@media \(max-width: 800px\) \{[\s\S]*?\n\}/g)?.at(-1) || "";
const desktopCss = stylesCss.slice(stylesCss.indexOf("@media (min-width: 801px) {"), stylesCss.indexOf("@media (min-width: 801px) and (max-width: 1050px)"));
assert.match(mobileCss, /#map-button[\s\S]*#theme-button\s*\{\s*display:\s*grid;/, "World Map and Theme icons should be visible on mobile");

const radioSummary = indexHtml.match(/<div class="radio-summary" id="radio-summary">[\s\S]*?<\/div>/)?.[0] || "";
assert.match(radioSummary, /id="mobile-volume"/, "Minimized radio summary should include a mobile volume slider");
assert.match(radioSummary, /type="range"/, "Mobile volume control should be a sliding range input");
assert.match(radioSummary, /aria-label="Radio volume"/, "Mobile volume slider should retain an accessible label");
assert.match(stylesCss, /\.mobile-volume-control\s*\{\s*display:\s*none;/, "Mobile volume slider should be hidden outside mobile summary layouts by default");
assert.match(stylesCss, /@media \(max-width: 800px\)[\s\S]*\.radio-summary \.mobile-volume-control\s*\{[^}]*display:\s*block/, "Mobile volume slider should appear inside the minimized radio summary on mobile");
assert.match(desktopCss, /\.radio-summary \.mobile-volume-control\s*\{[^}]*display:\s*block/, "Volume slider should also appear inside the minimized radio summary on desktop");
assert.match(stylesCss, /\.player-card\.is-expanded \.radio-summary\s*\{\s*display:\s*none;/, "Summary volume slider should be hidden with the minimized summary when the radio is expanded");

const citiesButton = indexHtml.match(/<button class="menu-button" id="cities-button"[\s\S]*?<\/button>/)?.[0] || "";
assert.match(citiesButton, /aria-label="Explore cities"/);
assert.match(citiesButton, /title="Explore cities"/);
assert.match(citiesButton, /<circle[^>]+cx="11"[^>]+cy="11"[^>]+r="6"/);
assert.match(stylesCss, /@media \(min-width: 801px\)[\s\S]*?#cities-button\s*\{[^}]*width:\s*44px[^}]*\}/, "Explore cities should be compact on desktop");
assert.match(stylesCss, /@media \(min-width: 801px\)[\s\S]*?#cities-button\s+span\s*\{\s*display:\s*none;/, "Explore cities label should be visually hidden on desktop");

console.log("Mobile menu tests passed: More Options is focused and World Map/Theme remain top-level mobile icons.");
