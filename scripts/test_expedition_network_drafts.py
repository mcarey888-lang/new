import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("drafts", Path(__file__).with_name("prepare-expedition-network-drafts.py"))
drafts = importlib.util.module_from_spec(spec)
spec.loader.exec_module(drafts)


class NetworkDraftTests(unittest.TestCase):
    def test_route_contains_only_existing_edges(self):
        graph = {1:{2:(3,99)},2:{1:(3,99),3:(4,100)},3:{2:(4,100)}}
        self.assertEqual(drafts.shortest(graph,1,3),[1,2,3])

    def test_disconnected_network_never_invents_join(self):
        with self.assertRaisesRegex(ValueError,"No connected"):
            drafts.shortest({1:{2:(1,1)},2:{1:(1,1)},3:{}},1,3)

    def test_explicit_private_foot_access_excluded(self):
        elements = [
            {"type":"node","id":1,"lat":54,"lon":-3},
            {"type":"node","id":2,"lat":54.001,"lon":-3},
            {"type":"way","id":10,"nodes":[1,2],"tags":{"highway":"path","foot":"private"}},
        ]
        _,graph = drafts.build_graph(elements)
        self.assertEqual(dict(graph),{})

    def test_explicit_oneway_foot_preserved(self):
        elements = [
            {"type":"node","id":1,"lat":54,"lon":-3},
            {"type":"node","id":2,"lat":54.001,"lon":-3},
            {"type":"way","id":10,"nodes":[1,2],"tags":{"highway":"path","oneway:foot":"yes"}},
        ]
        _,graph = drafts.build_graph(elements)
        self.assertIn(2,graph[1])
        self.assertNotIn(1,graph[2])


if __name__ == "__main__":
    unittest.main()
