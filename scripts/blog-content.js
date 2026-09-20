const { existsSync, readdirSync, readFileSync } = require("node:fs");
const { join, resolve, relative } = require("node:path");

const ALLOWED_KEYS = new Set([
  "title",
  "slug",
  "description",
  "image",
  "imageAlt",
  "author",
  "datePublished",
  "relatedCities",
  "relatedPosts",
  "draft",
  "dateModified",
  "sources",
  "imageCredit",
  "ctaLabel"
]);

const REQUIRED_KEYS = [
  "title",
  "slug",
  "description",
  "image",
  "imageAlt",
  "author",
  "datePublished",
  "relatedCities",
  "relatedPosts",
  "draft"
];

function sourceError(sourcePath, message) {
  const prefix = sourcePath ? `${sourcePath}: ` : "Blog content: ";
  return new Error(`${prefix}${message}`);
}

function requireString(value, key, sourcePath) {
  if (typeof value !== "string" || !value.trim()) {
    throw sourceError(sourcePath, `required field '${key}' must be a non-empty string`);
  }
  return value.trim();
}

function parseScalar(rawValue, key, sourcePath) {
  const value = rawValue.trim();
  if (!value) throw sourceError(sourcePath, `field '${key}' cannot be empty`);

  if (value.startsWith("[") || value.startsWith("{")) {
    if (!value.endsWith(value.startsWith("[") ? "]" : "}")) {
      throw sourceError(sourcePath, `field '${key}' contains an unterminated value`);
    }
    let parsed;
    try {
      parsed = JSON.parse(value);
    } catch {
      throw sourceError(sourcePath, `field '${key}' contains invalid JSON-like data`);
    }
    if (Array.isArray(parsed) && !parsed.every((entry) => typeof entry === "string" && entry.trim())) {
      throw sourceError(sourcePath, `field '${key}' must contain only non-empty strings`);
    }
    if (!Array.isArray(parsed)) throw sourceError(sourcePath, `field '${key}' must be an array`);
    return parsed.map((entry) => entry.trim());
  }

  if (value === "true") return true;
  if (value === "false") return false;
  if (value.startsWith('"')) {
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed !== "string" || !parsed.trim()) throw new Error("empty");
      return parsed;
    } catch {
      throw sourceError(sourcePath, `field '${key}' contains an invalid quoted string`);
    }
  }
  return value;
}

function parseFrontmatter(source, sourcePath = "") {
  const lines = String(source).replaceAll("\r\n", "\n").split("\n");
  if (lines[0] !== "---") throw sourceError(sourcePath, "frontmatter must start with ---");

  const closingIndex = lines.findIndex((line, index) => index > 0 && line === "---");
  if (closingIndex < 0) throw sourceError(sourcePath, "frontmatter is not closed with ---");

  const frontmatter = {};
  for (let index = 1; index < closingIndex; index += 1) {
    const line = lines[index];
    if (!line.trim()) continue;
    const separator = line.indexOf(":");
    if (separator <= 0 || line[0] === " " || line[0] === "\t") {
      throw sourceError(sourcePath, `invalid frontmatter line ${index + 1}`);
    }
    const key = line.slice(0, separator).trim();
    if (!ALLOWED_KEYS.has(key)) throw sourceError(sourcePath, `unknown frontmatter key '${key}'`);
    if (Object.prototype.hasOwnProperty.call(frontmatter, key)) {
      throw sourceError(sourcePath, `duplicate frontmatter key '${key}'`);
    }
    frontmatter[key] = parseScalar(line.slice(separator + 1), key, sourcePath);
  }

  return {
    frontmatter,
    body: lines.slice(closingIndex + 1).join("\n").trim()
  };
}

function validateSlug(slug, sourcePath = "") {
  if (typeof slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw sourceError(sourcePath, `slug '${slug}' is unsafe; use lowercase words separated by hyphens`);
  }
  return slug;
}

function validateDate(value, key, sourcePath) {
  const date = requireString(value, key, sourcePath);
  if (!/^\d{4}-\d{2}-\d{2}T/.test(date) || Number.isNaN(Date.parse(date))) {
    throw sourceError(sourcePath, `field '${key}' must be a valid ISO date`);
  }
  return date;
}

function validateArticle(article, { filePath = article?.sourcePath || "", now = new Date() } = {}) {
  for (const key of REQUIRED_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(article || {}, key)) {
      throw sourceError(filePath, `required field '${key}' is missing`);
    }
  }

  const normalized = { ...article };
  for (const key of ["title", "description", "image", "imageAlt", "author"]) {
    normalized[key] = requireString(normalized[key], key, filePath);
  }
  normalized.slug = validateSlug(normalized.slug, filePath);
  normalized.datePublished = validateDate(normalized.datePublished, "datePublished", filePath);
  if (normalized.dateModified !== undefined) {
    normalized.dateModified = validateDate(normalized.dateModified, "dateModified", filePath);
    if (Date.parse(normalized.dateModified) < Date.parse(normalized.datePublished)) {
      throw sourceError(filePath, "dateModified cannot be earlier than datePublished");
    }
  }
  if (typeof normalized.draft !== "boolean") throw sourceError(filePath, "field 'draft' must be true or false");
  for (const key of ["relatedCities", "relatedPosts"]) {
    if (!Array.isArray(normalized[key]) || !normalized[key].every((entry) => typeof entry === "string" && entry.trim())) {
      throw sourceError(filePath, `field '${key}' must be an array of non-empty strings`);
    }
    normalized[key] = normalized[key].map((entry) => entry.trim());
  }
  if (normalized.sources !== undefined) {
    if (!Array.isArray(normalized.sources) || !normalized.sources.every((entry) => typeof entry === "string" && /^https:\/\//.test(entry))) {
      throw sourceError(filePath, "field 'sources' must be an array of HTTPS URLs");
    }
  }
  if (normalized.imageCredit !== undefined) normalized.imageCredit = requireString(normalized.imageCredit, "imageCredit", filePath);
  if (normalized.ctaLabel !== undefined) normalized.ctaLabel = requireString(normalized.ctaLabel, "ctaLabel", filePath);
  normalized.body = String(normalized.body || "").trim();
  if (!normalized.body) throw sourceError(filePath, "article body cannot be empty");
  if (Date.parse(normalized.datePublished) > now.getTime()) normalized.isFuture = true;
  return normalized;
}

function parseArticleFile(filePath, { now = new Date() } = {}) {
  const source = readFileSync(filePath, "utf8");
  const parsed = parseFrontmatter(source, filePath);
  return validateArticle({ ...parsed.frontmatter, body: parsed.body, sourcePath: filePath }, { filePath, now });
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

function getPublishedArticles(articles, now = new Date()) {
  const timestamp = now.getTime();
  return articles.filter((article) => !article.draft && Date.parse(article.datePublished) <= timestamp);
}

function checkLocalImage(article, assetRoot) {
  if (typeof article.image !== "string" || !article.image.startsWith("/")) {
    throw sourceError(article.sourcePath, "image must be a root-relative local path");
  }
  const relativeImage = article.image.slice(1);
  const imagePath = resolve(assetRoot, relativeImage);
  const rootPath = resolve(assetRoot);
  if (relative(rootPath, imagePath).startsWith("..") || relativeImage.includes("?")) {
    throw sourceError(article.sourcePath, `image '${article.image}' is outside the local asset root`);
  }
  if (!existsSync(imagePath)) throw sourceError(article.sourcePath, `image '${article.image}' does not exist`);
}

function resolveArticleRelations(article, { catalog = [], allBySlug = new Map(), bySlug = new Map() } = {}) {
  const citiesBySlug = new Map(catalog.map((city) => [slugifyCity(city.name), city]));
  const cities = article.relatedCities.map((slug) => citiesBySlug.get(slug));
  const missingCity = article.relatedCities.find((slug) => !citiesBySlug.has(slug));
  if (missingCity) throw sourceError(article.sourcePath, `related city '${missingCity}' does not exist in the catalog`);
  if (!article.draft && !article.isFuture && !cities.length) {
    throw sourceError(article.sourcePath, "published article must relate to at least one catalog city");
  }

  const posts = [];
  for (const slug of article.relatedPosts) {
    const candidate = allBySlug.get(slug);
    if (!candidate) throw sourceError(article.sourcePath, `related post '${slug}' does not exist`);
    if (bySlug.has(slug)) posts.push(bySlug.get(slug));
  }
  return { cities, posts };
}

function loadBlogArticles({ contentDir, assetRoot, catalog = [], now = new Date() }) {
  if (!contentDir) throw new Error("Blog content directory is required");
  const files = readdirSync(contentDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => entry.name)
    .sort();
  const all = files.map((file) => {
    const article = parseArticleFile(join(contentDir, file), { now });
    checkLocalImage(article, assetRoot || resolve(contentDir, "../.."));
    return article;
  });
  const slugOwners = new Map();
  for (const article of all) {
    const owner = slugOwners.get(article.slug);
    if (owner) throw sourceError(article.sourcePath, `duplicate slug '${article.slug}' also appears in ${owner}`);
    slugOwners.set(article.slug, article.sourcePath);
  }
  const published = getPublishedArticles(all, now);
  const bySlug = new Map(published.map((article) => [article.slug, article]));
  const allBySlug = new Map(all.map((article) => [article.slug, article]));
  const relations = new Map();
  for (const article of published) {
    relations.set(article.slug, resolveArticleRelations(article, { catalog, allBySlug, bySlug }));
  }
  return {
    all,
    published,
    bySlug,
    resolveArticleRelations: (article) => relations.get(article.slug) || resolveArticleRelations(article, { catalog, allBySlug, bySlug })
  };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function markdownError(sourcePath, message) {
  throw sourceError(sourcePath, message);
}

function looksLikeRawHtml(value) {
  return /<\s*\/?\s*(script|style|iframe|object|embed|form|input|button|textarea|select|a\s|div\s|p\s|img\s)|on[a-z]+\s*=|<\s*!DOCTYPE/i.test(value);
}

function validateLinkUrl(value, sitePath, sourcePath) {
  if (!value || /[\s"'<>]/.test(value)) markdownError(sourcePath, "link URL contains invalid characters");
  if (value.startsWith("/")) {
    if (value.startsWith("//") || value.includes("..") || value.includes("?") || value.includes("#")) {
      markdownError(sourcePath, `link URL '${value}' is unsafe`);
    }
    return `${sitePath || ""}${value}`;
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    markdownError(sourcePath, `link URL '${value}' is invalid`);
  }
  if (url.protocol !== "https:") markdownError(sourcePath, `link URL '${value}' is unsafe`);
  return url.toString();
}

function renderInline(text, { sitePath = "", sourcePath = "" } = {}) {
  let output = "";
  let buffer = "";
  const flush = () => {
    if (buffer) output += escapeHtml(buffer);
    buffer = "";
  };

  for (let index = 0; index < text.length;) {
    if (text[index] === "`" || text[index] === "\\") markdownError(sourcePath, "unsupported inline Markdown syntax");
    if (text.startsWith("**", index)) {
      const end = text.indexOf("**", index + 2);
      if (end < 0) markdownError(sourcePath, "strong emphasis is not closed");
      flush();
      output += `<strong>${renderInline(text.slice(index + 2, end), { sitePath, sourcePath })}</strong>`;
      index = end + 2;
      continue;
    }
    if (text[index] === "*") {
      const end = text.indexOf("*", index + 1);
      if (end < 0) markdownError(sourcePath, "emphasis is not closed");
      flush();
      output += `<em>${renderInline(text.slice(index + 1, end), { sitePath, sourcePath })}</em>`;
      index = end + 1;
      continue;
    }
    if (text[index] === "[" && text.indexOf("](", index + 1) >= 0) {
      const separator = text.indexOf("](", index + 1);
      const end = text.indexOf(")", separator + 2);
      if (end < 0) markdownError(sourcePath, "link is not closed");
      const label = text.slice(index + 1, separator);
      const href = validateLinkUrl(text.slice(separator + 2, end), sitePath, sourcePath);
      flush();
      const external = /^https:\/\//.test(href);
      output += `<a href="${escapeHtml(href)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ""}>${renderInline(label, { sitePath, sourcePath })}</a>`;
      index = end + 1;
      continue;
    }
    if (text[index] === "<" && looksLikeRawHtml(text.slice(index))) markdownError(sourcePath, "raw HTML is not allowed");
    buffer += text[index];
    index += 1;
  }
  flush();
  return output;
}

function isUnordered(line) {
  return line.startsWith("- ") || line.startsWith("* ");
}

function isOrdered(line) {
  let index = 0;
  while (index < line.length && line[index] >= "0" && line[index] <= "9") index += 1;
  return index > 0 && line[index] === "." && line[index + 1] === " ";
}

function isBlockStart(line) {
  return line.startsWith("## ") || line.startsWith("### ") || line.startsWith("#") || isUnordered(line) || isOrdered(line) || line.startsWith("> ");
}

function renderList(lines, index, ordered, options) {
  const items = [];
  while (index < lines.length && (ordered ? isOrdered(lines[index]) : isUnordered(lines[index]))) {
    const line = lines[index];
    const content = ordered ? line.slice(line.indexOf(". ") + 2) : line.slice(2);
    items.push(`<li>${renderInline(content, options)}</li>`);
    index += 1;
  }
  return { html: `<${ordered ? "ol" : "ul"}>${items.join("")}</${ordered ? "ol" : "ul"}>`, index };
}

function renderMarkdown(markdown, { sitePath = "", sourcePath = "" } = {}) {
  const lines = String(markdown).replaceAll("\r\n", "\n").split("\n");
  const output = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }
    if (line.startsWith("``")) markdownError(sourcePath, "unsupported code blocks are not allowed");
    if (line.startsWith("# ") || line.startsWith("####") || (line.startsWith("#") && !line.startsWith("## ") && !line.startsWith("### "))) {
      markdownError(sourcePath, "only H2 and H3 headings are supported");
    }
    if (line.startsWith("## ") || line.startsWith("### ")) {
      const level = line.startsWith("### ") ? 3 : 2;
      const content = line.slice(level + 1).trim();
      if (!content) markdownError(sourcePath, "heading cannot be empty");
      output.push(`<h${level}>${renderInline(content, { sitePath, sourcePath })}</h${level}>`);
      index += 1;
      continue;
    }
    if (isUnordered(line) || isOrdered(line)) {
      const list = renderList(lines, index, isOrdered(line), { sitePath, sourcePath });
      output.push(list.html);
      index = list.index;
      continue;
    }
    if (line.startsWith("> ")) {
      const quote = [];
      while (index < lines.length && lines[index].startsWith("> ")) {
        quote.push(lines[index].slice(2));
        index += 1;
      }
      output.push(`<blockquote>${renderInline(quote.join(" "), { sitePath, sourcePath })}</blockquote>`);
      continue;
    }

    const paragraph = [line];
    index += 1;
    while (index < lines.length && lines[index].trim() && !isBlockStart(lines[index])) {
      paragraph.push(lines[index]);
      index += 1;
    }
    output.push(`<p>${renderInline(paragraph.join(" "), { sitePath, sourcePath })}</p>`);
  }

  return output.join("\n");
}

module.exports = {
  escapeHtml,
  getPublishedArticles,
  loadBlogArticles,
  parseArticleFile,
  parseFrontmatter,
  renderMarkdown,
  resolveArticleRelations,
  validateArticle,
  validateSlug
};
