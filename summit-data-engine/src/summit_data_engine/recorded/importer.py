"""Apply a recorded-trace plan to the engine database.

All judgement lives in `planner.plan_import`. This module only writes, and it
follows the same contract the international importer already established:

* every row id is a deterministic UUID5 of its natural key, so re-running the
  importer is idempotent rather than duplicative;
* a row whose columns are marked immutable is never updated — if the incoming
  values differ from what is stored, that is a bug upstream and the import
  raises rather than quietly rewriting history.

The engine database is reached only through `ENGINE_DATABASE_URL`. It never
falls back to the application's own `DATABASE_URL`; reading the traces out of
the app database is the caller's job, and is deliberately a separate step.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

from geoalchemy2.shape import from_shape
from shapely.geometry import LineString  # type: ignore[import-untyped]
from sqlalchemy import select
from sqlalchemy.orm import Session

from summit_data_engine.db.models import (
    RouteDefinition,
    RouteFact,
    RouteGeometry,
    RouteGeometryMember,
    RouteIdentity,
    SourceBundle,
)
from summit_data_engine.recorded.planner import ImportPlan, PlannedRoute

# Distinct from the international importer's namespace: the two sources must
# never be able to collide on a generated id.
_UUID_NAMESPACE = uuid.UUID("9d1b6c0a-8f3e-4a57-9b2d-0c7a4e51f832")

PROVIDER = "SummitReady recorded activities"
SOURCE_TYPE = "recorded_traces"
SOURCE_URL = "app://summitready/tracked-routes"
LICENCE = (
    "Contributed by SummitReady users under the app's terms. "
    "Derived geometry only; no recorder identity is carried."
)


@dataclass(frozen=True)
class ImportResult:
    bundle_id: uuid.UUID
    identities_written: int
    geometries_written: int
    unchanged: int


def _bundle(session: Session, plan: ImportPlan, *, snapshot_sha256: str) -> SourceBundle:
    """The provenance record every geometry member points back at.

    `snapshot_sha256` identifies the exact set of traces this run consumed, so
    a geometry can always be traced to the evidence that produced it.
    """
    existing = session.scalar(select(SourceBundle).where(SourceBundle.sha256 == snapshot_sha256))
    if existing is not None:
        if existing.provider != PROVIDER:
            raise ValueError("snapshot hash is already assigned to conflicting provenance")
        return existing

    bundle = SourceBundle(
        id=uuid.uuid5(_UUID_NAMESPACE, f"bundle:{snapshot_sha256}"),
        source_type=SOURCE_TYPE,
        provider=PROVIDER,
        source_url=SOURCE_URL,
        licence=LICENCE,
        local_path=f"snapshot://{snapshot_sha256}",
        sha256=snapshot_sha256,
        size_bytes=0,
        retrieved_at=datetime.now(UTC),
        metadata_json={
            "policy_version": plan.policy_version,
            "planned": plan.planned_count,
            "skipped": plan.skipped_count,
            "skipped_reasons": sorted({s.reason.value for s in plan.skipped}),
        },
        provenance_version=plan.policy_version,
    )
    session.add(bundle)
    session.flush()
    return bundle


def _write_route(session: Session, route: PlannedRoute, bundle: SourceBundle) -> bool:
    """Write one planned route. Returns True when anything new was inserted."""
    identity_id = uuid.uuid5(_UUID_NAMESPACE, f"route-identity:{route.identity_key}")
    definition_id = uuid.uuid5(
        _UUID_NAMESPACE, f"route-definition:{route.identity_key}:{route.version}"
    )
    geometry_id = uuid.uuid5(
        _UUID_NAMESPACE, f"route-geometry:{route.identity_key}:{route.version}"
    )
    fact_id = uuid.uuid5(_UUID_NAMESPACE, f"route-fact:{route.identity_key}:{route.version}")

    wrote = False

    identity = session.get(RouteIdentity, identity_id)
    if identity is None:
        session.add(
            RouteIdentity(
                id=identity_id,
                mountain_id=route.mountain_id,
                identity_key=route.identity_key,
                version=route.version,
                canonical_name=route.canonical_name,
                aliases=list(route.aliases),
                status=route.status,
            )
        )
        session.flush()
        wrote = True
    elif identity.identity_key != route.identity_key or identity.mountain_id != route.mountain_id:
        # identity_key and the mountain it hangs off are the identity. If either
        # moved, the plan is describing a different route under the same id.
        raise ValueError(f"immutable route identity changed for {route.identity_key}")

    definition = session.get(RouteDefinition, definition_id)
    if definition is None:
        session.add(
            RouteDefinition(
                id=definition_id,
                route_identity_id=identity_id,
                version=route.version,
                description=route.description,
                status=route.status,
            )
        )
        session.flush()
        wrote = True
    elif definition.version != route.version:
        raise ValueError(f"immutable route definition changed for {route.identity_key}")

    geometry = session.get(RouteGeometry, geometry_id)
    if geometry is None:
        # Coordinates are already (longitude, latitude); see
        # `traces.to_linestring_coordinates`, which is the only place they flip.
        line = LineString(route.geometry.coordinates)
        session.add(
            RouteGeometry(
                id=geometry_id,
                route_definition_id=definition_id,
                version=route.version,
                geom=from_shape(line, srid=4326),
                derivation_method=route.geometry.derivation_method,
            )
        )
        session.flush()
        session.add(
            RouteGeometryMember(
                id=uuid.uuid5(_UUID_NAMESPACE, f"route-geometry-member:{geometry_id}:0"),
                route_geometry_id=geometry_id,
                source_bundle_id=bundle.id,
                sequence=0,
                # The trace id, not the recorder. The link back to the evidence
                # must never become a link back to a person.
                source_member_type="recorded_trace",
                source_member_id=route.trace_id,
                direction=1,
            )
        )
        wrote = True
    elif geometry.version != route.version:
        raise ValueError(f"immutable route geometry changed for {route.identity_key}")

    fact = session.get(RouteFact, fact_id)
    if fact is None:
        session.add(
            RouteFact(
                id=fact_id,
                route_definition_id=definition_id,
                source_bundle_id=bundle.id,
                evidence_source_id=None,
                version=route.version,
                start_name=None,  # The trailhead is trimmed for privacy; see traces.trim_ends.
                start_elevation_m=None,
                summit_elevation_m=route.facts.summit_elevation_m,
                distance_km=route.facts.distance_km,
                total_ascent_m=route.facts.total_ascent_m,
                total_descent_m=route.facts.total_descent_m,
                typical_duration_hours=route.facts.typical_duration_hours,
                status=route.status,
                qa_flags=[flag.value for flag in route.qa_flags],
                provenance_version=route.version,
            )
        )
        wrote = True

    return wrote


def apply_plan(session: Session, plan: ImportPlan, *, snapshot_sha256: str) -> ImportResult:
    """Write a plan. Caller owns the transaction.

    Idempotent: applying the same plan twice inserts nothing the second time.
    """
    bundle = _bundle(session, plan, snapshot_sha256=snapshot_sha256)

    written = unchanged = 0
    for route in plan.planned:
        if _write_route(session, route, bundle):
            written += 1
        else:
            unchanged += 1

    return ImportResult(
        bundle_id=bundle.id,
        identities_written=written,
        geometries_written=written,
        unchanged=unchanged,
    )
