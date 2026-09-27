"""CLI for the OSM named-way candidate report.

Review only. Opens no database and writes no route. Peaks are supplied by the
caller — the tool never guesses a summit position, because a wrong summit turns
every verdict in the report into a confident falsehood.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from summit_data_engine.config.policy import load_validation_policy
from summit_data_engine.osm.candidates import (
    Peak,
    bounding_box,
    build_report,
    format_report,
    load_path_network,
)


def _peaks(path: Path | None, bbox: tuple[float, float, float, float]) -> list[Peak]:
    """Read peaks and keep only those inside the extract.

    A peak outside the bounding box cannot be reached by anything in the
    extract, so measuring against it would report every way as out of range
    when the real answer is that the extract does not cover that summit.
    """
    if path is None:
        return []
    with path.open("r", encoding="utf-8") as handle:
        raw = json.load(handle)
    if isinstance(raw, dict):
        raw = raw.get("peaks", [])

    min_lon, min_lat, max_lon, max_lat = bbox
    peaks: list[Peak] = []
    for entry in raw:
        lon, lat = float(entry["lon"]), float(entry["lat"])
        if min_lon <= lon <= max_lon and min_lat <= lat <= max_lat:
            osm_id = entry.get("osm_id")
            peaks.append(
                Peak(
                    name=str(entry["name"]),
                    lon=lon,
                    lat=lat,
                    osm_id=int(osm_id) if osm_id is not None else None,
                )
            )
    return peaks


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("network", type=Path, help="candidate path network GeoJSON")
    parser.add_argument("--policy", type=Path, required=True, help="validation policy TOML")
    parser.add_argument(
        "--peaks",
        type=Path,
        help='JSON list of {"name","lat","lon","osm_id"}; peaks outside the extract are dropped',
    )
    parser.add_argument("--json", type=Path, help="also write the report as JSON")
    args = parser.parse_args(argv)

    policy = load_validation_policy(args.policy)
    ways = load_path_network(args.network)
    if not ways:
        print("no usable ways in the network")
        return 1

    bbox = bounding_box(ways)
    peaks = _peaks(args.peaks, bbox)
    report = build_report(
        ways,
        peaks,
        summit_reach_tolerance_m=policy.validation.summit_reach_tolerance_m,
        min_route_length_m=policy.validation.min_route_length_m,
        policy_version=policy.version,
    )

    print(f"extract bbox: {bbox[0]:.5f},{bbox[1]:.5f} .. {bbox[2]:.5f},{bbox[3]:.5f}")
    print(f"peaks inside the extract: {', '.join(p.name for p in peaks) or 'none'}")
    print()
    print(format_report(report))

    if args.json:
        payload = {
            "linking_method": report.linking_method,
            "policy_version": report.policy_version,
            "summit_reach_tolerance_m": report.summit_reach_tolerance_m,
            "min_route_length_m": report.min_route_length_m,
            "bbox_epsg4326": list(bbox),
            "peaks_in_extract": [p.name for p in peaks],
            "candidates": [
                {
                    "name": c.name,
                    "way_ids": list(c.way_ids),
                    "shape": c.shape.value,
                    "chain_count": c.chain_count,
                    "length_m": c.length_m,
                    "largest_gap_m": c.largest_gap_m,
                    "nearest_peak": c.nearest_peak,
                    "nearest_peak_m": c.nearest_peak_m,
                    "verdict": c.verdict.value,
                    "detail": c.detail,
                }
                for c in report.candidates
            ],
        }
        args.json.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        print(f"\nwrote {args.json}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
