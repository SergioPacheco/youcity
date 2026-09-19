#!/usr/bin/env node

import assert from "node:assert/strict";

const mockWindow = {
  dataLayer: [],
  localStorage: {
    store: new Map(),
    getItem(key) { return this.store.get(key) || null; },
    setItem(key, value) { this.store.set(key, value); },
    clear() { this.store.clear(); }
  },
  YOUCITY_AFFILIATE_CONFIG: { debug: false },
  location: { hostname: "localhost" },
  document: {
    readyState: "complete",
    body: { appendChild: () => {} },
    getElementById: () => null,
    querySelector: () => null,
    addEventListener: () => {},
    createElement: (tag) => ({
      tagName: tag.toUpperCase(),
      setAttribute: () => {},
      getAttribute: () => null,
      classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
      style: {},
      appendChild: () => {},
      remove: () => {},
      hidden: false,
      querySelector: () => null,
      innerHTML: "",
      addEventListener: () => {}
    }),
    querySelectorAll: () => []
  },
  addEventListener: () => {}
};

global.window = mockWindow;
global.document = mockWindow.document;
global.navigator = { userAgent: "test" };
global.localStorage = mockWindow.localStorage;
global.dataLayer = [];

import { 
  CONSENT_STORAGE_KEY, 
  CONSENT_VERSION, 
  DEFAULT_CONSENT,
  getDataLayer,
  pushDefaultConsentToDataLayer,
  pushConsentToDataLayer,
  readStoredConsent,
  writeStoredConsent,
  hasValidStoredConsent,
  initializeConsentMode,
  initializeYouCityConsent,
  applyConsent,
  acceptAll,
  rejectAll,
  setAnalyticsConsent,
  setAdvertisingConsent,
  getCurrentConsent,
  shouldShowBanner
} from "../src/integrations/consent.mjs";

function resetTestEnvironment() {
  mockWindow.dataLayer = [];
  mockWindow.localStorage.clear();
  mockWindow.YOUCITY_CONSENT = undefined;
  delete mockWindow.gtag;
  delete mockWindow.__YOUCITY_CONSENT_DEFAULT__;
}

function runTest(name, fn) {
  try {
    resetTestEnvironment();
    fn();
    console.log(`  ✓ ${name}`);
  } catch (error) {
    console.log(`  ✗ ${name}: ${error.message}`);
    throw error;
  }
}

console.log("Running Consent Mode v2 unit tests...\n");

// Test 1: Default consent state
runTest("Default consent state is denied for all categories", () => {
  initializeConsentMode(mockWindow);
  const events = mockWindow.dataLayer.filter(e => e.event === "default_consent");
  assert.ok(events.length > 0, "Default consent should be pushed to dataLayer");
  const consent = events[0].consent;
  assert.equal(consent.ad_storage, "denied");
  assert.equal(consent.analytics_storage, "denied");
  assert.equal(consent.ad_user_data, "denied");
  assert.equal(consent.ad_personalization, "denied");
});

// Test 2: Accept all
runTest("Accept all grants all consent and persists", () => {
  const consent = acceptAll(mockWindow);
  assert.equal(consent.ad_storage, "granted");
  assert.equal(consent.analytics_storage, "granted");
  assert.equal(consent.ad_user_data, "granted");
  assert.equal(consent.ad_personalization, "granted");
  
  const stored = JSON.parse(mockWindow.localStorage.getItem(CONSENT_STORAGE_KEY));
  assert.ok(stored, "Consent should be persisted");
  assert.equal(stored.version, CONSENT_VERSION);
  assert.equal(stored.consent.ad_storage, "granted");
});

// Test 3: Reject all
runTest("Reject all denies all consent", () => {
  const consent = rejectAll(mockWindow);
  assert.equal(consent.ad_storage, "denied");
  assert.equal(consent.analytics_storage, "denied");
  assert.equal(consent.ad_user_data, "denied");
  assert.equal(consent.ad_personalization, "denied");
});

// Test 4: Analytics-only consent
runTest("Analytics-only consent works correctly", () => {
  setAnalyticsConsent(true, mockWindow);
  setAdvertisingConsent(false, mockWindow);
  
  const consent = getCurrentConsent(mockWindow);
  assert.equal(consent.analytics_storage, "granted");
  assert.equal(consent.ad_storage, "denied");
  assert.equal(consent.ad_user_data, "denied");
  assert.equal(consent.ad_personalization, "denied");
});

// Test 5: Persisted preferences - subsequent visit
runTest("Persisted preferences are applied on subsequent visit", () => {
  mockWindow.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify({
    version: CONSENT_VERSION,
    consent: {
      ad_storage: "granted",
      analytics_storage: "granted",
      ad_user_data: "granted",
      ad_personalization: "granted"
    },
    timestamp: Date.now()
  }));
  
  initializeYouCityConsent(mockWindow);
  const events = mockWindow.dataLayer.filter(e => e.event === "consent_update");
  assert.ok(events.length > 0, "Stored consent should be applied");
  const consent = events[events.length - 1].consent;
  assert.equal(consent.ad_storage, "granted");
  assert.equal(consent.analytics_storage, "granted");
});

// Test 6: Consent update behavior
runTest("Consent updates work correctly", () => {
  initializeConsentMode(mockWindow);
  
  let consent = getCurrentConsent(mockWindow);
  assert.equal(consent.ad_storage, "denied");
  assert.equal(consent.analytics_storage, "denied");
  
  setAnalyticsConsent(true, mockWindow);
  consent = getCurrentConsent(mockWindow);
  assert.equal(consent.analytics_storage, "granted");
  assert.equal(consent.ad_storage, "denied");
  
  setAdvertisingConsent(true, mockWindow);
  consent = getCurrentConsent(mockWindow);
  assert.equal(consent.ad_storage, "granted");
  assert.equal(consent.ad_user_data, "granted");
  assert.equal(consent.ad_personalization, "granted");
  assert.equal(consent.analytics_storage, "granted");
  
  setAdvertisingConsent(false, mockWindow);
  consent = getCurrentConsent(mockWindow);
  assert.equal(consent.ad_storage, "denied");
  assert.equal(consent.ad_user_data, "denied");
  assert.equal(consent.ad_personalization, "denied");
  assert.equal(consent.analytics_storage, "granted");
});

// Test 7: Should show banner when no valid consent
runTest("Banner should show when no valid consent exists", () => {
  assert.equal(shouldShowBanner(mockWindow), true);
});

// Test 8: Should not show banner when valid consent exists
runTest("Banner should not show when valid consent exists", () => {
  mockWindow.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify({
    version: CONSENT_VERSION,
    consent: {
      ad_storage: "granted",
      analytics_storage: "granted",
      ad_user_data: "granted",
      ad_personalization: "granted"
    },
    timestamp: Date.now()
  }));
  assert.equal(shouldShowBanner(mockWindow), false);
});

// Test 9: Old version consent is ignored
runTest("Old version consent is ignored", () => {
  mockWindow.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify({
    version: 0,
    consent: {
      ad_storage: "granted",
      analytics_storage: "granted",
      ad_user_data: "granted",
      ad_personalization: "granted"
    },
    timestamp: Date.now()
  }));
  assert.equal(hasValidStoredConsent(mockWindow), false);
});

// Test 10: Invalid consent data is ignored
runTest("Invalid consent data is ignored", () => {
  mockWindow.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify({
    version: CONSENT_VERSION,
    consent: {
      ad_storage: "invalid",
      analytics_storage: "granted"
    },
    timestamp: Date.now()
  }));
  assert.equal(hasValidStoredConsent(mockWindow), false);
});

// Test 11: dataLayer push functions
runTest("pushDefaultConsentToDataLayer pushes correct event", () => {
  pushDefaultConsentToDataLayer(mockWindow);
  const events = mockWindow.dataLayer.filter(e => e.event === "default_consent");
  assert.equal(events.length, 1);
  assert.equal(events[0].consent.ad_storage, "denied");
});

runTest("pushConsentToDataLayer pushes correct event", () => {
  pushConsentToDataLayer({ ad_storage: "granted", analytics_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" }, mockWindow);
  const events = mockWindow.dataLayer.filter(e => e.event === "consent_update");
  assert.equal(events.length, 1);
  assert.equal(events[0].consent.ad_storage, "granted");
});

// Test 12: writeStoredConsent returns true on success
runTest("writeStoredConsent returns true on success", () => {
  const result = writeStoredConsent({
    ad_storage: "granted",
    analytics_storage: "granted",
    ad_user_data: "granted",
    ad_personalization: "granted"
  }, mockWindow);
  assert.equal(result, true);
});

// Test 13: native Consent Mode API via gtag
runTest("initializeConsentMode forwards default via gtag when available", () => {
  const calls = [];
  mockWindow.gtag = (...args) => { calls.push(args); };
  initializeConsentMode(mockWindow);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "consent");
  assert.equal(calls[0][1], "default");
  assert.equal(calls[0][2].ad_storage, "denied");
  assert.equal(calls[0][2].analytics_storage, "denied");
  assert.equal(calls[0][2].ad_user_data, "denied");
  assert.equal(calls[0][2].ad_personalization, "denied");
});

runTest("acceptAll forwards granted update via gtag", () => {
  const calls = [];
  mockWindow.gtag = (...args) => { calls.push(args); };
  acceptAll(mockWindow);
  const update = calls.find((args) => args[0] === "consent" && args[1] === "update");
  assert.ok(update, "gtag consent update should be called");
  assert.equal(update[2].ad_storage, "granted");
  assert.equal(update[2].analytics_storage, "granted");
});

runTest("falls back to dataLayer array form without gtag", () => {
  initializeConsentMode(mockWindow);
  const native = mockWindow.dataLayer.find(
    (entry) => Array.isArray(entry) && entry[0] === "consent" && entry[1] === "default"
  );
  assert.ok(native, "dataLayer should contain a native consent default entry");
  assert.equal(native[2].analytics_storage, "denied");
});

// Test 14: sync snippet guard (index.html sets __YOUCITY_CONSENT_DEFAULT__)
runTest("skips redundant default/update when sync snippet already applied state", () => {
  mockWindow.__YOUCITY_CONSENT_DEFAULT__ = { ...DEFAULT_CONSENT };
  initializeYouCityConsent(mockWindow);
  assert.equal(
    mockWindow.dataLayer.filter((e) => e.event === "default_consent").length,
    0,
    "Should not re-push default when the sync snippet already set it"
  );
  assert.equal(
    mockWindow.dataLayer.filter((e) => e.event === "consent_update").length,
    0,
    "Should not push update when stored state equals the sync default"
  );
});

runTest("still pushes update when stored consent differs from sync default", () => {
  mockWindow.__YOUCITY_CONSENT_DEFAULT__ = { ...DEFAULT_CONSENT };
  mockWindow.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify({
    version: CONSENT_VERSION,
    consent: {
      ad_storage: "granted",
      analytics_storage: "granted",
      ad_user_data: "granted",
      ad_personalization: "granted"
    },
    timestamp: Date.now()
  }));
  initializeYouCityConsent(mockWindow);
  const events = mockWindow.dataLayer.filter((e) => e.event === "consent_update");
  assert.equal(events.length, 1);
  assert.equal(events[0].consent.ad_storage, "granted");
});

// Test 15: banner actually becomes visible (regression: base CSS starts hidden)
runTest("banner receives is-visible state so it actually displays", () => {
  const added = [];
  const origCreate = mockWindow.document.createElement;
  mockWindow.document.createElement = (tag) => {
    const el = origCreate(tag);
    el.classList.add = (cls) => { added.push(cls); };
    return el;
  };
  mockWindow.requestAnimationFrame = (cb) => { cb(); return 0; };
  try {
    initializeYouCityConsent(mockWindow);
  } finally {
    mockWindow.document.createElement = origCreate;
    delete mockWindow.requestAnimationFrame;
  }
  assert.ok(added.includes("is-visible"), "banner should get the is-visible class");
});

console.log("\nAll Consent Mode v2 unit tests passed! 🎉");