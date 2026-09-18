export function createRadioPanelController({ playerCard, playerCardMain, expandButton, collapseButton, initialExpanded = false } = {}) {
  let expanded = false;

  function setExpanded(value) {
    expanded = Boolean(value);
    playerCard?.classList.toggle("is-expanded", expanded);
    playerCardMain?.classList.toggle("is-visible", expanded);
    expandButton?.setAttribute("aria-expanded", String(expanded));
    collapseButton?.setAttribute("aria-expanded", String(expanded));
    return expanded;
  }

  setExpanded(initialExpanded);
  return {
    toggle: () => setExpanded(!expanded),
    setExpanded,
    isExpanded: () => expanded
  };
}
