export function createCityBrowser({
  cities,
  state,
  elements,
  storage,
  storageKeys,
  config,
  modeLabels,
  modeOrder,
  messages,
  showToast,
  getCurrentCityIndex = () => state.cityIndex,
  onSelectCity = () => {}
} = {}) {
  const normalizeSearch = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("en-US");

  function readList(key) {
    const values = storage.readJson(key, []);
    return Array.isArray(values) ? [...new Set(values.filter((value) => typeof value === "string"))] : [];
  }

  function writeList(key, values) {
    storage.writeJson(key, values);
  }

  function loadFavorites() { return readList(storageKeys.favorites); }
  function loadRecentCities() { return readList(storageKeys.recentCities); }
  function saveFavorites() { writeList(storageKeys.favorites, state.favorites); }
  function saveRecentCities() { writeList(storageKeys.recentCities, state.visitedCities); }

  function isFavorite(index) {
    return Boolean(cities[index]) && state.favorites.includes(cities[index].rawName);
  }

  function updateFavoriteButton() {
    const active = isFavorite(state.cityIndex);
    elements.favoriteBtn?.classList.toggle("is-active", active);
    elements.favoriteBtn?.setAttribute("aria-label", active ? "Remove from favorites" : "Add to favorites");
  }

  function toggleFavorite(index = state.cityIndex) {
    const city = cities[index];
    if (!city) return;
    const favoriteIndex = state.favorites.indexOf(city.rawName);
    if (favoriteIndex >= 0) {
      state.favorites.splice(favoriteIndex, 1);
      showToast(messages.favoriteRemoved(city.name));
    } else {
      state.favorites.push(city.rawName);
      showToast(messages.favoriteAdded(city.name));
    }
    saveFavorites();
    updateFavoriteButton();
    renderGrid(elements.search?.value || "");
  }

  function trackVisit(index) {
    const city = cities[index];
    if (!city) return;
    const key = city.rawName || city.id;
    if (!state.visitedCities.includes(key)) state.visitedCities.push(key);
    saveRecentCities();
  }

  function setFilter(filter) {
    state.currentFilter = filter;
    elements.filterButtons?.forEach((button) => button.classList.toggle("is-active", button.dataset.filter === filter));
    renderGrid(elements.search?.value || "");
  }

  function syncDrawerFilterToRide() {
    const filters = new Set([config.modes.DRIVE, config.modes.WALK, config.modes.DRONE, config.modes.BEACH_WALK]);
    setFilter(filters.has(state.currentMode) ? state.currentMode : config.filters.ALL);
  }

  function setContinent(continent) {
    state.currentContinent = continent;
    renderGrid(elements.search?.value || "");
  }

  function resetForOpen() {
    if (elements.search) elements.search.value = "";
    if (elements.filterContinent) elements.filterContinent.value = "";
    state.currentContinent = "";
    setFilter(config.filters.ALL);
  }

  function renderRail() {
    if (!elements.rail || !cities.length) return;
    const current = getCurrentCityIndex();
    const indexes = [-3, -2, -1, 0, 1, 2, 3].map((offset) => (current + offset + cities.length) % cities.length);
    elements.rail.innerHTML = indexes.map((index) => `
      <button class="rail-dot${index === current ? " is-active" : ""}" type="button" data-city="${index}" aria-label="Go to ${cities[index].name}"></button>
    `).join("");
  }

  function renderGrid(filter = "") {
    if (!elements.grid) return;
    const normalized = normalizeSearch(filter.trim());
    let matches = cities.map((city, index) => ({ city, index })).filter(({ city }) =>
      normalizeSearch(`${city.name} ${city.rawName} ${city.country} ${city.rawCountry} ${city.region}`).includes(normalized)
    );
    if (state.currentFilter === config.filters.FAVORITES) matches = matches.filter(({ index }) => isFavorite(index));
    const modeFilter = [config.modes.DRIVE, config.modes.WALK, config.modes.DRONE, config.modes.BEACH_WALK]
      .find((mode) => state.currentFilter === mode);
    if (modeFilter) matches = matches.filter(({ city }) => city.videos[modeFilter]?.length);
    if (state.currentContinent) matches = matches.filter(({ city }) => city.region === state.currentContinent);
    if (elements.resultCount) elements.resultCount.textContent = `${matches.length} ${matches.length === 1 ? "destination" : "destinations"}`;
    if (!matches.length) {
      elements.grid.innerHTML = '<p class="empty-state">No cities found.</p>';
      return;
    }

    const renderCards = (entries) => entries.map(({ city, index }) => {
      const thumbnailRide = modeOrder.map((mode) => city.videos[mode]?.[0]).find(Boolean);
      const modes = Object.entries(city.videos).filter(([, videos]) => videos.length).map(([mode]) => modeLabels[mode]).join(" · ");
      const favorite = isFavorite(index);
      return `
        <div class="city-card${index === getCurrentCityIndex() ? " is-current" : ""}" role="button" tabindex="0" data-city="${index}">
          ${thumbnailRide?.id ? `<img src="https://i.ytimg.com/vi/${thumbnailRide.id}/hqdefault.jpg" alt="" loading="lazy" />` : '<span class="city-card-placeholder" aria-hidden="true"></span>'}
          <span class="card-favorite${favorite ? " is-active" : ""}" role="button" tabindex="0" data-favorite="${index}" aria-label="${favorite ? "Remove from favorites" : "Add to favorites"}">
            <svg viewBox="0 0 24 24"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>
          </span>
          <span class="city-card-copy"><span><strong>${city.name}</strong><span>${city.country} · ${modes}</span></span><i>↗</i></span>
        </div>`;
    }).join("");

    const shouldGroup = !normalized && state.currentFilter === config.filters.ALL && !state.currentContinent;
    if (!shouldGroup) {
      elements.grid.innerHTML = renderCards(matches);
      return;
    }
    const featured = matches.filter(({ index }) => index === getCurrentCityIndex() || isFavorite(index)).slice(0, 4);
    const recent = matches.filter(({ city }) => state.visitedCities.includes(city.rawName)).slice(0, 4);
    const used = new Set([...featured, ...recent].map(({ index }) => index));
    const all = matches.filter(({ index }) => !used.has(index));
    const section = (label, entries) => entries.length ? `<section class="city-grid-section"><h3>${label}</h3><div class="city-grid-section-list">${renderCards(entries)}</div></section>` : "";
    const groups = new Map();
    all.forEach((entry) => {
      const letter = normalizeSearch(entry.city.name).charAt(0).toUpperCase() || "#";
      if (!groups.has(letter)) groups.set(letter, []);
      groups.get(letter).push(entry);
    });
    const allCities = all.length ? `<section class="city-grid-section"><h3>All cities</h3>${[...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([letter, entries]) => `<div class="city-alpha-group"><h4>${letter}</h4><div class="city-grid-section-list">${renderCards(entries)}</div></div>`).join("")}</section>` : "";
    elements.grid.innerHTML = `${section("Featured", featured)}${section("Recent", recent)}${allCities}`;
  }

  return {
    loadFavorites,
    loadRecentCities,
    toggleFavorite,
    updateFavoriteButton,
    isFavorite,
    trackVisit,
    setFilter,
    syncDrawerFilterToRide,
    setContinent,
    resetForOpen,
    renderRail,
    renderGrid,
    onSelectCity
  };
}
