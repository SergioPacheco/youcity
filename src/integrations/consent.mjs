export const CONSENT_STORAGE_KEY = "youcity_consent_v1";
export const CONSENT_VERSION = 1;

export const DEFAULT_CONSENT = {
  ad_storage: "denied",
  analytics_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
};

export function getDataLayer(global = globalThis) {
  return (global.dataLayer = global.dataLayer || []);
}

const CONSENT_KEYS = ["ad_storage", "analytics_storage", "ad_user_data", "ad_personalization"];

function toConsentParams(consent = {}) {
  return {
    ad_storage: consent.ad_storage,
    analytics_storage: consent.analytics_storage,
    ad_user_data: consent.ad_user_data,
    ad_personalization: consent.ad_personalization,
  };
}

function sameConsent(a = {}, b = {}) {
  return CONSENT_KEYS.every((key) => a[key] === b[key]);
}

/**
 * Forward consent state to the native Google Consent Mode API.
 *
 * Prefers gtag('consent', command, params) — the inline snippet in index.html
 * defines a gtag stub before GTM loads, so the default is registered
 * synchronously. Falls back to the dataLayer array form
 * (["consent", command, params]), which GTM processes as a gtag command.
 *
 * The custom default_consent/consent_update dataLayer events are still pushed
 * alongside (see pushDefaultConsentToDataLayer/updateConsentMode) for
 * backwards compatibility with existing GTM triggers and tests.
 */
export function applyNativeConsent(global = globalThis, command, consent) {
  const params = toConsentParams(consent);
  try {
    if (typeof global.gtag === "function") {
      global.gtag("consent", command, params);
      return true;
    }
  } catch {
    // Fall through to the dataLayer fallback below.
  }
  try {
    getDataLayer(global).push(["consent", command, params]);
    return true;
  } catch {
    return false;
  }
}

export function pushConsentToDataLayer(consent, global = globalThis) {
  const dataLayer = getDataLayer(global);
  dataLayer.push({
    event: "consent_update",
    consent,
  });
}

export function pushDefaultConsentToDataLayer(global = globalThis) {
  const dataLayer = getDataLayer(global);
  dataLayer.push({
    event: "default_consent",
    consent: DEFAULT_CONSENT,
  });
  applyNativeConsent(global, "default", DEFAULT_CONSENT);
}

export function updateConsentMode(consent, global = globalThis) {
  const dataLayer = getDataLayer(global);
  dataLayer.push({
    event: "consent_update",
    consent,
  });
  applyNativeConsent(global, "update", consent);
}

export function readStoredConsent(global = globalThis) {
  try {
    const stored = global.localStorage?.getItem(CONSENT_STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    if (parsed.version !== CONSENT_VERSION) return null;
    return parsed.consent;
  } catch {
    return null;
  }
}

export function writeStoredConsent(consent, global = globalThis) {
  try {
    global.localStorage?.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify({ version: CONSENT_VERSION, consent, timestamp: Date.now() })
    );
    return true;
  } catch {
    return false;
  }
}

export function hasValidStoredConsent(global = globalThis) {
  const stored = readStoredConsent(global);
  if (!stored) return false;
  return (
    typeof stored.ad_storage === "string" &&
    typeof stored.analytics_storage === "string" &&
    typeof stored.ad_user_data === "string" &&
    typeof stored.ad_personalization === "string"
  );
}

export function initializeConsentMode(global = globalThis) {
  pushDefaultConsentToDataLayer(global);
}

export function applyConsent(consent, global = globalThis) {
  writeStoredConsent(consent, global);
  updateConsentMode(consent, global);
}

export function acceptAll(global = globalThis) {
  const consent = {
    ad_storage: "granted",
    analytics_storage: "granted",
    ad_user_data: "granted",
    ad_personalization: "granted",
  };
  applyConsent(consent, global);
  return consent;
}

export function rejectAll(global = globalThis) {
  const consent = {
    ad_storage: "denied",
    analytics_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  };
  applyConsent(consent, global);
  return consent;
}

export function setAnalyticsConsent(granted, global = globalThis) {
  const stored = readStoredConsent(global) || { ...DEFAULT_CONSENT };
  stored.analytics_storage = granted ? "granted" : "denied";
  applyConsent(stored, global);
  return stored;
}

export function setAdvertisingConsent(granted, global = globalThis) {
  const stored = readStoredConsent(global) || { ...DEFAULT_CONSENT };
  stored.ad_storage = granted ? "granted" : "denied";
  stored.ad_user_data = granted ? "granted" : "denied";
  stored.ad_personalization = granted ? "granted" : "denied";
  applyConsent(stored, global);
  return stored;
}

export function getCurrentConsent(global = globalThis) {
  return readStoredConsent(global) || { ...DEFAULT_CONSENT };
}

export function shouldShowBanner(global = globalThis) {
  return !hasValidStoredConsent(global);
}

function createConsentBanner(global = globalThis) {
  const document = global.document;
  if (!document) return null;

  const existing = document.getElementById("consent-banner");
  if (existing) existing.remove();

  const banner = document.createElement("div");
  banner.id = "consent-banner";
  banner.className = "consent-banner";
  banner.setAttribute("role", "dialog");
  banner.setAttribute("aria-label", "Cookie consent");
  banner.setAttribute("aria-describedby", "consent-description");
  banner.innerHTML = `
    <div class="consent-banner-content">
      <p id="consent-description" class="consent-description">
        We use cookies to enhance your experience, analyze traffic, and personalize ads.
        Learn more in our <a href="/privacy.html" style="color: #fff; text-decoration: underline;">Privacy & Cookie Policy</a>.
      </p>
      <div class="consent-actions">
        <button type="button" class="consent-btn consent-btn-secondary" id="consent-reject-all" aria-label="Reject all cookies">
          Reject all
        </button>
        <button type="button" class="consent-btn consent-btn-primary" id="consent-accept-all" aria-label="Accept all cookies">
          Accept all
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(banner);

  // The base .consent-banner style starts hidden (opacity 0, translated down).
  // Flip to the visible state on the next frames so the CSS transition plays.
  const show = () => banner.classList.add("is-visible");
  if (typeof global.requestAnimationFrame === "function") {
    global.requestAnimationFrame(() => global.requestAnimationFrame(show));
  } else {
    show();
  }

  const acceptAllBtn = banner.querySelector("#consent-accept-all");
  const rejectAllBtn = banner.querySelector("#consent-reject-all");

  function hideBanner() {
    banner.classList.remove("is-visible");
    banner.classList.add("consent-banner-hidden");
    setTimeout(() => banner.remove(), 300);
  }

  acceptAllBtn?.addEventListener("click", () => {
    acceptAll(global);
    hideBanner();
  });

  rejectAllBtn?.addEventListener("click", () => {
    rejectAll(global);
    hideBanner();
  });

  return banner;
}

function createConsentSettings(global = globalThis) {
  const document = global.document;
  if (!document) return null;

  const existing = document.getElementById("consent-settings");
  if (existing) existing.remove();

  const current = getCurrentConsent(global);
  const analyticsGranted = current.analytics_storage === "granted";
  const advertisingGranted = current.ad_storage === "granted";

  const modal = document.createElement("div");
  modal.id = "consent-settings";
  modal.className = "consent-settings";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-label", "Privacy preferences");

  modal.innerHTML = `
    <div class="consent-settings-overlay"></div>
    <div class="consent-settings-panel">
      <button
        type="button"
        class="consent-settings-close"
        id="consent-settings-close"
        aria-label="Close privacy preferences"
      >
        ×
      </button>

      <span class="consent-eyebrow">YOUCITY</span>

      <h2>Privacy preferences</h2>

      <p class="consent-settings-intro">
        Choose how YouCity may use analytics and advertising technologies.
      </p>

      <div class="consent-setting">
        <div>
          <strong>Analytics</strong>
          <p>Helps us understand how people use YouCity.</p>
        </div>
        <label class="consent-switch">
          <input
            type="checkbox"
            id="consent-analytics"
            ${analyticsGranted ? "checked" : ""}
          >
          <span class="consent-switch-slider"></span>
        </label>
      </div>

      <div class="consent-setting">
        <div>
          <strong>Advertising</strong>
          <p>Allows advertising measurement and personalization.</p>
        </div>
        <label class="consent-switch">
          <input
            type="checkbox"
            id="consent-advertising"
            ${advertisingGranted ? "checked" : ""}
          >
          <span class="consent-switch-slider"></span>
        </label>
      </div>

      <div class="consent-settings-actions">
        <button
          type="button"
          id="consent-settings-reject"
          class="consent-btn consent-btn-secondary"
          aria-label="Reject all cookies"
        >
          Reject all
        </button>

        <button
          type="button"
          id="consent-settings-save"
          class="consent-btn consent-btn-primary"
          aria-label="Save preferences"
        >
          Save preferences
        </button>
      </div>

      <button
        type="button"
        id="consent-settings-accept"
        class="consent-accept-all-link"
        aria-label="Accept all cookies"
      >
        Accept all
      </button>
    </div>
  `;

  document.body.appendChild(modal);

  // Show with animation
  const show = () => modal.classList.add("is-visible");
  if (typeof global.requestAnimationFrame === "function") {
    global.requestAnimationFrame(() => global.requestAnimationFrame(show));
  } else {
    show();
  }

  const closeBtn = modal.querySelector("#consent-settings-close");
  const rejectBtn = modal.querySelector("#consent-settings-reject");
  const saveBtn = modal.querySelector("#consent-settings-save");
  const acceptBtn = modal.querySelector("#consent-settings-accept");
  const overlay = modal.querySelector(".consent-settings-overlay");
  const analyticsCheckbox = modal.querySelector("#consent-analytics");
  const advertisingCheckbox = modal.querySelector("#consent-advertising");

  function closeSettings() {
    document.removeEventListener("keydown", handleKeyDown);
    modal.classList.remove("is-visible");
    modal.classList.add("consent-settings-hidden");
    setTimeout(() => modal.remove(), 300);
  }

  closeBtn?.addEventListener("click", closeSettings);
  overlay?.addEventListener("click", closeSettings);

  rejectBtn?.addEventListener("click", () => {
    rejectAll(global);
    closeSettings();
  });

  acceptBtn?.addEventListener("click", () => {
    acceptAll(global);
    closeSettings();
  });

  saveBtn?.addEventListener("click", () => {
    const analyticsEnabled = analyticsCheckbox?.checked ?? false;
    const advertisingEnabled = advertisingCheckbox?.checked ?? false;

    const nextConsent = {
      analytics_storage: analyticsEnabled ? "granted" : "denied",
      ad_storage: advertisingEnabled ? "granted" : "denied",
      ad_user_data: advertisingEnabled ? "granted" : "denied",
      ad_personalization: advertisingEnabled ? "granted" : "denied",
    };

    applyConsent(nextConsent, global);
    closeSettings();
  });

  // Close on ESC key
  const handleKeyDown = (event) => {
    if (event.key === "Escape") {
      closeSettings();
    }
  };
  document.addEventListener("keydown", handleKeyDown);

  return modal;
}

export function initializeYouCityConsent(global = globalThis) {
  // The synchronous inline snippet in index.html already registered the
  // consent default (stored choice or denied) via gtag before GTM loaded.
  // Only push a default here when that snippet did not run (e.g. tests).
  const syncDefault = global.__YOUCITY_CONSENT_DEFAULT__;
  if (!syncDefault) {
    initializeConsentMode(global);
  }

  if (hasValidStoredConsent(global)) {
    const consent = readStoredConsent(global);
    // Skip the redundant update when the sync snippet already applied this
    // exact state as the default.
    if (consent && !sameConsent(consent, syncDefault)) {
      updateConsentMode(consent, global);
    }
  }

  if (typeof global.document !== "undefined" && global.document.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", () => {
      if (shouldShowBanner(global)) {
        createConsentBanner(global);
      }
    });
  } else {
    if (shouldShowBanner(global)) {
      createConsentBanner(global);
    }
  }

  global.YOUCITY_CONSENT = {
    acceptAll: () => acceptAll(global),
    rejectAll: () => rejectAll(global),
    setAnalyticsConsent: (granted) => setAnalyticsConsent(granted, global),
    setAdvertisingConsent: (granted) => setAdvertisingConsent(granted, global),
    getCurrentConsent: () => getCurrentConsent(global),
    hasValidConsent: () => hasValidStoredConsent(global),
    showBanner: () => createConsentBanner(global),
    showSettings: () => createConsentSettings(global),
  };
}