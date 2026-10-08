from __future__ import annotations

from dataclasses import dataclass, asdict


@dataclass
class Ranking:
    total: float
    modes: float
    videos: float
    radio: float
    completeness: float
    mode_count: int = 0
    video_count: int = 0
    station_count: int = 0

    def as_dict(self) -> dict:
        return asdict(self)


def rank_city(city: dict, modes: list[str], video_count: int, station_count: int) -> Ranking:
    """Score a city 0-100 for social selection. All inputs are catalog facts."""
    mode_count = len(modes)
    modes_points = min(mode_count, 5) * 8.0  # up to 40: variety of rides
    videos_points = min(video_count, 10) * 2.0  # up to 20: depth of catalog
    if station_count >= 3:
        radio_points = 10.0
    elif station_count >= 1:
        radio_points = 5.0
    else:
        radio_points = 0.0
    completeness_points = 0.0
    if city.get("coordinates"):
        completeness_points += 5.0
    if city.get("countryCode"):
        completeness_points += 5.0
    if mode_count >= 4:
        completeness_points += 10.0
    elif mode_count >= 3:
        completeness_points += 5.0
    total = modes_points + videos_points + radio_points + completeness_points
    return Ranking(
        round(total, 2),
        round(modes_points, 2),
        round(videos_points, 2),
        radio_points,
        round(completeness_points, 2),
        mode_count,
        video_count,
        station_count,
    )
