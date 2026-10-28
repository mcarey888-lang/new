#!/usr/bin/env python3
"""Build a separately licensed UK named-peak index from Geofabrik extracts.

Requires osmium-tool. No Overpass, user data, database writes, or AI.
Output is a deployment-independent App Storage snapshot, not a Git asset.
"""
import argparse
import concurrent.futures
import datetime
import hashlib
import json
import math
import pathlib
import re
import shutil
import subprocess
import tempfile
import time
import urllib.request
import xml.etree.ElementTree as ET

ROOT = "https://download.geofabrik.de/europe/united-kingdom/"
UA = "SummitReady-LocalHillsImport/1.0 (+https://summitready.uk)"


def request(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=120)


def regions():
    with request(ROOT + "england.html") as response:
        html = response.read().decode()
    counties = sorted(set(re.findall(r'href="(england/[a-z0-9-]+)\.html"', html)))
    if len(counties) < 40:
        raise RuntimeError("Incomplete England region listing; refusing a partial UK snapshot")
    # Lancashire first makes the local regression example available early.
    counties.sort(key=lambda r: (r != "england/lancashire", r))
    return counties + ["scotland", "wales", "ireland-and-northern-ireland"]


def parse_peaks(path):
    peaks = []
    for _, node in ET.iterparse(path, events=("end",)):
        if node.tag != "node":
            continue
        tags = {t.attrib["k"]: t.attrib["v"] for t in node.findall("tag")}
        name = (tags.get("name:en") or tags.get("name") or "").strip()
        lat, lng = float(node.attrib["lat"]), float(node.attrib["lon"])
        if tags.get("natural") == "peak" and name and math.isfinite(lat) and math.isfinite(lng) and -90 <= lat <= 90 and -180 <= lng <= 180:
            aliases = sorted(set(
                s.strip() for key in ["name", "name:en", "alt_name", "loc_name", "old_name"]
                for s in tags.get(key, "").split(";") if s.strip() and s.strip() != name
            ))
            ele = re.fullmatch(r"\s*(-?\d+(?:\.\d+)?)\s*(m|metres|meters|ft)?\s*", tags.get("ele", ""))
            height = float(ele[1]) * (0.3048 if ele[2] == "ft" else 1) if ele else None
            if height is not None and (height <= 0 or height > 9000):
                height = None
            peaks.append({"id": int(node.attrib["id"]), "name": name, "aliases": aliases,
                          "lat": lat, "lng": lng, "ele": round(height, 1) if height else None})
        node.clear()
    return peaks


def import_region(region, workdir, resume=False):
    if not re.fullmatch(r"(england/)?[a-z-]+", region):
        raise ValueError("Invalid Geofabrik region")
    prefix = pathlib.Path(workdir) / region.replace("/", "-")
    xml = prefix.with_suffix(".osm")
    pbf = prefix.with_suffix(".osm.pbf")
    url = (ROOT if region != "ireland-and-northern-ireland" else "https://download.geofabrik.de/europe/") + region + "-latest.osm.pbf"
    completed = prefix.with_suffix(".json")
    if resume and completed.exists() and time.time() - completed.stat().st_mtime < 24 * 3600:
        existing = json.loads(completed.read_text())
        if existing["source"]["region"] == region and existing["source"]["count"] == len(existing["peaks"]):
            print(json.dumps({"resumed": region}), flush=True)
            return existing["source"], existing["peaks"]
    try:
        for attempt in range(3):
            try:
                with request(url) as response, pbf.open("wb") as out:
                    resolved_url = response.url
                    expected = int(response.headers.get("Content-Length", "0"))
                    shutil.copyfileobj(response, out, length=1024 * 1024)
                if expected and pbf.stat().st_size != expected:
                    raise RuntimeError("Incomplete extract download")
                break
            except Exception:
                if attempt == 2:
                    raise
                time.sleep(2 ** attempt)
        # Record the exact extract and content hash, not a mutable "latest" URL.
        digest = hashlib.file_digest(pbf.open("rb"), "sha256").hexdigest()
        timestamp = subprocess.check_output(
            ["osmium", "fileinfo", str(pbf), "-g", "header.option.osmosis_replication_timestamp"],
            text=True,
        ).strip()
        subprocess.run(["osmium", "tags-filter", str(pbf), "n/natural=peak", "-R",
                        "-f", "osm", "-o", str(xml), "-O"], check=True, capture_output=True)
        peaks = parse_peaks(xml)
        source = {"region": region, "url": resolved_url, "sha256": digest,
                  "dataTimestamp": timestamp, "count": len(peaks)}
        # Region outputs are resumable; they are never published as complete UK.
        prefix.with_suffix(".json").write_text(json.dumps({"source": source, "peaks": peaks}))
        print(json.dumps(source), flush=True)
        return source, peaks
    finally:
        pbf.unlink(missing_ok=True)
        xml.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True)
    parser.add_argument("--workdir", default=None)
    parser.add_argument("--workers", type=int, choices=range(1, 5), default=4)
    parser.add_argument("--resume", action="store_true", help="Reuse this import's completed regional outputs for up to 24 hours")
    args = parser.parse_args()
    workdir = args.workdir or tempfile.mkdtemp(prefix="summit-hills-")
    pathlib.Path(workdir).mkdir(parents=True, exist_ok=True)
    sources, unique = [], {}
    selected = regions()
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as executor:
        for source, peaks in executor.map(lambda r: import_region(r, workdir, args.resume), selected):
            sources.append(source)
            for peak in peaks:
                previous = unique.get(peak["id"])
                if previous and (previous["lat"], previous["lng"], previous["name"]) != (peak["lat"], peak["lng"], peak["name"]):
                    raise RuntimeError(f"Conflicting OSM snapshots for node {peak['id']}; retry after source updates settle")
                unique[peak["id"]] = peak
    if len(sources) != len(selected) or len(unique) < 1000:
        raise RuntimeError("Incomplete UK snapshot; previous published snapshot remains unchanged")
    snapshot = {
        "schemaVersion": 1, "coverage": "United Kingdom and Ireland",
        "builtAt": datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z"),
        "attribution": "© OpenStreetMap contributors",
        "licence": "ODbL-1.0", "licenceUrl": "https://opendatacommons.org/licenses/odbl/1-0/",
        "sourceUrl": "https://download.geofabrik.de/europe/united-kingdom.html",
        "reviewedAliases": json.loads(pathlib.Path(__file__).with_name("local-hill-name-aliases.json").read_text()),
        "sources": sources, "peaks": sorted(unique.values(), key=lambda p: p["id"]),
    }
    output = pathlib.Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix(".tmp")
    temporary.write_text(json.dumps(snapshot, separators=(",", ":"), ensure_ascii=False))
    temporary.replace(output)
    print(json.dumps({"complete": True, "regions": len(sources), "peaks": len(unique), "output": str(output)}))


if __name__ == "__main__":
    main()
