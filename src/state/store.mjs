export function createAppStore(initialState = {}) {
  let state = { ...initialState };
  const listeners = new Set();

  return {
    getState() {
      return state;
    },
    update(patch) {
      Object.assign(state, typeof patch === "function" ? patch(state) : patch);
      listeners.forEach((listener) => listener(state));
      return state;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    restore(serialized) {
      if (!serialized || typeof serialized !== "object" || Array.isArray(serialized)) return state;
      return this.update(serialized);
    }
  };
}
