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
// Varredura sem os blocos <noscript>: fallbacks legítimos de CSS não devem
// ser confundidos com render-blocking.
const htmlActive = html.replace(/<noscript>[\s\S]*?<\/noscript>/g, "");
const css = readFileSync(resolve(root, "styles.css"), "utf8");
const headers = readFileSync(resolve(root, "_headers"), "utf8");

assert.doesNotMatch(video, /maxresdefault\.jpg/);
assert.doesNotMatch(video, /i\.ytimg\.com\/vi\/\$\{ride\.id\}\/hqdefault\.jpg/, "video loading poster should not use noisy YouTube thumbnails");
assert.match(video, /assets\/hero-saopaulo\.webp/, "video loading poster should use the curated YouCity placeholder image");
// O poster precisa ser descoberto no primeiro parse: preload + inline no HTML,
// sem depender do JS (que atrasa o updateVideo, ex. delay mobile).
assert.match(html, /<link[^>]*rel="preload"[^>]*as="image"[^>]*href="\/assets\/hero-saopaulo\.webp"/, "hero poster must be preloaded for LCP");
assert.match(html, /id="poster"[^>]*background-image/, "poster must paint on first paint without waiting for JS");
// O elemento de LCP precisa ser um <img> real (fetchpriority=high): background
// img não vira candidato de LCP de forma confiável no Chrome mobile, e o <h1>
// (povoado por JS) acabava virando o LCP em ~3.5s.
assert.match(html, /<img[^>]*id="hero-poster"[^>]*fetchpriority="high"/, "hero poster must be a real <img> so LCP is attributed to the image");
assert.match(css, /\.poster-img\s*\{[^}]*object-fit:\s*cover/, "hero <img> must cover the viewport");
// O preconnect do YouTube compete com o LCP: só após o player decidir carregar.
assert.doesNotMatch(html, /rel="preconnect"[^>]*i\.ytimg\.com/, "YouTube preconnect must be deferred until the player loads");
// Fontes não podem bloquear o primeiro paint.
assert.doesNotMatch(htmlActive, /<link[^>]*rel="stylesheet"[^>]*fonts\.googleapis\.com/, "Google Fonts CSS must not block rendering");
// styles.css é render-blocking de propósito: manter o iframe do YouTube sempre
// com a geometria bleed aplicada desde o nascimento evitou o CLS ~0.24 que o
// loading assíncrono causava quando o CSS chegava depois do iframe.
assert.match(html, /<link[^>]*rel="stylesheet"[^>]*href="\/styles\.css/, "styles.css must be loaded synchronously (single rendering source)");
// GTM é pesado (gtm.js + gtag): não pode entrar no primeiro paint.
assert.match(html, /gtm\.start/, "GTM bootstrap still emits the container start event");
assert.match(html, /addEventListener\(["']load["']/, "GTM must wait for the load event before booting");
assert.match(html, /class="source-link"[^>]*aria-label="View ride source"/);
assert.match(bootstrap, /setAttribute\("aria-label", "View ride source"\)/);
assert.match(css, /\.rail-dot\s*\{[^}]*width:\s*24px[^}]*height:\s*24px/s);
// Arquivos sem hash de conteúdo não podem ser immutable: deploys frequentes
// entregariam JS/CSS antigos do cache. TTL curto + SWR mantém PageSpeed sem
// o risco de stale permanente.
assert.match(headers, /\/styles\.css\n\s+Cache-Control: public, max-age=3600, stale-while-revalidate=86400/);
assert.match(headers, /\/\*\.js\n\s+Cache-Control: public, max-age=3600, stale-while-revalidate=86400/);
assert.match(headers, /\/\*\.mjs\n\s+Cache-Control: public, max-age=3600, stale-while-revalidate=86400/);
assert.doesNotMatch(headers, /immutable/, "immutable requires content-hashed filenames");
assert.match(headers, /\/api\/\*[\s\S]*Cache-Control: no-store/);
// Afiliados não podem bloquear o parse do HTML inicial.
for (const match of html.matchAll(/<script[^>]*src="\/affiliate\/[^"]*"[^>]*>/g)) {
  assert.match(match[0], /\bdefer\b/, `affiliate script must not block parsing: ${match[0]}`);
}
// Bootstrap inicial usa o catálogo mínimo; o completo entra após o LCP.
assert.match(bootstrap, /catalog-initial\.mjs/, "bootstrap must start from the minimal first-paint catalog");
assert.match(bootstrap, /loadFullCatalogInBackground/, "full catalog must load after first paint");
assert.match(bootstrap, /if\s*\(\s*options\.syncURL\s*!==\s*false\s*\)\s*syncURL/, "pending deep links must be able to select an initial city without rewriting the requested URL");
assert.match(bootstrap, /syncURL:\s*false/, "unresolved deep-link bootstrap selection must preserve the requested URL until the full catalog resolves");
// O player do YouTube deve esperar o `load` (fim do caminho crítico), não o
// primeiro paint: o download do player/stream competiria com TBT/LCP.
assert.match(bootstrap, /addEventListener\(["']load["'],\s*armDeferredPlayback/, "video playback must start only after the page load event");
// O player do YouTube não pode carregar antes da sessão de playback (LCP).
assert.match(video, /playbackSessionStarted/, "video controller must defer the YouTube player until playback starts");
assert.match(video, /hero-poster/, "video controller must hide (not remove) the hero <img> so the LCP candidate survives");
const packageJson = readFileSync(resolve(root, "package.json"), "utf8");
assert.match(packageJson, /"startup:performance:test":\s*"node scripts\/test-startup-performance\.mjs"/, "startup performance test must have a package script");
assert.match(packageJson, /npm run startup:performance:test/, "startup performance contract must run in npm test");
const buildStatic = readFileSync(resolve(root, "scripts/build-static.js"), "utf8");
assert.match(buildStatic, /copyStaticAssets/, "static build must copy assets through an explicit asset filter");
assert.match(buildStatic, /assets\/ad/, "unused ad image folder must be excluded from static output");

console.log("Startup performance contracts passed: startup, poster, controls, and cache behavior are guarded.");
