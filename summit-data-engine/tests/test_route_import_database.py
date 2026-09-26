"""End-to-end proof that a planned route reaches the app's read path.

Gated like the other database tests in this suite::

    RUN_ROUTE_IMPORT_DATABASE_TESTS=1 \\
    ENGINE_DATABASE_URL=postgresql+psycopg://... \\
    pytest tests/test_route_import_database.py

WHAT THIS PROVES THAT THE PLANNER TESTS CANNOT
----------------------------------------------
The planners are pure and exhaustively tested, but "the plan is correct" and
"the app can see the route" are different claims. This test writes a planned
route into a real PostGIS database and then runs the API server's OWN query
(`services/mountain/canonicalRouteRecord.ts`) against it, because that query
contains a rights gate the writer has to satisfy: geometry is withheld unless
every geometry member resolves to an evidence source classified
`reusable_geometry` with reuse allowed. A route can be written perfectly and
still be invisible, which is exactly the failure this test exists to catch.

The fixture line is synthetic. It ascends toward Tryfan's real summit so the
matcher has something to match, but it is NOT the North Ridge and must never
be shipped as route data.
"""

from __future__ import annotations

import hashlib
import os
import uuid
from datetime import UTC, datetime
from pathlib import Path

import pytest

pytestmark = pytest.mark.skipif(
    os.environ.get("RUN_ROUTE_IMPORT_DATABASE_TESTS") != "1",
    reason="set RUN_ROUTE_IMPORT_DATABASE_TESTS=1 for the explicit engine database check",
)

sqlalchemy = pytest.importorskip("sqlalchemy")

from sqlalchemy import create_engine, text  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from summit_data_engine.config.policy import load_validation_policy  # noqa: E402
from summit_data_engine.db.models import Mountain, SourceBundle  # noqa: E402
from summit_data_engine.editorial.planner import plan_editorial_import  # noqa: E402
from summit_data_engine.editorial.source import parse_drawn_routes  # noqa: E402
from summit_data_engine.models.domain import VerificationStatus  # noqa: E402
from summit_data_engine.recorded.importer import apply_plan  # noqa: E402
from summit_data_engine.routes.plan import CandidateMountain  # noqa: E402

POLICY_PATH = Path(__file__).parents[1] / "config" / "validation_policy.toml"

TRYFAN_LAT, TRYFAN_LON = 53.1163, -3.9915
MOUNTAIN_ID = uuid.UUID("aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa")

# The production query, reduced to what this test needs to assert. The shape of
# the joins and the whole rights gate are copied verbatim from
# `artifacts/api-server/src/services/mountain/canonicalRouteRecord.ts`; if that
# query's gate changes, this test should be updated alongside it.
READ_PATH_SQL = text(
    """
    SELECT
      ri.canonical_name AS route_name,
      ri.status         AS route_status,
      m.name            AS mountain_name,
      rf.distance_km    AS distance_km,
      geom.member_count,
      geom.reusable_member_count,
      geom.derivation_method,
      CASE WHEN geom.geom IS NULL OR geom.member_count = 0
        OR geom.reusable_member_count <> geom.member_count
        OR e.rights_classification <> 'reusable_geometry'
        OR NOT e.geometry_reuse_allowed THEN NULL
        ELSE ST_AsGeoJSON(geom.geom)::jsonb END AS geometry
    FROM public.route_identities AS ri
    JOIN public.mountains AS m ON m.id = ri.mountain_id
    JOIN public.route_definitions AS rd
      ON rd.route_identity_id = ri.id AND rd.version = ri.version
    JOIN public.route_facts AS rf
      ON rf.route_definition_id = rd.id AND rf.version = rd.version
    JOIN public.evidence_sources AS e ON e.id = rf.evidence_source_id
    LEFT JOIN LATERAL (
      SELECT
        g.geom,
        g.derivation_method,
        COUNT(gm.id)::int AS member_count,
        COUNT(es.id)::int AS reusable_member_count
      FROM public.route_geometries AS g
      LEFT JOIN public.route_geometry_members AS gm ON gm.route_geometry_id = g.id
      LEFT JOIN public.source_bundles AS sb ON sb.id = gm.source_bundle_id
      LEFT JOIN public.evidence_sources AS es
        ON es.publisher = sb.provider AND es.url = sb.source_url
       AND es.rights_classification = 'reusable_geometry'
       AND es.geometry_reuse_allowed = TRUE
      WHERE g.route_definition_id = rd.id AND g.version = rd.version
      GROUP BY g.id, g.geom, g.derivation_method
      ORDER BY g.id DESC
      LIMIT 1
    ) AS geom ON TRUE
    WHERE ri.identity_key = :identity_key AND ri.version = :version
    """
)


def _fixture_geojson() -> dict:
    """A synthetic ascending line finishing on Tryfan's summit.

    NOT the North Ridge. It exists so the summit matcher and PostGIS have real
    coordinates to work on, and it is generated rather than transcribed so that
    nobody can mistake it for surveyed route data.
    """
    start_lat = TRYFAN_LAT + (1_800 / 111_320.0)
    coordinates = []
    for i in range(40):
        f = i / 39
        coordinates.append(
            [TRYFAN_LON, start_lat + (TRYFAN_LAT - start_lat) * f, 350.0 + 550.0 * f]
        )
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "id": "pipeline-fixture-tryfan",
                "properties": {
                    "name": "Pipeline fixture line",
                    "mountain": "Tryfan",
                    "author": "integration test",
                    "drawn_on": "synthetic",
                    "description": "Synthetic line for the import proof. Not a real route.",
                },
                "geometry": {"type": "LineString", "coordinates": coordinates},
            }
        ],
    }


@pytest.fixture(scope="module")
def session():
    url = os.environ.get("ENGINE_DATABASE_URL")
    if not url:
        pytest.skip("ENGINE_DATABASE_URL is required")
    engine = create_engine(url, future=True)
    with Session(engine) as s:
        yield s
        s.rollback()


@pytest.fixture(scope="module")
def mountain(session) -> CandidateMountain:
    """A minimal Tryfan row, so the route has something real to hang off."""
    if session.get(Mountain, MOUNTAIN_ID) is None:
        bundle_sha = hashlib.sha256(b"route-import-test-mountain-bundle").hexdigest()
        bundle = SourceBundle(
            id=uuid.uuid5(uuid.NAMESPACE_URL, f"test-bundle:{bundle_sha}"),
            source_type="test_fixture",
            provider="integration test",
            source_url="test://route-import",
            licence="test fixture",
            local_path="test://route-import",
            sha256=bundle_sha,
            size_bytes=0,
            retrieved_at=datetime.now(UTC),
            metadata_json={},
            provenance_version="test",
        )
        session.add(bundle)
        session.flush()
        session.add(
            Mountain(
                id=MOUNTAIN_ID,
                source_bundle_id=bundle.id,
                source_feature_id="test:tryfan",
                name="Tryfan",
                country="Wales",
                region="Snowdonia",
                elevation_m=917.5,
                status=VerificationStatus.VERIFIED,
                geom=f"SRID=4326;POINT({TRYFAN_LON} {TRYFAN_LAT})",
                tags={},
                provenance_version="test",
            )
        )
        session.flush()
    return CandidateMountain(
        mountain_id=MOUNTAIN_ID,
        name="Tryfan",
        lat=TRYFAN_LAT,
        lon=TRYFAN_LON,
        elevation_m=917.5,
    )


@pytest.fixture(scope="module")
def applied(session, mountain):
    policy = load_validation_policy(POLICY_PATH)
    drafts = parse_drawn_routes(_fixture_geojson())
    plan = plan_editorial_import(drafts, [mountain], policy)
    assert plan.planned_count == 1, plan.skipped
    result = apply_plan(session, plan, snapshot_sha256=hashlib.sha256(b"proof").hexdigest())
    session.flush()
    return plan, result


class TestPostgisIsUsable:
    def test_postgis_is_installed(self, session):
        """The single biggest unknown for hosting the engine anywhere."""
        version = session.execute(text("SELECT PostGIS_Version()")).scalar_one()
        assert version

    def test_the_geometry_column_is_a_real_linestring_column(self, session):
        row = session.execute(
            text(
                "SELECT type, srid FROM geometry_columns "
                "WHERE f_table_name = 'route_geometries'"
            )
        ).one()
        assert row.type == "LINESTRING"
        assert row.srid == 4326


class TestWriteIsIdempotent:
    def test_the_plan_is_written(self, applied):
        _, result = applied
        assert result.geometries_written == 1

    def test_applying_the_same_plan_again_writes_nothing(self, session, applied):
        plan, _ = applied
        again = apply_plan(session, plan, snapshot_sha256=hashlib.sha256(b"proof").hexdigest())
        assert again.identities_written == 0
        assert again.unchanged == 1


class TestTheAppCanSeeTheRoute:
    def _row(self, session):
        return session.execute(
            READ_PATH_SQL,
            {"identity_key": "editorial:pipeline-fixture-tryfan", "version": "1"},
        ).one_or_none()

    def test_the_production_query_returns_the_route(self, session, applied):
        """The claim the planner tests cannot make."""
        row = self._row(session)
        assert row is not None, "the app's own query cannot see the written route"
        assert row.route_name == "Pipeline fixture line"
        assert row.mountain_name == "Tryfan"

    def test_the_rights_gate_passes_so_geometry_is_served(self, session, applied):
        """Geometry is withheld unless provenance proves it may be reused."""
        row = self._row(session)
        assert row.member_count == 1
        assert row.reusable_member_count == row.member_count
        assert row.geometry is not None, "geometry withheld — the rights gate failed"

    def test_the_served_geometry_is_the_line_that_was_planned(self, session, applied):
        plan, _ = applied
        row = self._row(session)
        served = row.geometry["coordinates"]
        planned = plan.planned[0].geometry.coordinates
        assert len(served) == len(planned)
        assert served[0][0] == pytest.approx(planned[0][0])
        assert served[0][1] == pytest.approx(planned[0][1])

    def test_the_served_coordinates_are_in_great_britain(self, session, applied):
        """Catches a latitude/longitude flip surviving all the way to the map."""
        row = self._row(session)
        for lon, lat, *_ in row.geometry["coordinates"]:
            assert -8 < lon < 2
            assert 49 < lat < 61

    def test_the_route_is_not_verified_so_it_stays_un_navigable(self, session, applied):
        row = self._row(session)
        assert row.route_status != "verified"

    def test_the_facts_describe_the_published_line(self, session, applied):
        plan, _ = applied
        row = self._row(session)
        assert row.distance_km == pytest.approx(plan.planned[0].facts.distance_km, abs=0.01)

    def test_the_derivation_method_says_the_line_was_drawn(self, session, applied):
        row = self._row(session)
        assert row.derivation_method == "drawn_editorial_v1"


class TestTheRightsGateIsReal:
    """Negative control.

    Without this, the gate assertions above could pass vacuously. The writer
    originally set `evidence_source_id` to NULL, which made the app's query —
    an INNER JOIN on evidence — return nothing at all. The route was written
    perfectly and was invisible.
    """

    def test_without_an_evidence_link_the_app_cannot_see_the_route(
        self, session, mountain, monkeypatch
    ):
        from summit_data_engine.recorded import importer

        policy = load_validation_policy(POLICY_PATH)
        document = _fixture_geojson()
        document["features"][0]["id"] = "pipeline-fixture-no-rights"
        plan = plan_editorial_import(parse_drawn_routes(document), [mountain], policy)

        monkeypatch.setattr(
            importer, "_evidence", lambda session, bundle: type("E", (), {"id": None})()
        )
        importer.apply_plan(
            session, plan, snapshot_sha256=hashlib.sha256(b"no-rights").hexdigest()
        )
        session.flush()

        row = session.execute(
            READ_PATH_SQL,
            {"identity_key": "editorial:pipeline-fixture-no-rights", "version": "1"},
        ).one_or_none()
        assert row is None
