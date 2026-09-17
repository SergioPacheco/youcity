export function createCommentAssistantLoader({ importer = () => import("./comment-assistant-controller.mjs") } = {}) {
  let assistantPromise = null;

  return function loadCommentAssistant({ enabled, ...dependencies } = {}) {
    if (!enabled) return Promise.resolve(null);
    if (!assistantPromise) {
      assistantPromise = importer()
        .then(({ createCommentAssistant }) => createCommentAssistant(dependencies))
        .catch((error) => {
          assistantPromise = null;
          throw error;
        });
    }
    return assistantPromise;
  };
}

export const loadCommentAssistant = createCommentAssistantLoader();
