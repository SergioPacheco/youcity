# YouCity performance pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Reduce YouCity's mobile startup cost while preserving ride autoplay, city browsing, travel fallback, and generated-asset behavior.

**Architecture:** Keep the current composition root. Add one focused loader for the third-party Stay22 script, delay only initial mobile player creation, render the city grid only when its drawer is useful, and use the build's existing query-string versioning to make first-party static assets immutable.

**Tech Stack:** Native ES modules, browser DOM APIs, Cloudflare Pages _headers, Node.js assertion scripts, npm scripts, and the existing static build.

**Spec:** docs/superpowers/specs/2026-09-19-performance-pass-design.md

## Global Constraints

- Preserve muted autoplay, video switching, autoplay fallback, error handling, and desktop startup.
- createVideoController.startPlayback() remains the public playback entry point.
- cityBrowser.renderGrid() remains the renderer; the drawer-open hook owns the first catalog render.
- Stay22 loading is idempotent and returns a promise; travel surfaces tolerate provider failure and retain fallback commerce.
- Keep APIs, production secrets, catalog data, autoplay, YouTube, travel monetization, city search, and the catalog.
- Keep query-string asset versioning; do not cache HTML or /api/*.
- Do not minify or rewrite the JavaScript/CSS architecture in this pass.

## Review Focus

- Desktop startup remains immediate when matchMedia reports a desktop viewport; test the desktop branch.
- A mobile gesture cancels the delay and creates exactly one player; test timer cancellation and repeated calls.
- Closed-drawer city selection does not rebuild the catalog; test the source contract and existing drawer reset behavior.
- Stay22 failure/retry and duplicate calls do not block the guide or append duplicate scripts; test both loader outcomes.
- Versioned CSS, JavaScript, and module assets are immutable while HTML/API behavior stays unchanged; test all header declarations.

## File Map

- Modify src/player/video-controller.mjs and src/app/bootstrap.mjs for startup scheduling, poster, and grid visibility.
- Create src/features/travel/stay22-loader.mjs; modify travel-controller.mjs and index.html for deferred external loading.
- Modify styles.css and _headers for accessibility hit areas and caching.
- Add scripts/test-startup-performance.mjs and scripts/test-stay22-loader.mjs; extend test-video-playback.mjs.
- Update scripts/build-static.js, scripts/test-architecture.mjs, and package.json for the new module/tests.

### Task 1: Delay mobile video initialization without changing playback semantics

**Files:**
- Modify: src/player/video-controller.mjs:8-198
- Modify: src/app/bootstrap.mjs:37-58
- Test: scripts/test-video-playback.mjs

**Interfaces:**
- Consumes: existing controller arguments, window.matchMedia, and config.MOBILE_VIDEO_START_DELAY.
- Produces: unchanged startPlayback(options = {}); userGesture true cancels the internal delay and starts immediately.

- [ ] Step 1: Add failing tests.

Refactor the existing fake-controller setup in scripts/test-video-playback.mjs to accept mobile and startDelay. Supply window.matchMedia: () => ({ matches: mobile }) and config.MOBILE_VIDEO_START_DELAY: startDelay. Add:

~~~js
const mobile = createController({ mobile: true, startDelay: 20 });
mobile.startPlayback();
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(fakePlayer, undefined);
await new Promise((resolve) => setTimeout(resolve, 25));
assert.deepEqual(fakePlayer.loadedIds, ["walk-current"]);
mobile.destroy();

const gesture = createController({ mobile: true, startDelay: 40 });
gesture.startPlayback();
gesture.startPlayback({ userGesture: true });
await new Promise((resolve) => setTimeout(resolve, 0));
assert.deepEqual(fakePlayer.loadedIds, ["walk-current"]);
await new Promise((resolve) => setTimeout(resolve, 50));
assert.deepEqual(fakePlayer.loadedIds, ["walk-current"]);
gesture.destroy();
~~~

Keep the existing desktop ended-ride assertions with matchMedia false.

- [ ] Step 2: Run node scripts/test-video-playback.mjs; expected FAIL because mobile currently initializes immediately.

- [ ] Step 3: Implement the scheduler.

Add runtime.startTimer, isMobileViewport(), and clearStartupTimers(). Clear startTimer and the pre-session changeTimer before startup. Keep updateVideo unchanged. The core contract is:

~~~js
function beginPlayback() {
  runtime.startTimer = null;
  updateVideo(getCurrentCity(), { immediate: true });
}

function startPlayback(options = {}) {
  if (!getCurrentRide()) return onNoRide();
  const userGesture = options.userGesture === true;
  if (userGesture) {
    state.videoUserGesture = true;
    radioController?.initializeForUserGesture?.();
  }
  if (state.playbackSessionStarted) {
    if (userGesture && !playerManager.getCurrentVideoId()) {
      clearStartupTimers();
      return beginPlayback();
    }
    return command("playVideo");
  }
  state.playbackSessionStarted = true;
  clearStartupTimers();
  if (!userGesture && isMobileViewport()) {
    runtime.startTimer = setTimeout(beginPlayback, Math.max(0, Number(config.MOBILE_VIDEO_START_DELAY) || 0));
    return;
  }
  beginPlayback();
}
~~~

Clear startTimer in destroy(). Add MOBILE_VIDEO_START_DELAY: 1000 to CONFIG. Desktop stays immediate.

- [ ] Step 4: Run node scripts/test-video-playback.mjs; expected PASS for desktop, delayed mobile, immediate gesture, and ended-ride fallback.

- [ ] Step 5: Commit:

~~~bash
git add src/player/video-controller.mjs src/app/bootstrap.mjs scripts/test-video-playback.mjs
git commit -m "perf: defer mobile video startup"
~~~

### Task 2: Defer the city catalog grid until the drawer is visible

**Files:**
- Modify: src/app/bootstrap.mjs:600-604, 790-830, 991-995
- Create: scripts/test-startup-performance.mjs
- Test: scripts/test-city-browser-reset.mjs (run unchanged)

**Interfaces:**
- Consumes: layers-controller onBeforeDrawerOpen and city-browser resetForOpen.
- Produces: local isCityDrawerOpen() guarding selection refresh; public renderGrid remains unchanged.

- [ ] Step 1: Add the failing source contract:

~~~js
const bootstrap = readFileSync(resolve(root, "src/app/bootstrap.mjs"), "utf8");
const selectCity = bootstrap.slice(bootstrap.indexOf("function selectCity"), bootstrap.indexOf("function selectRandomCity"));
const initialization = bootstrap.slice(bootstrap.indexOf("// Inicializa UI"), bootstrap.indexOf("// Configura event listeners"));
assert.match(selectCity, /isCityDrawerOpen\(\)\s*&&\s*renderGrid\(elements\.search\.value\)/);
assert.doesNotMatch(initialization, /renderGrid\(\)/);
assert.match(bootstrap, /onBeforeDrawerOpen:\s*\(\)\s*=>\s*resetForOpen\(\)/);
~~~

Run node scripts/test-startup-performance.mjs; expected FAIL on current unconditional calls.

- [ ] Step 2: Add const isCityDrawerOpen = () => elements.drawer?.classList.contains("is-open") === true near the layers controller. Keep onBeforeDrawerOpen: () => resetForOpen() because resetForOpen calls setFilter and therefore performs the first open render. Replace the selectCity call with if (isCityDrawerOpen()) renderGrid(elements.search.value); and remove only boot-time renderGrid();.

- [ ] Step 3: Run node scripts/test-startup-performance.mjs and node scripts/test-city-browser-reset.mjs; expected PASS for no boot grid, guarded refresh, and full catalog on drawer open.

- [ ] Step 4: Commit:

~~~bash
git add src/app/bootstrap.mjs scripts/test-startup-performance.mjs scripts/test-city-browser-reset.mjs
git commit -m "perf: defer city catalog rendering"
~~~

### Task 3: Defer the third-party Stay22 script while retaining fallback commerce

**Files:**
- Create: src/features/travel/stay22-loader.mjs
- Modify: src/features/travel/travel-controller.mjs:1-35, 329-365
- Modify: src/app/bootstrap.mjs:1-27, 607-623
- Modify: index.html:113-123
- Modify: scripts/build-static.js:20-92
- Modify: scripts/test-architecture.mjs
- Test: scripts/test-stay22-loader.mjs
- Modify: package.json:5-19

**Interfaces:**
- Produces: createStay22Loader({ window, document }); returned load() is Promise<boolean>, idempotent, retries after error, and appends one external script with data-youcity-provider=stay22-external.

- [ ] Step 1: Add a fake-document test in scripts/test-stay22-loader.mjs:

~~~js
const loader = createStay22Loader({ window: windowRef, document: documentRef });
const first = loader.load();
assert.equal(loader.load(), first);
assert.equal(documentRef.appended.length, 1);
assert.equal(documentRef.appended[0].src, "https://scripts.stay22.com/letmeallez.js");
assert.equal(windowRef.Stay22.params.lmaID, "6aa988f40f63b002f3d1083b");
documentRef.appended[0].listeners.load();
assert.equal(await first, true);
~~~

Use a second fixture to fire error, assert false, call load again, and assert a fresh script. Run node scripts/test-stay22-loader.mjs; expected FAIL because the module is absent.

- [ ] Step 2: Create the loader with:

~~~js
const STAY22_SCRIPT = "https://scripts.stay22.com/letmeallez.js";
const STAY22_ID = "6aa988f40f63b002f3d1083b";

export function createStay22Loader({ window, document } = {}) {
  let promise = null;
  return {
    load() {
      if (document.querySelector('script[data-youcity-provider="stay22-external"]')) return Promise.resolve(true);
      if (promise) return promise;
      window.Stay22 = window.Stay22 || {};
      window.Stay22.params = { ...(window.Stay22.params || {}), lmaID: STAY22_ID };
      promise = new Promise((resolve) => {
        const script = document.createElement("script");
        script.src = STAY22_SCRIPT;
        script.async = true;
        script.dataset.youcityProvider = "stay22-external";
        script.addEventListener("load", () => resolve(true), { once: true });
        script.addEventListener("error", () => { promise = null; resolve(false); }, { once: true });
        document.head.appendChild(script);
      });
      return promise;
    }
  };
}
~~~

Create it in bootstrap and pass loadStay22: () => stay22Loader.load() to travel-controller. Add the module to STATIC_ASSETS and architecture requiredFiles.

- [ ] Step 3: Add loadStay22 = async () => false to travel-controller. In openCityGuide start const stay22Promise = Promise.resolve(loadStay22()).catch(() => false) before city-guide loading, open the guide without awaiting that promise, then after renderTravelPlanner and ensureDiscoverCarsCatalog await it and call refreshDestinationHub(currentCity()) and renderTravelPrompts(currentCity()). Keep the existing secondary-provider refresh.

- [ ] Step 4: Remove the inline head injection of the external LetMeAllez URL from index.html. Keep the local affiliate/providers/stay22.js bottom script because it supplies local offers/fallback APIs without a third-party network request.

- [ ] Step 5: Add stay22:loader:test: node scripts/test-stay22-loader.mjs to package.json and include it in npm test after affiliate:test. Run npm run stay22:loader:test, npm run affiliate:test, node scripts/test-city-guide.mjs, and npm run architecture:test. Expected: PASS; local offers remain, external loading is deferred, and failure does not block the guide.

- [ ] Step 6: Commit:

~~~bash
git add src/features/travel/stay22-loader.mjs src/features/travel/travel-controller.mjs src/app/bootstrap.mjs index.html scripts/build-static.js scripts/test-architecture.mjs scripts/test-stay22-loader.mjs package.json
git commit -m "perf: defer Stay22 third-party script"
~~~

### Task 4: Remove the poster 404, repair accessibility findings, and update cache headers

**Files:**
- Modify: src/player/video-controller.mjs:83-88
- Modify: src/app/bootstrap.mjs:390-410
- Modify: index.html:231-234
- Modify: styles.css:169-173, 889-895
- Modify: _headers:15-21
- Modify: scripts/test-startup-performance.mjs

**Interfaces:**
- Produces: one hqdefault.jpg poster, source-link accessible name View ride source, 24px rail hit areas, and immutable first-party CSS/JS/module headers without caching HTML/API.

- [ ] Step 1: Add failing assertions:

~~~js
const video = readFileSync(resolve(root, "src/player/video-controller.mjs"), "utf8");
const html = readFileSync(resolve(root, "index.html"), "utf8");
const css = readFileSync(resolve(root, "styles.css"), "utf8");
const headers = readFileSync(resolve(root, "_headers"), "utf8");
assert.doesNotMatch(video, /maxresdefault\.jpg/);
assert.match(video, /hqdefault\.jpg/);
assert.match(html, /class="source-link"[^>]*aria-label="View ride source"/);
assert.match(bootstrap, /setAttribute\("aria-label", "View ride source"\)/);
assert.match(css, /\.rail-dot\s*\{[^}]*width:\s*24px[^}]*height:\s*24px/s);
assert.match(headers, /\/styles\.css[\s\S]*max-age=31536000, immutable/);
assert.match(headers, /\/\*\.js[\s\S]*max-age=31536000, immutable/);
assert.match(headers, /\/\*\.mjs[\s\S]*max-age=31536000, immutable/);
assert.match(headers, /\/api\/\*[\s\S]*Cache-Control: no-store/);
~~~

Run node scripts/test-startup-performance.mjs; expected FAIL on current poster, source label, rail size, and cache values.

- [ ] Step 2: Build poster URL only from hqdefault.jpg, set index.html and updateRideSourceLink success state to aria-label View ride source, and retain the no-ride label/URL/security attributes.

- [ ] Step 3: Make .rail-dot a 24px square transparent grid button with a 4px by 4px ::before visual. Move active 38px height to .rail-dot.is-active::before; mobile keeps button 24px square and active visual 28px. Preserve colors, transitions, semantics, and click handling.

- [ ] Step 4: Set _headers styles.css, /*.js, and /*.mjs to Cache-Control: public, max-age=31536000, immutable; leave image/sitemap/robots rules and /api/* Cache-Control: no-store, with no catch-all HTML cache.

- [ ] Step 5: Run node scripts/test-startup-performance.mjs; expected PASS. Commit:

~~~bash
git add src/player/video-controller.mjs src/app/bootstrap.mjs index.html styles.css _headers scripts/test-startup-performance.mjs
git commit -m "perf: improve static asset loading contracts"
~~~

### Task 5: Run complete regression and generated-output verification

**Files:**
- Modify: no source files unless a failing check identifies a concrete regression in Tasks 1-4.
- Test: npm test, static build, build-output validator, and git diff --check.

- [ ] Step 1: Run npm test; expected PASS for all existing suites plus Stay22 loader and performance contracts.

- [ ] Step 2: Run:

~~~bash
node scripts/build-static.js
npm run build:validate
~~~

Expected: versioned dist imports, the new loader in deployable assets, no eager external LetMeAllez HTML injection, and valid build output.

- [ ] Step 3: Run:

~~~bash
git diff --check
git status --short
git diff --stat HEAD~4..HEAD
~~~

Expected: no whitespace errors and no API, secret, catalog, or unrelated UI changes.

- [ ] Step 4: Run git log --oneline --decorate -5, confirm the implementation commits and clean verification state, then use finishing-development-branch to push directly to origin/main as previously requested.

