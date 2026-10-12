"""Generate a resumable library of drone Reels locally, without publishing."""
from __future__ import annotations

import argparse
import json
import math
import shutil
import sys
from concurrent.futures import ProcessPoolExecutor, wait, FIRST_COMPLETED
from datetime import datetime, timezone
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from tools.social.reels_library import ROOT, load_library, sha256_file, validate_video, validate_provenance
from tools.social.utils import city_slug, display_city_name, display_country_name


def capture_job(city: dict, clip_id: str, work_root: str, start_seconds: float | None) -> dict:
    """Worker owns its browser and all temporary files; parent alone edits the manifest."""
    from tools.social.video_capture_browser import capture_mobile_video
    directory = Path(work_root) / clip_id
    directory.mkdir(parents=True, exist_ok=True)
    log = directory / "capture.log"
    with log.open("w", encoding="utf-8") as stream:
        original_stdout, original_stderr = sys.stdout, sys.stderr
        sys.stdout = sys.stderr = stream
        try:
            slug = city_slug(city)
            captured = capture_mobile_video(
                slug, duration=15, output_dir=directory, timeout=20000,
                expected_video_ids={str(ride["id"]) for ride in city["videos"]["drone"] if ride.get("id")},
                start_seconds=start_seconds,
            )
            if not captured:
                return {"id": clip_id, "city_slug": slug, "error": "capture failed", "log": str(log)}
            properties = validate_video(captured)
            provenance = json.loads((directory / f"{slug}_capture.json").read_text())
            validate_provenance(provenance, {str(ride["id"]) for ride in city["videos"]["drone"] if ride.get("id")})
            return {"id": clip_id, "city_slug": slug, "city_name": display_city_name(city),
                    "country": display_country_name(city), "temporary_path": str(captured),
                    **provenance, **properties}
        except Exception as exc:
            print(f"Capture failed: {type(exc).__name__}: {exc}")
            return {"id": clip_id, "city_slug": city_slug(city), "error": type(exc).__name__, "log": str(log)}
        finally:
            sys.stdout, sys.stderr = original_stdout, original_stderr


def write_manifest(path: Path, records: list[dict]) -> None:
    payload = {"schema_version": 1, "generated_at": datetime.now(timezone.utc).isoformat(),
               "duration_seconds": 15, "clips": sorted(records, key=lambda record: record["id"])}
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".tmp.json")
    temporary.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    temporary.replace(path)


def build_library(target: int, workers: int, library_dir: Path, work_dir: Path, start_overrides: dict | None = None) -> int:
    catalog = json.loads((ROOT / "data" / "catalog.json").read_text())
    cities = [city for city in catalog if city.get("videos", {}).get("drone")]
    manifest = library_dir / "catalog.json"
    records = []
    if manifest.exists():
        records = [{key: value for key, value in record.items() if key != "path"}
                   for record in load_library(catalog, manifest)]
    if len(records) > target:
        raise ValueError(f"Existing library has {len(records)} clips, exceeding target {target}")
    existing_ids = {record["id"] for record in records}
    covered = {record["city_slug"] for record in records}
    overrides = start_overrides or {}
    if any(type(value) not in (int, float) or not math.isfinite(value) or value < 0 for value in overrides.values()):
        raise ValueError("Capture start overrides must be finite nonnegative seconds")
    primary = [(city, f"{city_slug(city)}-01", overrides.get(city_slug(city)))
               for city in cities if city_slug(city) not in covered]
    primary.sort(key=lambda job: city_slug(job[0]) not in overrides)
    queue = list(primary)
    fallback_added = False
    failures = []
    by_slug = {city_slug(city): city for city in cities}
    print(f"Resuming {len(records)}/{target}; {len(primary)} new cities; {workers} workers", flush=True)
    (library_dir / "videos").mkdir(parents=True, exist_ok=True)
    with ProcessPoolExecutor(max_workers=workers) as pool:
        pending = {}
        while len(records) < target:
            if not queue and not pending and not fallback_added:
                # These are distinct scenes, never copies of the first clip.
                for number in (2, 3):
                    for record in list(records):
                        identifier = f"{record['city_slug']}-{number:02d}"
                        if identifier not in existing_ids and record["id"].endswith("-01"):
                            queue.append((by_slug[record["city_slug"]], identifier,
                                          float(record["source_start_seconds"]) + (number - 1) * 45))
                fallback_added = True
            while queue and len(pending) < workers and len(records) + len(pending) < target:
                city, identifier, start = queue.pop(0)
                pending[pool.submit(capture_job, city, identifier, str(work_dir), start)] = identifier
            if not pending:
                break
            done, _ = wait(pending, return_when=FIRST_COMPLETED)
            for future in done:
                identifier = pending.pop(future)
                try:
                    record = future.result()
                except Exception as exc:
                    record = {"id": identifier, "error": type(exc).__name__}
                if record.get("error"):
                    failures.append(record)
                    print(f"Skipped {identifier}: {record['error']} ({len(records)}/{target})", flush=True)
                    continue
                source = Path(record.pop("temporary_path"))
                destination = library_dir / "videos" / f"{identifier}.mp4"
                temporary = destination.with_suffix(".tmp.mp4")
                shutil.copyfile(source, temporary)
                temporary.replace(destination)
                record["file"] = f"videos/{identifier}.mp4"
                record["sha256"] = sha256_file(destination)
                records.append(record)
                existing_ids.add(identifier)
                write_manifest(manifest, records)
                print(f"Ready {len(records)}/{target}: {identifier}, {record['bytes']/1024**2:.1f} MiB", flush=True)
    work_dir.mkdir(parents=True, exist_ok=True)
    (work_dir / "failures.json").write_text(json.dumps(failures, indent=2) + "\n")
    print(f"Library: {len(records)} clips, {len({record['city_slug'] for record in records})} cities, "
          f"{sum(record['bytes'] for record in records)/1024**2:.1f} MiB", flush=True)
    return 0 if len(records) == target else 1


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--count", type=int, default=100)
    parser.add_argument("--workers", type=int, default=6)
    parser.add_argument("--library-dir", type=Path, default=ROOT / "social" / "reels")
    parser.add_argument("--work-dir", type=Path, default=ROOT / "out" / "reels-library")
    parser.add_argument("--start-overrides", type=Path, help="JSON mapping city slugs to reviewed source start seconds")
    args = parser.parse_args()
    if args.count < 1 or not 1 <= args.workers <= 8:
        parser.error("count must be positive and workers must be between 1 and 8")
    overrides = json.loads(args.start_overrides.read_text()) if args.start_overrides else None
    return build_library(args.count, args.workers, args.library_dir, args.work_dir, overrides)


if __name__ == "__main__":
    raise SystemExit(main())
