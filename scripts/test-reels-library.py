#!/usr/bin/env python3
"""Offline tests for prerecorded media and publishing selection."""
import hashlib
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from types import SimpleNamespace
from concurrent.futures import Future

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from tools.social.reels_library import load_library, select_clip, validate_video


class ReelsLibraryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.directory = tempfile.TemporaryDirectory()
        cls.video = Path(cls.directory.name) / "valid.mp4"
        subprocess.run([
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-f", "lavfi", "-i", "testsrc2=size=540x960:rate=25",
            "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
            "-t", "15", "-c:v", "libx264", "-preset", "ultrafast", "-threads", "2",
            "-pix_fmt", "yuv420p", "-c:a", "aac", "-movflags", "+faststart", str(cls.video),
        ], check=True)

    @classmethod
    def tearDownClass(cls):
        cls.directory.cleanup()

    def fixture(self, directory):
        video = Path(directory) / "videos" / "lisbon-01.mp4"
        video.parent.mkdir()
        video.write_bytes(self.video.read_bytes())
        record = {
            "id": "lisbon-01", "city_slug": "lisbon", "file": "videos/lisbon-01.mp4",
            "source_video_id": "drone123", "source_url": "https://www.youtube.com/watch?v=drone123",
            "source_start_seconds": 25, "captured_at": "2026-10-12T12:00:00Z",
            "source_author": "Drone Author", "branding_applied": True,
            "sha256": hashlib.sha256(video.read_bytes()).hexdigest(),
            "bytes": video.stat().st_size,
        }
        manifest = Path(directory) / "catalog.json"
        manifest.write_text(json.dumps({"schema_version": 1, "clips": [record]}))
        city = {"name": "Lisbon", "country": "Portugal", "videos": {"drone": [{"id": "drone123"}]}}
        return manifest, video, city

    def test_valid_media_has_publishable_format(self):
        metadata = validate_video(self.video)
        self.assertEqual((metadata["width"], metadata["height"], metadata["fps"]), (540, 960, 25))
        self.assertAlmostEqual(metadata["duration_seconds"], 15, delta=0.15)

    def test_missing_video_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            manifest, video, city = self.fixture(directory)
            video.unlink()
            with self.assertRaises(ValueError):
                load_library([city], manifest)

    def test_changed_video_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            manifest, video, city = self.fixture(directory)
            video.write_bytes(video.read_bytes() + b"changed")
            with self.assertRaises(ValueError):
                load_library([city], manifest)

    def test_unknown_city_is_not_selected(self):
        with tempfile.TemporaryDirectory() as directory:
            manifest, video, city = self.fixture(directory)
            self.assertEqual(load_library([], manifest), [])

    def test_recent_city_is_not_selected(self):
        records = [{"city_slug": "lisbon", "id": "lisbon-01"}, {"city_slug": "tokyo", "id": "tokyo-01"}]
        self.assertEqual(select_clip(records, {"lisbon"})["id"], "tokyo-01")
        with self.assertRaises(ValueError):
            select_clip(records, {"lisbon", "tokyo"})

    def test_path_escape_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            manifest, video, city = self.fixture(directory)
            payload = json.loads(manifest.read_text())
            payload["clips"][0]["file"] = "../outside.mp4"
            manifest.write_text(json.dumps(payload))
            with self.assertRaises(ValueError):
                load_library([city], manifest)

    def test_prerecorded_cli_does_not_capture_or_publish_in_preview(self):
        from tools.social import shorts_daily
        with tempfile.TemporaryDirectory() as directory:
            manifest, video, city = self.fixture(directory)
            with patch.dict(os.environ, {"YOUCITY_REELS_MANIFEST": str(manifest)}), \
                    patch.object(shorts_daily, "OUTPUT_DIR", Path(directory) / "out"), \
                    patch.object(shorts_daily, "load_catalog", return_value=[city]), \
                    patch.object(shorts_daily, "generate_short", side_effect=AssertionError("Capture must not be used")), \
                    patch.object(shorts_daily, "publish_short", side_effect=AssertionError("Preview must not publish")), \
                    patch.object(shorts_daily, "STATE_FILE", Path(directory) / "history.json"), \
                    patch.object(sys, "argv", ["shorts_daily", "--source", "prerecorded", "--city", "lisbon", "--generate-only"]):
                self.assertEqual(shorts_daily.main(), 0)
            self.assertFalse((Path(directory) / "history.json").exists())

    def test_required_provenance_cannot_be_missing_or_invalid(self):
        cases = [("source_author", None), ("captured_at", None), ("captured_at", "not-a-date"),
                 ("source_start_seconds", None), ("source_start_seconds", -1),
                 ("source_start_seconds", float("nan")), ("branding_applied", False)]
        for key, value in cases:
            with self.subTest(key=key, value=value), tempfile.TemporaryDirectory() as directory:
                manifest, video, city = self.fixture(directory)
                payload = json.loads(manifest.read_text())
                if value is None:
                    payload["clips"][0].pop(key)
                else:
                    payload["clips"][0][key] = value
                manifest.write_text(json.dumps(payload))
                with self.assertRaises(ValueError):
                    load_library([city], manifest)

    def test_worker_rejects_non_drone_provenance_and_missing_branding(self):
        from tools.social.pregenerate_reels import capture_job
        for source_id, branding in [("walking456", True), ("drone123", False)]:
            with self.subTest(source_id=source_id, branding=branding), tempfile.TemporaryDirectory() as directory:
                manifest, video, city = self.fixture(directory)
                provenance = json.loads(manifest.read_text())["clips"][0]
                provenance.update(source_video_id=source_id, branding_applied=branding)
                work = Path(directory) / "work"
                capture_dir = work / "lisbon-01"
                capture_dir.mkdir(parents=True)
                (capture_dir / "lisbon_capture.json").write_text(json.dumps(provenance))
                with patch.dict(sys.modules, {"tools.social.video_capture_browser": SimpleNamespace(capture_mobile_video=lambda *args, **kwargs: video)}):
                    result = capture_job(city, "lisbon-01", str(work), None)
                self.assertTrue(result.get("error"), result)

    def test_fallbacks_wait_for_last_successful_primary_capture(self):
        from tools.social import pregenerate_reels
        with tempfile.TemporaryDirectory() as directory:
            manifest, video, city = self.fixture(directory)
            city = {**city, "name": "Beta"}
            catalog = [{**city, "name": "Alpha"}, city]
            futures = []

            class Executor:
                def __init__(self, **kwargs): pass
                def __enter__(self): return self
                def __exit__(self, *args): pass
                def submit(self, function, chosen_city, identifier, work_root, start):
                    future = Future()
                    future.result_fixture = {"id": identifier, "city_slug": "alpha", "error": "unavailable"} if identifier.startswith("alpha") else {
                        "id": identifier, "city_slug": "beta", "city_name": "Beta", "temporary_path": str(video),
                        "source_start_seconds": start if start is not None else 25, "bytes": video.stat().st_size,
                    }
                    futures.append(future)
                    return future

            def finish_one(pending, **kwargs):
                future = next(future for future in futures if future in pending)
                future.set_result(future.result_fixture)
                return {future}, set(pending) - {future}

            library = Path(directory) / "library"
            with patch.object(pregenerate_reels, "ProcessPoolExecutor", Executor), \
                    patch.object(pregenerate_reels, "wait", finish_one), \
                    patch.object(pregenerate_reels, "ROOT", Path(directory)):
                data_dir = Path(directory) / "data"
                data_dir.mkdir()
                (data_dir / "catalog.json").write_text(json.dumps(catalog))
                result = pregenerate_reels.build_library(3, 2, library, Path(directory) / "work")
            self.assertEqual(result, 0)
            records = json.loads((library / "catalog.json").read_text())["clips"]
            self.assertEqual([record["id"] for record in records], ["beta-01", "beta-02", "beta-03"])
            self.assertEqual([record["source_start_seconds"] for record in records], [25, 70, 115])


if __name__ == "__main__":
    unittest.main()
