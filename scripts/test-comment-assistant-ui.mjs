import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const styles = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const controller = fs.readFileSync(new URL("../src/features/comment-assistant/comment-assistant-controller.mjs", import.meta.url), "utf8");

assert.match(html, /<h2 id="comment-assistant-title">Comment Assistant<\/h2>/);
assert.match(html, /<details class="comment-assistant-change-video" id="comment-assistant-change-video"[\s\S]*?<form class="comment-assistant-form"/);
assert.match(html, /class="comment-assistant-workspace"/);
assert.match(html, /class="comment-assistant-context-column"/);
assert.match(html, /class="comment-assistant-action-column"/);
assert.match(styles, /\.comment-assistant-panel\s*\{[^}]*width: min\(1120px, 100%\)/s);
assert.match(styles, /\.comment-assistant-workspace\s*\{[^}]*grid-template-columns: minmax\(0, 1\.15fr\) minmax\(280px, \.85fr\)/s);
assert.match(styles, /\.comment-assistant-options\s*\{[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/s);
assert.match(controller, /elements\.changeVideo\.open = !videoUrl/);
assert.match(controller, /void analyzeVideo\(\)/);

console.log("Comment Assistant UI tests passed: compact title, current-video analysis, and desktop workspace layout.");
