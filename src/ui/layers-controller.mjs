const FOCUSABLE_SELECTOR = 'button:not([disabled]), [href], summary, input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function createLayersController({ document, elements, onBeforeDrawerOpen = () => {} } = {}) {
  let previouslyFocusedElement = null;

  function getFocusableElements(container) {
    return container?.querySelectorAll(FOCUSABLE_SELECTOR) || [];
  }

  function trapFocus(event, container) {
    const focusable = getFocusableElements(container);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function close(layer) {
    if (!layer) return;
    layer.classList.remove("is-open");
    layer.setAttribute("aria-hidden", "true");
    if (layer === elements.travelDrawer) elements.travelButton?.setAttribute("aria-expanded", "false");
    if (layer._focusTrapHandler) {
      layer.removeEventListener("keydown", layer._focusTrapHandler);
      delete layer._focusTrapHandler;
    }
    if (previouslyFocusedElement) {
      previouslyFocusedElement.focus();
      previouslyFocusedElement = null;
    }
  }

  function open(layer) {
    if (!layer) return;
    if (layer === elements.drawer) onBeforeDrawerOpen();
    const layers = [elements.drawer, elements.travelDrawer, elements.about, elements.mapModal].filter(Boolean);
    const activeElement = document.activeElement;
    const activeInsideAnotherLayer = layers.some((other) => other !== layer && other.contains(activeElement));
    layers.forEach((other) => {
      if (other === layer || !other.classList.contains("is-open")) return;
      close(other);
    });
    previouslyFocusedElement = activeInsideAnotherLayer ? null : activeElement;
    if (activeInsideAnotherLayer) activeElement.blur();
    layer.classList.add("is-open");
    layer.setAttribute("aria-hidden", "false");
    if (layer === elements.travelDrawer) elements.travelButton?.setAttribute("aria-expanded", "true");

    const panel = layer.querySelector(".drawer-panel, .about-card, .map-card");
    const focusable = getFocusableElements(panel || layer);
    if (focusable.length) setTimeout(() => focusable[0].focus(), 100);
    layer._focusTrapHandler = (event) => {
      if (event.key === "Tab") trapFocus(event, panel || layer);
    };
    layer.addEventListener("keydown", layer._focusTrapHandler);
  }

  function closeMoreMenu() {
    elements.moreMenu?.classList.remove("is-open");
    elements.moreButton?.setAttribute("aria-expanded", "false");
  }

  return { open, close, closeMoreMenu, getFocusableElements, trapFocus };
}
