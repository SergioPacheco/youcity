#!/usr/bin/env node

import assert from "node:assert/strict";
import { CommentHistoryService } from "../src/features/comment-assistant/history.mjs";
import { createSharingController } from "../src/sharing/sharing-controller.mjs";

const values = new Map();
const storage = {
  getItem: (key) => values.get(key) || null,
  setItem: (key, value) => values.set(key, String(value))
};
const history = new CommentHistoryService(storage);
history.save({
  videoId: "london-walk",
  city: "London",
  mode: "walk",
  generatedComment: "Generated comment for London — https://youcity.app/city/london?mode=walk"
});

const opened = [];
const copied = [];
const controller = createSharingController({
  window: {
    location: { origin: "https://youcity.app" },
    open: (url) => opened.push(url)
  },
  document: { addEventListener() {}, removeEventListener() {} },
  navigator: { userAgent: "Desktop", clipboard: { writeText: async (value) => copied.push(value) } },
  elements: { shareFan: { classList: { remove() {} } }, shareBtn: { setAttribute() {} } },
  getCity: () => ({ name: "London", rawName: "London" }),
  getState: () => ({ currentMode: "walk", currentVideoIndex: 0 }),
  getShareComment: (filters) => history.getShareComment(filters),
  slugify: (value) => value.toLowerCase(),
  sitePath: (path) => path,
  modeLabels: { walk: "Walk" },
  showToast() {},
  messages: { linkCopied: "Copied", linkCopyFailed: "Failed", shareTextCopied: "Comment copied" }
});

const generatedText = "Generated comment for London — https://youcity.app/city/london?mode=walk";
assert.equal(controller.getShareData().text, generatedText);
assert.equal(controller.getShareData().isGeneratedComment, true);
await controller.shareToSocial("whatsapp");
assert.equal(opened.length, 1);
assert.ok(opened[0].includes(encodeURIComponent("Generated comment for London")));
await controller.shareToSocial("facebook");
assert.equal(copied.at(-1), generatedText, "Facebook fallback should copy the generated comment");
assert.ok(opened.at(-1).includes("quote="), "Facebook share should retain the quote parameter");

console.log("Sharing tests passed: persisted Comment Assistant text is used by social sharing.");
