"""Which named ways in an OSM path network could become routes, and why not.

REVIEW ONLY. This module opens no database, plans no route, and produces no
geometry for publication. It answers one question about an extract that is
already on disk: if we tried to build canonical routes out of the named ways in
it, what would we get?

WHY THIS EXISTS RATHER THAN AN IMPORTER
---------------------------------------
The obvious next step after extracting a path network is to route across it —
find the summit, find a trailhead, and let a shortest-path algorithm join them
up. That step is deliberately not taken here, and this module is the evidence
for why.

Run against the committed Tryfan extract, nineteen named ways yield one
candidate, and that one only under a tolerance more generous than the extract
was built with. The remainder are too short to be routes, are broken into
fragments, or belong to a summit that the extract does not contain. An importer
built on top of this would be a large machine returning almost nothing, and the
gaps it would have to bridge to return more are exactly the places where no
single line exists on the ground.

So the report is the deliverable. It tells a reviewer which named ways are worth
a person's attention, and it is cheap to re-run when a wider extract arrives.

THE LINKING PROXY, STATED PLAINLY
---------------------------------
Two ways belong to the same chain when an endpoint of one is the *identical
coordinate* as an endpoint of the other. In OSM a shared node serialises to
identical coordinates, so this agrees with node identity in practice — but it is
a proxy, because a candidate-path-network export carries way ids and drops node
ids. Anything built for publication must compare node ids from the PBF itself.
`LINKING_METHOD` names the proxy so a report can never be mistaken for one.

Coordinates are `(longitude, latitude)` throughout, as GeoJSON provides them.
"""

from __future__ import annotations

import json
import math
from collections import Counter, defaultdict
from dataclasses import dataclass
from enum import StrEnum
from pathlib import Path
from typing import Any

#: Named so a reader of a report knows chains were linked by coordinate
#: coincidence and not by the OSM node ids a publishable importer would use.
LINKING_METHOD = "endpoint_coordinate_identity_v1"

#: OSM serialises coordinates at seven decimal places (~11 mm), so rounding
#: there is lossless for comparison and immune to float repr drift.
_COORD_PRECISION = 7

_EARTH_RADIUS_M = 6371008.8


class Shape(StrEnum):
    """What the named ways, taken together, actually form."""

    SIMPLE_PATH = "simple_path"
    LOOP = "loop"
    BRANCHING = "branching"
    FRAGMENTED = "fragmented"


class Verdict(StrEnum):
    """What a reviewer should do with this candidate."""

    REVIEWABLE = "reviewable"
    TOO_SHORT = "too_short"
    NOT_A_SINGLE_LINE = "not_a_single_line"
    SUMMIT_OUT_OF_RANGE = "summit_out_of_range"
    #: The decisive one. A way can only be judged against a summit it could
    #: plausibly belong to. When none was supplied near it, the answer is
    #: unknown, not "no" — see `judging_peak`.
    NO_PEAK_NEARBY = "no_peak_nearby"


@dataclass(frozen=True)
class OsmWay:
    way_id: int
    name: str | None
    highway: str | None
    #: Consecutive duplicate positions removed, so endpoints are meaningful.
    points: tuple[tuple[float, float], ...]


@dataclass(frozen=True)
class Peak:
    """A summit the extract actually contains."""

    name: str
    lon: float
    lat: float
    osm_id: int | None = None


@dataclass(frozen=True)
class Candidate:
    """One named group of ways, assessed."""

    name: str
    way_ids: tuple[int, ...]
    shape: Shape
    chain_count: int
    length_m: float
    #: Largest jump a chain-joining step would have to bridge, 0.0 when the
    #: ways already share endpoints. This is the number that decides whether a
    #: gap is a mapping artefact or a real absence of a single line.
    largest_gap_m: float
    nearest_peak: str | None
    nearest_peak_m: float | None
    verdict: Verdict
    detail: str


@dataclass(frozen=True)
class CandidateReport:
    candidates: tuple[Candidate, ...]
    way_count: int
    named_way_count: int
    linking_method: str
    policy_version: str
    summit_reach_tolerance_m: float
    min_route_length_m: float

    @property
    def reviewable(self) -> tuple[Candidate, ...]:
        return tuple(c for c in self.candidates if c.verdict is Verdict.REVIEWABLE)


def distance_m(a: tuple[float, float], b: tuple[float, float]) -> float:
    """Great-circle metres between two `(lon, lat)` positions."""
    lat1, lat2 = math.radians(a[1]), math.radians(b[1])
    d_lat = lat2 - lat1
    d_lon = math.radians(b[0] - a[0])
    h = math.sin(d_lat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(d_lon / 2) ** 2
    return 2 * _EARTH_RADIUS_M * math.asin(math.sqrt(min(1.0, h)))


def _positions(geometry: Any) -> tuple[tuple[float, float], ...]:
    """Flatten a LineString or MultiLineString into deduplicated positions.

    A MultiLineString here is a way exported as its individual segments, so
    concatenating the parts reconstructs the way. Malformed positions collapse
    the way to empty rather than raising: one bad feature must not fail a whole
    extract, and an empty way is reported as such.
    """
    if not isinstance(geometry, dict):
        return ()
    kind = geometry.get("type")
    raw = geometry.get("coordinates")
    if not isinstance(raw, list):
        return ()
    if kind == "LineString":
        parts: list[Any] = [raw]
    elif kind == "MultiLineString":
        parts = raw
    else:
        return ()

    points: list[tuple[float, float]] = []
    for part in parts:
        if not isinstance(part, list):
            return ()
        for position in part:
            if not isinstance(position, (list, tuple)) or len(position) < 2:
                return ()
            try:
                point = (
                    round(float(position[0]), _COORD_PRECISION),
                    round(float(position[1]), _COORD_PRECISION),
                )
            except (TypeError, ValueError):
                return ()
            if not points or point != points[-1]:
                points.append(point)
    return tuple(points)


def parse_path_network(document: Any) -> list[OsmWay]:
    """Read a candidate-path-network FeatureCollection into ways."""
    if not isinstance(document, dict) or document.get("type") != "FeatureCollection":
        raise ValueError("expected a GeoJSON FeatureCollection")
    features = document.get("features")
    if not isinstance(features, list):
        raise ValueError("FeatureCollection has no features array")

    ways: list[OsmWay] = []
    for feature in features:
        if not isinstance(feature, dict):
            continue
        properties = feature.get("properties")
        if not isinstance(properties, dict):
            properties = {}
        points = _positions(feature.get("geometry"))
        if len(points) < 2:
            continue
        name = properties.get("name")
        raw_id = properties.get("osm_id")
        if raw_id is None:
            continue
        try:
            way_id = int(raw_id)
        except (TypeError, ValueError):
            continue
        ways.append(
            OsmWay(
                way_id=way_id,
                name=name.strip() if isinstance(name, str) and name.strip() else None,
                highway=properties.get("highway"),
                points=points,
            )
        )
    return ways


def path_length_m(points: tuple[tuple[float, float], ...]) -> float:
    return sum(distance_m(points[i], points[i + 1]) for i in range(len(points) - 1))


def bounding_box(ways: list[OsmWay]) -> tuple[float, float, float, float]:
    """`(min_lon, min_lat, max_lon, max_lat)` over every position."""
    lons = [p[0] for w in ways for p in w.points]
    lats = [p[1] for w in ways for p in w.points]
    if not lons:
        raise ValueError("no positions to bound")
    return (min(lons), min(lats), max(lons), max(lats))


def _chains(group: list[OsmWay]) -> list[list[OsmWay]]:
    """Split a named group into connected chains by shared endpoint coordinate."""
    parent = {w.way_id: w.way_id for w in group}

    def find(x: int) -> int:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    at_endpoint: dict[tuple[float, float], list[int]] = defaultdict(list)
    for way in group:
        at_endpoint[way.points[0]].append(way.way_id)
        at_endpoint[way.points[-1]].append(way.way_id)
    for shared in at_endpoint.values():
        for other in shared[1:]:
            root_a, root_b = find(shared[0]), find(other)
            if root_a != root_b:
                parent[root_a] = root_b

    grouped: dict[int, list[OsmWay]] = defaultdict(list)
    for way in group:
        grouped[find(way.way_id)].append(way)
    # Sorted by way id so the report is deterministic.
    return [sorted(v, key=lambda w: w.way_id) for _, v in sorted(grouped.items())]


def _largest_gap_m(chains: list[list[OsmWay]]) -> float:
    """The widest nearest-neighbour gap any chain would have to bridge.

    For each chain, the distance to the closest endpoint of any other chain;
    the largest of those. One chain means no gap at all.
    """
    if len(chains) < 2:
        return 0.0
    endpoints = [[w.points[0] for w in c] + [w.points[-1] for w in c] for c in chains]
    widest = 0.0
    for index, mine in enumerate(endpoints):
        nearest = min(
            distance_m(a, b)
            for other, theirs in enumerate(endpoints)
            if other != index
            for a in mine
            for b in theirs
        )
        widest = max(widest, nearest)
    return widest


def _shape(group: list[OsmWay], chains: list[list[OsmWay]]) -> Shape:
    if len(chains) > 1:
        return Shape.FRAGMENTED
    degree: Counter[tuple[float, float]] = Counter()
    for way in group:
        degree[way.points[0]] += 1
        degree[way.points[-1]] += 1
    if any(count >= 3 for count in degree.values()):
        return Shape.BRANCHING
    terminals = [c for c, count in degree.items() if count == 1]
    if not terminals:
        return Shape.LOOP
    return Shape.SIMPLE_PATH if len(terminals) == 2 else Shape.FRAGMENTED


def _nearest_peak(
    group: list[OsmWay], peaks: list[Peak]
) -> tuple[Peak | None, float | None]:
    """Closest approach of any vertex to any supplied peak."""
    best: tuple[Peak | None, float | None] = (None, None)
    for peak in peaks:
        target = (peak.lon, peak.lat)
        approach = min(distance_m(p, target) for w in group for p in w.points)
        if best[1] is None or approach < best[1]:
            best = (peak, approach)
    return best


def judging_peak(length_m: float, approach_m: float | None) -> bool:
    """Whether a peak is close enough to this way to judge it at all.

    A peak further from a way than the way is long cannot be that way's summit:
    you cannot walk a kilometre and end up on a hill four kilometres away. The
    bound scales with the route, so it needs no magic constant, and it is the
    rule that stops a report from announcing that Crib Goch fails to reach
    Tryfan — which is true, irrelevant, and reads like a mapping defect.
    """
    return approach_m is not None and approach_m <= length_m


def assess(
    ways: list[OsmWay],
    peaks: list[Peak],
    *,
    summit_reach_tolerance_m: float,
    min_route_length_m: float,
) -> list[Candidate]:
    """Assess every named group of ways. Pure and deterministic."""
    named: dict[str, list[OsmWay]] = defaultdict(list)
    for way in ways:
        if way.name:
            named[way.name].append(way)

    candidates: list[Candidate] = []
    for name, group in sorted(named.items()):
        group = sorted(group, key=lambda w: w.way_id)
        chains = _chains(group)
        shape = _shape(group, chains)
        length_m = sum(path_length_m(w.points) for w in group)
        gap_m = _largest_gap_m(chains)
        peak, approach_m = _nearest_peak(group, peaks)

        # Ordered so the cheapest, most certain rejection wins. Length first:
        # a bridge or a gully is not a route whatever its topology, and saying
        # "fragmented" about a seven-metre footbridge is noise.
        if length_m < min_route_length_m:
            verdict = Verdict.TOO_SHORT
            detail = f"{length_m:.0f} m, below the {min_route_length_m:.0f} m minimum"
        elif shape is not Shape.SIMPLE_PATH:
            verdict = Verdict.NOT_A_SINGLE_LINE
            detail = (
                f"{shape.value} across {len(chains)} chain(s); "
                f"widest gap {gap_m:.0f} m"
                if gap_m
                else f"{shape.value} across {len(chains)} chain(s)"
            )
        elif peak is None or approach_m is None:
            verdict = Verdict.NO_PEAK_NEARBY
            detail = "no peak supplied to measure against"
        elif not judging_peak(length_m, approach_m):
            # Nothing near enough to judge against, so the answer is unknown.
            # Reporting it as a failure is how a clipped extract, or simply a
            # peak nobody supplied, gets mistaken for a mapping problem.
            verdict = Verdict.NO_PEAK_NEARBY
            detail = (
                f"nearest supplied peak {peak.name} is {approach_m:.0f} m away, "
                f"further than the {length_m:.0f} m way is long"
            )
        elif approach_m > summit_reach_tolerance_m:
            verdict = Verdict.SUMMIT_OUT_OF_RANGE
            detail = (
                f"closest approach {approach_m:.0f} m to {peak.name}, "
                f"tolerance {summit_reach_tolerance_m:.0f} m"
            )
        else:
            verdict = Verdict.REVIEWABLE
            detail = (
                f"simple path reaching within {approach_m:.0f} m of {peak.name} "
                f"(tolerance {summit_reach_tolerance_m:.0f} m)"
            )

        candidates.append(
            Candidate(
                name=name,
                way_ids=tuple(w.way_id for w in group),
                shape=shape,
                chain_count=len(chains),
                length_m=round(length_m, 1),
                largest_gap_m=round(gap_m, 1),
                nearest_peak=peak.name if peak else None,
                nearest_peak_m=round(approach_m, 1) if approach_m is not None else None,
                verdict=verdict,
                detail=detail,
            )
        )
    return candidates


def build_report(
    ways: list[OsmWay],
    peaks: list[Peak],
    *,
    summit_reach_tolerance_m: float,
    min_route_length_m: float,
    policy_version: str,
) -> CandidateReport:
    """Assess an extract and wrap the result with the terms it was judged on.

    The tolerances travel with the report because they change the answer. The
    Tryfan extract has exactly one candidate at 150 m and none at 75 m, so a
    report that did not state its tolerance would be unreadable a month later.
    """
    return CandidateReport(
        candidates=tuple(
            assess(
                ways,
                peaks,
                summit_reach_tolerance_m=summit_reach_tolerance_m,
                min_route_length_m=min_route_length_m,
            )
        ),
        way_count=len(ways),
        named_way_count=sum(1 for w in ways if w.name),
        linking_method=LINKING_METHOD,
        policy_version=policy_version,
        summit_reach_tolerance_m=summit_reach_tolerance_m,
        min_route_length_m=min_route_length_m,
    )


def load_path_network(path: Path) -> list[OsmWay]:
    with path.open("r", encoding="utf-8") as handle:
        return parse_path_network(json.load(handle))


def format_report(report: CandidateReport) -> str:
    """A plain-text table for a reviewer."""
    lines = [
        "OSM named-way candidate report (review only; nothing here is publishable)",
        "",
        f"ways: {report.way_count}   named: {report.named_way_count}   "
        f"names: {len(report.candidates)}",
        f"linking: {report.linking_method} (a proxy for OSM node identity)",
        f"policy: {report.policy_version}   "
        f"summit tolerance: {report.summit_reach_tolerance_m:.0f} m   "
        f"minimum length: {report.min_route_length_m:.0f} m",
        "",
        f"{'name':26} {'shape':11} {'len m':>7} {'gap m':>7} {'peak m':>7}  verdict",
        "-" * 92,
    ]
    for c in report.candidates:
        peak = f"{c.nearest_peak_m:.0f}" if c.nearest_peak_m is not None else "-"
        lines.append(
            f"{c.name[:26]:26} {c.shape.value:11} {c.length_m:>7.0f} "
            f"{c.largest_gap_m:>7.1f} {peak:>7}  {c.verdict.value}: {c.detail}"
        )
    lines += ["", f"REVIEWABLE: {len(report.reviewable)} of {len(report.candidates)}"]
    for c in report.reviewable:
        lines.append(f"   {c.name} — ways {', '.join(str(i) for i in c.way_ids)}")
    return "\n".join(lines)
