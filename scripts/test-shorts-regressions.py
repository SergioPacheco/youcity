#!/usr/bin/env python3
"""Offline regressions for the shorts CLI and platform selection."""
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from tools.social.shorts_daily import publish_short


class ShortsRegressions(unittest.TestCase):
    def test_direct_cli_starts_outside_repository(self):
        with tempfile.TemporaryDirectory() as directory:
            result = subprocess.run(
                [sys.executable, str(ROOT / "tools/social/shorts_daily.py"),
                 "--platforms", "facebook", "--help"],
                cwd=directory, capture_output=True, text=True,
            )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("--platforms", result.stdout)

    def test_module_cli_starts(self):
        result = subprocess.run(
            [sys.executable, "-m", "tools.social.shorts_daily", "--help"],
            cwd=ROOT, capture_output=True, text=True,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("--platforms", result.stdout)

    def check_facebook_publication(self, platforms, credentials_exist, tiktok_configured):
        # Keep the actual publishers; replace only the external HTTP calls.
        def facebook_response(url, **kwargs):
            if url.endswith("/me/accounts"):
                payload = {"data": [{"id": "123", "access_token": "page-token"}]}
            elif url.endswith("/123/videos"):
                payload = {"id": "reel-456"}
            else:
                raise AssertionError(f"Unexpected publication request: {url}")
            response = unittest.mock.Mock(status_code=200)
            response.json.return_value = payload
            return response

        with tempfile.TemporaryDirectory() as directory:
            video = Path(directory) / "short.mp4"
            video.write_bytes(b"test-video")
            credentials = Path(directory) / "credentials.json"
            if credentials_exist:
                credentials.write_text("{}", encoding="utf-8")
            environment = {
                "FB_SYSTEM_USER_TOKEN": "system-token",
                "FACEBOOK_PAGE_ID": "123",
                "YOUTUBE_CREDENTIALS_PATH": str(credentials),
                "TIKTOK_ACCESS_TOKEN": "tiktok-token" if tiktok_configured else "",
                "TIKTOK_OPEN_ID": "tiktok-user" if tiktok_configured else "",
            }
            with patch.dict(os.environ, environment, clear=True), \
                    patch("tools.social.publishers.requests.get", side_effect=facebook_response), \
                    patch("tools.social.publishers.requests.post", side_effect=facebook_response):
                results = publish_short(
                    video, {"name": "Sao Paulo", "country": "Brazil"}, None, platforms,
                )
        self.assertEqual(results, {"facebook": "reel-456"})

    def test_facebook_only_without_other_credentials(self):
        self.check_facebook_publication(["facebook"], False, False)

    def test_facebook_only_ignores_other_configured_platforms(self):
        self.check_facebook_publication(["facebook"], True, True)

    def test_unconfigured_optional_platforms_are_skipped(self):
        self.check_facebook_publication(["facebook", "youtube", "tiktok"], False, False)


if __name__ == "__main__":
    unittest.main()
