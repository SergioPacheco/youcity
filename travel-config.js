// Backwards-compatible entrypoint. The live configuration now lives in
// affiliate/affiliate-config.js and is loaded by index.html before src/main.mjs.
window.YOUCITY_TRAVEL = window.YOUCITY_AFFILIATE_CONFIG || {};
window.YOUCITY_TRAVEL_RECOMMENDATIONS = window.YOUCITY_TRAVEL;
