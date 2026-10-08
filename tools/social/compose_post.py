from __future__ import annotations

from .utils import (city_modes, city_slug, city_url, clean_text, display_city_name,
                    display_country_name, hashtag, radio_count)


def location_line(city: dict) -> tuple[str, str, str, str]:
    """Return (location_line, city_country, city_tag, country_tag)."""
    name = display_city_name(city) or "Unknown city"
    country = display_country_name(city) or "Unknown country"
    city_country = f"{name}, {country}"
    return f"{name} – {country}", city_country, hashtag(name), hashtag(country)


def opening(city: dict, city_country: str, slot_index: int) -> str:
    """Rotating opener per slot. Everything is a catalog fact."""
    modes = city_modes(city)
    ride = modes[0].lower() if modes else "ride"
    options = [
        f"🌍 Take a {ride} through {city_country}",
        "🎬 New virtual ride on YouCity",
        f"📻 {city_country} — with local radio on YouCity",
        f"✈️ No ticket needed: explore {city_country}",
    ]
    return options[slot_index % len(options)]


def body_lines(city: dict, location: str, variant: str) -> list[str]:
    """Caption body. All factual from the catalog; nothing invented."""
    modes = city_modes(city)
    stations = radio_count(city)
    if variant == "highlights" and len(modes) >= 2:
        lines = [
            f"🌆 {location}",
            f"🎬 Highlights: {' · '.join(modes[:3])}",
        ]
    elif variant == "compact":
        lines = [
            f"🌆 {location}",
            f"🎬 {' · '.join(modes) if modes else 'Virtual ride'}",
        ]
    else:  # detailed
        lines = [
            f"🌆 {location}",
            f"🎬 Rides: {' · '.join(modes) if modes else 'Virtual ride'}",
        ]
        if stations:
            lines.append(f"📻 Local radio: {stations} station{'s' if stations != 1 else ''} on YouCity")
        else:
            lines.append("📻 With local radio on YouCity")
    return lines


def compose_post(city: dict, scope: str, score: float, slot_index: int = 0,
                 variant: str | None = None, image: dict | None = None) -> str:
    from .templates import select_body_variant

    _, city_country, city_tag, country_tag = location_line(city)
    resolved = variant or select_body_variant(city)
    details = [opening(city, city_country, slot_index), ""]
    details.extend(body_lines(city, location_line(city)[0], resolved))

    url = city_url(city, scope)
    tags = ["#YouCity", "#VirtualTour", "#CityWalk", "#TravelFromHome"]
    for extra in (city_tag, country_tag):
        if extra and extra not in tags and len(tags) < 6:
            tags.append(extra)
    photo_line = ""
    if image and image.get("author"):
        photo_line = f"📷 Photo: {clean_text(image['author'])[:60]} via Wikimedia Commons"
    return "\n".join([
        *details,
        "",
        "Watch the ride:",
        url,
        "",
        "🌐 Free to explore — pick a ride and press play.",
        *(["", photo_line] if photo_line else []),
        "",
        " ".join(tags),
    ])


def city_display_label(city: dict) -> str:
    name = display_city_name(city)
    country = display_country_name(city)
    return f"{name}, {country}".strip(", ") or clean_text(city.get("name"))
