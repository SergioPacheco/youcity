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
}

export function updateConsentMode(consent, global = globalThis) {
  const dataLayer = getDataLayer(global);
  dataLayer.push({
    event: "consent_update",
    consent,
  });
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
        By clicking "Accept all", you consent to our use of cookies.
      </p>
      <div class="consent-actions">
        <button type="button" class="consent-btn consent-btn-primary" id="consent-accept-all" aria-label="Accept all cookies">
          Accept all
        </button>
        <button type="button" class="consent-btn consent-btn-secondary" id="consent-reject-all" aria-label="Reject all cookies">
          Reject all
        </button>
        <button type="button" class="consent-btn consent-btn-manage" id="consent-manage" aria-label="Manage cookie preferences">
          Manage preferences
        </button>
      </div>
    </div>
    <div class="consent-preferences" id="consent-preferences" hidden>
      <fieldset class="consent-fieldset">
        <legend>Analytics</legend>
        <p class="consent-pref-description">Help us understand how visitors interact with YouCity.</p>
        <label class="consent-toggle">
          <input type="checkbox" id="consent-analytics" ${getCurrentConsent(global).analytics_storage === "granted" ? "checked" : ""} />
          <span class="consent-toggle-slider"></span>
          <span class="consent-toggle-label">Analytics cookies</span>
        </label>
      </fieldset>
      <fieldset class="consent-fieldset">
        <legend>Advertising</legend>
        <p class="consent-pref-description">Show personalized ads based on your activity.</p>
        <label class="consent-toggle">
          <input type="checkbox" id="consent-advertising" ${getCurrentConsent(global).ad_storage === "granted" ? "checked" : ""} />
          <span class="consent-toggle-slider"></span>
          <span class="consent-toggle-label">Advertising cookies</span>
        </label>
      </fieldset>
      <div class="consent-pref-actions">
        <button type="button" class="consent-btn consent-btn-primary" id="consent-save-preferences" aria-label="Save preferences">
          Save preferences
        </button>
        <button type="button" class="consent-btn consent-btn-secondary" id="consent-back" aria-label="Back to main options">
          Back
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(banner);

  const acceptAllBtn = banner.querySelector("#consent-accept-all");
  const rejectAllBtn = banner.querySelector("#consent-reject-all");
  const manageBtn = banner.querySelector("#consent-manage");
  const savePrefsBtn = banner.querySelector("#consent-save-preferences");
  const backBtn = banner.querySelector("#consent-back");
  const analyticsCheckbox = banner.querySelector("#consent-analytics");
  const advertisingCheckbox = banner.querySelector("#consent-advertising");
  const preferencesPanel = banner.querySelector("#consent-preferences");
  const mainContent = banner.querySelector(".consent-banner-content");

  function showPreferences() {
    mainContent.hidden = true;
    preferencesPanel.hidden = false;
  }

  function showMain() {
    mainContent.hidden = false;
    preferencesPanel.hidden = true;
  }

  acceptAllBtn?.addEventListener("click", () => {
    acceptAll(global);
    hideBanner();
  });

  rejectAllBtn?.addEventListener("click", () => {
    rejectAll(global);
    hideBanner();
  });

  manageBtn?.addEventListener("click", showPreferences);

  backBtn?.addEventListener("click", showMain);

  savePrefsBtn?.addEventListener("click", () => {
    const analytics = analyticsCheckbox?.checked ?? false;
    const advertising = advertisingCheckbox?.checked ?? false;
    const stored = getCurrentConsent(global);
    stored.analytics_storage = analytics ? "granted" : "denied";
    stored.ad_storage = advertising ? "granted" : "denied";
    stored.ad_user_data = advertising ? "granted" : "denied";
    stored.ad_personalization = advertising ? "granted" : "denied";
    applyConsent(stored, global);
    hideBanner();
  });

  analyticsCheckbox?.addEventListener("change", () => {
    const current = getCurrentConsent(global);
    current.analytics_storage = analyticsCheckbox.checked ? "granted" : "denied";
  });

  advertisingCheckbox?.addEventListener("change", () => {
    const current = getCurrentConsent(global);
    const granted = advertisingCheckbox.checked;
    current.ad_storage = granted ? "granted" : "denied";
    current.ad_user_data = granted ? "granted" : "denied";
    current.ad_personalization = granted ? "granted" : "denied";
  });

  function hideBanner() {
    banner.classList.add("consent-banner-hidden");
    setTimeout(() => banner.remove(), 300);
  }

  return banner;
}

function createPrivacySettingsButton(global = globalThis) {
  const document = global.document;
  if (!document) return null;

  const existing = document.getElementById("privacy-settings-button");
  if (existing) return existing;

  const button = document.createElement("button");
  button.id = "privacy-settings-button";
  button.className = "privacy-settings-button";
  button.type = "button";
  button.setAttribute("aria-label", "Privacy & cookie settings");
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-haspopup", "dialog");
  button.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" fill="currentColor"/>
    </svg>
    <span class="privacy-settings-label">Privacy</span>
  `;

  button.addEventListener("click", () => {
    const consent = getCurrentConsent(global);
    const banner = createConsentBanner(global);
    if (banner) {
      const mainContent = banner.querySelector(".consent-banner-content");
      const preferencesPanel = banner.querySelector("#consent-preferences");
      mainContent.hidden = true;
      preferencesPanel.hidden = false;
      const analyticsCheckbox = banner.querySelector("#consent-analytics");
      const advertisingCheckbox = banner.querySelector("#consent-advertising");
      if (analyticsCheckbox) analyticsCheckbox.checked = consent.analytics_storage === "granted";
      if (advertisingCheckbox) advertisingCheckbox.checked = consent.ad_storage === "granted";
    }
  });

  return button;
}

export function initializeYouCityConsent(global = globalThis) {
  initializeConsentMode(global);

  if (hasValidStoredConsent(global)) {
    const consent = readStoredConsent(global);
    if (consent) {
      updateConsentMode(consent, global);
    }
  }

  if (typeof global.document !== "undefined" && global.document.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", () => {
      if (shouldShowBanner(global)) {
        createConsentBanner(global);
      }
      createPrivacySettingsButton(global);
    });
  } else {
    if (shouldShowBanner(global)) {
      createConsentBanner(global);
    }
    createPrivacySettingsButton(global);
  }

  global.YOUCITY_CONSENT = {
    acceptAll: () => acceptAll(global),
    rejectAll: () => rejectAll(global),
    setAnalyticsConsent: (granted) => setAnalyticsConsent(granted, global),
    setAdvertisingConsent: (granted) => setAdvertisingConsent(granted, global),
    getCurrentConsent: () => getCurrentConsent(global),
    hasValidConsent: () => hasValidStoredConsent(global),
    showBanner: () => createConsentBanner(global),
    showSettings: () => {
      const banner = createConsentBanner(global);
      if (banner) {
        const mainContent = banner.querySelector(".consent-banner-content");
        const preferencesPanel = banner.querySelector("#consent-preferences");
        mainContent.hidden = true;
        preferencesPanel.hidden = false;
      }
    },
  };
}