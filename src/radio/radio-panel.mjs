export function createRadioPanelController({ playerCard, playerCardMain, expandButton } = {}) {
  let expanded = false;

  function setExpanded(value) {
    expanded = Boolean(value);
    playerCard?.classList.toggle("is-expanded", expanded);
    playerCardMain?.classList.toggle("is-visible", expanded);
    expandButton?.setAttribute("aria-expanded", String(expanded));
    return expanded;
  }

  return {
    toggle: () => setExpanded(!expanded),
    setExpanded,
    isExpanded: () => expanded
  };
}
