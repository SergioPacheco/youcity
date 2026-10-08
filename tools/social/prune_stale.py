"""Remove from Facebook the posts whose cities left the catalog.

Cross-checks `social/published.json` against the current
`data/catalog.json`: every record with a `city_slug` missing from the
catalog (and not yet marked as `removed`) has its `post_id` deleted
via the Graph API.

Manual use (preview before applying):

    python tools/social/prune_stale.py --dry-run
    python tools/social/prune_stale.py

In the daily workflow the cleanup runs automatically before publishing.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    from social.config import PUBLISHED_HISTORY_LIMIT, STATE_FILE, load_pages, resolve_page_tokens
    from social.facebook_client import FacebookAPIError, FacebookClient
    from social.selector import load_cities
    from social.utils import city_slug, now_utc, read_json, write_json
else:
    from .config import PUBLISHED_HISTORY_LIMIT, STATE_FILE, load_pages, resolve_page_tokens
    from .facebook_client import FacebookAPIError, FacebookClient
    from .selector import load_cities
    from .utils import city_slug, now_utc, read_json, write_json


def parser() -> argparse.ArgumentParser:
    command = argparse.ArgumentParser(description="Delete posts of cities that left the catalog.")
    command.add_argument("--dry-run", action="store_true", help="Only list what would be removed.")
    command.add_argument("--scope", action="append", metavar="SCOPE", default=None,
                         help="Limit the cleanup to a scope (e.g. WORLD); may be repeated.")
    return command


def load_catalog_slugs() -> set[str]:
    return {city_slug(city) for city in load_cities() if city_slug(city)}


def already_gone(message: str) -> bool:
    """Detect an already-missing object error (goal reached by another path)."""
    lowered = message.lower()
    return "(#100)" in lowered or "does not exist" in lowered or "not found" in lowered


def main() -> int:
    args = parser().parse_args()
    scopes = {scope.upper() for scope in args.scope} if args.scope else None

    catalog = load_catalog_slugs()
    print(f"ℹ️ Current catalog: {len(catalog)} cities.")
    state = read_json(STATE_FILE, [])
    if not isinstance(state, list):
        print("❌ Invalid history (not a list).")
        return 1

    stale = [
        item for item in state
        if isinstance(item, dict)
        and str(item.get("city_slug") or "").strip() not in catalog
        and item.get("city_slug")
        and item.get("status") != "removed"
        and (scopes is None or str(item.get("scope") or "").upper() in scopes)
    ]
    if not stale:
        print("✅ No stale posts: everything published is still in the catalog.")
        return 0

    print(f"⚠️ {len(stale)} post(s) of cities outside the catalog.")
    tokens = {} if args.dry_run else resolve_page_tokens(load_pages())
    clients: dict[str, FacebookClient] = {}
    changed = False

    for item in stale:
        slug = str(item["city_slug"])
        post_id = str(item.get("post_id") or "").strip()
        scope = str(item.get("scope") or "").upper()
        if args.dry_run:
            print(f"[DRY-RUN] would remove post {post_id or 'without post_id'} (city {slug}, scope {scope})")
            continue
        if not post_id:
            item["status"] = "removed"
            item["removed_at"] = now_utc().isoformat()
            item["remove_detail"] = "without post_id; nothing to delete via API"
            changed = True
            print(f"[{scope}] {slug} | marked as removed (without post_id)")
            continue
        token = tokens.get(scope, "")
        if not token:
            print(f"[{scope}] {slug} | NOT REMOVED — token missing")
            continue
        client = clients.setdefault(scope, FacebookClient(token))
        try:
            client.delete_post(post_id)
            item["status"] = "removed"
            item["removed_at"] = now_utc().isoformat()
            item["remove_detail"] = "deleted via Graph API DELETE"
            changed = True
            print(f"[{scope}] {slug} | REMOVED — post {post_id}")
        except FacebookAPIError as exc:
            if already_gone(str(exc)):
                item["status"] = "removed"
                item["removed_at"] = now_utc().isoformat()
                item["remove_detail"] = f"already missing on the page: {exc}"
                changed = True
                print(f"[{scope}] {slug} | marked as removed (already missing)")
            else:
                print(f"[{scope}] {slug} | ERROR — {exc}")

    if changed:
        write_json(STATE_FILE, state[-PUBLISHED_HISTORY_LIMIT:])
        print("💾 History updated with removal status.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
