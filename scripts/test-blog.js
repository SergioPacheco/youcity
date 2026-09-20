#!/usr/bin/env node

const assert = require("node:assert/strict");
const { mkdtempSync, rmSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
const { tmpdir } = require("node:os");

const {
  parseArticleFile,
  parseFrontmatter,
  renderMarkdown,
  validateArticle,
  validateSlug
} = require("./blog-content");

function expectFailure(label, callback, expectedText = "") {
  assert.throws(callback, (error) => {
    assert.match(error.message, /blog\/article\.md/);
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

console.log("Blog parser tests passed.");
