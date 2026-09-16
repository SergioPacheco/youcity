# YouCity

Fully static immersive urban rides with local radio. There is no database, backend, login, or data collection.

The catalog currently includes 206 cities. Each city exposes only the `Drive`, `Bike`, `Walk`, `Beach Walk`, and `Drone` modes that have a valid video; the world map uses static city-center coordinates and links to the catalog's YouTube videos.

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

The build creates the home page, one crawlable `/city/<city-slug>` page per city, `robots.txt`, `sitemap.xml`, `404.html`, `_headers`, and `_redirects`. It also publishes the map coordinate/provider configuration and the empty travel-recommendation hooks. If no custom domain is configured yet, the fallback URL is `https://youcity.pages.dev`; set `SEO_SITE_URL` to the final domain before production deployment. See [docs/SEO.md](docs/SEO.md) for the release checklist.

For other static hosts, upload the generated `dist/` directory rather than the source files directly.

## Media

Videos are embedded from YouTube, the world map uses Leaflet with OpenStreetMap tiles, and radio stations are public external streams. City-specific stations are sourced from Radio Browser's directory, with the original catalog retained as a fallback. The interface therefore needs no server, but the experience depends on an internet connection and source availability. Browsers may require an initial click before playing audio.

Map tiles and travel links are configured in `map-config.js` and
`affiliate/affiliate-config.js`. DiscoverCars is catalog-driven; see
[`docs/discovercars-integration.md`](docs/discovercars-integration.md) for the
official sitemap update process and review rules. Other travel providers remain
unconfigured until their approved public affiliate URLs/IDs are added.
See [`docs/affiliate-architecture.md`](docs/affiliate-architecture.md) for the
provider contract and rollout model.

The cover image in `assets/hero-saopaulo.webp` was created specifically for the project and remains local.
