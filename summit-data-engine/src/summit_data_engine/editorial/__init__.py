"""Routes drawn deliberately by a person, rather than derived from movement.

A drawn line is the fastest honest way to get real route geometry into the
product. Nothing is generated, inferred or averaged: somebody looked at a map
and chose every point, and the record says so.

WHY THIS EXISTS ALONGSIDE `recorded`
------------------------------------
Recorded traces are ground truth but need walkers, and they arrive slowly.
Free OS data has no footpath geometry to derive routes from — OS Open Zoomstack
carries roads and contours but no paths, and the one OS product that did carry
a heighted path network is being withdrawn. Drawing is the remaining option
that invents nothing.

A drawn route can be better evidence than a single GPS trace, because a human
chose the line rather than a receiver recording where a body happened to drift.
It is still not a survey, so it carries `drawn_not_surveyed` and, like every
other source, it can never be planned as `verified`.
"""

from __future__ import annotations

from summit_data_engine.editorial.planner import plan_editorial_import
from summit_data_engine.editorial.source import (
    RouteDraft,
    load_drawn_routes,
    parse_drawn_routes,
)

__all__ = [
    "RouteDraft",
    "load_drawn_routes",
    "parse_drawn_routes",
    "plan_editorial_import",
]
