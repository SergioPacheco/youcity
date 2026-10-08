// On-demand loader for the curated street-food catalog.
//
// Fetched at most once per page load and only when the STREET section is
// actually rendered. `sitePath` must be the same base-path-aware helper
// used by the rest of the app (SEO_BASE_PATH previews), never a hardcoded
// "/data/..." URL.

let catalogPromise = null;

export function loadStreetFoodCatalog({ fetchImpl = fetch, sitePath = (path) => path } = {}) {
  if (!catalogPromise) {
    catalogPromise = Promise.resolve()
      .then(() =>
        fetchImpl(sitePath("/data/street-food.json"), { headers: { accept: "application/json" } })
      )
      .then((response) => {
        if (!response?.ok) throw new Error(`Street food HTTP ${response?.status}`);
        return response.json();
      })
      .catch((error) => {
        catalogPromise = null;
        throw error;
      });
  }
  return catalogPromise;
}

export function clearStreetFoodCache() {
  catalogPromise = null;
}
