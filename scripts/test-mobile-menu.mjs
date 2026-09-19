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
assert.match(overflowMenu, /data-overflow-action="privacy"/);

const mobileCss = stylesCss.match(/@media \(max-width: 800px\) \{[\s\S]*?\n\}/g)?.at(-1) || "";
assert.match(mobileCss, /#map-button[\s\S]*#theme-button\s*\{\s*display:\s*grid;/, "World Map and Theme icons should be visible on mobile");

const citiesButton = indexHtml.match(/<button class="menu-button" id="cities-button"[\s\S]*?<\/button>/)?.[0] || "";
assert.match(citiesButton, /aria-label="Explore cities"/);
assert.match(citiesButton, /title="Explore cities"/);
assert.match(citiesButton, /<circle[^>]+cx="11"[^>]+cy="11"[^>]+r="6"/);
assert.match(stylesCss, /@media \(min-width: 801px\)[\s\S]*?#cities-button\s*\{[^}]*width:\s*44px[^}]*\}/, "Explore cities should be compact on desktop");
assert.match(stylesCss, /@media \(min-width: 801px\)[\s\S]*?#cities-button\s+span\s*\{\s*display:\s*none;/, "Explore cities label should be visually hidden on desktop");

console.log("Mobile menu tests passed: More Options is focused and World Map/Theme remain top-level mobile icons.");
