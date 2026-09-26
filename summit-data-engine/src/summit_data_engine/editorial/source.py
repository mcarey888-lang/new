"""Reading drawn routes out of GeoJSON.

GeoJSON because every drawing tool already exports it — geojson.io, QGIS, the
OS Maps route plotter, a MapLibre draw control in our own app. Choosing the
format everything already speaks means a route can be drawn wherever it is
most convenient and still arrive here unchanged.

EXPECTED SHAPE
--------------
A FeatureCollection of LineString features::

    {
      "type": "FeatureCollection",
      "features": [{
        "type": "Feature",
        "id": "tryfan-north-ridge",
        "properties": {
          "name": "North Ridge",
          "mountain": "Tryfan",
          "aliases": ["Tryfan North Ridge"],
          "description": "Grade 1 scramble throughout; hands-on from the base.",
          "requires_scrambling": true,
          "author": "SummitReady editorial",
          "drawn_on": "OS Maps API Outdoor raster",
          "version": "1"
        },
        "geometry": {
          "type": "LineString",
          "coordinates": [[-3.9870, 53.1090], [-3.9899, 53.1131, 620.0]]
        }
      }]
    }

Coordinates are `[longitude, latitude]` with an optional third elevation
element, exactly as GeoJSON specifies. A third element is used when present and
never invented when absent.

`drawn_on` records which basemap the line was drawn over. That is provenance,
not decoration: a line traced over licensed cartography raises a question about
derived data that a line drawn over an open basemap does not, and the record
should be able to answer it years later.

`author` is a byline for attribution. It must never be an account id — the same
rule the recorded path follows.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from summit_data_engine.routes.geometry import TracePoint


@dataclass(frozen=True)
class RouteDraft:
    """One drawn route, before any judgement has been applied to it."""

    source_id: str
    name: str
    mountain_name: str
    points: list[TracePoint]
    aliases: tuple[str, ...] = ()
    description: str = ""
    requires_scrambling: bool = False
    author: str = ""
    drawn_on: str = ""
    version: str = "1"
    #: Anything in the source that this module did not consume, kept so a
    #: reviewer can see what the author said even when the engine has no field
    #: for it yet.
    extra: dict[str, Any] = field(default_factory=dict)


_CONSUMED = frozenset(
    {
        "id",
        "name",
        "mountain",
        "aliases",
        "description",
        "requires_scrambling",
        "author",
        "drawn_on",
        "version",
    }
)


class DrawnRouteFormatError(ValueError):
    """The file is not a FeatureCollection this module can read at all.

    Raised only for problems with the document itself. A single malformed
    feature is not an error here — it becomes a skip in the plan, so one bad
    route never blocks a whole batch.
    """


def _points(geometry: Any) -> list[TracePoint]:
    """Coordinates for a LineString feature, or an empty list.

    Returning empty rather than raising keeps a single broken feature from
    failing the batch; the planner reports it as `invalid_geometry`.
    """
    if not isinstance(geometry, dict) or geometry.get("type") != "LineString":
        return []
    raw = geometry.get("coordinates")
    if not isinstance(raw, list):
        return []

    points: list[TracePoint] = []
    for position in raw:
        if not isinstance(position, (list, tuple)) or len(position) < 2:
            return []
        try:
            lon = float(position[0])
            lat = float(position[1])
            alt = float(position[2]) if len(position) > 2 and position[2] is not None else None
        except (TypeError, ValueError):
            return []
        # GeoJSON is longitude-first; TracePoint is latitude-first. The flip
        # belongs here, at the boundary, and nowhere downstream.
        points.append(TracePoint(lat=lat, lon=lon, alt=alt))
    return points


def _aliases(value: Any) -> tuple[str, ...]:
    if isinstance(value, str):
        value = [value]
    if not isinstance(value, list):
        return ()
    return tuple(
        sorted({item.strip() for item in value if isinstance(item, str) and item.strip()})
    )


def parse_drawn_routes(document: Any) -> list[RouteDraft]:
    """Read a decoded GeoJSON FeatureCollection into drafts.

    Permissive about individual features on purpose: a feature missing a name
    or carrying an unreadable geometry still produces a draft, so the planner
    can report precisely why it was skipped rather than it vanishing silently.
    """
    if not isinstance(document, dict) or document.get("type") != "FeatureCollection":
        raise DrawnRouteFormatError("expected a GeoJSON FeatureCollection")
    features = document.get("features")
    if not isinstance(features, list):
        raise DrawnRouteFormatError("FeatureCollection has no features array")

    drafts: list[RouteDraft] = []
    for index, feature in enumerate(features):
        if not isinstance(feature, dict):
            continue
        properties = feature.get("properties")
        if not isinstance(properties, dict):
            properties = {}

        identifier = feature.get("id") or properties.get("id") or f"feature-{index}"
        drafts.append(
            RouteDraft(
                source_id=str(identifier),
                name=str(properties.get("name", "")).strip(),
                mountain_name=str(properties.get("mountain", "")).strip(),
                points=_points(feature.get("geometry")),
                aliases=_aliases(properties.get("aliases")),
                description=str(properties.get("description", "")).strip(),
                requires_scrambling=bool(properties.get("requires_scrambling", False)),
                author=str(properties.get("author", "")).strip(),
                drawn_on=str(properties.get("drawn_on", "")).strip(),
                version=str(properties.get("version", "1")).strip() or "1",
                extra={k: v for k, v in properties.items() if k not in _CONSUMED},
            )
        )
    return drafts


def load_drawn_routes(path: Path) -> list[RouteDraft]:
    """Read drafts from a `.geojson` file."""
    with path.open("r", encoding="utf-8") as handle:
        return parse_drawn_routes(json.load(handle))
