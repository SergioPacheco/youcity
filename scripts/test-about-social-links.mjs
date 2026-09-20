import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

const aboutCard = html.match(/<div class="about-card">([\s\S]*?)<\/div>\s*<\/section>/)?.[1] ?? "";
assert.ok(aboutCard, "About the project card should exist");

const socialLinks = [
  ["Instagram", "https://www.instagram.com/youcity.app/"],
  ["YouTube", "https://www.youtube.com/@youcityapp"],
  ["Facebook", "https://www.facebook.com/profile.php?id=61594796960032"],
  ["TikTok", "https://www.tiktok.com/@youcity.app"],
  ["Bluesky", "https://bsky.app/profile/youcityapp.bsky.social"],
];

for (const [name, href] of socialLinks) {
  const escapedHref = href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const linkPattern = new RegExp(`<a[^>]+class="about-social-link[^\"]*"[^>]+href="${escapedHref}"[^>]*>`);
  const match = aboutCard.match(linkPattern);
  assert.ok(match, `${name} link should be present in the About card`);
  assert.match(match[0], /target="_blank"/i, `${name} link should open in a new tab`);
  assert.match(match[0], /rel="noopener noreferrer"/i, `${name} link should be protected from opener access`);
  assert.match(match[0], new RegExp(`aria-label="${name}"`, "i"), `${name} link should have an accessible label`);
}

assert.equal(
  (aboutCard.match(/class="about-social-link[^"]*"/g) ?? []).length,
  socialLinks.length,
  "About card should contain exactly five social links",
);

console.log("About social links: all checks passed");
