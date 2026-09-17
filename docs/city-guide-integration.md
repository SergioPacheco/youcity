# City Guide

The City Guide is a lightweight, on-demand section in the combined
“Explore city” drawer for the currently selected YouCity destination. The same
top-bar icon also exposes the existing trip-planning offers, so the feature
does not add permanent cards over the video or another top-bar action.

## Sources

- Wikipedia provides the city summary and article link.
- Wikidata's MediaWiki API provides nearby structured entities through
  `geosearch` and `wbgetentities`.
- Wikipedia geosearch is used as a fallback when Wikidata is unavailable or
  returns too few useful entities.
- Wikimedia Commons provides optional place thumbnails linked to the original
  file page, adding visual context without creating another permanent card.

The server endpoint is `functions/api/city-guide.js`. It accepts the canonical
city name, country, and catalog coordinates, validates them, limits requests,
and caches results for 24 hours. Static local previews call the public sources
directly because a plain HTTP server does not execute Cloudflare Pages
Functions.

The UI intentionally limits the list to five filtered places and keeps the
full article available through the source link. Wikipedia content is shown as
a short excerpt with a link back to the article. Commons images are optional;
when available, a small thumbnail links to its original file page.
