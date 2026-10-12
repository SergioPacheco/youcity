# Prerecorded Drone Reels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Commit 100 verified drone MP4s and publish from that library through GitHub Actions.

**Architecture:** A manifest validates local media and ties it to catalog cities. A resumable local batch generator captures drones into isolated temporary directories and adds validated MP4s to the library. The existing CLI selects from the library when using the prerecorded source; the workflow runs that source without browser dependencies.

**Tech Stack:** Python, Playwright, FFmpeg/ffprobe, GitHub Actions.

**Spec:** docs/superpowers/specs/2026-10-12-prerecorded-drone-reels.md

## Global Constraints

- Exactly 100 drone clips, 15 seconds, 540×960, H.264/AAC and 25 fps.
- No photo fallback or other ride modes.
- Existing FB_SYSTEM_USER_TOKEN and FACEBOOK_PAGE_ID secrets only in the publishing job.
- Prefer different cities, use distinct source segments if necessary.
- Temporary captures in out/; committed MP4s in social/reels/videos.
- No real publication without explicit instruction.

## Review Focus

- A missing or corrupted MP4 must be rejected before publication.
- A clip for a city removed from the catalog must not be selected.
- Successful Facebook publication alone may block a city's repeat window.
- A YouTube player changing videos during capture must invalidate the clip.
- Resuming generation must preserve already verified clips without duplicating entries.

## Task 1: Library, generator and CLI

**Files:** Create tools/social/reels_library.py, tools/social/pregenerate_reels.py and scripts/test-reels-library.py; modify shorts_daily.py and video_capture_browser.py.

**Interfaces:** load_library(catalog, manifest_path) returns validated clip records; validate_video(path) returns media properties; the generator writes catalog.json atomically and stores SHA-256 per MP4. CLI source prerecorded loads approved files and never invokes capture or download.

- [x] Write and run failing tests for missing files, altered hashes, removed cities, media format and prerecorded CLI avoiding network generation.
- [x] Implement media validation, local selection and atomic manifest updates.
- [x] Implement resumable batch capture with provenance and independent temporary directories.
- [x] Verify the tests and start generation for 100 clips.

## Task 2: Actions and assets

**Files:** Modify .github/workflows/shorts-daily.yml and docs/SHORTS_SETUP.md; add social/reels/catalog.json and social/reels/videos/*.mp4.

- [x] Configure prerecorded publishing and a generate-only review input, removing capture-site/browser installation from Actions.
- [x] Verify exactly 100 manifest entries, MP4 hashes, actual formats, duration, size and origin metadata.
- [x] Run regression tests and npm test; review code independently.
- [x] Commit code and all 100 files, update PR #12 and run an Actions preview without publishing.
