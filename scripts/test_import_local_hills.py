import importlib.util
import pathlib
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("local_hills_import", pathlib.Path(__file__).with_name("import-local-hills.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ImportLocalHillsTest(unittest.TestCase):
    def test_only_named_mapped_peaks_with_safe_height_semantics(self):
        xml = """<osm>
        <node id="1" lat="53.7" lon="-2.3"><tag k="natural" v="peak"/><tag k="name" v="Small Tor"/><tag k="alt_name" v="Little Tor;Old Tor"/><tag k="ele" v="150 m"/></node>
        <node id="2" lat="53.71" lon="-2.3"><tag k="natural" v="peak"/><tag k="name" v="Unknown Height"/></node>
        <node id="3" lat="53.7" lon="-2.3"><tag k="place" v="suburb"/><tag k="name" v="Hill Street"/></node>
        <node id="4" lat="53.7" lon="-2.3"><tag k="natural" v="peak"/><tag k="ele" v="300"/></node>
        </osm>"""
        with tempfile.TemporaryDirectory() as temp:
            path = pathlib.Path(temp) / "peaks.osm"
            path.write_text(xml)
            peaks = module.parse_peaks(path)
        self.assertEqual([p["id"] for p in peaks], [1, 2])
        self.assertEqual(peaks[0]["ele"], 150)
        self.assertEqual(peaks[0]["aliases"], ["Little Tor", "Old Tor"])
        self.assertIsNone(peaks[1]["ele"])


if __name__ == "__main__":
    unittest.main()
