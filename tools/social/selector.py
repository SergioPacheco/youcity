from __future__ import annotations

import random
from datetime import timedelta

from .config import DATA_FILE, DEFAULT_MIN_MODES, DEFAULT_RECENT_DAYS, STATE_FILE
from .ranking import rank_city
from .utils import city_modes, now_utc, parse_datetime, radio_count, read_json, total_videos


def load_cities() -> list[dict]:
    cities = read_json(DATA_FILE, [])
    return cities if isinstance(cities, list) else []


def has_ride(city: dict) -> bool:
    videos = city.get("videos") or {}
    return any(isinstance(videos.get(key), list) and len(videos[key]) > 0
               for key in ("drive", "bike", "walk", "beach_walk", "drone"))


def local_recent_slugs(days: int = DEFAULT_RECENT_DAYS) -> set[str]:
    state = read_json(STATE_FILE, [])
    cutoff = now_utc() - timedelta(days=days)
    return {
        str(item.get("city_slug"))
        for item in state
        if isinstance(item, dict)
        and item.get("city_slug")
        and item.get("status", "published") == "published"
        and (parse_datetime(item.get("published_at")) or now_utc()) >= cutoff
    }


def candidates(minimum_modes: int = DEFAULT_MIN_MODES,
               recent_slugs: set[str] | None = None) -> list[tuple[dict, object]]:
    recent_slugs = recent_slugs or set()
    result = []
    for city in load_cities():
        from .utils import city_slug

        slug = city_slug(city)
        modes = city_modes(city)
        if not slug or not has_ride(city):
            continue
        if len(modes) < minimum_modes or slug in recent_slugs:
            continue
        videos = total_videos(city)
        stations = radio_count(city)
        result.append((city, rank_city(city, modes, videos, stations)))
    return sorted(result, key=lambda item: (item[1].total, item[1].video_count), reverse=True)


def mode_key(city: dict) -> str:
    from .utils import mode_keys

    return "+".join(mode_keys(city))


def weighted_pick(
    ranked: list[tuple[dict, object]],
    top_n: int = 20,
    rng: random.Random | None = None,
    recent_cities: set[str] | None = None,
    recent_countries: set[str] | None = None,
    city_penalty: float = 0.2,
    country_penalty: float = 0.5,
    same_day: list[dict] | None = None,
) -> tuple[tuple[dict, object], int]:
    """Weighted draw by score inside the top-N.

    Applies a diversity penalty when the city (×0.2) or country (×0.5)
    appeared in recent publications, without excluding the candidate.
    `same_day` holds today's picks and penalizes repeating the country
    or the exact mode set on the same day.
    Returns ((city, ranking), index_in_ranking).
    """
    from .utils import clean_text, display_city_name, display_country_name

    if not ranked:
        raise ValueError("empty candidate list")
    pool = ranked[: max(1, top_n)]
    rng = rng or random.Random()
    recent_cities = {c.strip().upper() for c in (recent_cities or set()) if c}
    recent_countries = {c.strip().upper() for c in (recent_countries or set()) if c}
    day = _day_sets(same_day or [])
    weights = []
    for city, ranking in pool:
        weight = max(float(getattr(ranking, "total", 0) or 0), 0.01)
        name = clean_text(display_city_name(city)).upper()
        country = clean_text(display_country_name(city)).upper()
        if name and name in recent_cities:
            weight *= city_penalty
        elif country and country in recent_countries:
            weight *= country_penalty
        weight *= _day_factor(city, day)
        weights.append(weight)
    chosen = rng.choices(range(len(pool)), weights=weights, k=1)[0]
    return pool[chosen], chosen


def _day_sets(picks: list[dict]) -> dict[str, set[str]]:
    day: dict[str, set[str]] = {"country": set(), "city": set(), "modes": set()}
    for pick in picks:
        if str(pick.get("pais") or "").strip().upper():
            day["country"].add(str(pick["pais"]).strip().upper())
        if str(pick.get("cidade") or "").strip().upper():
            day["city"].add(str(pick["cidade"]).strip().upper())
        if str(pick.get("modos") or "").strip():
            day["modes"].add(str(pick["modos"]).strip())
    return day


def _day_factor(city: dict, day: dict[str, set[str]]) -> float:
    from .utils import clean_text, display_city_name, display_country_name

    factor = 1.0
    if clean_text(display_city_name(city)).upper() in day["city"]:
        factor *= 0.1
    elif clean_text(display_country_name(city)).upper() in day["country"]:
        factor *= 0.3
    if mode_key(city) in day["modes"]:
        factor *= 0.5
    return factor
