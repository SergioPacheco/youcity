import { initializeYouCityAnalytics } from "./integrations/analytics.mjs";
import { initializeYouCityConsent } from "./integrations/consent.mjs";
import { startApplication } from "./app/bootstrap.mjs";

initializeYouCityAnalytics(window);
// Banner + updates. The consent *default* was already registered
// synchronously by the inline snippet in index.html before GTM loaded;
// this intentionally runs deferred (banner only).
initializeYouCityConsent(window);
startApplication();
