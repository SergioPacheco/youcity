const STAY22_SCRIPT = "https://scripts.stay22.com/letmeallez.js";
const STAY22_ID = "6aa988f40f63b002f3d1083b";

export function createStay22Loader({ window, document } = {}) {
  let promise = null;

  function load() {
    if (promise) return promise;
    const existing = document.querySelector('script[data-youcity-provider="stay22-external"]');
    if (existing && existing.dataset.youcityStatus !== "error") return Promise.resolve(true);

    window.Stay22 = window.Stay22 || {};
    window.Stay22.params = { ...(window.Stay22.params || {}), lmaID: STAY22_ID };
    promise = new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = STAY22_SCRIPT;
      script.async = true;
      script.dataset.youcityProvider = "stay22-external";
      script.dataset.youcityStatus = "loading";
      script.addEventListener("load", () => {
        script.dataset.youcityStatus = "loaded";
        resolve(true);
      }, { once: true });
      script.addEventListener("error", () => {
        script.dataset.youcityStatus = "error";
        promise = null;
        resolve(false);
      }, { once: true });
      document.head.appendChild(script);
    });
    return promise;
  }

  return { load };
}
