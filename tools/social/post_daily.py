from __future__ import annotations

import argparse
import random
import sys
from datetime import timedelta
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    from social.compose_post import city_display_label, compose_post
    from social.config import (DEFAULT_MIN_MODES, OUTPUT_DIR, PUBLISHED_HISTORY_LIMIT,
                               SLOT_TOLERANCE_MINUTES, STATE_FILE, WORLD_SCOPE,
                               facebook_timezone, load_pages,
                               posts_per_day, repost_after_days, resolve_page_tokens,
                               schedule_for)
    from social.templates import last_template_for_scope, select_template
    from social.facebook_client import FacebookAPIError, FacebookClient
    from social.generate_card import generate_card, generate_preview_cards, generate_story_card
    from social.selector import candidates, load_cities, mode_key, weighted_pick
    from social.city_image import download_image, resolve_city_image
    from social.utils import (city_modes, city_slug, city_url, clean_text, display_city_name,
                              display_country_name, local_now, now_utc, parse_datetime, read_json,
                              write_json)
else:
    from .compose_post import city_display_label, compose_post
    from .config import (DEFAULT_MIN_MODES, OUTPUT_DIR, PUBLISHED_HISTORY_LIMIT,
                         SLOT_TOLERANCE_MINUTES, STATE_FILE, WORLD_SCOPE,
                         facebook_timezone, load_pages,
                         posts_per_day, repost_after_days, resolve_page_tokens,
                         schedule_for)
    from .templates import last_template_for_scope, select_template
    from .facebook_client import FacebookAPIError, FacebookClient
    from .generate_card import generate_card, generate_preview_cards, generate_story_card
    from .selector import candidates, load_cities, mode_key, weighted_pick
    from .city_image import download_image, resolve_city_image
    from .utils import (city_modes, city_slug, city_url, clean_text, display_city_name,
                        display_country_name, local_now, now_utc, parse_datetime, read_json,
                        write_json)


def parser() -> argparse.ArgumentParser:
    command = argparse.ArgumentParser(description="Select and publish YouCity cities on social networks.")
    scope = command.add_mutually_exclusive_group(required=True)
    scope.add_argument("--city", action="append", metavar="SLUG", help="Process one city by slug; may be repeated.")
    scope.add_argument("--all", action="store_true", help="Process all configured pages.")
    mode = command.add_mutually_exclusive_group()
    mode.add_argument("--generate-only", action="store_true", help="Generate TXT/PNG without publishing.")
    mode.add_argument("--dry-run", action="store_true", help="Select and generate, but do not publish.")
    mode.add_argument("--publish", action="store_true", help="Publish on the configured pages.")
    command.add_argument("--min-modes", type=int, default=DEFAULT_MIN_MODES,
                         help="Minimum ride modes required (default: 1).")
    command.add_argument("--recent-days", type=int, default=None,
                         help="Anti-duplicate window (default: YOUCITY_FACEBOOK_REPOST_AFTER_DAYS or 30).")
    command.add_argument("--slot", metavar="HH:MM", default=None,
                         help="Force a grid slot (e.g. 09:30); ignores the current time.")
    command.add_argument("--top-n", type=int, default=20,
                         help="Pool size of the best ranked for the weighted draw.")
    command.add_argument("--seed", type=int, default=None,
                         help="Seed for a reproducible draw (omitted = random).")
    command.add_argument("--no-repeat-city-days", type=int, default=14,
                         help="Anti-repeat window per city/country (0 disables).")
    command.add_argument("--preview-templates", action="store_true",
                         help="Render one card per eligible theme ({scope}_preview_{theme}.png); implies generate-only.")
    return command


def available_scopes() -> list[str]:
    if load_cities():
        return [WORLD_SCOPE]
    return []


def lookup_cities(wanted: set[str]) -> dict[str, dict]:
    """Resolve full catalog records for a set of slugs."""
    found: dict[str, dict] = {}
    for city in load_cities():
        slug = city_slug(city)
        if slug in wanted and slug not in found:
            found[slug] = city
        if len(found) >= len(wanted):
            break
    return found


def load_local_recent_slugs(days: int) -> set[str]:
    cutoff = now_utc() - timedelta(days=days)
    state = read_json(STATE_FILE, [])
    return {
        str(item["city_slug"])
        for item in state
        if isinstance(item, dict)
        # Only published entries block (or legacy entries without status);
        # error/skip never marks the city as published.
        and item.get("city_slug") and item.get("status", "published") == "published"
        and (parse_datetime(item.get("published_at")) or now_utc()) >= cutoff
    }


def resolve_slot(slots: tuple[str, ...], tz_name: str, forced: str | None) -> tuple[str, int] | None:
    """Return the (slot, index) due now, or None when off schedule."""
    if forced:
        if forced not in slots:
            raise ValueError(f"slot {forced} outside the grid {list(slots)}")
        return forced, slots.index(forced)
    now = local_now(tz_name)
    for index, slot in enumerate(slots):
        hour, minute = (int(part) for part in slot.split(":"))
        start = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
        delta = (now - start).total_seconds() / 60
        if 0 <= delta < SLOT_TOLERANCE_MINUTES:
            return slot, index
    return None


def slot_key(tz_name: str) -> str:
    return local_now(tz_name).date().isoformat()


def slot_done(state: list, date: str, slot: str, scope: str) -> bool:
    return any(
        isinstance(item, dict)
        and item.get("status") == "published"
        and item.get("scheduled_for") == f"{date} {slot}"
        and str(item.get("scope") or "").upper() == scope
        for item in state
    )


def today_picks(state: list, date: str, scope: str) -> list[dict]:
    """Cities published today (for intra-day variety), with catalog fields."""
    picks = [
        item for item in state
        if isinstance(item, dict)
        and item.get("status") == "published"
        and str(item.get("scheduled_for") or "").startswith(date)
        and str(item.get("scope") or "").upper() == scope
    ]
    if not picks:
        return []
    catalog = lookup_cities({str(p["city_slug"]) for p in picks if p.get("city_slug")})
    enriched = []
    for pick in picks:
        city = catalog.get(str(pick.get("city_slug")), {})
        enriched.append({
            "pais": str(pick.get("pais") or display_country_name(city) or "").strip().upper(),
            "cidade": str(pick.get("cidade") or "").strip().upper(),
            "modos": str(pick.get("modos") or mode_key(city) or "").strip(),
        })
    return enriched


def recent_city_country_sets(days: int) -> tuple[set[str], set[str]]:
    """Cities/countries published in the diversity window (for anti-repeat)."""
    if days <= 0:
        return set(), set()
    cutoff = now_utc() - timedelta(days=days)
    state = read_json(STATE_FILE, [])
    if not isinstance(state, list):
        return set(), set()
    cities: set[str] = set()
    countries: set[str] = set()
    missing_slugs: list[str] = []
    for item in state:
        if not isinstance(item, dict):
            continue
        published = parse_datetime(item.get("published_at")) or now_utc()
        if published < cutoff:
            continue
        city = str(item.get("cidade") or "").strip().upper()
        country = str(item.get("pais") or "").strip().upper()
        if city:
            cities.add(city)
        if country:
            countries.add(country)
        elif not city and item.get("city_slug"):
            missing_slugs.append(str(item["city_slug"]))
    if missing_slugs:
        index = _city_location_index(set(missing_slugs))
        for slug in missing_slugs:
            city, country = index.get(slug, ("", ""))
            if city:
                cities.add(city)
            if country:
                countries.add(country)
    return cities, countries


def _city_location_index(wanted: set[str]) -> dict[str, tuple[str, str]]:
    """Resolve (city, country) for slugs by querying the catalog."""
    found: dict[str, tuple[str, str]] = {}
    for city in load_cities():
        slug = city_slug(city)
        if slug in wanted and slug not in found:
            found[slug] = (
                clean_text(display_city_name(city)).upper(),
                clean_text(display_country_name(city)).upper(),
            )
        if len(found) >= len(wanted):
            break
    return found


def write_summary(results: list[dict]) -> None:
    lines = ["## YouCity Social Publisher", "", "| Scope | City | Score | Action | Detail |", "| --- | --- | ---: | --- | --- |"]
    for result in results:
        lines.append(f"| {result['scope']} | {result.get('city_slug', '—')} | {result.get('score', '—')} | {result['action']} | {result.get('detail', '')} |")
    summary = "\n".join(lines) + "\n"
    summary_path = __import__("os").environ.get("GITHUB_STEP_SUMMARY")
    if summary_path:
        with open(summary_path, "a", encoding="utf-8") as file:
            file.write(summary)


def main() -> int:
    args = parser().parse_args()
    if args.preview_templates and args.publish:
        print("❌ --preview-templates implies generate-only; do not combine with --publish.")
        return 2
    mode = "publish" if args.publish else "generate-only" if (args.generate_only or args.preview_templates) else "dry-run"
    per_day = posts_per_day()
    slots = schedule_for(per_day)
    tz_name = facebook_timezone()
    recent_days = args.recent_days if args.recent_days else repost_after_days()
    try:
        resolved = resolve_slot(slots, tz_name, args.slot)
    except ValueError as exc:
        print(f"❌ {exc}")
        return 2
    if resolved is None:
        print(f"ℹ️ Off schedule (grid {per_day}/day in {tz_name}: {', '.join(slots)}). Nothing to do.")
        return 0
    slot, slot_index = resolved
    today = slot_key(tz_name)

    scopes = [WORLD_SCOPE]
    forced = {slug.strip().lower() for slug in (args.city or []) if slug.strip()} if args.city else None
    pages = load_pages()
    tokens = resolve_page_tokens(pages) if mode == "publish" else {}
    local_recent = load_local_recent_slugs(recent_days)
    results = []
    rng = random.Random(args.seed)
    state = read_json(STATE_FILE, [])
    if not isinstance(state, list):
        state = []

    print(f"ℹ️ Slot {slot} ({slot_index + 1}/{per_day}) in {tz_name} | anti-duplicate {recent_days}d.")
    recent_cities, recent_countries = recent_city_country_sets(args.no_repeat_city_days)

    for scope in scopes:
        if slot_done(state, today, slot, scope):
            result = {"scope": scope, "action": "NOT PUBLISHED", "detail": f"slot {slot} already published today"}
            results.append(result)
            print(f"[{scope}] {result['detail']}")
            continue
        ranked = candidates(args.min_modes, local_recent)
        if forced:
            ranked = [item for item in ranked if city_slug(item[0]) in forced]
            if not ranked:
                result = {"scope": scope, "action": "NOT PUBLISHED", "detail": "forced city not eligible"}
                results.append(result)
                print(f"[{scope}] {result['detail']}")
                continue
        if not ranked:
            result = {"scope": scope, "action": "NOT PUBLISHED", "detail": "no eligible city"}
            results.append(result)
            print(f"[{scope}] {result['detail']}")
            continue

        pool_size = min(max(1, args.top_n), len(ranked))
        (city, ranking), pick_index = weighted_pick(
            ranked, top_n=pool_size, rng=rng,
            recent_cities=recent_cities, recent_countries=recent_countries,
            same_day=today_picks(state, today, scope),
        )
        slug = city_slug(city)
        prefix = scope.lower()
        output_dir = OUTPUT_DIR / now_utc().date().isoformat()
        text_path = output_dir / f"{prefix}.txt"
        image_path = output_dir / f"{prefix}.png"
        story_path = output_dir / f"{prefix}_story.png"
        theme = select_template(city, scope, today, last_template_for_scope(state, scope))
        photo_meta = resolve_city_image(city)
        photo_path = download_image(photo_meta, output_dir / f"{prefix}_photo") if photo_meta else None
        if photo_meta and not photo_path:
            photo_meta = None  # download failed → gradient fallback (re-resolved next run)
        credit = clean_text((photo_meta or {}).get("author", ""))
        text = compose_post(city, scope, ranking.total, slot_index, image=photo_meta)
        text_path.parent.mkdir(parents=True, exist_ok=True)
        text_path.write_text(text + "\n", encoding="utf-8")
        generate_card(city, ranking.total, image_path, theme, photo_path, credit)
        generate_story_card(city, story_path, theme, photo_path, credit)
        if args.preview_templates:
            previews = generate_preview_cards(city, output_dir, prefix, photo_path, credit)
            result = {"scope": scope, "city_slug": slug, "score": ranking.total,
                      "action": "NOT PUBLISHED",
                      "detail": f"PREVIEW slot {slot} theme {theme}: {', '.join(path.name for path in previews)}"}
            results.append(result)
            print(f"[{scope} {slot}] {slug} | {ranking.total} points "
                  f"(#{pick_index + 1}/{pool_size} drawn, pool top-{pool_size}) | "
                  f"{result['action']} — {result['detail']}")
            continue

        scheduled_for = f"{today} {slot}"
        result = {"scope": scope, "city_slug": slug, "score": ranking.total, "action": "NOT PUBLISHED", "detail": f"{mode.upper()} slot {slot} theme {theme}"}
        if mode == "publish":
            page = pages.get(scope, {})
            page_id = str(page.get("pageId") or "").strip()
            token = tokens.get(scope, "")
            if not page.get("enabled") or not page_id or not token:
                result["detail"] = "page disabled or token missing"
                _record(state, city, scope, page_id, "", scheduled_for, tz_name, "skipped", result["detail"], theme, photo_meta)
            else:
                try:
                    client = FacebookClient(token)
                    remote_recent = client.recent_city_slugs(page_id, recent_days)
                    if slug in remote_recent:
                        result["detail"] = "already on the page in the last days"
                        _record(state, city, scope, page_id, "", scheduled_for, tz_name, "skipped", result["detail"], theme, photo_meta)
                    else:
                        post_id = client.publish_card(page_id, image_path, text)
                        _record(state, city, scope, page_id, post_id, scheduled_for, tz_name, "published", "", theme, photo_meta)
                        result["action"] = "PUBLISHED"
                        result["detail"] = post_id or "no post_id returned"
                except FacebookAPIError as exc:
                    # Failure recorded without the token; city NOT marked as published.
                    _record(state, city, scope, page_id, "", scheduled_for, tz_name, "error", _safe_error(exc), theme, photo_meta)
                    result["detail"] = f"ERROR: {_safe_error(exc)}"
                    result["action"] = "ERROR"
        results.append(result)
        print(f"[{scope} {slot}] {slug} ({city_display_label(city)}) | {ranking.total} points "
              f"(#{pick_index + 1}/{pool_size} drawn, pool top-{pool_size}) | "
              f"{result['action']} — {result['detail']}")

    write_summary(results)
    return 0 if all(result["action"] != "ERROR" for result in results) else 1


def _record(state: list, city: dict, scope: str, page_id: str, post_id: str,
            scheduled_for: str, tz_name: str, status: str, error: str,
            template: str = "", photo_meta: dict | None = None) -> None:
    photo_meta = photo_meta or {}
    state.append({
        "city_slug": city_slug(city),
        "scope": scope,
        "template": template,
        "cidade": clean_text(display_city_name(city)).upper(),
        "pais": clean_text(display_country_name(city)).upper(),
        "modos": mode_key(city),
        "page_id": page_id,
        "post_id": post_id,
        "scheduled_for": scheduled_for,
        "published_at": now_utc().isoformat() if status == "published" else "",
        "timezone": tz_name,
        "status": status,
        "error": error,
        "url": city_url(city, scope),
        "foto": {
            "provedor": photo_meta.get("provider", ""),
            "autor": photo_meta.get("author", ""),
            "licenca": photo_meta.get("license", ""),
        } if photo_meta.get("image_url") else None,
    })
    write_json(STATE_FILE, state[-PUBLISHED_HISTORY_LIMIT:])


def _safe_error(exc: Exception) -> str:
    """Secret-free message (the token never reaches the API exception)."""
    text = str(exc)
    for secret in ("access_token", "FB_SYSTEM_USER_TOKEN"):
        text = text.replace(secret, "***")
    return text[:300]


if __name__ == "__main__":
    raise SystemExit(main())
