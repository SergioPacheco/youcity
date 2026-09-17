export function createLazyModuleLoader() {
  const pending = new Map();

  function load(key, importer) {
    if (pending.has(key)) return pending.get(key);
    const promise = Promise.resolve().then(importer).catch((error) => {
      pending.delete(key);
      throw error;
    });
    pending.set(key, promise);
    return promise;
  }

  return {
    load,
    clear(key) {
      pending.delete(key);
    }
  };
}
