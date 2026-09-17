import assert from "node:assert/strict";
import {
  buildYouCityUrl,
  detectVideoMode,
  extractYouTubeVideoId,
  matchCity
} from "../src/features/comment-assistant/core.mjs";
import { generateStandardComments } from "../src/features/comment-assistant/comments.mjs";

const catalog = [{
  name: "London",
  country: "UK",
  videos: { drive: [{ id: "drive" }], bike: [], walk: [{ id: "walk" }], drone: [{ id: "drone" }], beach_walk: [] }
}];

assert.equal(extractYouTubeVideoId("https://www.youtube.com/watch?v=ABC123"), "ABC123");
assert.equal(extractYouTubeVideoId("https://youtu.be/ABC123"), "ABC123");
assert.equal(extractYouTubeVideoId("https://youtube.com/shorts/ABC123"), "ABC123");
assert.equal(extractYouTubeVideoId("https://example.com/watch?v=ABC123"), null);

assert.equal(detectVideoMode("London Walking Tour", ""), "walk");
assert.equal(detectVideoMode("London Driving Tour", ""), "drive");
assert.equal(detectVideoMode("London Drone 4K", ""), "drone");

const walking = matchCity("Covent Garden London Walk", "", catalog);
assert.equal(walking.city.name, "London");
assert.equal(walking.area, "Covent Garden");
assert.equal(matchCity("Walking Manhattan NYC", "", [{ ...catalog[0], name: "New York City", country: "USA" }]).city.name, "New York City");
assert.equal(matchCity("Granada Spain City Walk", "", [{ name: "Granada", country: "Spain", videos: {} }]).area, "");

const unavailable = matchCity("Kyoto Walking Tour", "", catalog);
assert.equal(unavailable.city, null);
assert.equal(buildYouCityUrl(unavailable.city, "walk"), null);
assert.equal(buildYouCityUrl(catalog[0], "drive"), "https://youcity.app/city/london?mode=drive");

const standardContext = {
  city: "London",
  country: "United Kingdom",
  area: "Covent Garden",
  videoType: "walk",
  language: "en",
  tone: "natural",
  cta: "city-link",
  includeCityUrl: true,
  mentionYouCity: true,
  youCityUrl: "https://youcity.app/city/london?mode=walk"
};
const comments = generateStandardComments(standardContext);
assert.equal(comments.length, 3);
assert.equal(new Set(comments).size, 3);
assert.ok(comments.every((comment) => comment.includes("Covent Garden")));
assert.ok(comments.every((comment) => comment.endsWith("https://youcity.app/city/london?mode=walk")));
assert.notDeepEqual(comments, generateStandardComments(standardContext, 1), "regenerate should use another standard template order");

console.log("Comment Assistant tests passed: YouTube URLs, city aliases, area detection, modes, unavailable cities, canonical URLs, and standard comments.");
