"""Database-free contract tests for recorded-trace promotion.

The planner is pure, so every rule is exercised here directly — no Postgres, no
PostGIS, no shapely. Tryfan is used as the worked example because the engine
already treats it as one (`EngineSettings.review_output_path`).
"""

from __future__ import annotations

import uuid
from pathlib import Path

import pytest

from summit_data_engine.config.policy import load_validation_policy
from summit_data_engine.models.domain import VerificationStatus
from summit_data_engine.recorded.planner import (
    CANONICAL_SAMPLE_COUNT,
    CandidateMountain,
    QaFlag,
    RecordedTrace,
    SkipReason,
    looks_auto_generated,
    plan_import,
)
from summit_data_engine.recorded.traces import (
    TracePoint,
    ascent_descent_m,
    haversine_m,
    nearest_approach_m,
    path_length_m,
    resample,
    to_linestring_coordinates,
    trim_ends,
)

POLICY_PATH = Path(__file__).parents[1] / "config" / "validation_policy.toml"

# Tryfan, Snowdonia. Approximate summit position; the tests care about
# relationships between points, not about surveying the mountain.
TRYFAN = CandidateMountain(
    mountain_id=uuid.UUID("11111111-1111-4111-8111-111111111111"),
    name="Tryfan",
    lat=53.1163,
    lon=-3.9915,
    elevation_m=917.5,
)

# Glyder Fach, ~1.6 km south-west of Tryfan — close enough to make summit
# attribution a real question rather than a formality.
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


def _metres_north(lat: float, metres: float) -> float:
    return lat + (metres / 111_320.0)


def _line_to_summit(
    summit: CandidateMountain,
    *,
    start_offset_m: float = 2_000.0,
    points: int = 400,
    start_alt: float = 300.0,
    end_alt: float = 900.0,
) -> list[TracePoint]:
    """A straight ascending line finishing on a summit.

    Simple on purpose: the planner's rules are about length, gaps, altitude and
    proximity, none of which need a realistic mountain path to exercise.
    """
    start_lat = _metres_north(summit.lat, start_offset_m)
    out: list[TracePoint] = []
    for i in range(points):
        f = i / (points - 1)
        out.append(
            TracePoint(
                lat=start_lat + (summit.lat - start_lat) * f,
                lon=summit.lon,
                alt=start_alt + (end_alt - start_alt) * f,
                ts=1_700_000_000 + i * 10,
            )
        )
    return out


def _trace(**overrides) -> RecordedTrace:
    points = overrides.pop("points", None) or _line_to_summit(TRYFAN)
    defaults = dict(
        trace_id="trk_0001",
        name="North Ridge",
        points=points,
        distance_km=round(path_length_m(points) / 1000, 2),
        elevation_gain_m=600.0,
        elevation_loss_m=0.0,
        duration_secs=7_200,
        contribution_count=3,
    )
    defaults.update(overrides)
    return RecordedTrace(**defaults)


# ── traces.py: the pure geometry ──────────────────────────────────────────────


class TestTraceGeometry:
    def test_haversine_matches_a_known_separation(self):
        # One degree of latitude is ~111.2 km anywhere on the globe.
        assert haversine_m(53.0, -4.0, 54.0, -4.0) == pytest.approx(111_195, rel=0.001)

    def test_path_length_sums_the_segments(self):
        points = [TracePoint(53.0, -4.0), TracePoint(_metres_north(53.0, 100), -4.0)]
        assert path_length_m(points) == pytest.approx(100, abs=1)

    def test_nearest_approach_uses_the_whole_trace_not_the_start(self):
        """A route's start is a car park; only the whole line locates a summit."""
        points = _line_to_summit(TRYFAN, start_offset_m=3_000)
        assert nearest_approach_m(points, TRYFAN.lat, TRYFAN.lon) == pytest.approx(0, abs=5)

    def test_resample_returns_the_requested_count_and_keeps_the_ends(self):
        points = _line_to_summit(TRYFAN, points=137)
        out = resample(points, 50)
        assert len(out) == 50
        assert out[0].lat == pytest.approx(points[0].lat)
        assert out[-1].lat == pytest.approx(points[-1].lat)

    def test_resample_refuses_to_invent_timestamps(self):
        """An interpolated time belongs to no walk, so the canonical line has none."""
        out = resample(_line_to_summit(TRYFAN), 50)
        assert all(p.ts is None for p in out)

    def test_resample_interpolates_altitude(self):
        out = resample(_line_to_summit(TRYFAN, start_alt=0, end_alt=1000), 3)
        assert out[1].alt == pytest.approx(500, abs=1)

    def test_trim_ends_removes_both_ends(self):
        points = _line_to_summit(TRYFAN, start_offset_m=2_000)
        trimmed = trim_ends(points, 250)
        assert len(trimmed) < len(points)
        # The new start is at least the trim radius from the old one.
        assert haversine_m(
            trimmed[0].lat, trimmed[0].lon, points[0].lat, points[0].lon
        ) >= 240

    def test_trim_ends_is_a_no_op_at_zero_radius(self):
        points = _line_to_summit(TRYFAN)
        assert trim_ends(points, 0) == points

    def test_ascent_ignores_jitter_inside_the_deadband(self):
        """A walker standing still must not accumulate ascent."""
        jitter = [TracePoint(53.0, -4.0, alt=300 + (1.0 if i % 2 else -1.0)) for i in range(200)]
        ascent, descent = ascent_descent_m(jitter, deadband_m=3.0)
        assert ascent == 0.0
        assert descent == 0.0

    def test_ascent_counts_real_climbing(self):
        climb = [TracePoint(53.0, -4.0, alt=300 + i * 10) for i in range(51)]
        ascent, descent = ascent_descent_m(climb, deadband_m=3.0)
        assert ascent == pytest.approx(500, abs=1)
        assert descent == 0.0

    def test_linestring_coordinates_are_longitude_first(self):
        """The one flip in the module. Getting it wrong puts Tryfan in Somalia."""
        out = to_linestring_coordinates([TracePoint(lat=53.1163, lon=-3.9915)])
        assert out == [(-3.9915, 53.1163)]


# ── The safety property ───────────────────────────────────────────────────────


class TestNothingBecomesNavigable:
    def test_no_planned_route_is_ever_verified(self, policy):
        """The guard this whole module is built around.

        `utils/routeEligibility.ts` navigates only a route whose engine status
        is `verified`. If this test ever fails, recorded traces have become
        navigable without anyone deciding that they should.
        """
        traces = [
            _trace(trace_id="a", name="North Ridge", contribution_count=9),
            _trace(trace_id="b", name="Heather Terrace", contribution_count=0),
            _trace(trace_id="c", name="Hike – 24 Sept 2026, 10:37"),
        ]
        plan = plan_import(traces, [TRYFAN], policy)
        assert plan.planned_count == 3
        assert all(route.status is not VerificationStatus.VERIFIED for route in plan.planned)
        assert {route.status for route in plan.planned} <= {
            VerificationStatus.PROCESSED,
            VerificationStatus.NEEDS_REVIEW,
        }

    def test_a_well_evidenced_named_route_still_only_reaches_processed(self, policy):
        plan = plan_import([_trace(contribution_count=50)], [TRYFAN], policy)
        assert plan.planned[0].status is VerificationStatus.PROCESSED


# ── Identity and naming ───────────────────────────────────────────────────────


class TestIdentity:
    def test_identity_key_comes_from_the_immutable_trace_id_not_the_name(self, policy):
        first = plan_import([_trace(name="North Ridge")], [TRYFAN], policy).planned[0]
        renamed = plan_import([_trace(name="Tryfan North Ridge")], [TRYFAN], policy).planned[0]
        assert first.identity_key == "recorded:trk_0001"
        assert renamed.identity_key == first.identity_key

    def test_version_advances_with_evidence(self, policy):
        """Each merged walk moves the line, so it earns a version, not a rewrite."""
        one = plan_import([_trace(contribution_count=0)], [TRYFAN], policy).planned[0]
        many = plan_import([_trace(contribution_count=7)], [TRYFAN], policy).planned[0]
        assert one.version == "1"
        assert many.version == "8"
        assert one.identity_key == many.identity_key

    def test_planning_is_deterministic(self, policy):
        traces = [_trace()]
        assert plan_import(traces, [TRYFAN], policy) == plan_import(traces, [TRYFAN], policy)

    def test_the_route_is_filed_under_its_mountain(self, policy):
        plan = plan_import([_trace()], [TRYFAN, GLYDER_FACH], policy)
        assert plan.planned[0].mountain_id == TRYFAN.mountain_id


class TestNaming:
    @pytest.mark.parametrize(
        "name",
        [
            "Hike – 24 Sept 2026, 10:37",
            "Hike - 3 Jan 2027, 08:02",
            "GPS Tracked Route",
            "Untitled",
            "Activity 4",
            "2026-09-24 morning",
            "   ",
            "",
        ],
    )
    def test_software_minted_names_are_recognised(self, name):
        assert looks_auto_generated(name)

    @pytest.mark.parametrize("name", ["North Ridge", "Heather Terrace", "Bristly Ridge"])
    def test_real_route_names_are_kept(self, name):
        assert not looks_auto_generated(name)

    def test_an_auto_named_trace_gets_a_descriptive_name_and_a_reviewer(self, policy):
        """Descriptive, not invented: it claims only what is known."""
        plan = plan_import([_trace(name="Hike – 24 Sept 2026, 10:37")], [TRYFAN], policy)
        route = plan.planned[0]
        assert route.canonical_name == "Tryfan — recorded line"
        assert QaFlag.AUTO_GENERATED_NAME in route.qa_flags
        assert route.status is VerificationStatus.NEEDS_REVIEW

    def test_names_people_chose_become_aliases(self, policy):
        plan = plan_import(
            [
                _trace(
                    name="North Ridge",
                    contributed_names=("Tryfan North Ridge", "North Ridge", "Hike – 1 Jan 2027"),
                )
            ],
            [TRYFAN],
            policy,
        )
        route = plan.planned[0]
        assert route.canonical_name == "North Ridge"
        # Deduplicated, the canonical name removed, software names excluded.
        assert route.aliases == ("Tryfan North Ridge",)

    def test_a_single_walk_is_flagged_and_reviewed(self, policy):
        route = plan_import([_trace(contribution_count=0)], [TRYFAN], policy).planned[0]
        assert QaFlag.SINGLE_CONTRIBUTION in route.qa_flags
        assert route.status is VerificationStatus.NEEDS_REVIEW


# ── Summit attribution ────────────────────────────────────────────────────────


class TestSummitAttribution:
    def test_a_trace_nowhere_near_a_summit_is_refused(self, policy):
        far = _line_to_summit(
            CandidateMountain(uuid.uuid4(), "Elsewhere", 52.0, -3.0, 400.0)
        )
        plan = plan_import([_trace(points=far)], [TRYFAN], policy)
        assert plan.planned_count == 0
        assert plan.skipped[0].reason is SkipReason.NO_SUMMIT_MATCH

    def test_two_equally_close_summits_are_refused_rather_than_guessed(self, policy):
        """`.agents/memory/ambiguous-hill-identity.md`: do not guess identity.

        A trace ending midway between two tops matches both and neither.
        """
        midpoint = CandidateMountain(
            uuid.uuid4(),
            "Midpoint",
            (TRYFAN.lat + GLYDER_FACH.lat) / 2,
            (TRYFAN.lon + GLYDER_FACH.lon) / 2,
        )
        twin_a = CandidateMountain(uuid.uuid4(), "Twin A", midpoint.lat, midpoint.lon, 900.0)
        twin_b = CandidateMountain(
            uuid.uuid4(), "Twin B", _metres_north(midpoint.lat, 20), midpoint.lon, 901.0
        )
        plan = plan_import(
            [_trace(points=_line_to_summit(twin_a))], [twin_a, twin_b], policy
        )
        assert plan.planned_count == 0
        assert plan.skipped[0].reason is SkipReason.AMBIGUOUS_SUMMIT

    def test_a_clear_winner_among_neighbours_is_accepted(self, policy):
        plan = plan_import(
            [_trace(points=_line_to_summit(GLYDER_FACH))], [TRYFAN, GLYDER_FACH], policy
        )
        assert plan.planned_count == 1
        assert plan.planned[0].mountain_id == GLYDER_FACH.mountain_id


# ── Quality gates ─────────────────────────────────────────────────────────────


class TestQualityGates:
    def test_a_handful_of_fixes_is_not_a_route(self, policy):
        plan = plan_import([_trace(points=_line_to_summit(TRYFAN, points=5))], [TRYFAN], policy)
        assert plan.skipped[0].reason is SkipReason.TOO_FEW_POINTS

    def test_a_gps_jump_is_refused(self, policy):
        """The straight line across a dropout is fiction, so the trace is refused."""
        points = _line_to_summit(TRYFAN)
        points[200] = TracePoint(_metres_north(points[200].lat, 5_000), points[200].lon, alt=400)
        plan = plan_import([_trace(points=points)], [TRYFAN], policy)
        assert plan.skipped[0].reason is SkipReason.GPS_JUMP

    def test_a_stroll_from_the_car_park_is_too_short(self, policy):
        plan = plan_import(
            [_trace(points=_line_to_summit(TRYFAN, start_offset_m=300))], [TRYFAN], policy
        )
        assert plan.skipped[0].reason in {
            SkipReason.TOO_SHORT,
            SkipReason.PRIVACY_TRIM_EXHAUSTED,
        }

    def test_a_multi_day_line_is_too_long_to_be_one_route(self, policy):
        plan = plan_import(
            [_trace(points=_line_to_summit(TRYFAN, start_offset_m=80_000, points=2000))],
            [TRYFAN],
            policy,
        )
        assert plan.skipped[0].reason is SkipReason.TOO_LONG

    def test_an_impossible_altitude_is_refused(self, policy):
        points = _line_to_summit(TRYFAN, start_alt=300, end_alt=8_000)
        plan = plan_import([_trace(points=points)], [TRYFAN], policy)
        assert plan.skipped[0].reason is SkipReason.IMPLAUSIBLE_ELEVATION

    def test_a_trace_with_no_altitude_is_kept_but_flagged(self, policy):
        points = [TracePoint(p.lat, p.lon) for p in _line_to_summit(TRYFAN)]
        route = plan_import([_trace(points=points)], [TRYFAN], policy).planned[0]
        assert QaFlag.NO_ALTITUDE in route.qa_flags
        assert route.facts.total_ascent_m == 0.0

    def test_a_wildly_different_reported_distance_is_flagged(self, policy):
        route = plan_import([_trace(distance_km=99.0)], [TRYFAN], policy).planned[0]
        assert QaFlag.REPORTED_DISTANCE_DIFFERS in route.qa_flags

    def test_skips_and_plans_are_reported_together(self, policy):
        plan = plan_import(
            [
                _trace(trace_id="good"),
                _trace(trace_id="bad", points=_line_to_summit(TRYFAN, points=5)),
            ],
            [TRYFAN],
            policy,
        )
        assert plan.planned_count == 1
        assert plan.skipped_count == 1
        assert plan.policy_version == "summitready_validation_v1"


# ── Privacy ───────────────────────────────────────────────────────────────────


class TestPrivacy:
    def test_the_published_line_does_not_start_where_the_recording_did(self, policy):
        """A trace often starts at someone's home or parked car."""
        points = _line_to_summit(TRYFAN, start_offset_m=3_000)
        route = plan_import([_trace(points=points)], [TRYFAN], policy).planned[0]
        first_lon, first_lat = route.geometry.coordinates[0]
        assert haversine_m(first_lat, first_lon, points[0].lat, points[0].lon) >= 240

    def test_privacy_trim_can_be_widened_by_the_caller(self, policy):
        points = _line_to_summit(TRYFAN, start_offset_m=4_000)
        wide = plan_import([_trace(points=points)], [TRYFAN], policy, privacy_trim_m=800).planned[0]
        narrow = plan_import(
            [_trace(points=points)], [TRYFAN], policy, privacy_trim_m=50
        ).planned[0]
        assert wide.facts.distance_km < narrow.facts.distance_km

    def test_a_trace_mostly_eaten_by_the_trim_is_refused(self, policy):
        """What survives is no longer the route that was walked."""
        points = _line_to_summit(TRYFAN, start_offset_m=1_200)
        plan = plan_import([_trace(points=points)], [TRYFAN], policy, privacy_trim_m=500)
        assert plan.planned_count == 0
        assert plan.skipped[0].reason is SkipReason.PRIVACY_TRIM_EXHAUSTED

    def test_the_recorder_is_not_carried_into_the_plan(self):
        """No field on the planned record can hold a user id."""
        fields = set(RecordedTrace.__dataclass_fields__)
        assert not {"created_by", "user_id", "clerk_id"} & fields


# ── The shape of what gets written ────────────────────────────────────────────


class TestPlannedOutput:
    def test_geometry_is_resampled_to_the_canonical_count(self, policy):
        route = plan_import([_trace()], [TRYFAN], policy).planned[0]
        assert len(route.geometry.coordinates) == CANONICAL_SAMPLE_COUNT
        assert route.geometry.derivation_method == "recorded_trace_merge_v1"

    def test_geometry_coordinates_are_longitude_latitude(self, policy):
        route = plan_import([_trace()], [TRYFAN], policy).planned[0]
        for lon, lat in route.geometry.coordinates:
            assert -8 < lon < 2, "longitude outside Great Britain — order flipped?"
            assert 49 < lat < 61, "latitude outside Great Britain — order flipped?"

    def test_facts_measure_the_published_line_not_the_raw_trace(self, policy):
        """Every number published describes the line that was published."""
        points = _line_to_summit(TRYFAN, start_offset_m=3_000)
        route = plan_import([_trace(points=points, distance_km=3.0)], [TRYFAN], policy).planned[0]
        published_km = path_length_m(
            [TracePoint(lat, lon) for lon, lat in route.geometry.coordinates]
        ) / 1000
        assert route.facts.distance_km == pytest.approx(published_km, abs=0.05)

    def test_typical_duration_is_the_median_of_real_walks(self, policy):
        route = plan_import(
            [_trace(duration_secs=3_600, contributed_duration_secs=(7_200, 10_800))],
            [TRYFAN],
            policy,
        ).planned[0]
        assert route.facts.typical_duration_hours == pytest.approx(2.0)

    def test_summit_elevation_comes_from_the_mountain_record(self, policy):
        route = plan_import([_trace()], [TRYFAN], policy).planned[0]
        assert route.facts.summit_elevation_m == TRYFAN.elevation_m

    def test_the_description_states_the_evidence_and_claims_nothing_more(self, policy):
        route = plan_import([_trace(contribution_count=4)], [TRYFAN], policy).planned[0]
        assert "5 recorded walks" in route.description
        assert "Not surveyed or verified" in route.description

    def test_an_empty_input_plans_nothing(self, policy):
        plan = plan_import([], [TRYFAN], policy)
        assert plan.planned_count == 0 and plan.skipped_count == 0

    def test_no_mountains_means_nothing_can_be_filed(self, policy):
        plan = plan_import([_trace()], [], policy)
        assert plan.skipped[0].reason is SkipReason.NO_SUMMIT_MATCH
