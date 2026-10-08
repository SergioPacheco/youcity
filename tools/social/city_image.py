"""Real city photos for the YouCity social publisher.

Provider chain (no API keys needed):

1. Wikipedia PageImages — lead image of the city's article
   (``action=query&prop=pageimages``), plus author/license via
   ``prop=imageinfo``. Covers nearly every notable city.
2. Nothing else keyless proved viable (Teleport's public API is gone).
3. Gradient fallback — the card renders without a photo.

Results are cached in ``tools/.city_image_cache.json`` (committed, like
the Imovue geocode caches) keyed by city slug::

    {"slug": {"provider": "wikipedia", "image_url": ..., "page_url": ...,
              "author": ..., "license": ..., "fetched_at": ...}}

Prefetch the whole catalog once (polite sequential requests with a
Wikimedia-compliant User-Agent)::

    python tools/social/city_image.py --all
    python tools/social/city_image.py --city lisbon
    python tools/social/city_image.py --city lisbon --refresh

At publish time the publisher only downloads the cached URL (fast) and
re-resolves automatically when the download fails.
"""

from __future__ import annotations

import argparse
import html
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    from social.config import DATA_FILE, ROOT_DIR
    from social.utils import city_slug, clean_text, display_city_name, read_json, write_json
else:
    from .config import DATA_FILE, ROOT_DIR
    from .utils import city_slug, clean_text, display_city_name, read_json, write_json

CACHE_FILE = ROOT_DIR / "tools" / ".city_image_cache.json"
USER_AGENT = "YouCitySocialPublisher/1.0 (https://youcity.app; social cards)"
WIKI_API = "https://en.wikipedia.org/w/api.php"
MIN_WIDTH = 800
REQUEST_SLEEP = 0.15


def _session() -> requests.Session:
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})
    return session


def _clean_author(value: object) -> str:
    text = html.unescape(re.sub(r"<[^>]+>", " ", str(value or "")))
    text = re.sub(r"\s+", " ", text).strip(" ;,")
    # Derivative-work credits start with the source file name — drop it.
    text = re.sub(r"^File:[^:]+:\s*", "", text).strip()
    # Drop trailing "talk" page artifacts like "John Doe talk".
    text = re.sub(r"\s+talk$", "", text, flags=re.IGNORECASE).strip()
    # Bare source URLs ("https://www.flickr.com/photos/uira/") → handle.
    if re.match(r"^https?://\S+$", text):
        text = text.rstrip("/").split("/")[-1].replace("_", " ")
    return text[:80]


def fetch_wikipedia(display_name: str, session: requests.Session | None = None) -> dict | None:
    """Lead article image + author/license. Returns None when unavailable."""
    session = session or _session()
    try:
        response = session.get(WIKI_API, params={
            "action": "query", "format": "json", "formatversion": 2,
            "redirects": 1, "prop": "pageimages",
            "titles": display_name, "pithumbsize": 1600,
        }, timeout=30)
        response.raise_for_status()
        pages = response.json().get("query", {}).get("pages", [])
        if not pages or pages[0].get("missing"):
            return None
        page = pages[0]
        thumbnail = page.get("thumbnail") or {}
        image_url = thumbnail.get("source", "")
        file_title = page.get("pageimage", "")
        if not image_url or not file_title or int(thumbnail.get("width", 0)) < MIN_WIDTH:
            return None

        info = session.get(WIKI_API, params={
            "action": "query", "format": "json", "formatversion": 2,
            "prop": "imageinfo", "titles": f"File:{file_title}",
            "iiprop": "user|url|extmetadata",
            "iiextmetadatafilter": "Artist|LicenseShortName|Credit",
        }, timeout=30)
        info.raise_for_status()
        info_pages = info.json().get("query", {}).get("pages", [])
        author, license_name = "", ""
        # Note: Commons-hosted files report missing:true locally, but still
        # carry imageinfo (imagerepository: shared) — gate on imageinfo.
        if info_pages:
            imageinfo = (info_pages[0].get("imageinfo") or [{}])[0]
            meta = imageinfo.get("extmetadata") or {}
            author = _clean_author((meta.get("Artist") or {}).get("value", ""))
            if not author:
                author = _clean_author((meta.get("Credit") or {}).get("value", ""))
            if not author:
                author = clean_text(imageinfo.get("user", ""))[:80]
            license_name = clean_text((meta.get("LicenseShortName") or {}).get("value", ""))[:40]
        time.sleep(REQUEST_SLEEP)
        return {
            "provider": "wikipedia",
            "image_url": image_url,
            "page_url": f"https://en.wikipedia.org/?curid={page.get('pageid', '')}",
            "author": author,
            "license": license_name,
        }
    except requests.RequestException as exc:
        print(f"⚠️ Wikipedia lookup failed for {display_name}: {exc}")
        return None


def load_cache() -> dict:
    cached = read_json(CACHE_FILE, {})
    return cached if isinstance(cached, dict) else {}


def resolve_city_image(city: dict, refresh: bool = False) -> dict | None:
    """Cached photo metadata for a catalog city (None = use fallback)."""
    slug = city_slug(city)
    if not slug:
        return None
    cache = load_cache()
    if not refresh and slug in cache and isinstance(cache[slug], dict) and cache[slug].get("image_url"):
        return {"slug": slug, **cache[slug]}
    found = fetch_wikipedia(display_city_name(city) or clean_text(city.get("name")))
    if found:
        record = {**found, "fetched_at": datetime.now(timezone.utc).isoformat()}
        cache[slug] = record
        write_json(CACHE_FILE, cache)
        return {"slug": slug, **record}
    return None


def download_image(meta: dict, dest: Path, session: requests.Session | None = None) -> Path | None:
    """Download the cached photo. Returns the path, or None on failure."""
    if not meta or not meta.get("image_url"):
        return None
    session = session or _session()
    try:
        response = session.get(meta["image_url"], timeout=60)
        response.raise_for_status()
        content_type = response.headers.get("Content-Type", "")
        if "image" not in content_type or len(response.content) < 20_000:
            print(f"⚠️ Rejected photo ({content_type}, {len(response.content)} bytes): {meta.get('slug')}")
            return None
        suffix = ".png" if "png" in content_type else ".jpg"
        dest = dest.with_suffix(suffix)
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(response.content)
        return dest
    except requests.RequestException as exc:
        print(f"⚠️ Photo download failed ({meta.get('slug')}): {exc}")
        return None


def parser() -> argparse.ArgumentParser:
    command = argparse.ArgumentParser(description="Prefetch real city photos into the cache.")
    target = command.add_mutually_exclusive_group(required=True)
    target.add_argument("--all", action="store_true", help="Fetch every catalog city missing from the cache.")
    target.add_argument("--city", metavar="SLUG", help="Fetch one city by slug.")
    command.add_argument("--refresh", action="store_true", help="Re-fetch even when cached.")
    return command


def main() -> int:
    args = parser().parse_args()
    catalog = read_json(DATA_FILE, [])
    if not isinstance(catalog, list):
        print("❌ Catalog is not a list.")
        return 1
    if args.city:
        wanted = args.city.strip().lower()
        cities = [city for city in catalog if city_slug(city) == wanted]
        if not cities:
            print(f"❌ Unknown city slug: {wanted}")
            return 2
    else:
        cities = catalog

    session = _session()
    hits, misses, cached = 0, 0, 0
    for index, city in enumerate(cities, 1):
        slug = city_slug(city)
        if not args.refresh and slug in load_cache():
            cached += 1
            continue
        name = display_city_name(city)
        print(f"[{index}/{len(cities)}] {slug} ({name}) ... ", end="", flush=True)
        found = fetch_wikipedia(name or slug, session)
        if found:
            record = {**found, "fetched_at": datetime.now(timezone.utc).isoformat()}
            cache = load_cache()
            cache[slug] = record
            write_json(CACHE_FILE, cache)
            hits += 1
            print(f"OK by {record['author'] or '?'} ({record['license'] or '?'})")
        else:
            misses += 1
            print("no photo → fallback")
    print(f"✅ photos: {hits} fetched, {misses} without photo (fallback), {cached} already cached.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
