"""Decide what a set of recorded traces should become, without writing anything.

Mirrors `international.importer.plan_import`: planning is a pure function over
plain data, so the rules can be tested exhaustively with no database, and the
apply step has no judgement left in it.

THE SAFETY PROPERTY THIS MODULE EXISTS TO HOLD
----------------------------------------------
Nothing planned here is ever `VerificationStatus.VERIFIED`. The app refuses to
navigate a route unless its engine status is `verified` AND its product
lifecycle is `summitready_verified` (`utils/routeEligibility.ts`). A recorded
line is evidence, not endorsement, so it lands at `processed` — or at
`needs_review` when something about it wants a human — and the Start button
stays off. `test_recorded_route_planner.py` asserts this directly.
"""

from __future__ import annotations

import re
import uuid
from dataclasses import dataclass, field
from enum import StrEnum

from summit_data_engine.config.policy import ValidationPolicy
from summit_data_engine.models.domain import VerificationStatus
from summit_data_engine.recorded.traces import (
    TracePoint,
    ascent_descent_m,
    max_segment_jump_m,
    nearest_approach_m,
    path_length_m,
    resample,
    to_linestring_coordinates,
    trim_ends,
)

# How many points a planned canonical line carries. Enough to hold the shape of
# a mountain route, small enough to ship inside an offline route corridor.
CANONICAL_SAMPLE_COUNT = 512

# Below this a "trace" is a handful of fixes, not a route.
MIN_TRACE_POINTS = 20

# Privacy trim applied to both ends of every trace. See `traces.trim_ends`.
DEFAULT_PRIVACY_TRIM_M = 250.0

# Reject the trace if the privacy trim ate more than this share of its length;
# what is left is no longer the route that was walked.
MAX_PRIVACY_TRIM_FRACTION = 0.35

# The engine's own identity namespace for this source.
IDENTITY_NAMESPACE = "recorded"

DERIVATION_METHOD = "recorded_trace_merge_v1"


class SkipReason(StrEnum):
    """Why a trace produced no route. Values are stable; they are reported on."""

    TOO_FEW_POINTS = "too_few_points"
    TOO_SHORT = "too_short"
    TOO_LONG = "too_long"
    GPS_JUMP = "gps_jump"
    NO_SUMMIT_MATCH = "no_summit_match"
    AMBIGUOUS_SUMMIT = "ambiguous_summit"
    IMPLAUSIBLE_ELEVATION = "implausible_elevation"
    PRIVACY_TRIM_EXHAUSTED = "privacy_trim_exhausted"


class QaFlag(StrEnum):
    """Accepted, but a human should know. Present on the planned record."""

    AUTO_GENERATED_NAME = "auto_generated_name"
    SINGLE_CONTRIBUTION = "single_contribution"
    PRIVACY_TRIM_SIGNIFICANT = "privacy_trim_significant"
    REPORTED_DISTANCE_DIFFERS = "reported_distance_differs"
    NO_ALTITUDE = "no_altitude"


@dataclass(frozen=True)
class RecordedTrace:
    """One row of `tracked_routes`, with its canonical merged line.

    `contribution_count` is how many separate walks the API server has already
    merged into `points`. It is the strength of the evidence, and it drives the
    identity version: more walks means a better line, which means a new version
    rather than a rewrite of an immutable one.

    `created_by` is intentionally absent. The recorder's identity is not part of
    a canonical route and must not travel into the engine.
    """

    trace_id: str
    name: str
    points: list[TracePoint]
    distance_km: float
    elevation_gain_m: float
    elevation_loss_m: float
    duration_secs: int
    contribution_count: int = 0
    difficulty: str | None = None
    location: str | None = None
    contributed_names: tuple[str, ...] = ()
    contributed_duration_secs: tuple[int, ...] = ()


@dataclass(frozen=True)
class CandidateMountain:
    """A row of `mountains` a trace might belong to."""

    mountain_id: uuid.UUID
    name: str
    lat: float
    lon: float
    elevation_m: float | None = None


@dataclass(frozen=True)
class PlannedGeometry:
    """Coordinates are `(longitude, latitude)`, ready for a 4326 LINESTRING."""

    coordinates: list[tuple[float, float]]
    derivation_method: str
    source_point_count: int


@dataclass(frozen=True)
class PlannedFacts:
    distance_km: float
    total_ascent_m: float
    total_descent_m: float
    typical_duration_hours: float | None
    summit_elevation_m: float | None


@dataclass(frozen=True)
class PlannedRoute:
    """Everything the apply step needs, with no decisions left to make."""

    trace_id: str
    mountain_id: uuid.UUID
    identity_key: str
    version: str
    canonical_name: str
    aliases: tuple[str, ...]
    description: str
    status: VerificationStatus
    geometry: PlannedGeometry
    facts: PlannedFacts
    qa_flags: tuple[QaFlag, ...]
    contribution_count: int


@dataclass(frozen=True)
class SkippedTrace:
    trace_id: str
    reason: SkipReason
    detail: str


@dataclass(frozen=True)
class ImportPlan:
    planned: list[PlannedRoute] = field(default_factory=list)
    skipped: list[SkippedTrace] = field(default_factory=list)
    policy_version: str = ""

    @property
    def planned_count(self) -> int:
        return len(self.planned)

    @property
    def skipped_count(self) -> int:
        return len(self.skipped)


# The app mints a placeholder title of the form "Hike – 24 Sept 2026, 10:37"
# when the user does not name an activity, and the tracked-route table defaults
# its location to "GPS Tracked Route". Neither is a route name, and neither
# should be published as one.
_AUTO_NAME_PATTERNS = (
    re.compile(r"^hike\s*[–\-—]\s*\d", re.IGNORECASE),
    re.compile(r"^gps\s+tracked\s+route$", re.IGNORECASE),
    re.compile(r"^(untitled|activity|walk|route)\s*\d*$", re.IGNORECASE),
    re.compile(r"^\d{4}-\d{2}-\d{2}"),
)


def looks_auto_generated(name: str) -> bool:
    """True when a name was minted by software rather than chosen by a person."""
    candidate = name.strip()
    if not candidate:
        return True
    return any(pattern.match(candidate) for pattern in _AUTO_NAME_PATTERNS)


def _match_mountain(
    points: list[TracePoint],
    mountains: list[CandidateMountain],
    tolerance_m: float,
) -> tuple[CandidateMountain | None, SkipReason | None, str]:
    """Which mountain, if any, this trace belongs to.

    A trace matches a summit when it passes within `summit_reach_tolerance_m`
    of it. Where two summits both qualify and neither is clearly closer, the
    match is refused rather than guessed: `.agents/memory/ambiguous-hill-identity.md`
    records what name- and proximity-based guessing has already cost us, and a
    route filed under the wrong mountain is worse than a route filed under none.
    """
    approaches = sorted(
        (
            (nearest_approach_m(points, mountain.lat, mountain.lon), mountain)
            for mountain in mountains
        ),
        key=lambda pair: (pair[0], str(pair[1].mountain_id)),
    )
    within = [(distance, mountain) for distance, mountain in approaches if distance <= tolerance_m]

    if not within:
        closest = f"{approaches[0][0]:.0f} m" if approaches else "no candidates"
        return None, SkipReason.NO_SUMMIT_MATCH, f"closest summit approach {closest}"

    if len(within) > 1:
        (nearest_m, nearest), (second_m, second) = within[0], within[1]
        # A clear winner has to be closer by at least half the tolerance.
        if second_m - nearest_m < tolerance_m / 2:
            return (
                None,
                SkipReason.AMBIGUOUS_SUMMIT,
                f"{nearest.name} at {nearest_m:.0f} m and {second.name} at {second_m:.0f} m",
            )

    return within[0][1], None, ""


def _plan_one(
    trace: RecordedTrace,
    mountains: list[CandidateMountain],
    policy: ValidationPolicy,
    privacy_trim_m: float,
) -> PlannedRoute | SkippedTrace:
    rules = policy.validation

    if len(trace.points) < MIN_TRACE_POINTS:
        return SkippedTrace(
            trace.trace_id,
            SkipReason.TOO_FEW_POINTS,
            f"{len(trace.points)} points, minimum {MIN_TRACE_POINTS}",
        )

    jump_m = max_segment_jump_m(trace.points)
    if jump_m > rules.max_segment_jump_m:
        return SkippedTrace(
            trace.trace_id,
            SkipReason.GPS_JUMP,
            f"{jump_m:.0f} m gap between fixes, limit {rules.max_segment_jump_m:.0f} m",
        )

    # Summit attribution runs on the RAW trace. A summit is a public, surveyed
    # place, so there is no privacy reason to hide the approach to it — and
    # matching after the trim would lose the summit on exactly the routes that
    # finish on one.
    mountain, reason, detail = _match_mountain(
        trace.points, mountains, rules.summit_reach_tolerance_m
    )
    if mountain is None:
        assert reason is not None
        return SkippedTrace(trace.trace_id, reason, detail)

    # Privacy trim BEFORE any measurement, so every published number describes
    # the line that will actually be published. The summit is protected from
    # the trim; the trailhead is not.
    raw_length_m = path_length_m(trace.points)
    trimmed = trim_ends(
        trace.points,
        privacy_trim_m,
        protect_lat=mountain.lat,
        protect_lon=mountain.lon,
        protect_radius_m=rules.summit_reach_tolerance_m,
    )
    if len(trimmed) < MIN_TRACE_POINTS:
        return SkippedTrace(
            trace.trace_id,
            SkipReason.PRIVACY_TRIM_EXHAUSTED,
            f"{len(trimmed)} points survived a {privacy_trim_m:.0f} m trim",
        )

    trimmed_length_m = path_length_m(trimmed)
    removed_fraction = 1.0 - (trimmed_length_m / raw_length_m) if raw_length_m > 0 else 1.0
    if removed_fraction > MAX_PRIVACY_TRIM_FRACTION:
        return SkippedTrace(
            trace.trace_id,
            SkipReason.PRIVACY_TRIM_EXHAUSTED,
            f"trim removed {removed_fraction:.0%} of the line",
        )

    if trimmed_length_m < rules.min_route_length_m:
        return SkippedTrace(
            trace.trace_id,
            SkipReason.TOO_SHORT,
            f"{trimmed_length_m:.0f} m, minimum {rules.min_route_length_m:.0f} m",
        )
    if trimmed_length_m > rules.max_route_length_m:
        return SkippedTrace(
            trace.trace_id,
            SkipReason.TOO_LONG,
            f"{trimmed_length_m:.0f} m, maximum {rules.max_route_length_m:.0f} m",
        )

    altitudes = [p.alt for p in trimmed if p.alt is not None]
    if altitudes and not all(
        rules.min_elevation_m <= altitude <= rules.max_elevation_m for altitude in altitudes
    ):
        return SkippedTrace(
            trace.trace_id,
            SkipReason.IMPLAUSIBLE_ELEVATION,
            f"altitudes {min(altitudes):.0f}–{max(altitudes):.0f} m outside "
            f"{rules.min_elevation_m:.0f}–{rules.max_elevation_m:.0f} m",
        )

    canonical = resample(trimmed, CANONICAL_SAMPLE_COUNT)
    ascent_m, descent_m = ascent_descent_m(canonical, policy.elevation.vertical_deadband_m)

    flags: list[QaFlag] = []
    if trace.contribution_count < 1:
        flags.append(QaFlag.SINGLE_CONTRIBUTION)
    if not altitudes:
        flags.append(QaFlag.NO_ALTITUDE)
    if removed_fraction > MAX_PRIVACY_TRIM_FRACTION / 2:
        flags.append(QaFlag.PRIVACY_TRIM_SIGNIFICANT)
    # The recorder's reported distance is the untrimmed walk; a large divergence
    # from the measured line means one of the two is not describing this route.
    if trace.distance_km > 0 and abs(trace.distance_km - raw_length_m / 1000) > max(
        0.5, trace.distance_km * 0.2
    ):
        flags.append(QaFlag.REPORTED_DISTANCE_DIFFERS)

    auto_named = looks_auto_generated(trace.name)
    if auto_named:
        flags.append(QaFlag.AUTO_GENERATED_NAME)
        # Descriptive, not invented. It claims only what is known: a recorded
        # line on a named mountain.
        canonical_name = f"{mountain.name} — recorded line"
    else:
        canonical_name = trace.name.strip()

    aliases = tuple(
        sorted(
            {
                name.strip()
                for name in (trace.name, *trace.contributed_names)
                if name and name.strip() and not looks_auto_generated(name)
            }
            - {canonical_name}
        )
    )

    # A name nobody chose, or evidence from a single walk, is exactly what a
    # reviewer should see before this line is shown as an established route.
    status = (
        VerificationStatus.NEEDS_REVIEW
        if (auto_named or QaFlag.SINGLE_CONTRIBUTION in flags)
        else VerificationStatus.PROCESSED
    )

    durations = [d for d in (trace.duration_secs, *trace.contributed_duration_secs) if d > 0]
    typical_hours = (sorted(durations)[len(durations) // 2] / 3600) if durations else None

    return PlannedRoute(
        trace_id=trace.trace_id,
        mountain_id=mountain.mountain_id,
        # Keyed on the trace's own immutable id, never on its name: names are
        # editable and duplicated, and `identity_key` is marked immutable.
        identity_key=f"{IDENTITY_NAMESPACE}:{trace.trace_id}",
        # Each additional merged walk moves the canonical line, so it earns a
        # new version rather than overwriting an immutable one.
        version=str(trace.contribution_count + 1),
        canonical_name=canonical_name,
        aliases=aliases,
        description=(
            f"Derived from {trace.contribution_count + 1} recorded "
            f"{'walk' if trace.contribution_count == 0 else 'walks'} "
            f"of this line. Not surveyed or verified."
        ),
        status=status,
        geometry=PlannedGeometry(
            coordinates=to_linestring_coordinates(canonical),
            derivation_method=DERIVATION_METHOD,
            source_point_count=len(trace.points),
        ),
        facts=PlannedFacts(
            distance_km=round(trimmed_length_m / 1000, 3),
            total_ascent_m=round(ascent_m, 1),
            total_descent_m=round(descent_m, 1),
            typical_duration_hours=round(typical_hours, 2) if typical_hours else None,
            summit_elevation_m=mountain.elevation_m,
        ),
        qa_flags=tuple(flags),
        contribution_count=trace.contribution_count,
    )


def plan_import(
    traces: list[RecordedTrace],
    mountains: list[CandidateMountain],
    policy: ValidationPolicy,
    *,
    privacy_trim_m: float = DEFAULT_PRIVACY_TRIM_M,
) -> ImportPlan:
    """Plan the promotion of recorded traces to candidate canonical routes.

    Pure: the same inputs always produce the same plan, and no row is written.
    The caller applies the plan, or reads it and decides not to.
    """
    planned: list[PlannedRoute] = []
    skipped: list[SkippedTrace] = []

    for trace in traces:
        outcome = _plan_one(trace, mountains, policy, privacy_trim_m)
        if isinstance(outcome, SkippedTrace):
            skipped.append(outcome)
        else:
            planned.append(outcome)

    return ImportPlan(planned=planned, skipped=skipped, policy_version=policy.version)
