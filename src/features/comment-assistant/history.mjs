import { COMMENT_HISTORY_STORAGE_KEY, findShareComment } from "../../sharing/comment-share.mjs";

const STORAGE_KEY = COMMENT_HISTORY_STORAGE_KEY;
const CANDIDATES_KEY = "youcity-comment-assistant-candidates-v1";

function readArray(storage, key) {
  try {
    const value = JSON.parse(storage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function writeArray(storage, key, value) {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Private browsing or disabled storage should not block the assistant.
  }
}

function defaultStorage() {
  try {
    if (globalThis.localStorage) return globalThis.localStorage;
  } catch {
    // Storage can be unavailable in private browsing or restricted frames.
  }
  const values = new Map();
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, String(value))
  };
}

export class CommentHistoryService {
  constructor(storage) {
    this.storage = storage || defaultStorage();
  }

  list() {
    return readArray(this.storage, STORAGE_KEY);
  }

  find(videoId) {
    return this.list().find((entry) => entry.videoId === videoId) || null;
  }

  getShareComment(filters) {
    return findShareComment(this.storage, filters);
  }

  save(entry) {
    const items = this.list().filter((item) => item.videoId !== entry.videoId);
    const saved = { ...entry, updatedAt: new Date().toISOString() };
    writeArray(this.storage, STORAGE_KEY, [saved, ...items].slice(0, 100));
    return saved;
  }

  update(videoId, patch) {
    const current = this.find(videoId);
    if (!current) return null;
    return this.save({ ...current, ...patch });
  }

  addCandidate(candidate) {
    const items = readArray(this.storage, CANDIDATES_KEY).filter((item) => item.videoId !== candidate.videoId);
    const saved = { ...candidate, createdAt: candidate.createdAt || new Date().toISOString() };
    writeArray(this.storage, CANDIDATES_KEY, [saved, ...items].slice(0, 100));
    return saved;
  }
}

export { CANDIDATES_KEY, STORAGE_KEY };
