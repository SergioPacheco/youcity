# YouCity Comment Assistant

The Comment Assistant is an assisted workflow inside the existing YouCity
application: analyze a YouTube URL, review detected context, generate three
standard comment alternatives locally, edit/copy/approve one, and decide
separately whether to post it. The video catalog is fixed, so generation does
not call an AI service and does not depend on a model response. It does not
publish comments automatically, process videos in bulk, schedule comments, or
bypass YouTube limits.

## Files

Created:

- `comment-assistant/core.mjs` — shared URL validation, city matching, area and
  mode detection, language heuristics, and canonical YouCity URL building.
- `comment-assistant/comments.mjs` — deterministic comment templates for the
  supported modes, languages, tones, and CTAs.
- `comment-assistant/history.mjs` — local history and city-candidate storage.
- `comment-assistant/publisher.mjs` — future OAuth publication boundary; it is
  intentionally non-functional in the MVP.
- `comment-assistant.js` — UI controller mounted in the existing modal/menu and
  the `dataLayer` analytics adapter.
- `functions/api/youtube-metadata.js` — server-side YouTube Data API adapter.
- `scripts/test-comment-assistant.mjs` — core behavior tests.

Changed:

- `index.html` — adds the Comment Assistant modal and existing overflow-menu
  entry.
- `styles.css` — adds responsive styles using the existing YouCity tokens.
- `app.js` — routes the existing overflow menu to the assistant.
- `analytics.js` — allows `language` and `tone` properties in existing GTM
  events.
- `scripts/build-static.js` — copies the browser assistant assets into `dist/`.
- `_headers` — prevents caching API responses.
- `package.json`, `.gitignore`, and `README.md` — test command, local secret
  protection, and documentation links.

## Environment variables

Set this as a Cloudflare Pages secret, never in frontend JavaScript:

```text
YOUTUBE_API_KEY=your_youtube_data_api_key
```

The browser only calls the same-origin `/api/youtube-metadata` endpoint; it
never sees the YouTube API key or any OAuth token. Comment generation happens
in `comment-assistant/comments.mjs` in the browser.

For local Cloudflare development, create an untracked `.dev.vars` file in the
repository root with the same values, then run:

```bash
node scripts/build-static.js
npx wrangler pages dev dist
```

Keep `functions/` at the project root. It is intentionally not copied into
`dist/`; Cloudflare Pages detects the root-level metadata Function and maps it
to `/api/youtube-metadata` during Pages deployment.

Use the deployed Pages project to configure production secrets. This change
does not modify production workflows or secrets.

## API configuration

Enable **YouTube Data API v3** in a Google Cloud project, create a restricted
API key, and configure its allowed API/project restrictions. The metadata
Function calls `videos.list` with `part=snippet,statistics`, which provides the
title, description, channel title, tags when exposed, thumbnails, publication
date, and public statistics.

The future publishing adapter should use Google OAuth 2.0 for the authorized
YouTube account and `commentThreads.insert` with the
`https://www.googleapis.com/auth/youtube.force-ssl` scope. The MVP intentionally
does not implement that write path; its final action is Copy or Approve.

References:

- [YouTube videos.list](https://developers.google.com/youtube/v3/docs/videos/list)
- [YouTube OAuth 2.0 for server-side web applications](https://developers.google.com/youtube/v3/guides/auth/server-side-web-apps)
- [YouTube commentThreads.insert](https://developers.google.com/youtube/v3/docs/commentThreads/insert)

## Test and build

Run the complete existing test suite plus the new assistant tests:

```bash
npm test
node scripts/build-static.js
SEO_SITE_URL=https://youcity.app node scripts/seo-check.js
```

The local history uses `localStorage` under the keys
`youcity-comment-assistant-history-v1` and
`youcity-comment-assistant-candidates-v1`. Entries include the video ID, URL,
title, detected city/country/area, mode, generated alternatives, language,
timestamp, and status (`GENERATED`, `COPIED`, `APPROVED`, or the future
`PUBLISHED`).

When a generated, copied, or approved comment exists for the current city and
mode, the existing YouCity social-share controls include that comment in the
text sent to WhatsApp, X, Facebook, and Telegram while preserving the current
YouCity URL. Without a matching history entry, sharing keeps its original
message.

## Known limitations

- City and area detection is metadata-based. It does not watch the video or
  inspect its frames, so it cannot verify details that are absent from the
  title/description.
- City matching uses only the canonical catalog. It derives safe forms from a
  catalog name itself (for example, the `NYC` acronym from `New York City`);
  unknown cities are saved only as local candidates and never receive a
  YouCity URL.
- Area detection derives nearby title/description words around the matched
  catalog city. There is no hardcoded neighborhood list because the catalog
  currently has no neighborhood dataset.
- Metadata and generation rate limits are best-effort per Cloudflare isolate;
  a durable global quota would require an external store.
- YouTube search (`Find videos`) and OAuth publication are intentionally left
  for a later phase.
