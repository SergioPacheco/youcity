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

console.log("Startup performance contracts passed: city catalog rendering is drawer-scoped.");
