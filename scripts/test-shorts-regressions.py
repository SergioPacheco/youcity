#!/usr/bin/env python3
"""Offline regressions for the shorts CLI and platform selection."""
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from tools.social.shorts_daily import publish_short, main, save_state
from tools.social.publishers import FacebookReelsPublisher, PublisherError


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
            elif url.endswith("/123/video_reels"):
                data = kwargs["data"]
                self.assertEqual(data["access_token"], "page-token")
                if data["upload_phase"] == "start":
                    payload = {"video_id": "reel-456", "upload_url": "https://rupload.facebook.com/video-upload/v23.0/reel-456"}
                else:
                    self.assertEqual(data["video_state"], "PUBLISHED")
                    self.assertEqual(data["video_id"], "reel-456")
                    payload = {"success": True}
            elif url.startswith("https://rupload.facebook.com/"):
                self.assertEqual(kwargs["headers"]["Authorization"], "OAuth page-token")
                self.assertEqual(kwargs["headers"]["offset"], "0")
                self.assertEqual(kwargs["headers"]["file_size"], "10")
                self.assertEqual(kwargs["data"].read(), b"test-video")
                payload = {"success": True}
            elif url.endswith("/reel-456"):
                payload = {"status": {"video_status": "ready", "publishing_phase": {"status": "complete"}}}
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

    def test_reel_upload_failure_does_not_finish_publication(self):
        with tempfile.TemporaryDirectory() as directory:
            video = Path(directory) / "short.mp4"
            video.write_bytes(b"test-video")
            responses = [
                unittest.mock.Mock(status_code=200, json=lambda: {"video_id": "456", "upload_url": "https://rupload.facebook.com/video-upload/v23.0/456"}),
                unittest.mock.Mock(status_code=200, json=lambda: {"success": False}),
            ]
            with patch.object(FacebookReelsPublisher, "_get_page_access_token", return_value="page-token"), \
                    patch("tools.social.publishers.requests.post", side_effect=responses):
                with self.assertRaises(PublisherError):
                    FacebookReelsPublisher("system-token").upload_reel("123", video, "Test")

    def test_failed_publication_is_not_recorded_as_published(self):
        from tools.social import shorts_daily
        with tempfile.TemporaryDirectory() as directory:
            video = Path(directory) / "short.mp4"
            video.write_bytes(b"test-video")
            history = Path(directory) / "history.json"
            with patch.object(shorts_daily, "STATE_FILE", history):
                save_state({"name": "Lisbon", "country": "Portugal"}, video, None, {"facebook_error": "rejected"})
            import json
            self.assertEqual(json.loads(history.read_text())[0]["status"], "error")

    def test_cli_reports_failed_publication(self):
        from tools.social import shorts_daily
        city = {"name": "Lisbon", "country": "Portugal"}
        with tempfile.TemporaryDirectory() as directory:
            video = Path(directory) / "short.mp4"
            video.write_bytes(b"test-video")
            with patch.object(shorts_daily, "OUTPUT_DIR", Path(directory)), \
                    patch.object(shorts_daily, "STATE_FILE", Path(directory) / "history.json"), \
                    patch.object(shorts_daily, "load_catalog", return_value=[city]), \
                    patch.object(shorts_daily, "get_city_info", return_value=city), \
                    patch.object(shorts_daily, "generate_short", return_value=(video, None)), \
                    patch.object(shorts_daily, "publish_short", return_value={"facebook_error": "rejected"}), \
                    patch.object(sys, "argv", ["shorts_daily", "--city", "lisbon", "--platforms", "facebook", "--source", "browser"]):
                self.assertEqual(main(), 1)

    def test_browser_source_generates_drone_without_youtube_download(self):
        from tools.social import shorts_daily
        with tempfile.TemporaryDirectory() as directory:
            video = Path(directory) / "drone.mp4"
            video.write_bytes(b"captured-drone")
            city = {"name": "Lisbon", "country": "Portugal", "videos": {"drone": [{"id": "drone123"}]}}
            capture = unittest.mock.Mock(return_value=video)
            with patch.dict(sys.modules, {"tools.social.video_capture_browser": SimpleNamespace(capture_mobile_video=capture)}), \
                    patch.object(shorts_daily, "download_youtube_segment", side_effect=AssertionError("YouTube download should not be used")):
                result, radio = shorts_daily.generate_short(city, 15, Path(directory), source="browser")
            self.assertEqual(result.read_bytes(), b"captured-drone")
            self.assertEqual(capture.call_args.kwargs["expected_video_ids"], {"drone123"})

    def test_reels_processing_error_is_not_reported_as_success(self):
        with patch("tools.social.publishers.requests.get") as get, \
                patch("tools.social.publishers.requests.post") as post, \
                tempfile.TemporaryDirectory() as directory:
            video = Path(directory) / "short.mp4"
            video.write_bytes(b"test-video")
            get.side_effect = [
                unittest.mock.Mock(status_code=200, json=lambda: {"data": [{"id": "123", "access_token": "page-token"}]}),
                unittest.mock.Mock(status_code=200, json=lambda: {"status": {"video_status": "error"}}),
            ]
            post.side_effect = [
                unittest.mock.Mock(status_code=200, json=lambda: {"video_id": "456", "upload_url": "https://rupload.facebook.com/video-upload/v23.0/456"}),
                unittest.mock.Mock(status_code=200, json=lambda: {"success": True}),
                unittest.mock.Mock(status_code=200, json=lambda: {"success": True}),
            ]
            with self.assertRaises(PublisherError):
                FacebookReelsPublisher("system-token").upload_reel("123", video, "Test")

    def test_accented_city_can_generate_drone(self):
        from tools.social.video_editor import get_city_drone_video, get_city_info
        city = {"name": "São Paulo", "videos": {"drone": [{"id": "drone123"}]}}
        self.assertEqual(get_city_drone_video([city], "sao-paulo"), {"id": "drone123"})
        self.assertEqual(get_city_info([city], "sao-paulo"), city)

    def test_editor_lookup_starts_outside_repository(self):
        with tempfile.TemporaryDirectory() as directory:
            result = subprocess.run([
                sys.executable, "-c",
                "import runpy, sys; module = runpy.run_path(sys.argv[1]); "
                "assert module['get_city_info']([{'name': 'Lisbon'}], 'lisbon') == {'name': 'Lisbon'}",
                str(ROOT / "tools/social/video_editor.py"),
            ], cwd=directory, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_only_successful_facebook_publication_blocks_repeats(self):
        from tools.social.shorts_daily import _load_recent_slugs
        from tools.social.utils import now_utc
        history = [
            {"city_slug": "lisbon", "status": "published", "published_at": now_utc().isoformat(), "platforms": {"facebook": "reel-1"}},
            {"city_slug": "tokyo", "status": "published", "published_at": now_utc().isoformat(), "platforms": {"youtube": "short-2", "facebook_error": "rejected"}},
        ]
        self.assertEqual(_load_recent_slugs(history, 45), {"lisbon"})


if __name__ == "__main__":
    unittest.main()
