# YouCity blog

The blog is a build-time, file-backed publishing system. It has no database,
login, comments, search, pagination, browser hydration, or production
publishing step. Public pages are generated at `/blog` and `/blog/<slug>` by
`node scripts/build-static.js`.

## Create an article

Create one Markdown file under `content/blog/`. The filename is editorial
organization only; the public URL comes from `slug`.

Required frontmatter:

```yaml
---
title: "A descriptive English title"
slug: "lowercase-words-separated-by-hyphens"
description: "A unique summary of the article."
image: "/assets/blog/article-cover-1440.webp"
imageAlt: "A precise description of the cover"
author: "Sergio Pacheco"
datePublished: "2026-09-20T10:00:00-03:00"
relatedCities: ["london"]
relatedPosts: ["another-published-slug"]
draft: false
---
```

Optional fields are `dateModified`, `sources`, `imageCredit`, and `ctaLabel`.
`dateModified` is used only for a meaningful editorial change. Dates must be
ISO dates; future articles remain out of the public build.

The local renderer supports paragraphs, H2/H3 headings, unordered and ordered
lists, blockquotes, `*emphasis*`, `**strong emphasis**`, and Markdown links.
Raw HTML, code blocks, inline images, scripts, event attributes, and non-HTTPS
external URLs are rejected. Root-relative links may not contain `..`, query
strings, or fragments. The renderer runs only during the build and never
executes article content.

## Images and credits

Put cover files under `assets/blog/`. A public article must use a local
`-1440.webp` cover plus matching `-960.webp` and `-640.webp` variants. The
build emits the three existing files in `srcset`, with explicit dimensions and
an eager first cover for LCP. Do not reference an uncommitted file.

Record source, creator, permission/license, dimensions, derivatives, and
whether the visual is documentary or illustrative in
[`docs/blog-images.md`](blog-images.md). Use descriptive alt text. Do not use
synthetic artwork as evidence of a real place; label an illustration as
editorial and non-documentary.

## Cities and related posts

`relatedCities` uses the same normalized slug as `data/catalog.json`, for
example `london`, `sao-paulo`, or `malibu`. The build fails if a city does not
exist. A public article must have at least one valid related city and receives
a contextual CTA to that city.

`relatedPosts` names another article slug. Published related posts become
links. Draft and future related posts are omitted; an unknown slug fails the
build. This prevents broken public links while allowing a draft companion.

## Drafts and publication

Set `draft: true` while an article is incomplete. Drafts are parsed and
validated, but do not appear in HTML, the listing, related links, the sitemap,
or public content assets. The initial repository contains two complete public
examples and ten structured drafts.

Before publishing:

1. verify every claim against the cited source or current catalog;
2. verify the selected video/radio source is still the intended source;
3. replace any cover placeholder and record its provenance;
4. confirm that the city offers every mode mentioned;
5. set `draft: false` and use a non-future publication date;
6. run the build and validation commands.

The build does not fetch media, sources, APIs, or images. Editorial assets must
already be versioned locally. The repository currently has seven published
articles and ten structured drafts; new manually written posts must follow the
frontmatter contract before they can be public.

## Update or rename an article

Set `dateModified` only for a meaningful editorial change. Do not update all
dates on every deploy. Treat a published slug as stable. If a change is
necessary, add a narrow permanent redirect in `_redirects` before publishing:

```text
/blog/old-slug /blog/new-slug 301
```

Do not add a wildcard blog fallback to the home page. Rebuild and confirm that
the old URL redirects, the new URL returns the article, and only the new URL
is in sitemap and canonical metadata.

## Preview and validation

```bash
node scripts/build-static.js
node scripts/seo-check.js
npm run blog:test
npm run seo:test
npm run build:validate
python3 -m http.server 4174 --directory dist
```

Open `/blog` and an article in the static preview. A plain Python server also
allows direct inspection of the generated `.html` files. Cloudflare Pages
resolves the extensionless URLs from `blog/index.html` and article files.

The build supports the same URL settings as city pages:

```bash
SEO_SITE_URL=https://preview.example SEO_BASE_PATH=/youcity node scripts/build-static.js
SEO_SITE_URL=https://preview.example SEO_BASE_PATH=/youcity node scripts/seo-check.js
```

Check canonical, navigation, legal links, cover URLs, city CTAs, related links,
JSON-LD, robots, and sitemap locations for exactly one base path. Unknown blog
slugs must not be rewritten to the home page.

## After publication

Only after the production URL is public, test representative pages in Google's
Rich Results Test and inspect the URL in Google Search Console. Submit or
refresh the production sitemap, then monitor indexing and canonical selection.
These checks cannot be completed meaningfully against an unpublished preview,
and structured data does not guarantee enhanced search results.
