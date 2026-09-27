"""The OSM candidate report is review-only, so these tests pin its judgement.

Two halves. The first uses small hand-built networks to pin each rule on its own.
The second runs the real committed Tryfan extract, because the whole reason the
module exists is the answer it gives on real data — and that answer is the thing
most likely to be quietly broken by a later change.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from summit_data_engine.osm.candidates import (
    LINKING_METHOD,
    OsmWay,
    Peak,
    Shape,
    Verdict,
    assess,
    bounding_box,
    build_report,
    distance_m,
    judging_peak,
    load_path_network,
    parse_path_network,
    path_length_m,
)

EXTRACT = (
    Path(__file__).resolve().parents[1]
    / "data"
    / "processed"
    / "tryfan_candidate_path_network.geojson"
)

# OSM node 29580544, as recorded in data/processed/tryfan_manifest.json.
TRYFAN = Peak(name="Tryfan", lon=-3.997578, lat=53.1149311, osm_id=29580544)


def way(way_id: int, points, name="Test Route", highway="path") -> OsmWay:
    return OsmWay(way_id=way_id, name=name, highway=highway, points=tuple(points))


def line(lon0: float, lat0: float, count: int, step: float = 0.002):
    """A straight run of positions, long enough to clear the length minimum."""
    return [(round(lon0, 7), round(lat0 + i * step, 7)) for i in range(count)]


def one(ways, peaks=(TRYFAN,), *, tolerance=150.0, minimum=500.0):
    results = assess(
        list(ways),
        list(peaks),
        summit_reach_tolerance_m=tolerance,
        min_route_length_m=minimum,
    )
    assert len(results) == 1
    return results[0]


class TestGeometry:
    def test_distance_is_symmetric_and_zero_on_itself(self):
        a, b = (-3.99, 53.11), (-3.98, 53.12)
        assert distance_m(a, a) == 0.0
        assert distance_m(a, b) == pytest.approx(distance_m(b, a))

    def test_a_degree_of_latitude_is_about_111_km(self):
        assert distance_m((0.0, 53.0), (0.0, 54.0)) == pytest.approx(111_195, rel=0.01)

    def test_length_sums_the_segments(self):
        points = ((0.0, 53.0), (0.0, 53.01), (0.0, 53.02))
        assert path_length_m(points) == pytest.approx(2 * distance_m((0.0, 53.0), (0.0, 53.01)))


class TestParsing:
    def test_reads_a_multilinestring_as_one_way(self):
        doc = {
            "type": "FeatureCollection",
            "features": [
                {
                    "properties": {"osm_id": 1, "name": "Ridge", "highway": "path"},
                    "geometry": {
                        "type": "MultiLineString",
                        "coordinates": [
                            [[-3.99, 53.11], [-3.99, 53.12]],
                            [[-3.99, 53.12], [-3.99, 53.13]],
                        ],
                    },
                }
            ],
        }
        ways = parse_path_network(doc)
        assert len(ways) == 1
        # The shared position appears once, so the endpoints stay meaningful.
        assert ways[0].points == ((-3.99, 53.11), (-3.99, 53.12), (-3.99, 53.13))

    def test_a_single_broken_feature_does_not_fail_the_extract(self):
        doc = {
            "type": "FeatureCollection",
            "features": [
                {
                    "properties": {"osm_id": 1},
                    "geometry": {"type": "Point", "coordinates": [0, 0]},
                },
                {
                    "properties": {"osm_id": 2, "name": "Good"},
                    "geometry": {
                        "type": "LineString",
                        "coordinates": [[-3.99, 53.11], [-3.99, 53.12]],
                    },
                },
            ],
        }
        assert [w.way_id for w in parse_path_network(doc)] == [2]

    def test_rejects_a_document_that_is_not_a_feature_collection(self):
        with pytest.raises(ValueError):
            parse_path_network({"type": "LineString", "coordinates": []})
        with pytest.raises(ValueError):
            parse_path_network({"type": "FeatureCollection"})

    def test_unnamed_ways_are_kept_but_never_assessed(self):
        doc = {
            "type": "FeatureCollection",
            "features": [
                {
                    "properties": {"osm_id": 7, "name": None},
                    "geometry": {
                        "type": "LineString",
                        "coordinates": [[-3.99, 53.11], [-3.99, 53.2]],
                    },
                }
            ],
        }
        ways = parse_path_network(doc)
        assert ways[0].name is None
        assert (
            assess(ways, [TRYFAN], summit_reach_tolerance_m=150.0, min_route_length_m=500.0)
            == []
        )


class TestVerdicts:
    def test_a_short_way_is_too_short_whatever_its_shape(self):
        """A footbridge is not a fragmented route; it is not a route."""
        result = one(
            [
                way(1, [(-3.99, 53.11), (-3.99, 53.1101)]),
                way(2, [(-3.98, 53.12), (-3.98, 53.1201)]),
            ]
        )
        assert result.verdict is Verdict.TOO_SHORT
        assert result.shape is Shape.FRAGMENTED

    def test_ways_sharing_an_endpoint_form_one_simple_path(self):
        a = line(-3.997578, 53.1000, 10)
        b = line(a[-1][0], a[-1][1], 10)
        result = one([way(1, a), way(2, b)])
        assert result.shape is Shape.SIMPLE_PATH
        assert result.chain_count == 1
        assert result.largest_gap_m == 0.0

    def test_a_gap_makes_it_fragmented_and_reports_the_distance(self):
        a = line(-3.997578, 53.1000, 10)
        b = line(-3.997578, 53.1300, 10)  # a clear gap north of a
        result = one([way(1, a), way(2, b)])
        assert result.verdict is Verdict.NOT_A_SINGLE_LINE
        assert result.chain_count == 2
        assert result.largest_gap_m > 100.0

    def test_a_third_way_at_a_shared_point_is_branching(self):
        a = line(-3.997578, 53.1000, 8)
        junction = a[-1]
        b = [junction, (junction[0] + 0.01, junction[1] + 0.01)]
        c = [junction, (junction[0] - 0.01, junction[1] + 0.01)]
        result = one([way(1, a), way(2, b), way(3, c)])
        assert result.shape is Shape.BRANCHING
        assert result.verdict is Verdict.NOT_A_SINGLE_LINE

    def test_a_closed_ring_is_a_loop_not_a_path(self):
        ring = [(-3.99, 53.11), (-3.98, 53.11), (-3.98, 53.12), (-3.99, 53.12)]
        result = one([way(1, ring + [ring[0]])])
        assert result.shape is Shape.LOOP
        assert result.verdict is Verdict.NOT_A_SINGLE_LINE

    def test_a_path_reaching_the_summit_is_reviewable(self):
        points = line(-3.997578, 53.1149311 - 0.02, 12)  # runs north onto the summit
        result = one([way(1, points)])
        assert result.verdict is Verdict.REVIEWABLE
        assert result.nearest_peak == "Tryfan"
        assert result.nearest_peak_m is not None and result.nearest_peak_m < 150.0

    def test_a_path_that_passes_near_the_summit_without_reaching_it(self):
        """Close enough for Tryfan to judge it, not close enough to pass."""
        points = line(-3.997578 + 0.012, 53.1149311 - 0.01, 12)
        result = one([way(1, points)])
        assert result.verdict is Verdict.SUMMIT_OUT_OF_RANGE
        assert "tolerance" in result.detail

    def test_no_peak_supplied_is_unknown_rather_than_a_failure(self):
        """The rule that keeps a clipped extract from reading as a data defect."""
        points = line(-3.997578, 53.1149311 - 0.02, 12)
        result = one([way(1, points)], peaks=())
        assert result.verdict is Verdict.NO_PEAK_NEARBY
        assert result.nearest_peak is None
        assert result.nearest_peak_m is None

    def test_a_distant_peak_does_not_judge_a_short_way(self):
        """A 900 m way five kilometres from the only supplied peak is not a
        route that failed to summit; it is a route whose summit nobody gave."""
        points = line(-3.90, 53.05, 6)
        result = one([way(1, points)])
        assert result.verdict is Verdict.NO_PEAK_NEARBY
        assert "further than" in result.detail
        # The measurement is still reported, so a reviewer can see the distance.
        assert result.nearest_peak == "Tryfan"
        assert result.nearest_peak_m is not None

    def test_the_association_bound_scales_with_the_route(self):
        assert judging_peak(3575.0, 655.0) is True
        assert judging_peak(951.0, 5150.0) is False
        assert judging_peak(1000.0, 1000.0) is True
        assert judging_peak(1000.0, None) is False

    def test_the_tolerance_decides_the_verdict(self):
        """The same geometry passes at one tolerance and fails at another.

        Offset east by 0.0015 degrees of longitude, which at this latitude puts
        the closest approach near 100 m — inside 150 and outside 50.
        """
        points = line(-3.997578 + 0.0015, 53.1149311 - 0.02, 12)
        loose = one([way(1, points)], tolerance=150.0)
        strict = one([way(1, points)], tolerance=50.0)
        assert loose.verdict is Verdict.REVIEWABLE
        assert strict.verdict is Verdict.SUMMIT_OUT_OF_RANGE
        assert loose.nearest_peak_m == pytest.approx(100, abs=15)

    def test_assessment_is_deterministic(self):
        ways = [way(2, line(-3.99, 53.10, 9)), way(1, line(-3.98, 53.12, 9), name="Other")]
        first = assess(ways, [TRYFAN], summit_reach_tolerance_m=150.0, min_route_length_m=500.0)
        second = assess(
            list(reversed(ways)), [TRYFAN], summit_reach_tolerance_m=150.0, min_route_length_m=500.0
        )
        assert first == second


class TestReport:
    def test_the_report_carries_the_terms_it_judged_on(self):
        report = build_report(
            [way(1, line(-3.997578, 53.1149311 - 0.02, 12))],
            [TRYFAN],
            summit_reach_tolerance_m=150.0,
            min_route_length_m=500.0,
            policy_version="test_v1",
        )
        assert report.policy_version == "test_v1"
        assert report.summit_reach_tolerance_m == 150.0
        assert report.linking_method == LINKING_METHOD
        assert len(report.reviewable) == 1


@pytest.mark.skipif(not EXTRACT.exists(), reason="committed Tryfan extract not present")
class TestCommittedTryfanExtract:
    """What the module actually says about the real data.

    These numbers are the finding the module was written to record: the Tryfan
    extract yields one candidate at a 150 m tolerance and none at 75 m, which is
    the tolerance the extract was originally built with.
    """

    @staticmethod
    @pytest.fixture(scope="class")
    def ways():
        return load_path_network(EXTRACT)

    def test_the_extract_is_the_size_we_think(self, ways):
        assert len(ways) == 650
        assert sum(1 for w in ways if w.name) == 43

    def test_tryfan_is_inside_the_extract_and_snowdon_is_not(self, ways):
        min_lon, min_lat, max_lon, max_lat = bounding_box(ways)
        assert min_lon <= TRYFAN.lon <= max_lon
        assert min_lat <= TRYFAN.lat <= max_lat
        # Snowdon's summit sits west of the western edge, so every Snowdon path
        # in here is clipped short of its summit. Verdicts for those routes are
        # NO_PEAK_NEARBY, not a judgement on the mapping.
        assert min_lon > -4.0765

    def test_nineteen_named_routes_yield_exactly_one_candidate(self, ways):
        report = build_report(
            ways,
            [TRYFAN],
            summit_reach_tolerance_m=150.0,
            min_route_length_m=500.0,
            policy_version="summitready_validation_v1",
        )
        assert len(report.candidates) == 19
        assert [c.name for c in report.reviewable] == ["Llwybr Gwregys"]

    def test_the_only_candidate_disappears_at_the_original_tolerance(self, ways):
        """75 m is what data/processed/tryfan_manifest.json records for the run
        that produced this extract. The single candidate does not survive it."""
        report = build_report(
            ways,
            [TRYFAN],
            summit_reach_tolerance_m=75.0,
            min_route_length_m=500.0,
            policy_version="summitready_validation_v1",
        )
        assert report.reviewable == ()

    def test_the_north_ridge_chain_is_broken_by_a_single_large_gap(self, ways):
        """Crib Ogwen carries the three ways tryfan_review.md names as the
        North Ridge topology. It reaches the summit; it is the gap near the
        base that makes it unpublishable, and the gap is 300 m wide — far too
        wide to be a mapping artefact that could be safely joined."""
        report = build_report(
            ways,
            [TRYFAN],
            summit_reach_tolerance_m=150.0,
            min_route_length_m=500.0,
            policy_version="summitready_validation_v1",
        )
        ridge = next(c for c in report.candidates if c.name == "Crib Ogwen")
        assert {1136472277, 1111458062, 114871121} <= set(ridge.way_ids)
        assert ridge.verdict is Verdict.NOT_A_SINGLE_LINE
        assert ridge.nearest_peak_m is not None and ridge.nearest_peak_m < 10.0
        assert 300.0 < ridge.largest_gap_m < 310.0

    def test_the_other_gaps_are_small_enough_to_be_mapping_artefacts(self, ways):
        """The distribution is the argument. Every gap bar the North Ridge is
        under ten metres, so 'refuse to join' costs almost nothing and 'join
        anything' would invent 300 m of ridge."""
        report = build_report(
            ways,
            [TRYFAN],
            summit_reach_tolerance_m=150.0,
            min_route_length_m=500.0,
            policy_version="summitready_validation_v1",
        )
        gaps = sorted(c.largest_gap_m for c in report.candidates if c.largest_gap_m > 0)
        assert gaps[-1] > 300.0
        assert all(gap < 10.0 for gap in gaps[:-1])
