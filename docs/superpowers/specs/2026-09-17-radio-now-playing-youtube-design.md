# Radio Now Playing to YouTube Design

## Goal

Allow a user who is listening to a selected radio station to request the
current track metadata and then search for a matching YouTube music video,
without adding any initial-load requests or autoplaying video.

## Decisions

- Radio discovery remains user-initiated through the existing radio panel.
- “Identify music” is a separate explicit action and never runs on page load,
  city selection, or radio playback events.
- The browser calls same-origin Pages Functions. External stream metadata and
  YouTube API keys stay server-side.
- A station without usable metadata produces a clear fallback message.
- YouTube results are limited to three candidates and are displayed as links
  with thumbnails. The embedded player is created only after the user selects
  a candidate.
- The YouTube search endpoint uses `q`, `type=video`,
  `videoCategoryId=10`, `videoEmbeddable=true`, and
  `videoSyndicated=true`.
- Current-track metadata is best-effort: first use Radio Browser station
  resolution and then inspect ICY metadata from the stream. The directory's
  station record itself is not treated as a now-playing source.

## Components

- `src/radio/radio-now-playing.mjs`: pure metadata normalization and a
  same-origin client with request deduplication and short-lived cache.
- `src/radio/radio-youtube.mjs`: YouTube result normalization and a
  same-origin search client with request deduplication and cache.
- `src/radio/radio-media-feature.mjs`: owns the panel's identify/search/embed
  lifecycle, aborts stale requests, and renders accessible controls.
- `functions/api/radio-now-playing.js`: resolves a station through Radio
  Browser when possible and parses bounded ICY stream metadata.
- `functions/api/youtube-search.js`: validates a search query and calls
  YouTube Data API v3 with the server-side `YOUTUBE_API_KEY`.

## Fallbacks and limits

- No station URL is accepted directly by the metadata Function unless it is
  resolved from a Radio Browser station record or matches a catalog station
  allowlist.
- Requests are rate-limited per client; station discovery and YouTube search are
  cached for ten minutes, while current-track reads are never response-cached.
- Stream reads stop after a bounded number of bytes and a bounded timeout.
- Metadata may be absent, stale, a program title, or not music; the UI says so
  instead of guessing.
- YouTube results are labeled as matches, not guaranteed official videos.
- No audio fingerprinting service is introduced in this scope.

## Verification

- Unit tests cover metadata parsing/normalization, client deduplication,
  YouTube result normalization, stale request handling, and lazy embed creation.
- Existing application, architecture, build, and SEO checks remain required.
