# Weather integration

YouCity now displays the current weather for the selected city using the
coordinates already stored in the canonical catalog (`data/catalog.json`). It
does not geocode city names at runtime.

## Data flow

1. The browser requests `/api/weather?latitude=...&longitude=...`.
2. `functions/api/weather.js` validates the coordinates and requests the
   current conditions and a three-day forecast from Open-Meteo.
3. Cloudflare/browser caches reduce repeated requests for the same city.
4. The city header shows the current temperature and a readable weather label.

During a static local preview with `python3 -m http.server`, Pages Functions
are not available. The browser then falls back to the public Open-Meteo
endpoint so the feature can still be previewed locally.

## Configuration

No API key is required for the current implementation. Open-Meteo requires
appropriate attribution and its free endpoint is intended for evaluation and
non-commercial use. Review the provider's current terms before using it in a
commercial production environment:

- [Open-Meteo documentation](https://open-meteo.com/en/docs)
- [Open-Meteo pricing and usage licence](https://open-meteo.com/en/pricing)

If traffic grows, configure the commercial customer endpoint in the server
function without exposing credentials to the browser.
