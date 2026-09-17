import {
  DEFAULT_MODE,
  DEFAULT_SITE_URL,
  MODE_LABELS,
  buildCommentContext,
  countryName,
  detectLanguage,
  detectVideoMode,
  extractYouTubeVideoId,
  matchCity,
  normalizeText,
  resolveMode,
  youtubeWatchUrl
} from "./core.mjs";
import { generateStandardComments } from "./comments.mjs";
import { CommentHistoryService } from "./history.mjs";

export function createCommentAssistant({
  window: windowRef = globalThis,
  document: documentRef = windowRef.document,
  navigator: navigatorRef = windowRef.navigator,
  fetchImpl = windowRef.fetch?.bind(windowRef),
  catalog = [],
  basePath = "",
  analytics = windowRef.YOUCITY_ANALYTICS,
  isAdmin = false,
  storage
} = {}) {
  const document = documentRef;
  const navigator = navigatorRef;
  const history = new CommentHistoryService(storage);
  const state = {
    metadata: null,
    detection: null,
    context: null,
    comments: [],
    historyEntry: null,
    catalogContext: null,
    previousFocus: null,
    busy: false,
    generationCount: 0
  };

  const $ = (selector) => document.querySelector(selector);
  const elements = {
    modal: $("#comment-assistant-modal"),
    panel: $(".comment-assistant-panel"),
    form: $("#comment-assistant-form"),
    url: $("#comment-assistant-url"),
    analyze: $("#comment-assistant-analyze"),
    status: $("#comment-assistant-status"),
    error: $("#comment-assistant-error"),
    video: $("#comment-assistant-video"),
    thumb: $("#comment-assistant-video-thumb"),
    videoTitle: $("#comment-assistant-video-title"),
    videoChannel: $("#comment-assistant-video-channel"),
    videoLink: $("#comment-assistant-video-link"),
    detection: $("#comment-assistant-detection"),
    detectedGrid: $("#comment-assistant-detected-grid"),
    candidate: $("#comment-assistant-candidate"),
    addCandidate: $("#comment-assistant-add-candidate"),
    settings: $("#comment-assistant-settings"),
    tone: $("#comment-assistant-tone"),
    language: $("#comment-assistant-language"),
    cta: $("#comment-assistant-cta"),
    experience: $("#comment-assistant-experience"),
    specific: $("#comment-assistant-specific"),
    youcity: $("#comment-assistant-youcity"),
    urlToggle: $("#comment-assistant-url-toggle"),
    trip: $("#comment-assistant-trip"),
    generate: $("#comment-assistant-generate"),
    historyNotice: $("#comment-assistant-history-notice"),
    results: $("#comment-assistant-results"),
    options: $("#comment-assistant-options")
  };

  function track(event, extra = {}) {
    const context = state.context || {};
    const metadata = state.metadata || {};
    const detection = state.detection || {};
    try {
      analytics?.track?.({
        event,
        city: context.city || detection.city?.name || detection.cityCandidate || "",
        country: context.country || (detection.city ? countryName(detection.city.country) : detection.country) || "",
        mode: context.videoType || (metadata.title ? detectVideoMode(metadata.title, metadata.description) : ""),
        language: context.language || (metadata.title ? detectLanguage(metadata.title, metadata.description) : ""),
        tone: context.tone,
        ...extra
      });
    } catch {
      // Analytics must never block the assistant.
    }
  }

  function setStatus(message, busy = false) {
    elements.status.textContent = message || "";
    elements.status.classList.toggle("is-busy", busy);
  }

  function setError(message = "") {
    elements.error.textContent = message;
    elements.error.hidden = !message;
  }

  function setBusy(busy, label = "") {
    state.busy = busy;
    elements.analyze.disabled = busy;
    elements.generate.disabled = busy;
    elements.url.disabled = busy;
    if (label) setStatus(label, busy);
  }

  function open(options = {}) {
    if (!elements.modal || isAdmin !== true) return;
    state.previousFocus = document.activeElement;
    elements.modal.classList.add("is-open");
    elements.modal.setAttribute("aria-hidden", "false");
    state.catalogContext = options.catalogContext || null;
    track("comment_assistant_open");
    const videoUrl = String(options.videoUrl || options.url || "").trim();
    if (videoUrl) {
      elements.url.value = videoUrl;
      setTimeout(() => analyzeVideo(), 100);
    } else {
      setTimeout(() => elements.url.focus(), 80);
    }
  }

  function close() {
    elements.modal.classList.remove("is-open");
    elements.modal.setAttribute("aria-hidden", "true");
    if (state.previousFocus?.focus) state.previousFocus.focus();
    state.previousFocus = null;
  }

  function getShareComment({ city = "", mode = "" } = {}) {
    const targetCity = normalizeText(city);
    const entry = history.list().find((item) => {
      if (!item.generatedComment) return false;
      if (targetCity && normalizeText(item.city) !== targetCity) return false;
      if (mode && item.mode !== mode) return false;
      return true;
    });
    return entry?.generatedComment || "";
  }

  function apiMessage(error) {
    return {
      INVALID_YOUTUBE_URL: "Invalid YouTube URL.",
      YOUTUBE_API_NOT_CONFIGURED: "Video analysis is not configured yet. Please try again later.",
      VIDEO_NOT_FOUND: "Video not found.",
      PRIVATE_VIDEO: "This video is private or unavailable.",
      VIDEO_METADATA_UNAVAILABLE: "Video metadata is unavailable right now.",
      YOUTUBE_API_QUOTA_EXCEEDED: "YouTube API quota exceeded. Please try again later.",
      RATE_LIMITED: "Too many requests. Please wait a little and try again."
    }[error?.code] || error?.message || "Something went wrong. Please try again.";
  }

  async function post(path, body) {
    const requestBasePath = String(basePath || "").replace(/\/+$/, "");
    if (typeof fetchImpl !== "function") throw new Error("FETCH_UNAVAILABLE");
    const response = await fetchImpl(`${requestBasePath}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(body)
    });
    let payload = {};
    try { payload = await response.json(); } catch { /* handled below */ }
    if (!response.ok) {
      const message = payload.message || (response.status === 404 || response.status === 405
        ? "Video metadata service is not available in this environment."
        : `Video metadata request failed (${response.status}).`);
      const error = new Error(message);
      error.code = payload.error;
      throw error;
    }
    return payload;
  }

  function buildCatalogMetadata(videoId) {
    const catalog = state.catalogContext;
    if (!catalog || catalog.videoId !== videoId) return null;
    return {
      videoId,
      videoUrl: youtubeWatchUrl(videoId),
      title: catalog.title || "YouCity city video",
      description: catalog.description || "",
      channel: catalog.channel || "YouCity catalog",
      channelId: "",
      tags: [],
      thumbnails: {
        high: { url: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` }
      },
      publishedAt: null,
    };
  }

  function matchCatalogVideo(videoId, title = "", description = "") {
    const city = catalog.find((candidate) => Object.values(candidate.videos || {}).some((videos) =>
      videos?.some((video) => video?.id === videoId)
    ));
    if (!city) return null;
    const detected = matchCity(title, description, [city]);
    return {
      ...detected,
      city,
      cityCandidate: city.name,
      country: countryName(city.country),
      confidence: "high"
    };
  }

  function renderMetadata(metadata) {
    elements.video.hidden = false;
    elements.videoTitle.textContent = metadata.title;
    elements.videoChannel.textContent = metadata.channel ? `by ${metadata.channel}` : "";
    elements.videoLink.href = metadata.videoUrl;
    const thumbnail = metadata.thumbnails?.high?.url || metadata.thumbnails?.medium?.url || `https://i.ytimg.com/vi/${metadata.videoId}/hqdefault.jpg`;
    elements.thumb.replaceChildren();
    const image = document.createElement("img");
    image.src = thumbnail;
    image.alt = `Thumbnail for ${metadata.title}`;
    image.loading = "lazy";
    image.referrerPolicy = "strict-origin-when-cross-origin";
    elements.thumb.append(image);
  }

  function addDetectedItem(label, value) {
    const item = document.createElement("div");
    item.className = "comment-assistant-detected-item";
    const labelElement = document.createElement("span");
    labelElement.textContent = label;
    const valueElement = document.createElement("strong");
    valueElement.textContent = value || "Not detected";
    item.append(labelElement, valueElement);
    elements.detectedGrid.append(item);
  }

  function renderDetection() {
    const detection = state.detection;
    const city = detection.city;
    const detectedMode = detectVideoMode(state.metadata.title, state.metadata.description);
    elements.detectedGrid.replaceChildren();
    addDetectedItem("City", city?.name || detection.cityCandidate || "Not detected");
    addDetectedItem("Country", city ? countryName(city.country) : "Not available");
    addDetectedItem("Area", detection.area || "Not detected");
    addDetectedItem("Content", MODE_LABELS[detectedMode] || detectedMode);
    addDetectedItem("Language", ({ en: "English", es: "Spanish", pt: "Portuguese" }[detectLanguage(state.metadata.title, state.metadata.description)] || "English"));
    elements.detection.hidden = false;
    elements.candidate.hidden = Boolean(city);
    elements.settings.hidden = !city;
    if (city) {
      const autoMode = resolveMode(city, "auto", detectedMode);
      elements.experience.value = autoMode === DEFAULT_MODE && !city.videos?.[detectedMode]?.length ? "auto" : autoMode;
    }
  }

  function buildContextFromForm() {
    const detection = state.detection;
    const detectedMode = detectVideoMode(state.metadata.title, state.metadata.description);
    const mode = resolveMode(detection.city, elements.experience.value, detectedMode);
    const language = elements.language.value === "auto" ? detectLanguage(state.metadata.title, state.metadata.description) : elements.language.value;
    return buildCommentContext({
      metadata: state.metadata,
      detection,
      mode,
      language,
      tone: elements.tone.value,
      cta: elements.cta.value,
      options: {
        mentionSpecific: elements.specific.checked,
        mentionYouCity: elements.youcity.checked,
        includeCityUrl: elements.urlToggle.checked,
        mentionPlanTrip: elements.trip.checked
      },
      siteUrl: DEFAULT_SITE_URL
    });
  }

  function renderHistoryNotice() {
    if (!state.historyEntry) {
      elements.historyNotice.hidden = true;
      elements.historyNotice.textContent = "";
      return;
    }
    elements.historyNotice.hidden = false;
    elements.historyNotice.textContent = "You already generated a comment for this video. The previous options are shown below; generate again only if you want new alternatives.";
  }

  function saveHistory(status = "GENERATED", selectedComment = state.comments[0] || "") {
    if (!state.metadata || !state.context) return;
    state.historyEntry = history.save({
      videoId: state.metadata.videoId,
      videoUrl: state.metadata.videoUrl,
      videoTitle: state.metadata.title,
      city: state.context.city,
      country: state.context.country,
      area: state.context.area,
      mode: state.context.videoType,
      generatedComment: selectedComment,
      comments: state.comments,
      language: state.context.language,
      createdAt: state.historyEntry?.createdAt || new Date().toISOString(),
      status
    });
    renderHistoryNotice();
  }

  function renderOptions() {
    elements.options.replaceChildren();
    state.comments.forEach((comment, index) => {
      const card = document.createElement("article");
      card.className = "comment-assistant-option";
      card.dataset.option = String(index);
      const heading = document.createElement("div");
      heading.className = "comment-assistant-option-heading";
      const title = document.createElement("span");
      title.textContent = `Option ${index + 1}`;
      heading.append(title);
      const textarea = document.createElement("textarea");
      textarea.value = comment;
      textarea.readOnly = true;
      textarea.maxLength = 600;
      textarea.setAttribute("aria-label", `Comment option ${index + 1}`);
      const actions = document.createElement("div");
      actions.className = "comment-assistant-option-actions";
      [["copy", "Copy"], ["regenerate", "Regenerate"], ["edit", "Edit"], ["approve", "Approve"]].forEach(([action, label]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = action === "copy" ? "comment-assistant-secondary" : "comment-assistant-quiet";
        button.dataset.commentAction = action;
        button.textContent = label;
        actions.append(button);
      });
      card.append(heading, textarea, actions);
      elements.options.append(card);
    });
    elements.results.hidden = !state.comments.length;
  }

  async function copyComment(index) {
    const comment = state.comments[index];
    if (!comment) return;
    try {
      await navigator.clipboard.writeText(comment);
    } catch {
      const input = document.createElement("textarea");
      input.value = comment;
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.append(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    }
    saveHistory("COPIED", comment);
    track("comment_copied", { variant: `option_${index + 1}` });
    setStatus("Comment copied. Review it before posting.");
  }

  function approveComment(index) {
    const comment = state.comments[index];
    if (!comment) return;
    saveHistory("APPROVED", comment);
    track("comment_approved", { variant: `option_${index + 1}` });
    const button = elements.options.querySelector(`[data-option="${index}"] [data-comment-action="approve"]`);
    if (button) {
      button.textContent = "Approved";
      button.disabled = true;
    }
    setStatus("Comment approved for your review. Publishing is not automated in this MVP.");
  }

  function generateComments() {
    if (!state.metadata || !state.detection?.city) return;
    setError("");
    const isRegeneration = state.comments.length > 0;
    state.context = buildContextFromForm();
    state.generationCount += 1;
    state.comments = generateStandardComments(state.context, state.generationCount - 1);
    saveHistory("GENERATED");
    renderOptions();
    track(isRegeneration ? "comment_regenerated" : "comment_generated");
    setStatus("Three standard comment options are ready to review.");
  }

  async function analyzeVideo(event) {
    event?.preventDefault();
    if (state.busy) return;
    const url = elements.url.value.trim();
    const videoId = extractYouTubeVideoId(url);
    setError("");
    if (!videoId) {
      setError("Invalid YouTube URL. Use a youtube.com/watch, youtu.be, or youtube.com/shorts URL.");
      return;
    }
    setBusy(true, "Analyzing video…");
    elements.video.hidden = true;
    elements.detection.hidden = true;
    elements.settings.hidden = true;
    elements.results.hidden = true;
    elements.historyNotice.hidden = true;
    elements.addCandidate.disabled = false;
    elements.addCandidate.textContent = "Add to city candidates";
    state.metadata = null;
    state.detection = null;
    state.context = null;
    state.comments = [];
    state.generationCount = 0;
    try {
      const catalogMetadata = buildCatalogMetadata(videoId);
      const metadata = catalogMetadata || await post("/api/youtube-metadata", { url });
      state.metadata = { ...metadata, videoUrl: youtubeWatchUrl(metadata.videoId || videoId) };
      state.detection = matchCatalogVideo(metadata.videoId || videoId, metadata.title, metadata.description)
        || matchCity(metadata.title, metadata.description, catalog);
      state.historyEntry = history.find(metadata.videoId || videoId);
      renderMetadata(state.metadata);
      renderDetection();
      renderHistoryNotice();
      if (state.historyEntry?.comments?.length) {
        state.comments = state.historyEntry.comments;
        renderOptions();
      }
      track("youtube_video_analyzed");
      setStatus(state.detection.city ? "Video analyzed. Review the detected context before generating." : "The video was analyzed, but its city is not in the YouCity catalog.");
    } catch (error) {
      setError(apiMessage(error));
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  function addCandidate() {
    if (!state.metadata || state.detection?.city) return;
    history.addCandidate({
      videoId: state.metadata.videoId,
      videoUrl: state.metadata.videoUrl,
      videoTitle: state.metadata.title,
      city: state.detection?.cityCandidate || "",
      country: state.detection?.country || "",
      area: state.detection?.area || ""
    });
    track("city_candidate_added");
    elements.addCandidate.disabled = true;
    elements.addCandidate.textContent = "Added to city candidates";
    setStatus("City saved locally as a candidate for future catalog review.");
  }

  function handleOptionAction(event) {
    const button = event.target.closest("[data-comment-action]");
    if (!button) return;
    const card = button.closest("[data-option]");
    const index = Number(card?.dataset.option);
    const action = button.dataset.commentAction;
    if (action === "copy") copyComment(index);
    if (action === "approve") approveComment(index);
    if (action === "regenerate") generateComments();
    if (action === "edit") {
      const textarea = card.querySelector("textarea");
      const editing = textarea.readOnly;
      textarea.readOnly = !editing;
      button.textContent = editing ? "Save" : "Edit";
      if (!editing) {
        state.comments[index] = textarea.value.trim();
        saveHistory("GENERATED", state.comments[index]);
        setStatus("Edited comment saved locally.");
      } else textarea.focus();
    }
  }

  function initialize() {
    if (!elements.modal) return;
    elements.form.addEventListener("submit", analyzeVideo);
    elements.generate.addEventListener("click", generateComments);
    elements.addCandidate.addEventListener("click", addCandidate);
    elements.options.addEventListener("click", handleOptionAction);
    elements.modal.addEventListener("click", (event) => {
      if (event.target.closest("[data-close-comment-assistant]")) close();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && elements.modal.classList.contains("is-open")) close();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
  else initialize();

  return { open, close, analyze: analyzeVideo, getShareComment };
}
