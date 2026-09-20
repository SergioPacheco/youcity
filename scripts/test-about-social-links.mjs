import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, styles] = await Promise.all([
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../styles.css", import.meta.url), "utf8"),
]);

const aboutStart = html.indexOf('<div class="about-card">');
const aboutEnd = html.indexOf("<!-- World map with city video links -->", aboutStart);
const aboutCard = aboutStart >= 0 && aboutEnd > aboutStart ? html.slice(aboutStart, aboutEnd) : "";
assert.ok(aboutCard, "About the project card should exist");

const normalizedAbout = aboutCard.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
assert.match(aboutCard, /<span class="drawer-kicker">ABOUT YOUCITY<\/span>/, "About modal should use the YouCity eyebrow");
assert.match(normalizedAbout, /Travel the feeling, before the trip\./, "About modal should lead with the approved headline");
assert.match(normalizedAbout, /YouCity lets you explore cities through real street videos and local radio\. Wander, listen, and discover the atmosphere of a place before deciding where to go next\./, "About modal should use the approved body copy");
assert.doesNotMatch(aboutCard, /A static experience inspired by virtual urban tours/, "About modal should not retain the generic project copy");
assert.match(aboutCard, /<a class="about-blog-link" href="\/blog">[\s\S]*Open the YouCity blog/, "About modal should contain the blog link");

assert.match(aboutCard, /class="about-social"/, "About modal should contain a social section");
assert.match(aboutCard, /FOLLOW THE JOURNEY/, "Social section should have a clear eyebrow");

const socialLinks = [
  ["Watch on YouTube", "https://www.youtube.com/@youcityapp", "social-cta--primary"],
  ["Follow on Instagram", "https://www.instagram.com/youcity.app/", ""],
  ["Follow on TikTok", "https://www.tiktok.com/@youcity.app", ""],
  ["Follow on Facebook", "https://www.facebook.com/profile.php?id=61594796960032", "social-cta--quiet"],
  ["Follow on Bluesky", "https://bsky.app/profile/youcityapp.bsky.social", "social-cta--quiet"],
];

for (const [label, href, modifier] of socialLinks) {
  const escapedHref = href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const linkPattern = new RegExp(`<a class="social-cta[^\"]*" href="${escapedHref}"[^>]*>[\\s\\S]*?<\\/a>`);
  const match = aboutCard.match(linkPattern);
  assert.ok(match, `${label} link should be present in the About card`);
  assert.match(match[0], new RegExp(`class="social-cta[^\"]*${modifier ? modifier : ""}`), `${label} should use the expected visual treatment`);
  assert.match(match[0], new RegExp(`<span class="social-cta__label">${label}</span>`), `${label} should use an action-oriented label`);
  assert.match(match[0], /class="social-cta__arrow"/, `${label} should show an external-link arrow`);
  assert.match(match[0], /target="_blank"/i, `${label} link should open in a new tab`);
  assert.match(match[0], /rel="noopener noreferrer"/i, `${label} link should be protected from opener access`);
  assert.match(match[0], /<span class="sr-only">\(opens in a new tab\)<\/span>/, `${label} should announce the new tab behavior`);
}

assert.equal(
  (aboutCard.match(/<a class="social-cta[^\"]*"/g) ?? []).length,
  socialLinks.length,
  "About card should contain exactly five social links",
);
assert.match(aboutCard, /href="\/privacy\.html"/, "Privacy Policy link should remain available");
assert.match(aboutCard, /href="\/terms\.html"/, "Terms of Use link should remain available");
assert.match(styles, /@media \(max-width: 640px\)[\s\S]*\.about-social__grid[\s\S]*grid-template-columns: 1fr/, "Social links should stack on narrow screens");
assert.match(styles, /prefers-reduced-motion: reduce[\s\S]*\.social-cta[\s\S]*transform: none/, "Social link motion should respect reduced-motion preferences");

console.log("About project copy and links: all checks passed");
