# YouCity

Immersive urban rides with local radio. The core experience remains static and
does not require a database or login; the optional Comment Assistant uses
Cloudflare Pages Functions only when its server-side API secrets are
configured. See [`docs/comment-assistant.md`](docs/comment-assistant.md).

The catalog currently includes 206 cities. Each city exposes only the `Drive`, `Bike`, `Walk`, `Beach Walk`, and `Drone` modes that have a valid video; the world map uses static city-center coordinates and links to the catalog's YouTube videos.

The canonical city, video and radio source is `data/catalog.json`. Run
`npm run catalog:build` after editing it to validate the records and regenerate
the browser asset `catalog.js`. Comment templates live in
`data/comment-templates.mjs` and are also deterministic local data.

## Run locally

For the quick interactive preview, serve the project root:

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

To preview the same SEO output that will be deployed to Cloudflare Pages:

```bash
node scripts/build-static.js
node scripts/seo-check.js
python3 -m http.server 4174 --directory dist
```

Validate the audited Drone catalog before publishing:

```bash
node scripts/validate-drone-catalog.js
```

The Comment Assistant MVP is documented in
[`docs/comment-assistant.md`](docs/comment-assistant.md). It adds the tool to
the existing application and requires only the server-side YouTube metadata
secret; comments are generated locally from standard templates.

Open `http://localhost:4174`. The generated city file is available at
`http://localhost:4174/city/sao-paulo.html`; Cloudflare Pages also serves it at
the extensionless URL `/city/sao-paulo` after deployment.

## Deployment

For a direct static upload, publish `dist/` after running the SEO build:

```bash
SEO_SITE_URL=https://your-domain.example node scripts/build-static.js
node scripts/seo-check.js
```

Cloudflare Pages configuration:

- Root directory: `/`
- Build command: `node scripts/build-static.js`
- Output directory: `dist`
- Production environment variable: `SEO_SITE_URL=https://your-real-domain.example`

GitHub Pages is also supported through [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml).
After pushing the repository, enable **Settings → Pages → Source: GitHub Actions**. The workflow builds
the same static output with Node.js 24 and deploys it automatically on every push to `main`.

The build creates the home page, one crawlable `/city/<city-slug>` page per city, `robots.txt`, `sitemap.xml`, `404.html`, `_headers`, and `_redirects`. It also publishes the map coordinate/provider configuration and the empty travel-recommendation hooks. The production default is `https://youcity.app`; set `SEO_SITE_URL` when building another environment. See [docs/SEO.md](docs/SEO.md) for the release checklist.

For other static hosts, upload the generated `dist/` directory rather than the source files directly.

## Media

Videos are embedded from YouTube, the world map uses Leaflet with OpenStreetMap tiles, and radio stations are public external streams. City-specific stations are sourced from Radio Browser's directory and stored in the canonical catalog. The interface therefore needs no server, but the experience depends on an internet connection and source availability. Browsers may require an initial click before playing audio.

Map tiles and travel links are configured in `map-config.js` and
`affiliate/affiliate-config.js`. DiscoverCars is catalog-driven; see
[`docs/discovercars-integration.md`](docs/discovercars-integration.md) for the
official sitemap update process and review rules. Other travel providers remain
unconfigured until their approved public affiliate URLs/IDs are added.
See [`docs/affiliate-architecture.md`](docs/affiliate-architecture.md) for the
provider contract and rollout model.

The cover image in `assets/hero-saopaulo.webp` was created specifically for the project and remains local.
