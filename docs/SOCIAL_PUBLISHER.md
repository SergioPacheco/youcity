# YouCity Social Publisher

The publisher picks a random city from the catalog, generates an English
caption and PNG cards, and can publish them to a configured Facebook page.
Selection works without Facebook, in manual and dry-run modes.

The design mirrors the Imovue social publisher: slot grid with tolerance,
idempotency per slot, anti-duplicate window plus a remote page check,
city/country anti-repeat, weighted draw inside the top-N, feed + story
cards, and history committed back to the repo.

## Commands

From the repository root:

```bash
python3 -m venv .venv-social
source .venv-social/bin/activate
pip install -r requirements-social.txt

python tools/social/post_daily.py --city sao-paulo --generate-only
python tools/social/post_daily.py --all --dry-run
python tools/social/post_daily.py --all --generate-only
```

Files are written to `out/social/YYYY-MM-DD/world.txt`, `world.png`
(feed) and `world_story.png`. The `out/` directory is not committed.

`--city <slug>` forces a specific city (for preview/tests);
`--all` runs the normal random draw on every configured page.

## Selection and ranking

Cities without any video are skipped, as are cities published in the
last 30 days (`YOUCITY_FACEBOOK_REPOST_AFTER_DAYS`). The 0–100 score
combines ride-mode variety, catalog depth (video count), local stations,
and record completeness (coordinates, country code).

The final pick is a weighted draw by score inside the top-N (`--top-n`,
default 20). `--seed` makes the draw reproducible. Anti-repeat
(`--no-repeat-city-days`, default 14, `0` disables) penalizes candidates
whose city (×0.2) or country (×0.5) appeared in recent publications,
without excluding them. New records in `published.json` store the city
and country for this; legacy entries have their location resolved via
the catalog when possible.

## Facebook setup

Edit `social/facebook_pages.json` with names, IDs and enablement only.
Never put tokens in that file. The token lives in the GitHub Secret:

```text
FB_SYSTEM_USER_TOKEN=SYSTEM_USER_TOKEN
```

It is a single System User token (Meta Business, no expiry) with access
to every page. For local tests, create an untracked `.env` file and fill
in the token. Variables already exported in the environment take
precedence.

No other token is accepted: the code reads `FB_SYSTEM_USER_TOKEN`
exclusively. Do not create `META_PAGE_TOKEN_*`, `PAGE_TOKENS` or similar
— in any environment, file, secret or log. It is 1 secret only.

On the new Pages experience, read/publish endpoints require each page's
Page Access Token. The exchange is automatic at runtime
(`resolve_page_tokens` in `tools/social/config.py`): the publisher calls
`GET /me/accounts` with the system token and uses each page's token —
all in memory only, never writing tokens to disk, logs or the repo. If
the exchange returns empty, the code falls back to the configured token
and the scope is skipped without error. Prerequisite: the pages must be
assets of the System User in Meta Business.

The token is never printed in logs. The Graph API version can be set via
`META_GRAPH_VERSION`; the code defaults to `v23.0`. Publishing uses
`/{page_id}/photos`, sending the generated card with the caption.

Before enabling the page, validate manually:

```bash
FB_SYSTEM_USER_TOKEN='...' \
python tools/social/post_daily.py --all --dry-run
```

The registry ships with the `WORLD` page already carrying the numeric
Page ID but still `enabled: false` until the token is configured.
To go live:

1. create the Facebook page and get its numeric ID;
2. add the page to the System User assets in Meta Business;
3. set the `pageId` in `social/facebook_pages.json`, keeping
   `enabled: false`;
4. generate the post with `--generate-only` and review text and card;
5. confirm the city page already exists on the published site;
6. run an isolated test with `--city <slug> --publish --slot <HH:MM>`
   (or wait for the slot);
7. only then enable with `enabled: true`.

## Publishing strategy (single global page)

The grid is centralized in `tools/social/config.py` (`SCHEDULES`); no
schedule logic lives anywhere else. Times are always audience-local
(`YOUCITY_FACEBOOK_TIMEZONE`, default `America/Sao_Paulo` — never
UTC/server time for decisions).

| Posts/day (`YOUCITY_FACEBOOK_POSTS_PER_DAY`) | Slots |
|---|---|
| 2 | 11:30, 19:00 |
| 3 (fallback) | 10:00, 14:30, 19:30 |
| 4 (default) | 09:30, 12:30, 16:30, 20:00 |

A missing value or one outside {2,3,4} falls back to 4. The workflow fires
on every possible slot (crons in UTC) and the script publishes **at most
1 post per run**, only when "now" is inside a slot (50 min tolerance for
runner lag). Repeating the same slot on the same day is ignored by
idempotency (`scheduled_for` already published).

- **Anti-duplicate:** `YOUCITY_FACEBOOK_REPOST_AFTER_DAYS` (default 30)
  + remote check of the page's recent posts. An API failure records
  `status: error` and does **not** mark the city as published.
- **Intra-day variety:** the weighted top-20 draw penalizes a country or
  exact mode set already published today, plus the 14-day city/country
  anti-repeat.
- **Copy (English):** rotating opener per slot, `City – Country`
  location line, factual body (ride modes, station count), trackable link
  to the city page, and 4–6 hashtags (`#YouCity #VirtualTour #CityWalk
  #TravelFromHome` + city/country).
- **Records:** every attempt stores `city_slug, scheduled_for,
  published_at, timezone, post_id, url, status, error, template` — ready
  for future per-slot and per-theme performance analysis.
- **Safe testing:** `--dry-run` and `--generate-only` never touch the API
  (tokens are not even loaded); `--slot HH:MM` forces a slot for local
  tests.

## History and Action

After a successful publication, `social/published.json` stores the city,
country, page, `post_id`, date and trackable URL. The Action also queries
the page's recent posts via the Graph API, so a re-run never reuses an
already-published city.

## Stale-post cleanup

`tools/social/prune_stale.py` crosses `published.json` with the current
catalog and deletes from the page (Graph API `DELETE /{post_id}`) the
posts whose cities left the catalog. The entry is kept with
`status: removed`, `removed_at` and `remove_detail` for auditing. Preview
before applying:

```bash
python tools/social/prune_stale.py --dry-run   # list only
python tools/social/prune_stale.py             # delete for real
python tools/social/prune_stale.py --scope WORLD
```

The daily Action (`facebook-daily.yml`) runs the cleanup automatically
before publishing (with `continue-on-error`, never blocking publication)
and persists the updated history in the same commit.

## Images

Cards use a real photo of the city with a discreet text overlay —
no generated gradients as the main visual. Photos come from the
Wikipedia article's lead image (`PageImages` API, no key needed),
with author and license resolved via `imageinfo` and stored in the
committed cache `tools/.city_image_cache.json`:

```bash
python tools/social/city_image.py --city sao-paulo   # one city
python tools/social/city_image.py --all               # whole catalog
python tools/social/city_image.py --city lisbon --refresh
```

At publish time the runner downloads the cached URL into `out/` (never
committed) and renders over it; if the download fails, the city is
re-resolved, and when no photo exists the card falls back to the dark
gradient identity. Coverage is ~85% of the catalog; misses never block
publishing.

Each run generates two files: `world.png` (feed 1080×1350, 4:5 — this
is the image published on Facebook) and `world_story.png` (story
1080×1920, 9:16, for manual reuse on Instagram).

Photo layout (all factual, photo untouched above the text): the official
`assets/logo-youcity.png` lockup with a soft drop shadow + frosted
"VIRTUAL RIDE" pill on a light top scrim, then — per theme — bottom-left
stack on a bottom-heavy scrim (`premium`),
frosted light panel with dark text (`claro`), or centered giant city
name (`spotlight`). Footer with a lime rule (`Explore youcity.app`) and
a tiny photo credit on the right. The caption also credits the author
(`📷 Photo: … via Wikimedia Commons`), and every history record stores
the photo provider/author/license for auditing.

## Ad themes (anti-monotony)

Three themes with the same components (`tools/social/templates.py`); real
photos are never used:

| Theme | Look | Eligibility |
|---|---|---|
| `premium` | dark/lime base | always |
| `claro` | light background, dark text | always |
| `spotlight` | giant ride count as protagonist | only 4+ modes or beach walk |

Selection is deterministic (`hash(city_slug + date)`, weights 40/35/25)
and avoids repeating the previous day's theme on the same page. The
caption body also varies (`detailed`, `highlights`, `compact` — stable per
city, all factual). The theme goes into `published.json`, enabling future
per-theme performance comparison.

Preview before enabling (never publishes, never writes history):

```bash
python tools/social/post_daily.py --city sao-paulo --preview-templates --slot 09:30
```

Generates `world_preview_{theme}.png` per eligible theme in
`out/social/YYYY-MM-DD/`.
