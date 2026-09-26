"""Deciding which mountain a line belongs to.

Shared by every route source, because getting it wrong costs the same however
the line was produced: a route filed under the wrong mountain is worse than a
route filed under none.
"""

from __future__ import annotations

from summit_data_engine.routes.geometry import TracePoint, nearest_approach_m
from summit_data_engine.routes.plan import CandidateMountain, SkipReason


def match_mountain(
    points: list[TracePoint],
    mountains: list[CandidateMountain],
    tolerance_m: float,
) -> tuple[CandidateMountain | None, SkipReason | None, str]:
    """Which mountain, if any, this line belongs to.

    A line matches a summit when it passes within `summit_reach_tolerance_m`
    of it. Where two summits both qualify and neither is clearly closer, the
    match is refused rather than guessed: `.agents/memory/ambiguous-hill-identity.md`
    records what name- and proximity-based guessing has already cost us.

    Proximity is measured against the WHOLE line rather than its start: a route
    to a summit usually begins at a car park some distance away, so the start
    point says nothing about which mountain it belongs to.
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
