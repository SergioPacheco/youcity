"""Verified, prerecorded drone media for the Facebook publishing job."""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import random
import subprocess
from fractions import Fraction
from pathlib import Path
from datetime import datetime

from .utils import city_slug

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_MANIFEST = ROOT / "social" / "reels" / "catalog.json"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def validate_provenance(record: dict, drone_ids: set[str], require_branding: bool = True) -> None:
    if record.get("source_video_id") not in drone_ids:
        raise ValueError("Capture source is not a catalog drone")
    if record.get("source_url") != f"https://www.youtube.com/watch?v={record['source_video_id']}":
        raise ValueError("Invalid drone source attribution")
    if not isinstance(record.get("source_author"), str) or not record["source_author"].strip():
        raise ValueError("Drone author is missing")
    start = record.get("source_start_seconds")
    if type(start) not in (int, float) or not math.isfinite(start) or start < 0:
        raise ValueError("Drone source start is invalid")
    try:
        captured = datetime.fromisoformat(record["captured_at"].replace("Z", "+00:00"))
        if captured.tzinfo is None:
            raise ValueError("Capture timestamp needs a timezone")
    except (KeyError, AttributeError, TypeError, ValueError):
        raise ValueError("Drone capture timestamp is invalid") from None
    if require_branding and record.get("branding_applied") is not True:
        raise ValueError("Drone branding was not confirmed")


def validate_video(path: Path) -> dict:
    """Read actual MP4 streams; never trust a filename or stored dimensions."""
    try:
        result = subprocess.run([
            "ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(path),
        ], capture_output=True, text=True, check=True, timeout=30)
        payload = json.loads(result.stdout)
        video = next(stream for stream in payload["streams"] if stream["codec_type"] == "video")
        audio = next(stream for stream in payload["streams"] if stream["codec_type"] == "audio")
        duration = float(payload["format"]["duration"])
        fps = float(Fraction(video["r_frame_rate"]))
        valid = (
            "mp4" in payload["format"]["format_name"].split(",")
            and video["codec_name"] == "h264" and audio["codec_name"] == "aac"
            and video["width"] == 540 and video["height"] == 960
            and video["pix_fmt"] == "yuv420p" and fps == 25
            and 14.8 <= duration <= 15.3 and 0 < path.stat().st_size < 100 * 1024 * 1024
        )
    except (OSError, subprocess.SubprocessError, ValueError, KeyError, StopIteration, ZeroDivisionError) as exc:
        raise ValueError(f"Invalid prerecorded video: {path.name} ({type(exc).__name__})") from None
    if not valid:
        raise ValueError(f"Video does not meet the Reels library format: {path.name}")
    return {"width": 540, "height": 960, "fps": fps, "duration_seconds": duration,
            "video_codec": "h264", "audio_codec": "aac", "bytes": path.stat().st_size}


def load_library(catalog: list[dict], manifest_path: Path | None = None) -> list[dict]:
    path = manifest_path or Path(os.environ.get("YOUCITY_REELS_MANIFEST") or DEFAULT_MANIFEST)
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        raise ValueError(f"Reels library is missing or invalid: {path}") from None
    if not isinstance(payload, dict) or payload.get("schema_version") != 1 or not isinstance(payload.get("clips"), list):
        raise ValueError("Unsupported Reels library manifest")
    cities = {city_slug(city): city for city in catalog}
    root = path.parent.resolve()
    seen = set()
    records = []
    for clip in payload["clips"]:
        if not isinstance(clip, dict) or not clip.get("id") or clip["id"] in seen:
            raise ValueError("Reels library contains an invalid or duplicate clip ID")
        seen.add(clip["id"])
        city = cities.get(clip.get("city_slug"))
        if city is None:
            continue
        filename = clip.get("file")
        if not isinstance(filename, str):
            raise ValueError(f"Missing file for {clip['id']}")
        video = (root / filename).resolve()
        if not video.is_relative_to(root) or video.suffix.lower() != ".mp4" or not video.is_file():
            raise ValueError(f"Missing or invalid path for {clip['id']}")
        if clip.get("bytes") != video.stat().st_size or clip.get("sha256") != sha256_file(video):
            raise ValueError(f"Reels video checksum mismatch: {clip['id']}")
        drone_ids = {str(ride.get("id")) for ride in city.get("videos", {}).get("drone", [])}
        validate_provenance(clip, drone_ids)
        metadata = validate_video(video)
        records.append({**clip, **metadata, "path": video})
    return records


def select_clip(records: list[dict], recent_city_slugs: set[str], city: str | None = None) -> dict:
    eligible = [record for record in records if
                (record["city_slug"] == city if city else record["city_slug"] not in recent_city_slugs)]
    if not eligible:
        raise ValueError("No prerecorded drone is eligible for this city or repeat window")
    return random.choice(eligible)


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate the prerecorded drone library")
    parser.add_argument("--expected-count", type=int, default=100)
    args = parser.parse_args()
    try:
        catalog = json.loads((ROOT / "data" / "catalog.json").read_text())
        clips = load_library(catalog)
        if len(clips) != args.expected_count:
            raise ValueError(f"Expected {args.expected_count} clips, found {len(clips)}")
        print(f"Verified {len(clips)} drones, {len({clip['city_slug'] for clip in clips})} cities, "
              f"{sum(clip['bytes'] for clip in clips) / 1024**2:.1f} MiB")
        return 0
    except ValueError as exc:
        print(f"Library validation failed: {exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
