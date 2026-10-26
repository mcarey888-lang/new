import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("published_source", Path(__file__).with_name("prepare-published-expedition-source.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def fixture():
    return {"id": 16155652, "name": "Bein Alligin Trail", "tags": {"route": "hiking"},
            "route": {"linear": "yes", "appendices": [], "main": [{"ways": [
                {"id": 1, "geometry": {"type": "LineString", "coordinates": [[-619297, 7875159], [-619299, 7875260]]}},
                {"id": 2, "geometry": {"type": "LineString", "coordinates": [[-619299, 7875260], [-619200, 7875300]]}},
            ]}]}}


class PublishedSourceTests(unittest.TestCase):
    def test_only_published_points_and_order_are_used(self):
        points, ids = module.extract_published_track(fixture())
        self.assertEqual(ids, [1, 2])
        self.assertEqual(len(points), 3)
        self.assertNotEqual(points[0], points[-1])  # Never synthesize a closure.

    def test_gap_is_not_bridged(self):
        source = fixture()
        source["route"]["main"][0]["ways"][1]["geometry"]["coordinates"][0] = [-619298, 7875260]
        with self.assertRaisesRegex(ValueError, "Discontinuous"):
            module.extract_published_track(source)

    def test_reversed_member_is_not_guessed(self):
        source = fixture()
        source["route"]["main"][0]["ways"][1]["geometry"]["coordinates"].reverse()
        with self.assertRaisesRegex(ValueError, "Discontinuous"):
            module.extract_published_track(source)

    def test_disconnected_or_branched_published_routes_are_rejected(self):
        for mutation in ["linear", "main", "appendices"]:
            source = fixture()
            source["route"][mutation] = {"linear": "no", "main": [{}, {}], "appendices": [{}]}[mutation]
            with self.subTest(mutation=mutation), self.assertRaises(ValueError):
                module.extract_published_track(source)

    def test_wrong_identity_and_invalid_coordinates_are_rejected(self):
        source = fixture()
        source["id"] = 5643210  # Different Three Peaks route is not a substitute.
        with self.assertRaises(ValueError):
            module.extract_published_track(source)
        source = fixture()
        source["route"]["main"][0]["ways"][0]["geometry"]["coordinates"][0][0] = float("nan")
        with self.assertRaises(ValueError):
            module.extract_published_track(source)


if __name__ == "__main__":
    unittest.main()
