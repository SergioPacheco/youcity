const COMMENT_HISTORY_STORAGE_KEY = "youcity-comment-assistant-history-v1";

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function findShareComment(storage, { city = "", mode = "" } = {}) {
  if (!storage) return "";
  let entries;
  try {
    entries = JSON.parse(storage.getItem(COMMENT_HISTORY_STORAGE_KEY) || "[]");
  } catch {
    return "";
  }
  if (!Array.isArray(entries)) return "";

  const targetCity = normalizeText(city);
  const entry = entries.find((item) => {
    if (!item?.generatedComment) return false;
    if (targetCity && normalizeText(item.city) !== targetCity) return false;
    if (mode && item.mode !== mode) return false;
    return true;
  });
  return entry?.generatedComment || "";
}

export { COMMENT_HISTORY_STORAGE_KEY, findShareComment };
