"""The vocabulary every route source plans in.

Two things can produce canonical route geometry, and more will follow:

* `recorded` — merged GPS traces from people who walked the line;
* `editorial` — a line drawn deliberately by a person on a basemap.

They differ entirely in where the coordinates come from and in how much they
can be trusted, and not at all in what they produce. Both emit `PlannedRoute`,
both are applied by the same writer, and both are held to the same rule: a
planner may never emit `VerificationStatus.VERIFIED`. Navigation is gated on
that status, so promoting a route past this point stays a human act.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from enum import StrEnum

from summit_data_engine.models.domain import VerificationStatus


class SkipReason(StrEnum):
    """Why a source produced no route. Values are stable; they are reported on."""

    TOO_FEW_POINTS = "too_few_points"
    TOO_SHORT = "too_short"
    TOO_LONG = "too_long"
    GPS_JUMP = "gps_jump"
    NO_SUMMIT_MATCH = "no_summit_match"
    AMBIGUOUS_SUMMIT = "ambiguous_summit"
    IMPLAUSIBLE_ELEVATION = "implausible_elevation"
    PRIVACY_TRIM_EXHAUSTED = "privacy_trim_exhausted"
    # Editorial sources only.
    MOUNTAIN_NOT_FOUND = "mountain_not_found"
    MOUNTAIN_DISAGREES_WITH_LINE = "mountain_disagrees_with_line"
    MISSING_NAME = "missing_name"
    INVALID_GEOMETRY = "invalid_geometry"


class QaFlag(StrEnum):
    """Accepted, but a human should know. Present on the planned record."""

    AUTO_GENERATED_NAME = "auto_generated_name"
    SINGLE_CONTRIBUTION = "single_contribution"
    PRIVACY_TRIM_SIGNIFICANT = "privacy_trim_significant"
    REPORTED_DISTANCE_DIFFERS = "reported_distance_differs"
    NO_ALTITUDE = "no_altitude"
    # Editorial sources only.
    DRAWN_NOT_SURVEYED = "drawn_not_surveyed"
    REQUIRES_SCRAMBLING = "requires_scrambling"
    NO_ELEVATION_SOURCE = "no_elevation_source"


@dataclass(frozen=True)
class CandidateMountain:
    """A row of `mountains` a route might belong to."""

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
    total_ascent_m: float | None
    total_descent_m: float | None
    typical_duration_hours: float | None
    summit_elevation_m: float | None


@dataclass(frozen=True)
class PlannedRoute:
    """Everything the writer needs, with no decisions left to make.

    `source_id` is whatever identifies this route in the system it came from —
    a tracked-route id, a GeoJSON feature id. It is never a person.
    """

    source_id: str
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
    contribution_count: int = 0

    def __post_init__(self) -> None:
        # The invariant the whole design rests on, enforced where it cannot be
        # forgotten rather than only in the planners that build these.
        if self.status is VerificationStatus.VERIFIED:
            raise ValueError(
                "a planner may not emit VERIFIED: navigation is gated on that "
                "status, so promotion is a human decision made elsewhere"
            )


@dataclass(frozen=True)
class SkippedSource:
    source_id: str
    reason: SkipReason
    detail: str


@dataclass(frozen=True)
class ImportPlan:
    planned: list[PlannedRoute] = field(default_factory=list)
    skipped: list[SkippedSource] = field(default_factory=list)
    policy_version: str = ""

    @property
    def planned_count(self) -> int:
        return len(self.planned)

    @property
    def skipped_count(self) -> int:
        return len(self.skipped)
