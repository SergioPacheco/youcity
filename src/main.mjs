import { parseDisplayOptions } from "./core/url.mjs";
import { initializeYouCityAnalytics } from "./integrations/analytics.mjs";
import { initializeYouCityConsent } from "./integrations/consent.mjs";
import { startApplication } from "./app/bootstrap.mjs";

const displayOptions = parseDisplayOptions(window.location);
if (displayOptions.clean) document.documentElement.dataset.youcityDisplay = "clean";

initializeYouCityAnalytics(window);
initializeYouCityConsent(window);
startApplication();
