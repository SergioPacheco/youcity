from __future__ import annotations

import json
import re
import unicodedata
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlencode

from .config import SITE_URL

# Mirrors the display names used by the static build (scripts/build-static.js).
CITY_DISPLAY_NAMES = {
    "Sao Paulo": "São Paulo",
}
COUNTRY_NAMES = {
    "USA": "United States",
    "UAE": "United Arab Emirates",
    "UK": "United Kingdom",
    "Korea": "South Korea",
    "Russia": "Russia",
    "Turkey": "Türkiye",
}

MODE_ORDER = ("drive", "bike", "walk", "beach_walk", "drone")
MODE_LABELS = {
    "drive": "Drive",
    "bike": "Bike",
    "walk": "Walk",
    "beach_walk": "Beach Walk",
    "drone": "Drone",
}


def clean_text(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def display_city_name(city: dict) -> str:
    name = clean_text(city.get("name"))
    return CITY_DISPLAY_NAMES.get(name, name)


def display_country_name(city: dict) -> str:
    country = clean_text(city.get("country"))
    return COUNTRY_NAMES.get(country, country)


def city_modes(city: dict) -> list[str]:
    """Mode labels with at least one video, in canonical order."""
    videos = city.get("videos") or {}
    return [
        MODE_LABELS[key]
        for key in MODE_ORDER
        if isinstance(videos.get(key), list) and len(videos[key]) > 0
    ]


def mode_keys(city: dict) -> list[str]:
    videos = city.get("videos") or {}
    return [
        key for key in MODE_ORDER
        if isinstance(videos.get(key), list) and len(videos[key]) > 0
    ]


def total_videos(city: dict) -> int:
    videos = city.get("videos") or {}
    return sum(len(videos[key]) for key in MODE_ORDER if isinstance(videos.get(key), list))


def radio_count(city: dict) -> int:
    radios = city.get("radios") or []
    return len(radios) if isinstance(radios, list) else 0


def slugify(value: object) -> str:
    """Must match the slugify() in scripts/build-static.js for /city/<slug> URLs."""
    slug = unicodedata.normalize("NFD", str(value or ""))
    slug = "".join(char for char in slug if not unicodedata.combining(char))
    slug = slug.lower()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    return slug.strip("-")


def city_slug(city: dict) -> str:
    return slugify(city.get("name"))


def hashtag(value: object) -> str:
    """Normalize text to a hashtag (no accents, spaces or symbols)."""
    text = unicodedata.normalize("NFKD", clean_text(value))
    text = "".join(char for char in text if not unicodedata.combining(char))
    text = re.sub(r"[^A-Za-z0-9]", "", text)
    return f"#{text}" if text else ""


def city_url(city: dict, scope: str) -> str:
    slug = city_slug(city)
    query = urlencode({
        "utm_source": "facebook",
        "utm_medium": "social",
        "utm_campaign": f"{scope.lower()}_daily",
        "utm_content": slug,
    })
    return f"{SITE_URL}/city/{slug}?{query}"


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def local_now(tz_name: str) -> datetime:
    """Current time in the audience-perceived timezone (fallback: fixed UTC-3)."""
    try:
        from zoneinfo import ZoneInfo
        return datetime.now(ZoneInfo(tz_name))
    except Exception:
        return datetime.now(timezone(timedelta(hours=-3)))


def parse_datetime(value: object) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def read_json(path: Path, fallback):
    if not path.exists():
        return fallback
    with path.open(encoding="utf-8") as file:
        return json.load(file)


def write_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    with temporary.open("w", encoding="utf-8") as file:
        json.dump(value, file, ensure_ascii=False, indent=2)
        file.write("\n")
    temporary.replace(path)
