# YouCity SEO and Cloudflare Pages

YouCity is a static site. The build creates the deployable `dist/` directory,
including the interactive application, one prerendered HTML page per city,
`robots.txt`, `sitemap.xml`, `404.html`, `_headers`, and `_redirects`.

## Cloudflare Pages settings

Configure the Pages project with:

- Root directory: `/`
- Build command: `node scripts/build-static.js`
- Build output directory: `dist`
- Production variable: `SEO_SITE_URL=https://your-real-domain.example`

The production default URL is `https://youcity.app`. Set `SEO_SITE_URL` when
building another environment, and do not use a preview `pages.dev` URL as the
production value.

Cloudflare Pages can deploy static HTML without a framework. The build command
is only needed here to generate the city pages and SEO files.

## Generated SEO coverage

- `/` — generic YouCity landing page; the application still starts in a random city.
- `/city/<slug>` — one stable page for every catalog city; only cities with at
  least one video experience are included in the sitemap.
- Each page includes one title, description, robots directive, canonical URL,
  Open Graph tags, Twitter Card tags, H1, and JSON-LD.
- Query-string variants such as `?city=` and `?preview=` are disallowed in
  `robots.txt`; stable city paths are used for sharing and the sitemap.
- `/404.html` is a custom `noindex,follow` not-found page.

## Build and validation

```bash
SEO_SITE_URL=https://your-real-domain.example node scripts/build-static.js
node scripts/seo-check.js
```

The validator checks every generated HTML file, canonical uniqueness, required
metadata, valid JSON-LD, city-page coverage, robots, sitemap, and deployable
Cloudflare files.

## After deployment

1. Open the production home and a city URL without JavaScript and confirm that
   the title, H1, description, and city copy are present.
2. Confirm `/robots.txt` references the production `/sitemap.xml`.
3. Confirm an unknown path returns the custom 404 page with HTTP 404.
4. Submit the production sitemap in Google Search Console and Bing Webmaster
   Tools, then inspect the home and at least one city URL.

The page content remains dependent on Leaflet/OpenStreetMap, YouTube, and
public radio providers at runtime; those external media URLs are not treated
as SEO URLs. Leaflet is loaded only after the visitor opens the map. Future
hotel, flight, and car-rental links are resolved centrally through
`affiliate/affiliate-config.js` and the provider catalogs;
the active map tile provider can be changed in `map-config.js`; the map currently
renders no empty recommendation blocks.
