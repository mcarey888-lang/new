"""Deterministic trace geometry, in plain Python.

Every function here is pure and dependency-free so the planning layer can be
tested without a database, without PostGIS and without shapely. The engine
still uses those at the point of writing; it does not need them to decide what
to write.

COORDINATE ORDER IS A TRAP HERE, so it is stated once and obeyed throughout:
inside this module points are `TracePoint(lat, lon, ...)`, because that is the
order the app records them in. The engine's `route_geometries.geom` is a
LINESTRING in EPSG:4326, and both PostGIS and the app's `RouteGeometry` type
want `(longitude, latitude)`. The flip happens exactly once, in
`to_linestring_coordinates`, and nowhere else.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

EARTH_RADIUS_M = 6_371_000.0


@dataclass(frozen=True)
class TracePoint:
    """One recorded fix. `alt` and `ts` are optional because the app allows both."""

    lat: float
    lon: float
    alt: float | None = None
    ts: int | None = None


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in metres.

    This mirrors the `haversineKm` the API server already uses for the same
    traces, so the engine and the server never disagree about how far apart two
    fixes are.
    """
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon / 2) ** 2
    )
    return EARTH_RADIUS_M * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def point_distance_m(a: TracePoint, b: TracePoint) -> float:
    return haversine_m(a.lat, a.lon, b.lat, b.lon)


def path_length_m(points: list[TracePoint]) -> float:
    """Ground distance along the trace. Elevation is ignored, as GPS distance is."""
    return sum(point_distance_m(points[i - 1], points[i]) for i in range(1, len(points)))


def max_segment_jump_m(points: list[TracePoint]) -> float:
    """The largest gap between consecutive fixes.

    A large gap is the signature of a GPS dropout or a device waking up miles
    away. The straight line drawn across such a gap is fiction, which is why
    `RouteValidationPolicy.max_segment_jump_m` exists to reject it.
    """
    if len(points) < 2:
        return 0.0
    return max(point_distance_m(points[i - 1], points[i]) for i in range(1, len(points)))


def nearest_approach_m(points: list[TracePoint], lat: float, lon: float) -> float:
    """How close the trace ever gets to a position.

    Deliberately measured against the WHOLE trace rather than its start: a
    route to a summit usually begins at a car park some distance away, so the
    start point says nothing about which mountain the trace belongs to.
    """
    if not points:
        return math.inf
    return min(haversine_m(p.lat, p.lon, lat, lon) for p in points)


def resample(points: list[TracePoint], count: int) -> list[TracePoint]:
    """Resample to a fixed number of evenly-indexed points.

    This is the Python twin of `resampleTrack` in the API server's tracked
    route handler, and interpolates the same way, so a line resampled here
    matches one resampled there. Altitude is interpolated with the position;
    timestamps are dropped, because an interpolated time is a fabrication and
    the canonical line is not a record of any one walk.
    """
    if count < 2 or len(points) < 2:
        return list(points)

    out: list[TracePoint] = []
    for i in range(count):
        t = i / (count - 1)
        idx = t * (len(points) - 1)
        lo = math.floor(idx)
        hi = min(math.ceil(idx), len(points) - 1)
        f = idx - lo
        a, b = points[lo], points[hi]
        alt: float | None = None
        if a.alt is not None and b.alt is not None:
            alt = a.alt * (1 - f) + b.alt * f
        elif a.alt is not None and f == 0:
            alt = a.alt
        out.append(
            TracePoint(
                lat=a.lat * (1 - f) + b.lat * f,
                lon=a.lon * (1 - f) + b.lon * f,
                alt=alt,
            )
        )
    return out


def trim_ends(
    points: list[TracePoint],
    radius_m: float,
    *,
    protect_lat: float | None = None,
    protect_lon: float | None = None,
    protect_radius_m: float = 0.0,
) -> list[TracePoint]:
    """Drop the fixes within `radius_m` of the trace's own first and last point.

    PRIVACY, NOT TIDINESS. A recorded trace frequently starts at the recorder's
    home or their parked car, and publishing that as a canonical route start
    publishes where somebody lives. Trimming both ends costs the exact trailhead
    — a genuine loss for a walking route — and that trade is made deliberately
    in favour of the person who recorded it. A verified trailhead can be
    attached later from a source that is safe to publish.

    THE PROTECTED POSITION EXISTS BECAUSE THE SUMMIT IS OFTEN THE END. A route
    up a mountain finishes on the top, and blindly trimming the last 250 m
    deletes the one point the route is for. A summit is a public, surveyed
    place with no privacy interest in it at all, so trimming stops on reaching
    anything within `protect_radius_m` of it.

    On a circular route the start and end are near each other, so both trims
    bite the same area; the caller is told how much was removed and can reject
    a trace that lost too much.
    """
    if radius_m <= 0 or len(points) < 2:
        return list(points)

    protected = protect_lat is not None and protect_lon is not None

    def is_protected(point: TracePoint) -> bool:
        if not protected:
            return False
        assert protect_lat is not None and protect_lon is not None
        return haversine_m(point.lat, point.lon, protect_lat, protect_lon) <= protect_radius_m

    origin, terminus = points[0], points[-1]

    start = 0
    while (
        start < len(points)
        and point_distance_m(points[start], origin) < radius_m
        and not is_protected(points[start])
    ):
        start += 1

    end = len(points) - 1
    while (
        end > start
        and point_distance_m(points[end], terminus) < radius_m
        and not is_protected(points[end])
    ):
        end -= 1

    return points[start : end + 1]


def ascent_descent_m(points: list[TracePoint], deadband_m: float) -> tuple[float, float]:
    """Cumulative ascent and descent, ignoring movement inside the deadband.

    Barometric and GPS altitude both jitter by several metres while standing
    still. Summing every rise would credit a stationary walker with hundreds of
    metres of ascent, so a change only counts once it exceeds
    `ElevationPolicy.vertical_deadband_m` from the last counted altitude.
    """
    altitudes = [p.alt for p in points if p.alt is not None]
    if len(altitudes) < 2:
        return 0.0, 0.0

    ascent = descent = 0.0
    reference = altitudes[0]
    for altitude in altitudes[1:]:
        delta = altitude - reference
        if abs(delta) < deadband_m:
            continue
        if delta > 0:
            ascent += delta
        else:
            descent += -delta
        reference = altitude
    return ascent, descent


def to_linestring_coordinates(points: list[TracePoint]) -> list[tuple[float, float]]:
    """The one place latitude/longitude order is flipped.

    Returns `(longitude, latitude)` pairs, which is what EPSG:4326 LINESTRING
    geometry and the app's `RouteGeometry.coordinates` type both expect.
    """
    return [(p.lon, p.lat) for p in points]
