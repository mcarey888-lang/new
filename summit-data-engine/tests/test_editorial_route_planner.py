"""Database-free contract tests for drawn editorial routes.

Tryfan again, because it is the case the rules were written for: a mountain
whose most famous line is a Grade 1 scramble that reads like an ordinary walk
in a list of route names.
"""

from __future__ import annotations

import json
import uuid
from pathlib import Path

import pytest

from summit_data_engine.config.policy import load_validation_policy
from summit_data_engine.editorial.planner import (
    DERIVATION_METHOD,
    MIN_DRAWN_POINTS,
    plan_editorial_import,
)
from summit_data_engine.editorial.source import (
    DrawnRouteFormatError,
    RouteDraft,
    load_drawn_routes,
    parse_drawn_routes,
)
from summit_data_engine.models.domain import VerificationStatus
from summit_data_engine.routes.geometry import TracePoint, path_length_m
from summit_data_engine.routes.plan import CandidateMountain, QaFlag, SkipReason

POLICY_PATH = Path(__file__).parents[1] / "config" / "validation_policy.toml"

TRYFAN = CandidateMountain(
    mountain_id=uuid.UUID("11111111-1111-4111-8111-111111111111"),
    name="Tryfan",
    lat=53.1163,
    lon=-3.9915,
    elevation_m=917.5,
)
GLYDER_FACH = CandidateMountain(
    mountain_id=uuid.UUID("22222222-2222-4222-8222-222222222222"),
    name="Glyder Fach",
    lat=53.1030,
    lon=-4.0040,
    elevation_m=994.0,
)


@pytest.fixture(scope="module")
def policy():
    return load_validation_policy(POLICY_PATH)


def _drawn_line(
    summit: CandidateMountain,
    *,
    start_offset_m: float = 1_500.0,
    points: int = 40,
    with_elevation: bool = False,
    start_alt: float = 350.0,
    end_alt: float = 900.0,
) -> list[TracePoint]:
    """A line a person might have drawn, finishing on the summit."""
    start_lat = summit.lat + (start_offset_m / 111_320.0)
    out: list[TracePoint] = []
    for i in range(points):
        f = i / (points - 1)
        out.append(
            TracePoint(
                lat=start_lat + (summit.lat - start_lat) * f,
                lon=summit.lon,
                alt=(start_alt + (end_alt - start_alt) * f) if with_elevation else None,
            )
        )
    return out


def _draft(**overrides) -> RouteDraft:
    defaults = dict(
        source_id="tryfan-north-ridge",
        name="North Ridge",
        mountain_name="Tryfan",
        points=_drawn_line(TRYFAN),
        author="SummitReady editorial",
        drawn_on="OS Maps API Outdoor raster",
    )
    defaults.update(overrides)
    return RouteDraft(**defaults)


# ── Reading the source format ─────────────────────────────────────────────────


class TestGeoJsonSource:
    def _document(self, **properties):
        props = {"name": "North Ridge", "mountain": "Tryfan"}
        props.update(properties)
        return {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "id": "tryfan-north-ridge",
                    "properties": props,
                    "geometry": {
                        "type": "LineString",
                        "coordinates": [[-3.9870, 53.1090], [-3.9899, 53.1131]],
                    },
                }
            ],
        }

    def test_reads_a_feature_collection(self):
        draft = parse_drawn_routes(self._document())[0]
        assert draft.source_id == "tryfan-north-ridge"
        assert draft.name == "North Ridge"
        assert draft.mountain_name == "Tryfan"
        assert len(draft.points) == 2

    def test_geojson_is_longitude_first_and_is_flipped_here(self):
        """The boundary flip. Getting it wrong puts Tryfan in the Indian Ocean."""
        draft = parse_drawn_routes(self._document())[0]
        assert draft.points[0].lat == pytest.approx(53.1090)
        assert draft.points[0].lon == pytest.approx(-3.9870)

    def test_a_third_coordinate_is_used_as_elevation(self):
        document = self._document()
        document["features"][0]["geometry"]["coordinates"] = [
            [-3.9870, 53.1090, 400.0],
            [-3.9899, 53.1131, 620.0],
        ]
        draft = parse_drawn_routes(document)[0]
        assert [p.alt for p in draft.points] == [400.0, 620.0]

    def test_elevation_is_never_invented_when_absent(self):
        draft = parse_drawn_routes(self._document())[0]
        assert all(p.alt is None for p in draft.points)

    def test_aliases_are_deduplicated_and_sorted(self):
        draft = parse_drawn_routes(self._document(aliases=["B", "A", "A", "  "]))[0]
        assert draft.aliases == ("A", "B")

    def test_unknown_properties_are_kept_for_the_reviewer(self):
        """The engine has no grade column; the author's words are not discarded."""
        draft = parse_drawn_routes(self._document(grade="Grade 1 scramble"))[0]
        assert draft.extra == {"grade": "Grade 1 scramble"}

    def test_a_broken_feature_does_not_fail_the_batch(self):
        document = self._document()
        document["features"].append(
            {"type": "Feature", "properties": {"name": "Broken"}, "geometry": {"type": "Point"}}
        )
        drafts = parse_drawn_routes(document)
        assert len(drafts) == 2
        assert drafts[1].points == []

    def test_a_document_that_is_not_a_feature_collection_is_rejected(self):
        with pytest.raises(DrawnRouteFormatError):
            parse_drawn_routes({"type": "Feature"})
        with pytest.raises(DrawnRouteFormatError):
            parse_drawn_routes({"type": "FeatureCollection"})

    def test_reads_from_a_file(self, tmp_path):
        path = tmp_path / "routes.geojson"
        path.write_text(json.dumps(self._document()), encoding="utf-8")
        assert load_drawn_routes(path)[0].name == "North Ridge"


# ── The safety property ───────────────────────────────────────────────────────


class TestNothingBecomesNavigable:
    def test_no_drawn_route_is_ever_verified(self, policy):
        plan = plan_editorial_import(
            [
                _draft(source_id="a"),
                _draft(source_id="b", requires_scrambling=True),
                _draft(source_id="c", points=_drawn_line(TRYFAN, with_elevation=True)),
            ],
            [TRYFAN],
            policy,
        )
        assert plan.planned_count == 3
        assert all(r.status is not VerificationStatus.VERIFIED for r in plan.planned)

    def test_the_plan_type_itself_refuses_a_verified_route(self):
        """Enforced on the record, not only in the planners that build them."""
        from summit_data_engine.routes.plan import PlannedFacts, PlannedGeometry, PlannedRoute

        with pytest.raises(ValueError, match="may not emit VERIFIED"):
            PlannedRoute(
                source_id="x",
                mountain_id=TRYFAN.mountain_id,
                identity_key="editorial:x",
                version="1",
                canonical_name="North Ridge",
                aliases=(),
                description="",
                status=VerificationStatus.VERIFIED,
                geometry=PlannedGeometry([(0.0, 0.0)], "test", 1),
                facts=PlannedFacts(1.0, None, None, None, None),
                qa_flags=(),
            )

    def test_a_scramble_always_goes_to_a_reviewer(self, policy):
        """The Tryfan rule: hands-on rock is not published unseen."""
        route = plan_editorial_import(
            [_draft(requires_scrambling=True)], [TRYFAN], policy
        ).planned[0]
        assert route.status is VerificationStatus.NEEDS_REVIEW
        assert QaFlag.REQUIRES_SCRAMBLING in route.qa_flags


# ── The author and the line must agree ────────────────────────────────────────


class TestMountainAgreement:
    def test_a_named_mountain_the_line_reaches_is_accepted(self, policy):
        route = plan_editorial_import([_draft()], [TRYFAN, GLYDER_FACH], policy).planned[0]
        assert route.mountain_id == TRYFAN.mountain_id

    def test_a_line_that_never_reaches_its_stated_mountain_is_refused(self, policy):
        """The check the recorded path cannot make."""
        plan = plan_editorial_import(
            [_draft(mountain_name="Tryfan", points=_drawn_line(GLYDER_FACH))],
            [TRYFAN, GLYDER_FACH],
            policy,
        )
        assert plan.planned_count == 0
        assert plan.skipped[0].reason is SkipReason.MOUNTAIN_DISAGREES_WITH_LINE

    def test_an_unknown_mountain_name_is_refused(self, policy):
        plan = plan_editorial_import([_draft(mountain_name="Tryfann")], [TRYFAN], policy)
        assert plan.skipped[0].reason is SkipReason.MOUNTAIN_NOT_FOUND

    def test_mountain_names_are_matched_exactly_not_fuzzily(self, policy):
        """Fuzzy matching is how a route lands on the wrong hill in Montana."""
        for wrong in ["Tryfan Bach", "tryfan north", "Tryfa"]:
            plan = plan_editorial_import([_draft(mountain_name=wrong)], [TRYFAN], policy)
            assert plan.skipped[0].reason is SkipReason.MOUNTAIN_NOT_FOUND

    def test_case_and_spacing_do_not_matter(self, policy):
        plan = plan_editorial_import([_draft(mountain_name="  tryfan  ")], [TRYFAN], policy)
        assert plan.planned_count == 1

    def test_an_ambiguous_name_among_candidates_is_refused(self, policy):
        twin = CandidateMountain(uuid.uuid4(), "Tryfan", TRYFAN.lat, TRYFAN.lon, 917.0)
        plan = plan_editorial_import([_draft()], [TRYFAN, twin], policy)
        assert plan.skipped[0].reason is SkipReason.MOUNTAIN_NOT_FOUND


# ── What makes a drawn route different ────────────────────────────────────────


class TestDrawnRouteHandling:
    def test_the_points_are_kept_exactly_as_drawn(self, policy):
        """No resampling: the author chose each point."""
        points = _drawn_line(TRYFAN, points=31)
        route = plan_editorial_import([_draft(points=points)], [TRYFAN], policy).planned[0]
        assert len(route.geometry.coordinates) == 31
        assert route.geometry.source_point_count == 31
        first_lon, first_lat = route.geometry.coordinates[0]
        assert (first_lat, first_lon) == pytest.approx((points[0].lat, points[0].lon))

    def test_the_trailhead_survives_because_there_is_no_person_in_a_drawn_line(self, policy):
        points = _drawn_line(TRYFAN)
        route = plan_editorial_import([_draft(points=points)], [TRYFAN], policy).planned[0]
        published_km = path_length_m(points) / 1000
        assert route.facts.distance_km == pytest.approx(published_km, abs=0.01)

    def test_every_drawn_route_says_it_was_drawn(self, policy):
        route = plan_editorial_import([_draft()], [TRYFAN], policy).planned[0]
        assert QaFlag.DRAWN_NOT_SURVEYED in route.qa_flags
        assert route.geometry.derivation_method == DERIVATION_METHOD
        assert "Not surveyed or verified" in route.description

    def test_provenance_records_the_author_and_the_basemap(self, policy):
        route = plan_editorial_import([_draft()], [TRYFAN], policy).planned[0]
        assert "SummitReady editorial" in route.description
        assert "OS Maps API Outdoor raster" in route.description

    def test_ascent_is_absent_rather_than_estimated_without_elevation(self, policy):
        route = plan_editorial_import([_draft()], [TRYFAN], policy).planned[0]
        assert route.facts.total_ascent_m is None
        assert QaFlag.NO_ELEVATION_SOURCE in route.qa_flags

    def test_ascent_is_computed_when_the_author_supplied_elevation(self, policy):
        route = plan_editorial_import(
            [_draft(points=_drawn_line(TRYFAN, with_elevation=True, start_alt=350, end_alt=900))],
            [TRYFAN],
            policy,
        ).planned[0]
        assert route.facts.total_ascent_m == pytest.approx(550, abs=5)
        assert QaFlag.NO_ELEVATION_SOURCE not in route.qa_flags

    def test_no_duration_is_claimed_because_nobody_walked_it(self, policy):
        route = plan_editorial_import([_draft()], [TRYFAN], policy).planned[0]
        assert route.facts.typical_duration_hours is None
        assert route.contribution_count == 0

    def test_a_sparsely_drawn_line_goes_to_a_reviewer(self, policy):
        sparse = _drawn_line(TRYFAN, start_offset_m=10_000, points=8)
        route = plan_editorial_import([_draft(points=sparse)], [TRYFAN], policy).planned[0]
        assert route.status is VerificationStatus.NEEDS_REVIEW


# ── Identity ──────────────────────────────────────────────────────────────────


class TestIdentity:
    def test_identity_is_namespaced_and_keyed_on_the_source_id(self, policy):
        route = plan_editorial_import([_draft()], [TRYFAN], policy).planned[0]
        assert route.identity_key == "editorial:tryfan-north-ridge"
        assert route.source_id == "tryfan-north-ridge"

    def test_identity_survives_a_rename(self, policy):
        first = plan_editorial_import([_draft(name="North Ridge")], [TRYFAN], policy).planned[0]
        renamed = plan_editorial_import(
            [_draft(name="Tryfan North Ridge")], [TRYFAN], policy
        ).planned[0]
        assert first.identity_key == renamed.identity_key

    def test_redrawing_is_a_new_version_chosen_by_the_author(self, policy):
        route = plan_editorial_import([_draft(version="3")], [TRYFAN], policy).planned[0]
        assert route.version == "3"

    def test_the_canonical_name_is_not_repeated_in_aliases(self, policy):
        route = plan_editorial_import(
            [_draft(name="North Ridge", aliases=("North Ridge", "Tryfan North Ridge"))],
            [TRYFAN],
            policy,
        ).planned[0]
        assert route.aliases == ("Tryfan North Ridge",)

    def test_planning_is_deterministic(self, policy):
        drafts = [_draft()]
        assert plan_editorial_import(drafts, [TRYFAN], policy) == plan_editorial_import(
            drafts, [TRYFAN], policy
        )


# ── Quality gates ─────────────────────────────────────────────────────────────


class TestQualityGates:
    def test_an_unnamed_route_is_refused(self, policy):
        """A drawn route with no name has no author behind it."""
        plan = plan_editorial_import([_draft(name="")], [TRYFAN], policy)
        assert plan.skipped[0].reason is SkipReason.MISSING_NAME

    def test_a_handful_of_clicks_is_not_a_route(self, policy):
        plan = plan_editorial_import(
            [_draft(points=_drawn_line(TRYFAN, points=MIN_DRAWN_POINTS - 1))], [TRYFAN], policy
        )
        assert plan.skipped[0].reason is SkipReason.INVALID_GEOMETRY

    def test_an_unreadable_geometry_is_refused_not_crashed_on(self, policy):
        plan = plan_editorial_import([_draft(points=[])], [TRYFAN], policy)
        assert plan.skipped[0].reason is SkipReason.INVALID_GEOMETRY

    def test_a_line_shorter_than_the_policy_minimum_is_refused(self, policy):
        plan = plan_editorial_import(
            [_draft(points=_drawn_line(TRYFAN, start_offset_m=200))], [TRYFAN], policy
        )
        assert plan.skipped[0].reason is SkipReason.TOO_SHORT

    def test_a_multi_day_line_is_too_long_for_one_route(self, policy):
        plan = plan_editorial_import(
            [_draft(points=_drawn_line(TRYFAN, start_offset_m=80_000, points=200))],
            [TRYFAN],
            policy,
        )
        assert plan.skipped[0].reason is SkipReason.TOO_LONG

    def test_an_impossible_elevation_is_refused(self, policy):
        plan = plan_editorial_import(
            [_draft(points=_drawn_line(TRYFAN, with_elevation=True, end_alt=8_000))],
            [TRYFAN],
            policy,
        )
        assert plan.skipped[0].reason is SkipReason.IMPLAUSIBLE_ELEVATION

    def test_plans_and_skips_are_reported_together(self, policy):
        plan = plan_editorial_import(
            [_draft(source_id="good"), _draft(source_id="bad", name="")], [TRYFAN], policy
        )
        assert plan.planned_count == 1
        assert plan.skipped_count == 1
        assert plan.policy_version == "summitready_validation_v1"

    def test_an_empty_input_plans_nothing(self, policy):
        plan = plan_editorial_import([], [TRYFAN], policy)
        assert plan.planned_count == 0 and plan.skipped_count == 0
