export function createSharingController({
  window,
  document = window?.document,
  navigator,
  elements,
  getCity,
  getState,
  getCommentAssistant = () => null,
  countryInfo = {},
  slugify,
  sitePath,
  modeLabels = {},
  showToast,
  messages
} = {}) {
  function getShareData() {
    const state = getState();
    const city = getCity();
    const params = new URLSearchParams({ mode: state.currentMode });
    if (state.currentVideoIndex > 0) params.set("video", String(state.currentVideoIndex + 1));
    const url = `${window.location.origin}${sitePath(`/city/${slugify(city.rawName || city.name)}?${params.toString()}`)}`;
    const defaultText = `🌍 Exploring ${city.name} by ${(modeLabels[state.currentMode] || state.currentMode).toLowerCase()} on YouCity — an immersive urban ride with local radio`;
    const generatedComment = getCommentAssistant()?.getShareComment?.({ city: city.name, mode: state.currentMode }) || "";
    const text = generatedComment || defaultText;
    return { url, text, title: `YouCity — ${city.name}`, hasEmbeddedUrl: /https?:\/\/\S+/i.test(text) };
  }

  function closeFan() {
    const fan = elements.shareFan;
    fan?.classList.remove("is-open");
    elements.shareBtn?.setAttribute("aria-expanded", "false");
    document.removeEventListener("click", closeShareFanOnClickOutside);
  }

  function closeShareFanOnClickOutside(event) {
    if (!event.target.closest(".share-fan-wrapper")) closeFan();
  }

  function toggleFan() {
    const fan = elements.shareFan;
    if (!fan || !elements.shareBtn) return;
    const isOpen = fan.classList.toggle("is-open");
    elements.shareBtn.setAttribute("aria-expanded", String(isOpen));
    if (isOpen) setTimeout(() => document.addEventListener("click", closeShareFanOnClickOutside), 10);
  }

  async function shareToSocial(platform) {
    const { url, text, title, hasEmbeddedUrl } = getShareData();
    const encodedUrl = encodeURIComponent(url);
    const encodedText = encodeURIComponent(text);
    const shareUrls = {
      whatsapp: `https://api.whatsapp.com/send?text=${encodedText}${hasEmbeddedUrl ? "" : `%20${encodedUrl}`}`,
      twitter: `https://twitter.com/intent/tweet?text=${encodedText}${hasEmbeddedUrl ? "" : `&url=${encodedUrl}`}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}`,
      telegram: `https://t.me/share/url?${hasEmbeddedUrl ? "" : `url=${encodedUrl}&`}text=${encodedText}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`
    };
    if (platform === "copy") {
      try {
        await navigator.clipboard.writeText(url);
        showToast(messages.linkCopied);
      } catch (error) {
        console.warn("[YouCity] Could not copy link:", error.message);
        showToast(messages.linkCopyFailed);
      }
      closeFan();
      return;
    }
    if (shareUrls[platform]) {
      window.open(shareUrls[platform], "_blank", "width=600,height=400,menubar=no,toolbar=no");
      closeFan();
    }
  }

  async function shareCity() {
    if (navigator.share && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      const { url, text, title, hasEmbeddedUrl } = getShareData();
      const shareData = { title, text };
      if (!hasEmbeddedUrl) shareData.url = url;
      try {
        await navigator.share(shareData);
      } catch (error) {
        if (error.name !== "AbortError") console.warn("[YouCity] Could not share:", error.message);
      }
    } else {
      toggleFan();
    }
  }

  return { getShareData, shareCity, shareToSocial, toggleShareFan: toggleFan, closeShareFan: closeFan };
}
