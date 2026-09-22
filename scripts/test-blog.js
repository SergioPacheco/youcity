#!/usr/bin/env node

const assert = require("node:assert/strict");
const { mkdtempSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
const { tmpdir } = require("node:os");

const {
  getPublishedArticles,
  loadBlogArticles,
  parseArticleFile,
  parseFrontmatter,
  renderMarkdown,
  validateArticle,
  validateSlug
} = require("./blog-content");
const { renderBlogIndex, renderBlogPost } = require("./build-blog");

function expectFailure(label, callback, expectedText = "") {
  assert.throws(callback, (error) => {
    assert.match(error.message, /\.md:/);
    if (expectedText) assert.match(error.message, new RegExp(expectedText));
    return true;
  }, label);
}

const sourcePath = "/tmp/blog/article.md";
const validSource = `---
title: "A useful title"
slug: "a-useful-title"
description: "A clear description."
image: "/assets/blog/cover.webp"
imageAlt: "A dark editorial cover"
author: "YouCity"
datePublished: "2026-09-20T10:00:00+00:00"
relatedCities: ["london"]
relatedPosts: ["another-post"]
draft: false
sources: ["https://example.com/source"]
---

## A heading

A paragraph with **strong text**, *emphasis*, and a [city link](/city/london).

- First item
- Second item

1. One item
2. Two items

> A useful caveat.
`;

const parsed = parseFrontmatter(validSource, sourcePath);
assert.equal(parsed.frontmatter.title, "A useful title");
assert.deepEqual(parsed.frontmatter.relatedCities, ["london"]);
assert.equal(parsed.frontmatter.draft, false);
assert.match(parsed.body, /A paragraph/);

const rendered = renderMarkdown(parsed.body, { sitePath: "/youcity", sourcePath });
assert.match(rendered, /<h2>A heading<\/h2>/);
assert.match(rendered, /<strong>strong text<\/strong>/);
assert.match(rendered, /<em>emphasis<\/em>/);
assert.match(rendered, /href="\/youcity\/city\/london"/);
assert.match(rendered, /<ul>[\s\S]*<li>First item<\/li>/);
assert.match(rendered, /<ol>[\s\S]*<li>One item<\/li>/);
assert.match(rendered, /<blockquote>A useful caveat\.<\/blockquote>/);

const external = renderMarkdown("[Source](https://example.com/a)", { sourcePath });
assert.match(external, /target="_blank"/);
assert.match(external, /rel="noopener noreferrer"/);

const table = renderMarkdown("| Focus | Choice |\n| --- | --- |\n| Walk | Lisbon |", { sourcePath });
assert.match(table, /<table class="blog-table">/);
assert.match(table, /<th scope="col">Focus<\/th>/);
assert.match(table, /<td>Lisbon<\/td>/);

const escaped = renderMarkdown("Text & <word> \"quoted\"", { sourcePath });
assert.match(escaped, /Text &amp; &lt;word&gt; &quot;quoted&quot;/);

const tempDir = mkdtempSync(join(tmpdir(), "youcity-blog-parser-"));
try {
  const articlePath = join(tempDir, "article.md");
  writeFileSync(articlePath, validSource);
  const article = parseArticleFile(articlePath, { now: new Date("2026-09-21T00:00:00Z") });
  assert.equal(article.slug, "a-useful-title");
  assert.equal(article.sourcePath, articlePath);
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

expectFailure("duplicate frontmatter keys", () => parseFrontmatter(validSource.replace("title: \"A useful title\"", "title: \"A useful title\"\ntitle: \"Again\""), sourcePath), "duplicate");
expectFailure("unknown frontmatter key", () => parseFrontmatter(validSource.replace("draft: false", "unknown: true\ndraft: false"), sourcePath), "unknown");
expectFailure("unterminated frontmatter", () => parseFrontmatter(validSource.replace("---\n\n## A heading", "\n## A heading"), sourcePath), "frontmatter");
expectFailure("unsafe slug", () => validateSlug("../bad slug", sourcePath), "slug");
expectFailure("raw HTML", () => renderMarkdown("<script>alert(1)</script>", { sourcePath }), "HTML");
expectFailure("code fence", () => renderMarkdown("```js\nalert(1)\n```", { sourcePath }), "unsupported");
expectFailure("unsupported heading", () => renderMarkdown("# H1", { sourcePath }), "heading");
expectFailure("unsafe external URL", () => renderMarkdown("[bad](javascript:alert(1))", { sourcePath }), "URL");
expectFailure("malformed link", () => renderMarkdown("[bad](https://example.com", { sourcePath }), "link");
expectFailure("unsafe local URL", () => renderMarkdown("[bad](/../secret)", { sourcePath }), "URL");

expectFailure("missing required field", () => validateArticle({
  title: "Only a title"
}, { filePath: sourcePath, now: new Date("2026-09-21T00:00:00Z") }), "required");

function fixtureArticle({ slug, title = slug, draft = false, datePublished = "2026-09-20T10:00:00+00:00", relatedCities = ["london"], relatedPosts = [] }) {
  return `---
title: "${title}"
slug: "${slug}"
description: "Description for ${slug}."
image: "/assets/blog/cover.webp"
imageAlt: "Cover for ${slug}"
author: "YouCity"
datePublished: "${datePublished}"
relatedCities: ${JSON.stringify(relatedCities)}
relatedPosts: ${JSON.stringify(relatedPosts)}
draft: ${draft}
---

## ${title}

Useful article body for ${slug}.
`;
}

function createFixture(files) {
  const root = mkdtempSync(join(tmpdir(), "youcity-blog-loader-"));
  const contentDir = join(root, "content");
  const assetPath = join(root, "assets/blog");
  require("node:fs").mkdirSync(contentDir, { recursive: true });
  require("node:fs").mkdirSync(assetPath, { recursive: true });
  writeFileSync(join(assetPath, "cover.webp"), "fixture");
  for (const [name, content] of Object.entries(files)) writeFileSync(join(contentDir, name), content);
  return { root, contentDir, assetRoot: root };
}

const fixtureCatalog = [{
  name: "London",
  videos: { walk: [{ id: "video" }] },
  radios: [{ name: "Local station", url: "https://example.com/stream" }]
}];

const loaderFixture = createFixture({
  "01-public.md": fixtureArticle({ slug: "public-one", relatedPosts: ["public-two", "draft-post"] }),
  "02-public.md": fixtureArticle({ slug: "public-two", relatedPosts: ["public-one"] }),
  "03-draft.md": fixtureArticle({ slug: "draft-post", draft: true }),
  "04-future.md": fixtureArticle({ slug: "future-post", datePublished: "2099-01-01T00:00:00+00:00" })
});
try {
  const loaded = loadBlogArticles({
    contentDir: loaderFixture.contentDir,
    assetRoot: loaderFixture.assetRoot,
    catalog: fixtureCatalog,
    now: new Date("2026-09-21T00:00:00Z")
  });
  assert.equal(loaded.all.length, 4);
  assert.equal(loaded.published.length, 2);
  assert.deepEqual([...loaded.bySlug.keys()].sort(), ["public-one", "public-two"]);
  assert.deepEqual(getPublishedArticles(loaded.all, new Date("2026-09-21T00:00:00Z")).map((article) => article.slug), ["public-one", "public-two"]);
} finally {
  rmSync(loaderFixture.root, { recursive: true, force: true });
}

const relationFixture = createFixture({
  "public.md": fixtureArticle({ slug: "public-post", relatedPosts: ["draft-post"] }),
  "draft.md": fixtureArticle({ slug: "draft-post", draft: true })
});
try {
  const loaded = loadBlogArticles({ contentDir: relationFixture.contentDir, assetRoot: relationFixture.assetRoot, catalog: fixtureCatalog, now: new Date("2026-09-21T00:00:00Z") });
  const relations = loaded.resolveArticleRelations(loaded.bySlug.get("public-post"));
  assert.deepEqual(relations.posts, []);
} finally {
  rmSync(relationFixture.root, { recursive: true, force: true });
}

const missingImageFixture = createFixture({
  "missing.md": fixtureArticle({ slug: "missing-image" }).replace("/assets/blog/cover.webp", "/assets/blog/missing.webp")
});
expectFailure("missing image", () => loadBlogArticles({ contentDir: missingImageFixture.contentDir, assetRoot: missingImageFixture.assetRoot, catalog: fixtureCatalog, now: new Date("2026-09-21T00:00:00Z") }), "image");
rmSync(missingImageFixture.root, { recursive: true, force: true });

const missingCityFixture = createFixture({ "missing-city.md": fixtureArticle({ slug: "missing-city", relatedCities: ["paris"] }) });
expectFailure("missing catalog city", () => loadBlogArticles({ contentDir: missingCityFixture.contentDir, assetRoot: missingCityFixture.assetRoot, catalog: fixtureCatalog, now: new Date("2026-09-21T00:00:00Z") }), "city");
rmSync(missingCityFixture.root, { recursive: true, force: true });

const missingPostFixture = createFixture({ "missing-post.md": fixtureArticle({ slug: "missing-post", relatedPosts: ["does-not-exist"] }) });
expectFailure("missing published related post", () => loadBlogArticles({ contentDir: missingPostFixture.contentDir, assetRoot: missingPostFixture.assetRoot, catalog: fixtureCatalog, now: new Date("2026-09-21T00:00:00Z") }), "related");
rmSync(missingPostFixture.root, { recursive: true, force: true });

const duplicateFixture = createFixture({
  "one.md": fixtureArticle({ slug: "duplicate" }),
  "two.md": fixtureArticle({ slug: "duplicate" })
});
expectFailure("duplicate slug", () => loadBlogArticles({ contentDir: duplicateFixture.contentDir, assetRoot: duplicateFixture.assetRoot, catalog: fixtureCatalog, now: new Date("2026-09-21T00:00:00Z") }), "duplicate");
rmSync(duplicateFixture.root, { recursive: true, force: true });

const repositoryArticles = loadBlogArticles({
  contentDir: join(__dirname, "../content/blog"),
  assetRoot: join(__dirname, ".."),
  catalog: require("../data/catalog.json"),
  now: new Date("2026-09-21T00:00:00Z")
});
assert.equal(repositoryArticles.all.length, 17);
assert.equal(repositoryArticles.published.length, 17);
assert.equal(repositoryArticles.bySlug.size, 17);

const templateRoot = join(__dirname, "../templates");
const indexHtml = renderBlogIndex({
  template: readFileSync(join(templateRoot, "blog-index.html"), "utf8"),
  articles: repositoryArticles.published,
  siteUrl: "https://youcity.app",
  sitePath: ""
});
assert.match(indexHtml, /<!doctype html>/i);
assert.match(indexHtml, /<html lang="en">/);
assert.match(indexHtml, /<h1[^>]*>Travel inspiration<\/h1>/);
assert.match(indexHtml, /href="\/blog\/explore-a-city-virtually-before-travelling"/);
assert.match(indexHtml, /href="\/blog\/discovering-a-citys-atmosphere-through-local-radio"/);
assert.match(indexHtml, /<h2 class="blog-card__title">How to Explore a City Virtually Before Travelling<\/h2>/);
assert.match(indexHtml, /<link rel="canonical" href="https:\/\/youcity\.app\/blog\/" \/>/);
assert.match(indexHtml, /application\/ld\+json/);
assert.match(indexHtml, /googletagmanager\.com\/gtm\.js/);
assert.match(indexHtml, /GTM-M64MQRNM/);
assert.match(indexHtml, /googletagmanager\.com\/ns\.html\?id=GTM-M64MQRNM/);
assert.match(indexHtml, /gtag\("consent", "default"/);
assert.doesNotMatch(indexHtml, /src\/main\.mjs|type="module"/);

const post = repositoryArticles.published[0];
const postHtml = renderBlogPost({
  template: readFileSync(join(templateRoot, "blog-post.html"), "utf8"),
  article: post,
  relations: repositoryArticles.resolveArticleRelations(post),
  siteUrl: "https://youcity.app",
  sitePath: ""
});
assert.match(postHtml, /<main[\s\S]*<article[\s\S]*<\/article>[\s\S]*<\/main>/);
assert.match(postHtml, /<h1[^>]*>How to Explore a City Virtually Before Travelling<\/h1>/);
assert.match(postHtml, /<meta property="og:type" content="article"/);
assert.match(postHtml, /<meta property="og:image" content="https:\/\/youcity\.app\/assets\/blog\/1-1440\.webp"/);
assert.match(postHtml, /srcset="[^"]*1-640\.webp 640w/);
assert.match(postHtml, /href="\/city\/london"/);
assert.match(postHtml, /href="\/privacy\.html"/);
assert.match(postHtml, /href="\/terms\.html"/);
assert.match(postHtml, /application\/ld\+json/);
assert.match(postHtml, /googletagmanager\.com\/gtm\.js/);
assert.match(postHtml, /GTM-M64MQRNM/);
assert.match(postHtml, /googletagmanager\.com\/ns\.html\?id=GTM-M64MQRNM/);
assert.match(postHtml, /gtag\("consent", "default"/);
assert.doesNotMatch(postHtml, /src\/main\.mjs|youtube\.com\/embed|leaflet|<script[^>]+type="module"/);
assert.doesNotMatch(postHtml, /youtube\.com\/watch/);

const brandArticle = repositoryArticles.published.find((article) => article.author === "YouCity");
const brandPostHtml = renderBlogPost({
  template: readFileSync(join(templateRoot, "blog-post.html"), "utf8"),
  article: brandArticle,
  relations: repositoryArticles.resolveArticleRelations(brandArticle),
  siteUrl: "https://youcity.app",
  sitePath: ""
});
assert.match(brandPostHtml, /"@type":"Organization","name":"YouCity"/);

const homeMarkup = readFileSync(join(__dirname, "../index.html"), "utf8");
assert.doesNotMatch(homeMarkup, /class="blog-nav-link"[^>]+href="\/blog"/);
assert.doesNotMatch(homeMarkup, /class="overflow-menu-link"[^>]+href="\/blog"/);
assert.match(homeMarkup, /class="about-blog-link"[^>]+href="\/blog\/"[^>]*>[\s\S]*Open the YouCity blog/);
assert.match(homeMarkup, /href="\/privacy\.html"/);
assert.match(homeMarkup, /href="\/terms\.html"/);

console.log("Blog parser tests passed.");
