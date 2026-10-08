"""YouCity ad themes.

Three graphic themes with the same components and identity — only the
visual hierarchy changes, so posts never all look the same:

- ``premium``: dark/lime base (always eligible);
- ``claro``: light background with dark text (always eligible);
- ``spotlight``: the ride count as the giant protagonist (only for
  cities with 4+ modes or a beach walk).

Selection is DETERMINISTIC (hash of city + date): reproducible,
auditable, and never repeats the previous day's theme on the same
page. The chosen theme is stored in ``published.json`` for future
per-theme performance analysis. Real photos are NOT used.
"""

from __future__ import annotations

import hashlib

THEMES = ("premium", "claro", "spotlight")


def mode_count_of(city: dict) -> int:
    from .utils import city_modes

    return len(city_modes(city))


def has_beach(city: dict) -> bool:
    videos = city.get("videos") or {}
    return isinstance(videos.get("beach_walk"), list) and len(videos["beach_walk"]) > 0


def eligible_themes(city: dict) -> list[str]:
    """Valid themes for the city (spotlight only for rich catalogs)."""
    themes = ["premium", "claro"]
    if mode_count_of(city) >= 4 or has_beach(city):
        themes.append("spotlight")
    return themes


def _stable_index(key: str, size: int) -> int:
    digest = hashlib.sha256(key.encode("utf-8")).digest()
    return int.from_bytes(digest[:8], "big") % size


def last_template_for_scope(state: list, scope: str) -> str | None:
    """Theme of the scope's last PUBLISHED post (legacy entries = None)."""
    wanted = str(scope or "").upper()
    for item in reversed(state or []):
        if not isinstance(item, dict):
            continue
        if str(item.get("scope") or "").upper() != wanted:
            continue
        if item.get("status") != "published":
            continue
        return item.get("template") or None
    return None


def select_template(city: dict, scope: str, date_str: str,
                    last_template: str | None = None) -> str:
    """Pick the post theme. Weights: premium 40 / claro 35 / spotlight 25."""
    from .utils import city_slug

    eligible = eligible_themes(city)
    weights = {"premium": 40, "claro": 35, "spotlight": 25}
    pool = [theme for theme in eligible for _ in range(weights.get(theme, 0))]
    slug = city_slug(city)
    chosen = pool[_stable_index(f"{slug}|{date_str}", len(pool))]
    # Avoid repeating the previous day's theme on the same scope.
    if last_template and chosen == last_template and len(eligible) > 1:
        ordered = [theme for theme in ("premium", "claro", "spotlight") if theme in eligible]
        chosen = ordered[(ordered.index(chosen) + 1) % len(ordered)]
    return chosen


def select_body_variant(city: dict) -> str:
    """Caption body: detailed / highlights / compact (stable per city)."""
    from .utils import city_slug

    slug = city_slug(city)
    options = ["detailed", "highlights", "compact"]
    variant = options[_stable_index(f"body|{slug}", len(options))]
    if variant == "highlights" and mode_count_of(city) < 2:
        return "detailed"
    return variant
