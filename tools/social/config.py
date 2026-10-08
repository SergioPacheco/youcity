from __future__ import annotations

import json
import os
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[2]
DATA_FILE = ROOT_DIR / "data" / "catalog.json"
SOCIAL_CONFIG_DIR = ROOT_DIR / "social"
PAGES_FILE = SOCIAL_CONFIG_DIR / "facebook_pages.json"
STATE_FILE = SOCIAL_CONFIG_DIR / "published.json"
OUTPUT_DIR = ROOT_DIR / "out" / "social"

SITE_URL = "https://youcity.app"
DEFAULT_MIN_MODES = 1
DEFAULT_RECENT_DAYS = 30
DEFAULT_GRAPH_VERSION = "v23.0"

# Single global page strategy (mirrors the "Imovue Brasil" national page).
# Random cities from the whole catalog are posted on this page.
WORLD_SCOPE = "WORLD"

# Publishing grid (local hours in the configured timezone).
# Mirrors the Imovue layout: no schedule logic may live outside this module.
DEFAULT_TIMEZONE = "America/Sao_Paulo"
DEFAULT_POSTS_PER_DAY = 4
ALLOWED_POSTS_PER_DAY = (2, 3, 4)
# Slots per daily count (local time in YOUCITY_FACEBOOK_TIMEZONE).
SCHEDULES = {
    2: ("11:30", "19:00"),
    3: ("10:00", "14:30", "19:30"),
    4: ("09:30", "12:30", "16:30", "20:00"),
}
# Window after the cron trigger in which the slot is still valid (runner lag).
SLOT_TOLERANCE_MINUTES = 50
# History cap (4 posts/day stay well under this for years of daily posting).
PUBLISHED_HISTORY_LIMIT = 10000


def load_local_env() -> None:
    """Load a simple .env file without overriding exported variables."""
    env_path = ROOT_DIR / ".env"
    if not env_path.exists():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
            value = value[1:-1]
        if key and key not in os.environ:
            os.environ[key] = value


def load_pages() -> dict[str, dict]:
    if not PAGES_FILE.exists():
        return {}
    with PAGES_FILE.open(encoding="utf-8") as file:
        return json.load(file)


def load_page_tokens() -> dict[str, str]:
    # GOLDEN RULE: there is exactly ONE secret — FB_SYSTEM_USER_TOKEN
    # (Meta Business System User, no expiry). No other token is read,
    # created or stored.
    load_local_env()
    system_token = os.environ.get("FB_SYSTEM_USER_TOKEN", "").strip()
    if not system_token:
        return {}
    return {WORLD_SCOPE: system_token}


def graph_version() -> str:
    load_local_env()
    return os.environ.get("META_GRAPH_VERSION", DEFAULT_GRAPH_VERSION).strip() or DEFAULT_GRAPH_VERSION


def resolve_page_tokens(pages: dict[str, dict]) -> dict[str, str]:
    """Resolve the effective token per scope.

    On the new Pages experience, read/publish endpoints require each
    page's Page Access Token — the System User token alone is rejected
    (#10). The exchange happens at runtime via ``GET /me/accounts`` and
    page tokens live only in memory: no token is written to disk, logs
    or the repository.

    Without a system token (or when the exchange returns empty), falls
    back to :func:`load_page_tokens` without error — the scope is
    skipped at publish time.
    """
    load_local_env()
    base = load_page_tokens()
    system_token = os.environ.get("FB_SYSTEM_USER_TOKEN", "").strip()
    if not system_token:
        return base
    try:
        page_tokens, page_names = _exchange_system_token(system_token)
    except Exception as exc:
        # requests exceptions may embed the URL (with access_token).
        print(f"⚠️ Page-token exchange failed ({_sanitize(str(exc))}); using configured token.")
        return base
    if not page_tokens:
        print("⚠️ System User has no assets (me/accounts returned 0 pages); using configured token.")
        return base
    _report_discovery(pages or {}, page_names)
    resolved = dict(base)
    for scope, page in (pages or {}).items():
        page_id = str((page or {}).get("pageId") or "").strip()
        if page_id and page_id in page_tokens:
            resolved[str(scope).upper()] = page_tokens[page_id]
    return resolved


def _report_discovery(pages: dict[str, dict], page_names: dict[str, str]) -> None:
    """Assisted auto-discovery: reports mismatches, never posts alone.

    - A page reachable by the System User but missing from
      facebook_pages.json is only REPORTED — never published to without
      an explicit registration with enabled + pageId.
    - A configured scope without access means a missing asset on the
      System User.
    """
    configured = {
        str((page or {}).get("pageId") or "").strip(): scope
        for scope, page in pages.items()
    }
    configured.pop("", None)
    for page_id, name in sorted(page_names.items(), key=lambda item: item[1]):
        if page_id not in configured:
            print(f"ℹ️ Reachable page outside the registry (ignored): {name} ({page_id})")
    for page_id, scope in sorted(configured.items()):
        if page_id not in page_names:
            print(f"⚠️ {scope} configured but not reachable via System User — check assets ({page_id})")


def _exchange_system_token(system_token: str) -> tuple[dict[str, str], dict[str, str]]:
    """Exchange the system token for page tokens.

    Returns (page_tokens, page_names): page_id → page_token and
    page_id → name. Names are only used for the discovery report —
    tokens never reach logs.
    """
    import requests

    url = f"https://graph.facebook.com/{graph_version()}/me/accounts"
    page_tokens: dict[str, str] = {}
    page_names: dict[str, str] = {}
    params: dict[str, object] = {"fields": "id,name,access_token", "limit": 100}
    while url:
        # The token goes as a parameter but never reaches logs or
        # exceptions: on error only Meta's message (without token) is raised.
        response = requests.get(url, params={**params, "access_token": system_token}, timeout=30)
        if response.status_code >= 400:
            raise RuntimeError(_graph_error_message(response))
        data = response.json()
        for item in data.get("data", []):
            page_id = str(item.get("id") or "").strip()
            page_token = str(item.get("access_token") or "").strip()
            if page_id:
                page_names[page_id] = str(item.get("name") or page_id)
            if page_id and page_token:
                page_tokens[page_id] = page_token
        paging = (data.get("paging") or {}).get("next", "")
        url = paging
        params = {}
    return page_tokens, page_names


def _graph_error_message(response) -> str:
    try:
        error = response.json().get("error", {})
        detail = error.get("message") or ""
        code = error.get("code", "")
        return f"Graph API {response.status_code}/{code}: {detail}"[:300]
    except ValueError:
        return f"Graph API {response.status_code}"


def _sanitize(text: str) -> str:
    """Strip access_token values from error messages (never in logs)."""
    import re

    text = re.sub(r"access_token=[^&\s]+", "access_token=***", text)
    if len(text) > 300:
        text = text[:300]
    return text


def facebook_timezone() -> str:
    load_local_env()
    return os.environ.get("YOUCITY_FACEBOOK_TIMEZONE", DEFAULT_TIMEZONE).strip() or DEFAULT_TIMEZONE


def posts_per_day() -> int:
    """Daily count (2-4); missing or invalid falls back to 4."""
    load_local_env()
    try:
        value = int(os.environ.get("YOUCITY_FACEBOOK_POSTS_PER_DAY", DEFAULT_POSTS_PER_DAY))
    except (TypeError, ValueError):
        return DEFAULT_POSTS_PER_DAY
    return value if value in ALLOWED_POSTS_PER_DAY else DEFAULT_POSTS_PER_DAY


def repost_after_days() -> int:
    load_local_env()
    try:
        value = int(os.environ.get("YOUCITY_FACEBOOK_REPOST_AFTER_DAYS", DEFAULT_RECENT_DAYS))
    except (TypeError, ValueError):
        return DEFAULT_RECENT_DAYS
    return value if value > 0 else DEFAULT_RECENT_DAYS


def schedule_for(count: int) -> tuple[str, ...]:
    return SCHEDULES.get(count, SCHEDULES[DEFAULT_POSTS_PER_DAY])
