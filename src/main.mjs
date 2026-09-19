import { initializeYouCityAnalytics } from "./integrations/analytics.mjs";
import { initializeYouCityConsent } from "./integrations/consent.mjs";
import { startApplication } from "./app/bootstrap.mjs";

initializeYouCityAnalytics(window);
initializeYouCityConsent(window);
startApplication();
