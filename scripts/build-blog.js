const { existsSync, mkdirSync, readFileSync, writeFileSync } = require("node:fs");
const { join, resolve } = require("node:path");
const {
  escapeHtml,
  loadBlogArticles,
  renderMarkdown
} = require("./blog-content");

const BLOG_DESCRIPTION = "Travel inspiration for discovering destinations through real city videos and local radio before the trip.";
const SOCIAL_IMAGE_ALT = "YouCity editorial cover";

function joinSitePath(sitePath, path) {
  return `${sitePath || ""}${path}`;
}

function absoluteUrl(siteUrl, sitePath, path) {
  return `${siteUrl}${joinSitePath(sitePath, path)}`;
}

function safeJsonForScript(value) {
  return JSON.stringify(value)
    .replaceAll("<", String.raw`\u003c`)
    .replaceAll(">", String.raw`\u003e`)
    .replaceAll("&", String.raw`\u0026`)
    .replaceAll("\u2028", String.raw`\u2028`)
    .replaceAll("\u2029", String.raw`\u2029`);
}

function fillTemplate(template, replacements) {
  let html = template;
  for (const [key, value] of Object.entries(replacements)) html = html.replaceAll(`{{${key}}}`, String(value));
  if (/{{[A-Z_]+}}/.test(html)) throw new Error("Blog template contains an unreplaced placeholder");
  return html;
}

function slugifyCity(value) {
  let slug = String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
  while (slug.startsWith("-")) slug = slug.slice(1);
  while (slug.endsWith("-")) slug = slug.slice(0, -1);
  return slug;
}

function formatDate(datePublished) {
  return new Intl.DateTimeFormat("en", { dateStyle: "long", timeZone: "UTC" }).format(new Date(datePublished));
}

function imageVariants(image, sitePath) {
  const match = image.match(/^(.*)-1440\.webp$/);
  if (!match) throw new Error(`Blog cover must use a -1440.webp source: ${image}`);
  const base = match[1];
  return {
    src: joinSitePath(sitePath, image),
    srcset: [
      `${joinSitePath(sitePath, `${base}-640.webp`)} 640w`,
      `${joinSitePath(sitePath, `${base}-960.webp`)} 960w`,
      `${joinSitePath(sitePath, `${base}-1440.webp`)} 1440w`
    ].join(", ")
  };
}

function coverMarkup(article, sitePath, { lazy = false } = {}) {
  const variants = imageVariants(article.image, sitePath);
  return `<img class="blog-cover__image" src="${escapeHtml(variants.src)}" srcset="${escapeHtml(variants.srcset)}" sizes="(max-width: 768px) calc(100vw - 32px), 736px" width="1440" height="960" alt="${escapeHtml(article.imageAlt)}"${lazy ? " loading=\"lazy\"" : " fetchpriority=\"high\""} />`;
}

function commonReplacements({ title, description, canonical, socialImage, socialImageAlt, jsonLd, siteUrl, sitePath, CONTENT }) {
  return {
    TITLE: escapeHtml(title),
    DESCRIPTION: escapeHtml(description),
    CANONICAL: escapeHtml(canonical),
    SOCIAL_IMAGE: escapeHtml(socialImage),
    SOCIAL_IMAGE_ALT: escapeHtml(socialImageAlt),
    JSONLD: safeJsonForScript(jsonLd),
    CSS_URL: escapeHtml(joinSitePath(sitePath, "/blog.css")),
    HOME_URL: escapeHtml(joinSitePath(sitePath, "/")),
    EXPLORE_URL: escapeHtml(joinSitePath(sitePath, "/")),
    BLOG_URL: escapeHtml(joinSitePath(sitePath, "/blog")),
    PRIVACY_URL: escapeHtml(joinSitePath(sitePath, "/privacy.html")),
    TERMS_URL: escapeHtml(joinSitePath(sitePath, "/terms.html")),
    LOGO_URL: escapeHtml(joinSitePath(sitePath, "/assets/logo.png")),
    SITE_URL: escapeHtml(siteUrl),
    CONTENT
  };
}

function renderBreadcrumb(article, siteUrl, sitePath) {
  const articleUrl = absoluteUrl(siteUrl, sitePath, `/blog/${article.slug}`);
  return `<nav class="blog-breadcrumb" aria-label="Breadcrumb"><a href="${escapeHtml(joinSitePath(sitePath, "/"))}">Home</a><span aria-hidden="true">→</span><a href="${escapeHtml(joinSitePath(sitePath, "/blog"))}">Blog</a><span aria-hidden="true">→</span><span aria-current="page">${escapeHtml(article.title)}</span></nav>`;
}

function articleJsonLd(article, relations, siteUrl, sitePath) {
  const articleUrl = absoluteUrl(siteUrl, sitePath, `/blog/${article.slug}`);
  const imageUrl = absoluteUrl(siteUrl, sitePath, article.image);
  const homeUrl = absoluteUrl(siteUrl, sitePath, "/");
  const blogUrl = absoluteUrl(siteUrl, sitePath, "/blog");
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        "@id": `${articleUrl}#article`,
        headline: article.title,
        description: article.description,
        image: [imageUrl],
        datePublished: article.datePublished,
        ...(article.dateModified ? { dateModified: article.dateModified } : {}),
        author: { "@type": "Person", name: article.author },
        publisher: { "@type": "Organization", name: "YouCity", url: homeUrl },
        mainEntityOfPage: { "@type": "WebPage", "@id": articleUrl },
        isPartOf: { "@type": "WebSite", name: "YouCity", url: homeUrl },
        inLanguage: "en"
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: homeUrl },
          { "@type": "ListItem", position: 2, name: "Blog", item: blogUrl },
          { "@type": "ListItem", position: 3, name: article.title, item: articleUrl }
        ]
      }
    ]
  };
}

function listingJsonLd(articles, siteUrl, sitePath) {
  const blogUrl = absoluteUrl(siteUrl, sitePath, "/blog");
  return {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "CollectionPage", "@id": blogUrl, name: "Travel inspiration", url: blogUrl, inLanguage: "en" },
      {
        "@type": "ItemList",
        itemListElement: articles.map((article, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: article.title,
          url: absoluteUrl(siteUrl, sitePath, `/blog/${article.slug}`)
        }))
      }
    ]
  };
}

function articleCard(article, sitePath) {
  const cardImage = imageVariants(article.image, sitePath);
  return `<article class="blog-card"><a class="blog-card__link" href="${escapeHtml(joinSitePath(sitePath, `/blog/${article.slug}`))}"><img class="blog-card__image" src="${escapeHtml(cardImage.src)}" srcset="${escapeHtml(cardImage.srcset)}" sizes="(max-width: 600px) calc(100vw - 32px), (max-width: 900px) 45vw, 30vw" width="1440" height="960" loading="lazy" alt="${escapeHtml(article.imageAlt)}" /><span class="blog-card__content"><span class="blog-card__eyebrow">${escapeHtml(formatDate(article.datePublished))}</span><span class="blog-card__title">${escapeHtml(article.title)}</span><span class="blog-card__description">${escapeHtml(article.description)}</span><span class="blog-card__read">Open article <span aria-hidden="true">↗</span></span></span></a></article>`;
}

function renderBlogIndex({ template, articles, siteUrl, sitePath = "" }) {
  const title = "Travel inspiration | YouCity";
  const canonical = absoluteUrl(siteUrl, sitePath, "/blog");
  const socialImage = absoluteUrl(siteUrl, sitePath, articles[0]?.image || "/assets/hero-saopaulo.webp");
  const content = `<section class="blog-index-intro"><p class="blog-eyebrow">YOUCITY JOURNAL</p><h1>Travel inspiration</h1><p>Discover destinations through real city videos and local radio. Start with the feeling of a place, then decide what is worth exploring in person.</p></section><section aria-labelledby="blog-list-heading"><h2 id="blog-list-heading" class="blog-section-heading">Latest stories</h2><div class="blog-grid">${articles.map((article) => articleCard(article, sitePath)).join("")}</div></section>`;
  return fillTemplate(template, commonReplacements({
    title,
    description: BLOG_DESCRIPTION,
    canonical,
    socialImage,
    socialImageAlt: SOCIAL_IMAGE_ALT,
    jsonLd: listingJsonLd(articles, siteUrl, sitePath),
    siteUrl,
    sitePath,
    CONTENT: content
  }));
}

function renderBlogPost({ template, article, relations, siteUrl, sitePath = "" }) {
  const title = `${article.title} | YouCity`;
  const canonical = absoluteUrl(siteUrl, sitePath, `/blog/${article.slug}`);
  const image = imageVariants(article.image, sitePath);
  const cityLinks = relations.cities.map((city) => `<a class="blog-cta__link" href="${escapeHtml(joinSitePath(sitePath, `/city/${slugifyCity(city.name)}`))}">${escapeHtml(article.ctaLabel || `Explore ${city.name} on YouCity`)} <span aria-hidden="true">↗</span></a>`).join("");
  const related = relations.posts.length ? `<section class="blog-related" aria-labelledby="related-heading"><h2 id="related-heading">Keep exploring</h2><div class="blog-related__grid">${relations.posts.map((relatedArticle) => articleCard(relatedArticle, sitePath)).join("")}</div></section>` : "";
  const sources = article.sources?.length ? `<section class="blog-sources" aria-labelledby="sources-heading"><h2 id="sources-heading">Sources and notes</h2><ul>${article.sources.map((source, index) => `<li><a href="${escapeHtml(source)}" target="_blank" rel="noopener noreferrer">Verified source ${index + 1} <span aria-hidden="true">↗</span></a></li>`).join("")}</ul></section>` : "";
  const content = `<article class="blog-article"><div class="blog-article__inner">${renderBreadcrumb(article, siteUrl, sitePath)}<header class="blog-article__header"><p class="blog-eyebrow">YOUCITY JOURNAL</p><h1>${escapeHtml(article.title)}</h1><p class="blog-article__description">${escapeHtml(article.description)}</p><p class="blog-article__byline">By ${escapeHtml(article.author)} · <time datetime="${escapeHtml(article.datePublished)}">${escapeHtml(formatDate(article.datePublished))}</time></p></header><figure class="blog-article__cover">${coverMarkup(article, sitePath)}<figcaption>${escapeHtml(article.imageCredit || article.imageAlt)}</figcaption></figure><div class="blog-article__body">${renderMarkdown(article.body, { sitePath, sourcePath: article.sourcePath })}</div><section class="blog-cta" aria-labelledby="blog-cta-heading"><p class="blog-eyebrow">CONTINUE THE JOURNEY</p><h2 id="blog-cta-heading">Explore the destination yourself.</h2><div class="blog-cta__links">${cityLinks}</div></section>${sources}${related}</div></article>`;
  return fillTemplate(template, commonReplacements({
    title,
    description: article.description,
    canonical,
    socialImage: absoluteUrl(siteUrl, sitePath, article.image),
    socialImageAlt: article.imageAlt,
    jsonLd: articleJsonLd(article, relations, siteUrl, sitePath),
    siteUrl,
    sitePath,
    CONTENT: content
  }));
}

function buildBlog({ rootDir, outputDir, siteUrl, sitePath = "", catalog, now = new Date() }) {
  const contentDir = resolve(rootDir, "content/blog");
  const templatesDir = resolve(rootDir, "templates");
  const blog = loadBlogArticles({ contentDir, assetRoot: rootDir, catalog, now });
  const blogOutput = join(outputDir, "blog");
  mkdirSync(blogOutput, { recursive: true });
  const indexTemplate = readFileSync(join(templatesDir, "blog-index.html"), "utf8");
  const postTemplate = readFileSync(join(templatesDir, "blog-post.html"), "utf8");
  writeFileSync(join(blogOutput, "index.html"), renderBlogIndex({ template: indexTemplate, articles: blog.published, siteUrl, sitePath }));
  for (const article of blog.published) {
    const variants = imageVariants(article.image, sitePath);
    for (const source of variants.srcset.split(", ").map((entry) => entry.split(" ")[0])) {
      if (!existsSync(resolve(outputDir, source.replace(`${sitePath}/`, "")))) {
        throw new Error(`${article.sourcePath}: generated cover variant is missing from dist: ${source}`);
      }
    }
    writeFileSync(join(blogOutput, `${article.slug}.html`), renderBlogPost({
      template: postTemplate,
      article,
      relations: blog.resolveArticleRelations(article),
      siteUrl,
      sitePath
    }));
  }
  return { articles: blog.published, urls: ["/blog", ...blog.published.map((article) => `/blog/${article.slug}`)], blog };
}

module.exports = {
  buildBlog,
  articleJsonLd,
  listingJsonLd,
  renderBlogIndex,
  renderBlogPost,
  safeJsonForScript
};
