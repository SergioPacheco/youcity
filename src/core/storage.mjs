export function createStorage(storage) {
  const fallback = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
  };
  let target = storage || fallback;
  try {
    target.getItem("__youcity_storage_probe__");
  } catch {
    target = fallback;
  }

  return {
    readJson(key, fallbackValue = null) {
      try {
        const raw = target.getItem(key);
        return raw === null ? fallbackValue : JSON.parse(raw);
      } catch {
        return fallbackValue;
      }
    },
    writeJson(key, value) {
      try {
        target.setItem(key, JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    },
    remove(key) {
      try { target.removeItem(key); } catch { /* storage is optional */ }
    }
  };
}
