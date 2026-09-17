// Map provider configuration. Keep the interface stable so the tile provider
// can be changed later without touching the map UI.
const MAP_CONFIG = {
  leafletCssUrl: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
  leafletJsUrl: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
  tileUrl: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: "&copy; OpenStreetMap contributors",
  maxZoom: 19
};

export { MAP_CONFIG };
export default MAP_CONFIG;
