import { initializeYouCityAnalytics } from "./integrations/analytics.mjs";
import { startApplication } from "./app/bootstrap.mjs";

initializeYouCityAnalytics(window);
startApplication();
