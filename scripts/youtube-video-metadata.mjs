#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const CATALOG_PATH = new URL("../data/catalog.json", import.meta.url);
const YOUTUBE_VIDEOS_ENDPOINT = "https://www.googleapis.com/youtube/v3/videos";
const MODES = ["drive", "bike", "walk", "drone", "beach_walk"];
const BATCH_SIZE = 50;

function gcd(a, b) {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) [x, y] = [y, x % y];
  return x || 1;
}

function chunk(values, size) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) chunks.push(values.slice(index, index + size));
  return chunks;
}

export function collectVideoIds(catalog) {
  const seen = new Set();
  const ids = [];
  for (const city of catalog || []) {
    for (const mode of MODES) {
      for (const video of city?.videos?.[mode] || []) {
        if (!/^[A-Za-z0-9_-]{11}$/.test(video.id || "") || seen.has(video.id)) continue;
        seen.add(video.id);
        ids.push(video.id);
      }
    }
  }
  return ids;
}

export function normalizePlayerMetadata(videoResource) {
  const embedWidth = Number(videoResource?.player?.embedWidth);
  const embedHeight = Number(videoResource?.player?.embedHeight);
  if (!Number.isFinite(embedWidth) || !Number.isFinite(embedHeight) || embedWidth <= 0 || embedHeight <= 0) return null;
  const divisor = gcd(embedWidth, embedHeight);
  return {
    aspectRatio: `${embedWidth / divisor}:${embedHeight / divisor}`,
    youtubeMeta: {
      embedWidth,
      embedHeight,
      definition: videoResource?.contentDetails?.definition || undefined,
      dimension: videoResource?.contentDetails?.dimension || undefined
    }
  };
}

export function upsertVideoMetadata(catalog, metadataById) {
  return catalog.map((city) => ({
    ...city,
    videos: Object.fromEntries(Object.entries(city.videos || {}).map(([mode, videos]) => [
      mode,
      Array.isArray(videos)
        ? videos.map((video) => {
            const metadata = metadataById.get(video.id);
            return metadata ? { ...video, ...metadata } : { ...video };
          })
        : videos
    ]))
  }));
}

async function fetchVideoMetadata(ids, apiKey, fetchImpl = fetch) {
  const metadataById = new Map();
  for (const batch of chunk(ids, BATCH_SIZE)) {
    const params = new URLSearchParams({
      key: apiKey,
      part: "player,contentDetails",
      id: batch.join(","),
      maxHeight: "720"
    });
    const response = await fetchImpl(`${YOUTUBE_VIDEOS_ENDPOINT}?${params}`);
    if (!response.ok) throw new Error(`YouTube Data API request failed with ${response.status}`);
    const payload = await response.json();
    for (const item of payload.items || []) metadataById.set(item.id, normalizePlayerMetadata(item));
    for (const id of batch) {
      if (!metadataById.has(id)) metadataById.set(id, null);
    }
  }
  return metadataById;
}

async function main() {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) throw new Error("Set YOUTUBE_API_KEY before running this script");

  const catalog = JSON.parse(await readFile(CATALOG_PATH, "utf8"));
  const ids = collectVideoIds(catalog);
  const metadataById = await fetchVideoMetadata(ids, apiKey);
  const updatedCatalog = upsertVideoMetadata(catalog, metadataById);
  await writeFile(CATALOG_PATH, `${JSON.stringify(updatedCatalog, null, 2)}\n`);

  const updated = [...metadataById.values()].filter(Boolean).length;
  const missing = metadataById.size - updated;
  console.log(`YouTube metadata sync complete: ${updated} videos updated, ${missing} unavailable.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
