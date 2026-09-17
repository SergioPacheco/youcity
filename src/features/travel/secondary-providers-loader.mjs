let providersPromise = null;

const OPTIONAL_PROVIDERS = ["expedia", "booking", "viator", "travelpayouts", "airalo", "heymondo"];

export function loadSecondaryProviders({ document, sitePath = (path) => path, assetVersion = globalThis.YOUCITY_ASSET_VERSION || "" } = {}) {
  if (providersPromise) return providersPromise;
  providersPromise = OPTIONAL_PROVIDERS.reduce((promise, provider) => promise.then(() => new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-youcity-provider="${provider}"]`);
    if (existing) { resolve(); return; }
    const script = document.createElement("script");
    const version = String(assetVersion).trim();
    const path = sitePath(`/affiliate/providers/${provider}.js`);
    script.src = `${path}${version ? `?v=${encodeURIComponent(version)}` : ""}`;
    script.async = true;
    script.dataset.youcityProvider = provider;
    script.addEventListener("load", resolve, { once: true });
    script.addEventListener("error", () => reject(new Error(`Affiliate provider ${provider} failed to load`)), { once: true });
    document.head.appendChild(script);
  })), Promise.resolve()).catch((error) => {
    providersPromise = null;
    throw error;
  });
  return providersPromise;
}
