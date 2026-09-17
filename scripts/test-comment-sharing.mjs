#!/usr/bin/env node

import assert from "node:assert/strict";
import {
  COMMENT_SHARE_DESTINATIONS,
  FEATURED_COMMENT_SHARE_IDS,
  buildCommentShareLink,
  getCommentShareDestinations
} from "../src/features/comment-assistant/share-destinations.mjs";

const shareData = {
  text: "A thoughtful generated comment",
  title: "YouCity — London",
  url: "https://www.youtube.com/watch?v=abc123"
};

assert.equal(COMMENT_SHARE_DESTINATIONS.length, 50, "the assistant should offer about 50 destinations");
assert.equal(new Set(COMMENT_SHARE_DESTINATIONS.map(({ id }) => id)).size, 50, "destination ids should be unique");
assert.ok(FEATURED_COMMENT_SHARE_IDS.length >= 8 && FEATURED_COMMENT_SHARE_IDS.length <= 12, "the compact picker should feature 8–12 destinations");
assert.equal(getCommentShareDestinations().length, FEATURED_COMMENT_SHARE_IDS.length);
assert.equal(getCommentShareDestinations({ expanded: true }).length, 50);

const whatsapp = buildCommentShareLink("whatsapp", shareData);
assert.equal(whatsapp.requiresCopy, false);
assert.ok(whatsapp.href.startsWith("https://api.whatsapp.com/send?text="));
assert.ok(whatsapp.href.includes(encodeURIComponent(shareData.text)));
assert.ok(whatsapp.href.includes(encodeURIComponent(shareData.url)));

const facebook = buildCommentShareLink("facebook", shareData);
assert.ok(facebook.href.includes(`u=${encodeURIComponent(shareData.url)}`));
assert.ok(facebook.href.includes(`quote=${encodeURIComponent(shareData.text)}`));

const instagram = buildCommentShareLink("instagram", shareData);
assert.equal(instagram.requiresCopy, true, "Instagram has no public web prefill endpoint");
assert.equal(instagram.href, "https://www.instagram.com/");

assert.throws(() => buildCommentShareLink("unknown", shareData), /Unknown comment share destination/);

console.log("Comment sharing tests passed: 50 destinations, compact picker, encoded links, and copy-first fallbacks.");
