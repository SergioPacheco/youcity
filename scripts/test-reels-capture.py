#!/usr/bin/env python3
"""Exercise playback validation and MP4 output with real Chromium and FFmpeg."""
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from tools.social.video_capture_browser import wait_for_video_playback, mux_video_audio


class ReelsCapture(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.directory = tempfile.TemporaryDirectory()
        cls.clip = Path(cls.directory.name) / "drone.mp4"
        subprocess.run([
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-f", "lavfi", "-i", "testsrc2=size=540x960:rate=25", "-t", "2",
            "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", str(cls.clip),
        ], check=True)
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(headless=True, args=["--no-sandbox"])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        cls.directory.cleanup()

    def test_error_screen_is_rejected(self):
        page = self.browser.new_page()
        try:
            page.set_content('<iframe srcdoc="Sign in to confirm you are not a bot"></iframe>')
            self.assertFalse(wait_for_video_playback(page, timeout=400))
        finally:
            page.close()

    def test_playing_video_is_required(self):
        page = self.browser.new_page()
        try:
            page.route("https://capture.test/**", lambda route: route.fulfill(
                content_type="video/mp4" if route.request.url.endswith(".mp4") else "text/html",
                body=self.clip.read_bytes() if route.request.url.endswith(".mp4") else '<div id="movie_player"></div><video src="/drone.mp4" autoplay muted loop></video><script>window.liveId="drone123"; document.querySelector("#movie_player").getVideoData = () => ({video_id:window.liveId});</script>',
            ))
            page.goto("https://capture.test/embed/drone123")
            self.assertTrue(wait_for_video_playback(page, timeout=5000, expected_video_ids={"drone123"}))
            page.evaluate("document.querySelector('video').pause()")
            self.assertFalse(wait_for_video_playback(page, timeout=400))
            page.evaluate("document.querySelector('video').play()")
            self.assertFalse(wait_for_video_playback(page, timeout=400, expected_video_ids={"walking456"}))
            # YouTube loadVideoById changes the live video while retaining the iframe URL.
            page.evaluate("window.liveId = 'walking456'")
            self.assertFalse(wait_for_video_playback(page, timeout=400, expected_video_ids={"drone123"}))
        finally:
            page.close()

    def test_mp4_remains_publishable_without_radio(self):
        output = Path(self.directory.name) / "final.mp4"
        self.assertEqual(mux_video_audio(self.clip, None, output, 1), output)
        probe = subprocess.run([
            "ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(output),
        ], capture_output=True, text=True, check=True)
        payload = json.loads(probe.stdout)
        video = next(stream for stream in payload["streams"] if stream["codec_type"] == "video")
        audio = next(stream for stream in payload["streams"] if stream["codec_type"] == "audio")
        self.assertEqual((video["width"], video["height"]), (540, 960))
        self.assertEqual(video["codec_name"], "h264")
        self.assertEqual(video["r_frame_rate"], "25/1")
        self.assertEqual(audio["codec_name"], "aac")
        self.assertAlmostEqual(float(payload["format"]["duration"]), 1, delta=0.15)


if __name__ == "__main__":
    unittest.main()
