import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("sources", Path(__file__).with_name("prepare-expedition-route-sources.py"))
sources = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sources)


class ExactSourceChainTests(unittest.TestCase):
    def fixture(self, ways):
        return {"elements": [
            {"type": "relation", "id": 9, "version": 1,
             "members": [{"type": "way", "ref": i, "role": ""} for i in ways]},
            *[{"type": "way", "id": i, "version": 1, "nodes": ns} for i, ns in ways.items()],
            *[{"type": "node", "id": i, "version": 1, "lon": -4 + i / 10000, "lat": 53}
              for i in range(1, 7)],
        ]}

    def test_connected_edges_reordered_without_inventing_nodes(self):
        data = self.fixture({11: [2, 3], 12: [1, 2]})
        _, coords, edges = sources.source_chain(data)
        self.assertEqual(len(coords), 3)
        self.assertEqual(len(edges), 2)
        self.assertEqual({(min(e["fromNode"], e["toNode"]), max(e["fromNode"], e["toNode"])) for e in edges},
                         {(1, 2), (2, 3)})

    def test_disconnected_source_is_rejected(self):
        with self.assertRaises(ValueError):
            sources.source_chain(self.fixture({11: [1, 2], 12: [3, 4]}))

    def test_branch_is_rejected(self):
        with self.assertRaises(ValueError):
            sources.source_chain(self.fixture({11: [1, 2, 3], 12: [2, 4]}))

    def test_repeated_edge_is_rejected(self):
        with self.assertRaises(ValueError):
            sources.source_chain(self.fixture({11: [1, 2, 3], 12: [3, 2]}))

    def test_fuzzy_names_do_not_become_source_leads(self):
        self.assertFalse(sources.discovery.relevant("Fairfield", "Horseshoe Falls Trail"))
        self.assertFalse(sources.discovery.relevant("Cruachan", "Ruachan Trail"))
        self.assertTrue(sources.discovery.relevant("Carn Mor Dearg", "Càrn Mòr Dearg arête"))


if __name__ == "__main__":
    unittest.main()
