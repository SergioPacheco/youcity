from __future__ import annotations

import re
import time
from datetime import timedelta
from pathlib import Path

import requests

from .config import DEFAULT_RECENT_DAYS, graph_version
from .utils import now_utc, parse_datetime


class FacebookAPIError(RuntimeError):
    def __init__(self, status: int, message: str):
        super().__init__(f"Facebook API {status}: {message}")
        self.status = status


class FacebookClient:
    def __init__(self, token: str, timeout: int = 30):
        self.token = token
        self.timeout = timeout
        self.base_url = f"https://graph.facebook.com/{graph_version()}"
        self.session = requests.Session()

    def _request(self, method: str, path: str, **kwargs) -> dict:
        kwargs.setdefault("timeout", self.timeout)
        params = kwargs.setdefault("params", {})
        params["access_token"] = self.token
        for attempt in range(3):
            try:
                response = self.session.request(method, f"{self.base_url}/{path.lstrip('/')}", **kwargs)
            except requests.RequestException as exc:
                if attempt == 2:
                    raise FacebookAPIError(0, f"network failure: {exc}") from exc
                time.sleep((2, 5, 15)[attempt])
                continue

            if response.status_code in (429, 500, 502, 503, 504):
                if attempt == 2:
                    raise FacebookAPIError(response.status_code, self._message(response))
                time.sleep((2, 5, 15)[attempt])
                continue
            if response.status_code >= 400:
                raise FacebookAPIError(response.status_code, self._message(response))
            try:
                return response.json()
            except ValueError as exc:
                raise FacebookAPIError(response.status_code, "response is not JSON") from exc
        raise FacebookAPIError(0, "unexpected failure")

    @staticmethod
    def _message(response: requests.Response) -> str:
        try:
            error = response.json().get("error", {})
            return str(error.get("message") or response.text[:200])
        except ValueError:
            return response.text[:200]

    def recent_city_slugs(self, page_id: str, days: int = DEFAULT_RECENT_DAYS) -> set[str]:
        since = int((now_utc() - timedelta(days=days)).timestamp())
        data = self._request("GET", f"{page_id}/posts", params={"fields": "message,created_time", "since": since, "limit": 100})
        slugs = set()
        pattern = re.compile(r"youcity\.app/city/([a-z0-9-]+)", re.IGNORECASE)
        for post in data.get("data", []):
            created = parse_datetime(post.get("created_time"))
            if created and created < now_utc() - timedelta(days=days):
                continue
            slugs.update(slug.lower() for slug in pattern.findall(post.get("message", "")))
        return slugs

    def publish_card(self, page_id: str, image_path: Path, caption: str) -> str:
        with image_path.open("rb") as image_file:
            result = self._request(
                "POST",
                f"{page_id}/photos",
                params={},
                files={"source": (image_path.name, image_file, "image/png")},
                data={"message": caption, "published": "true"},
            )
        return str(result.get("post_id") or result.get("id") or "")

    def delete_post(self, post_id: str) -> bool:
        """Delete a page post/photo. Returns True when removed."""
        result = self._request("DELETE", post_id, params={})
        return result.get("success") is True
