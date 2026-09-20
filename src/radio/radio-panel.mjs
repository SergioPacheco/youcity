const DEFAULT_INACTIVITY_TIMEOUT = 30_000;
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "input", "wheel"];

export function createRadioPanelController({
  playerCard,
  playerCardMain,
  expandButton,
  collapseButton,
  initialExpanded = false,
  inactivityTimeout = DEFAULT_INACTIVITY_TIMEOUT,
  setTimeoutImpl = setTimeout,
  clearTimeoutImpl = clearTimeout
} = {}) {
  let expanded = false;
  let inactivityTimer = null;

  function clearInactivityTimer() {
    if (inactivityTimer === null) return;
    clearTimeoutImpl(inactivityTimer);
    inactivityTimer = null;
  }

  function scheduleInactivityCollapse() {
    clearInactivityTimer();
    if (!expanded || inactivityTimeout <= 0) return;
    inactivityTimer = setTimeoutImpl(() => {
      inactivityTimer = null;
      setExpanded(false);
    }, inactivityTimeout);
  }

  function noteActivity() {
    if (expanded) scheduleInactivityCollapse();
  }

  function setExpanded(value) {
    expanded = Boolean(value);
    playerCard?.classList.toggle("is-expanded", expanded);
    playerCardMain?.classList.toggle("is-visible", expanded);
    expandButton?.setAttribute("aria-expanded", String(expanded));
    collapseButton?.setAttribute("aria-expanded", String(expanded));
    scheduleInactivityCollapse();
    return expanded;
  }

  ACTIVITY_EVENTS.forEach((eventName) => playerCard?.addEventListener?.(eventName, noteActivity));
  setExpanded(initialExpanded);
  return {
    toggle: () => setExpanded(!expanded),
    setExpanded,
    isExpanded: () => expanded,
    destroy: () => {
      clearInactivityTimer();
      ACTIVITY_EVENTS.forEach((eventName) => playerCard?.removeEventListener?.(eventName, noteActivity));
    }
  };
}
