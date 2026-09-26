"""Decide what a set of drawn routes should become, without writing anything.

Same contract as the recorded planner: pure, deterministic, and incapable of
planning a `verified` route.

HOW THIS DIFFERS FROM THE RECORDED PATH
---------------------------------------
* **The author names the mountain, and the line must agree.** A recorded trace
  has only its geometry to go on. A drawn route also carries a stated mountain,
  so both must point the same way — a route labelled Tryfan whose line never
  approaches Tryfan is refused rather than quietly filed under whatever summit
  happened to be nearest.
* **The points are kept exactly as drawn.** Recorded traces are resampled,
  because a merged average of many walks has no meaningful individual points.
  A drawn line does: somebody chose each one, and resampling would both discard
  that and imply a precision the line does not have.
* **No privacy trim.** There is no person in a drawn line, so there is nothing
  to protect and no reason to lose the trailhead.
* **Elevation only when supplied.** Without a DEM the engine cannot know the
  ascent of a drawn line, so it says so instead of estimating.
"""

from __future__ import annotations

from summit_data_engine.config.policy import ValidationPolicy
from summit_data_engine.editorial.source import RouteDraft
from summit_data_engine.models.domain import VerificationStatus
from summit_data_engine.routes.geometry import (
    ascent_descent_m,
    nearest_approach_m,
    path_length_m,
    to_linestring_coordinates,
)
from summit_data_engine.routes.plan import (
    CandidateMountain,
    ImportPlan,
    PlannedFacts,
    PlannedGeometry,
    PlannedRoute,
    QaFlag,
    SkippedSource,
    SkipReason,
)

# Below this a drawn line is a few clicks, not a described route. Lower than
# the recorded minimum because a person draws far fewer points than a receiver
# records — a careful line up a ridge might be twenty deliberate points.
MIN_DRAWN_POINTS = 6

# A line with very few points for its length has been sketched rather than
# traced, and a reviewer should see it before it is published.
SPARSE_POINTS_PER_KM = 4.0

IDENTITY_NAMESPACE = "editorial"

DERIVATION_METHOD = "drawn_editorial_v1"


def _normalise(name: str) -> str:
    return " ".join(name.strip().lower().split())


def _named_mountain(
    mountain_name: str, mountains: list[CandidateMountain]
) -> CandidateMountain | None:
    """Resolve the author's stated mountain by name.

    Exact normalised match only. Fuzzy matching a mountain name is precisely
    how a route ends up on the wrong hill in another country, which
    `.agents/memory/ambiguous-hill-identity.md` already records the cost of.
    """
    wanted = _normalise(mountain_name)
    if not wanted:
        return None
    matches = [m for m in mountains if _normalise(m.name) == wanted]
    return matches[0] if len(matches) == 1 else None


def _plan_one(
    draft: RouteDraft,
    mountains: list[CandidateMountain],
    policy: ValidationPolicy,
) -> PlannedRoute | SkippedSource:
    rules = policy.validation

    if not draft.name:
        return SkippedSource(
            draft.source_id, SkipReason.MISSING_NAME, "a drawn route must be named by its author"
        )

    if len(draft.points) < MIN_DRAWN_POINTS:
        return SkippedSource(
            draft.source_id,
            SkipReason.INVALID_GEOMETRY,
            f"{len(draft.points)} usable points, minimum {MIN_DRAWN_POINTS}",
        )

    mountain = _named_mountain(draft.mountain_name, mountains)
    if mountain is None:
        return SkippedSource(
            draft.source_id,
            SkipReason.MOUNTAIN_NOT_FOUND,
            f"no single mountain named {draft.mountain_name!r}",
        )

    # The author said which mountain; the geometry has to agree. This is the
    # check the recorded path cannot make, and it is the main reason a drawn
    # route can be trusted further than a single trace.
    approach_m = nearest_approach_m(draft.points, mountain.lat, mountain.lon)
    if approach_m > rules.summit_reach_tolerance_m:
        return SkippedSource(
            draft.source_id,
            SkipReason.MOUNTAIN_DISAGREES_WITH_LINE,
            f"line comes no closer than {approach_m:.0f} m to {mountain.name}, "
            f"tolerance {rules.summit_reach_tolerance_m:.0f} m",
        )

    length_m = path_length_m(draft.points)
    if length_m < rules.min_route_length_m:
        return SkippedSource(
            draft.source_id,
            SkipReason.TOO_SHORT,
            f"{length_m:.0f} m, minimum {rules.min_route_length_m:.0f} m",
        )
    if length_m > rules.max_route_length_m:
        return SkippedSource(
            draft.source_id,
            SkipReason.TOO_LONG,
            f"{length_m:.0f} m, maximum {rules.max_route_length_m:.0f} m",
        )

    altitudes = [p.alt for p in draft.points if p.alt is not None]
    if altitudes and not all(
        rules.min_elevation_m <= altitude <= rules.max_elevation_m for altitude in altitudes
    ):
        return SkippedSource(
            draft.source_id,
            SkipReason.IMPLAUSIBLE_ELEVATION,
            f"elevations {min(altitudes):.0f}–{max(altitudes):.0f} m outside "
            f"{rules.min_elevation_m:.0f}–{rules.max_elevation_m:.0f} m",
        )

    # Always true of a drawn route, and stated on every one of them so that no
    # consumer has to infer it from the derivation method.
    flags: list[QaFlag] = [QaFlag.DRAWN_NOT_SURVEYED]

    ascent_m: float | None = None
    descent_m: float | None = None
    if altitudes:
        ascent_m, descent_m = ascent_descent_m(draft.points, policy.elevation.vertical_deadband_m)
    else:
        # No DEM here, and no guessing. A profile can be attached later by the
        # elevation pipeline, which is what OS Terrain 50 is for.
        flags.append(QaFlag.NO_ELEVATION_SOURCE)

    if draft.requires_scrambling:
        flags.append(QaFlag.REQUIRES_SCRAMBLING)

    points_per_km = len(draft.points) / (length_m / 1000) if length_m > 0 else 0.0
    sparse = points_per_km < SPARSE_POINTS_PER_KM

    # A route the author says needs hands on rock is not published without
    # someone looking at it. Tryfan's North Ridge is the reason this rule
    # exists: it is a Grade 1 scramble that reads like an ordinary walk in a
    # list of route names.
    status = (
        VerificationStatus.NEEDS_REVIEW
        if (draft.requires_scrambling or sparse)
        else VerificationStatus.PROCESSED
    )

    provenance = [f"Drawn by {draft.author}" if draft.author else "Drawn route"]
    if draft.drawn_on:
        provenance.append(f"over {draft.drawn_on}")
    description = draft.description or f"{draft.name} on {mountain.name}."
    description = f"{description} {' '.join(provenance)}. Not surveyed or verified.".strip()

    return PlannedRoute(
        source_id=draft.source_id,
        mountain_id=mountain.mountain_id,
        identity_key=f"{IDENTITY_NAMESPACE}:{draft.source_id}",
        # Author-controlled: redrawing the line is a new version, and the old
        # one stays immutable.
        version=draft.version,
        canonical_name=draft.name,
        aliases=tuple(a for a in draft.aliases if a != draft.name),
        description=description,
        status=status,
        geometry=PlannedGeometry(
            # Exactly the points the author drew. Nothing added, nothing removed.
            coordinates=to_linestring_coordinates(draft.points),
            derivation_method=DERIVATION_METHOD,
            source_point_count=len(draft.points),
        ),
        facts=PlannedFacts(
            distance_km=round(length_m / 1000, 3),
            total_ascent_m=round(ascent_m, 1) if ascent_m is not None else None,
            total_descent_m=round(descent_m, 1) if descent_m is not None else None,
            # Nobody walked this line, so there is no duration to report.
            typical_duration_hours=None,
            summit_elevation_m=mountain.elevation_m,
        ),
        qa_flags=tuple(flags),
        contribution_count=0,
    )


def plan_editorial_import(
    drafts: list[RouteDraft],
    mountains: list[CandidateMountain],
    policy: ValidationPolicy,
) -> ImportPlan:
    """Plan the promotion of drawn routes to candidate canonical routes.

    Pure: the same inputs always produce the same plan, and no row is written.
    """
    planned: list[PlannedRoute] = []
    skipped: list[SkippedSource] = []

    for draft in drafts:
        outcome = _plan_one(draft, mountains, policy)
        if isinstance(outcome, SkippedSource):
            skipped.append(outcome)
        else:
            planned.append(outcome)

    return ImportPlan(planned=planned, skipped=skipped, policy_version=policy.version)
