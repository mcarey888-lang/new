import copy
import unittest
import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location("watkin_pilot", Path(__file__).with_name("build-watkin-route-pilot.py"))
pilot = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pilot)
components, merge_sources = pilot.components, pilot.merge_sources
ordered_chain, source_graph, summit_access = pilot.ordered_chain, pilot.source_graph, pilot.summit_access


def node(latitude, longitude):
    return {"lat": latitude, "lon": longitude, "version": "1"}


def fixture():
    return {"node": {"a": node(53, -4), "b": node(53.001, -4),
                     "c": node(53.0011, -4), "d": node(53.002, -4)},
            "way": {"lower": {"nodes": ["a","b"],"tags":{"highway":"path"}},
                    "upper": {"nodes": ["c","d"],"tags":{"highway":"path"}},
                    "bridge": {"nodes": ["b","c"],"tags":{"highway":"footway","bridge":"yes"}}},
            "relation": {}}


class PilotChecks(unittest.TestCase):
    def test_gap_is_not_snapped(self):
        graph, _ = source_graph(["lower","upper"], fixture())
        self.assertEqual(len(components(graph)), 2)
        with self.assertRaises(ValueError):
            ordered_chain(graph, "a")

    def test_bridge_requires_actual_shared_node_ids(self):
        graph, owners = source_graph(["upper","bridge","lower"], fixture())
        self.assertEqual(ordered_chain(graph, "a"), ["a","b","c","d"])
        self.assertEqual(owners[("b","c")], "bridge")

    def test_overlapping_edges_and_missing_source_nodes_fail(self):
        with self.assertRaises(ValueError):
            source_graph(["lower","lower"], fixture())
        source=fixture()
        del source["node"]["b"]
        with self.assertRaises(ValueError):
            source_graph(["lower"], source)

    def test_branch_does_not_become_an_arbitrary_route(self):
        source=fixture()
        source["node"]["e"]=node(53.001,-4.001)
        source["way"]["branch"]={"nodes":["b","e"],"tags":{"highway":"path"}}
        graph,_=source_graph(["lower","upper","bridge","branch"],source)
        with self.assertRaises(ValueError):
            ordered_chain(graph,"a")

    def test_mixed_snapshots_are_rejected(self):
        first=fixture()
        second=copy.deepcopy(first)
        second["node"]["a"]["version"]="2"
        with self.assertRaises(ValueError):
            merge_sources(first,second)

    def test_summit_connector_cannot_cross_private_way(self):
        source=fixture()
        source["node"]["summit"]=node(53.002,-4)
        source["way"]["bridge"]["tags"]["access"]="private"
        with self.assertRaises(ValueError):
            summit_access(source,"a","summit")

    def test_summit_connector_keeps_exact_mapped_edges(self):
        source=fixture()
        source["node"]["summit"]=node(53.002,-4)
        edges,offset=summit_access(source,"a","summit")
        self.assertEqual(edges,[("a","b","lower"),("b","c","bridge"),("c","d","upper")])
        self.assertEqual(offset,0)


if __name__=="__main__":
    unittest.main()
