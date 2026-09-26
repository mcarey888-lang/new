"""Turning recorded activities into candidate canonical route geometry.

SummitReady already collects real GPS traces: `tracked_routes` holds a
canonical line per route and `route_contributions` holds each repeat walk of
it, with the API server merging every contribution into the canonical line as
it arrives. Those traces are the best geometry source the product has — they
were walked, not synthesised — but nothing has ever promoted them into the
engine's own `route_identities` / `route_geometries` tables.

This package is that promotion step, and nothing more.

WHAT IT DELIBERATELY DOES NOT DO
--------------------------------
It does not make anything navigable. Every record it plans lands at
`processed` or `needs_review`, never `verified`, so the app's own navigation
guard (which requires an engine status of `verified` AND a product lifecycle
of `summitready_verified`) continues to refuse these routes for Start. A
recorded line is evidence that a route exists and roughly where it runs. It is
not a statement that the route is safe, and promotion past this point is a
human decision made elsewhere.
"""

from __future__ import annotations

from summit_data_engine.recorded.planner import (
    CandidateMountain,
    ImportPlan,
    PlannedGeometry,
    PlannedRoute,
    RecordedTrace,
    SkippedTrace,
    SkipReason,
    plan_import,
)
from summit_data_engine.recorded.traces import TracePoint

__all__ = [
    "CandidateMountain",
    "ImportPlan",
    "PlannedGeometry",
    "PlannedRoute",
    "RecordedTrace",
    "SkipReason",
    "SkippedTrace",
    "TracePoint",
    "plan_import",
]
