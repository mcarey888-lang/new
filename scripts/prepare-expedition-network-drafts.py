#!/usr/bin/env python3
"""Bounded OSM network extraction and explicit provisional itineraries for review.

Uses exact existing OSM edges only, never straight joins. Not canonical routes.
Raw contributor metadata is discarded before any snapshot is saved.
"""
import argparse
import collections
import concurrent.futures
import datetime
import hashlib
import heapq
import json
import math
import time
import unicodedata
import urllib.error
import urllib.request
from pathlib import Path

HIGHWAYS = {"path", "footway", "track", "steps", "bridleway", "pedestrian",
            "cycleway", "service", "residential", "unclassified", "living_street"}
SAFE = {"name", "name:en", "natural", "highway", "foot", "access", "surface",
        "sac_scale", "trail_visibility", "incline", "bridge", "tunnel",
        "foot:conditional", "access:conditional", "oneway:foot", "amenity"}


def metres(a, b):
    r = math.pi / 180
    h = math.sin((a[0]-b[0])*r/2)**2 + math.cos(a[0]*r)*math.cos(b[0]*r)*math.sin((a[1]-b[1])*r/2)**2
    return 12742000 * math.asin(min(1, math.sqrt(h)))


def tile(x, y, cache, level=0):
    name = f"osm-{x}-{y}.json" if level == 0 else f"osm-l{level}-{x}-{y}.json"
    dest = cache / name
    if dest.exists():
        return json.loads(dest.read_text())
    step = 0.06 / 2**level
    bbox = f"{x*step:.5f},{y*step:.5f},{(x+1)*step:.5f},{(y+1)*step:.5f}"
    url = "https://api.openstreetmap.org/api/0.6/map.json?bbox=" + bbox
    req = urllib.request.Request(url, headers={"User-Agent": "SummitReady-development-route-review/1.0", "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=40) as response:
            raw = response.read(18_000_001)
    except urllib.error.HTTPError as exc:
        if exc.code == 400 and level < 2:
            parts = [tile(x*2+dx,y*2+dy,cache,level+1) for dx in range(2) for dy in range(2)]
            result = {"url":url,"capturedAt":datetime.datetime.now(datetime.timezone.utc).isoformat(),
                      "subtiles":[{k:v for k,v in p.items() if k!="elements"} for p in parts],
                      "elements":list({(e["type"],e["id"]):e for p in parts for e in p["elements"]}.values())}
            dest.write_text(json.dumps(result,separators=(",",":"),ensure_ascii=False))
            return result
        raise
    if len(raw) > 18_000_000:
        raise ValueError("Bounded OSM response exceeds 18 MB")
    data = json.loads(raw)
    # Restrict persisted source to graph-relevant objects and safe provenance.
    ways = [e for e in data["elements"] if e["type"] == "way" and (
        e.get("tags", {}).get("highway") in HIGHWAYS or e.get("tags", {}).get("amenity") == "parking")]
    needed = {n for w in ways for n in w["nodes"]}
    elems = [e for e in data["elements"] if e["type"] == "node" and
             (e["id"] in needed or e.get("tags", {}).get("natural") == "peak")] + ways
    safe = [{**{k: e[k] for k in ("type", "id", "version", "timestamp", "lat", "lon", "nodes") if k in e},
             "tags": {k: v for k, v in e.get("tags", {}).items() if k in SAFE}} for e in elems]
    result = {"url": url, "capturedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
              "originalResponseSha256": hashlib.sha256(raw).hexdigest(), "elements": safe}
    dest.write_text(json.dumps(result, separators=(",", ":"), ensure_ascii=False))
    time.sleep(0.25)
    return result


def build_graph(elements):
    nodes = {e["id"]: e for e in elements if e["type"] == "node"}
    graph = collections.defaultdict(dict)
    for way in elements:
        if way["type"] != "way" or way.get("tags", {}).get("highway") not in HIGHWAYS:
            continue
        tags = way.get("tags", {})
        if tags.get("foot") in {"no", "private"} or (tags.get("access") in {"no", "private"} and tags.get("foot") not in {"yes", "designated", "permissive"}):
            continue
        # Conditional restrictions are retained, not silently interpreted as clearance.
        for a, b in zip(way["nodes"], way["nodes"][1:]):
            if a == b or a not in nodes or b not in nodes:
                continue
            distance = metres((nodes[a]["lat"], nodes[a]["lon"]), (nodes[b]["lat"], nodes[b]["lon"]))
            if distance > 1500:
                continue
            graph[a][b] = (distance, way["id"])
            if tags.get("oneway:foot") != "yes":
                graph[b][a] = (distance, way["id"])
    return nodes, graph


def shortest(graph, start, finish):
    todo, best, previous = [(0, start)], {start: 0}, {}
    while todo:
        cost, node = heapq.heappop(todo)
        if cost > best[node]:
            continue
        if node == finish:
            chain = [node]
            while chain[-1] != start:
                chain.append(previous[chain[-1]])
            return chain[::-1]
        for other, (distance, _) in graph[node].items():
            new = cost + distance
            if new < best.get(other, math.inf):
                best[other], previous[other] = new, node
                heapq.heappush(todo, (new, other))
    raise ValueError("No connected mapped walking path between proposed anchors; no synthetic join")


def prepare(key, anchors, row, out, cache):
    step = .06
    # 0.012 deg margin; tiled extraction bounded per-route and globally cached.
    west, east = min(a[1] for a in anchors)-.012, max(a[1] for a in anchors)+.012
    south, north = min(a[0] for a in anchors)-.012, max(a[0] for a in anchors)+.012
    cells = [(x,y) for x in range(math.floor(west/step),math.floor(east/step)+1)
             for y in range(math.floor(south/step),math.floor(north/step)+1)]
    if len(cells) > 36:
        raise ValueError("Itinerary exceeds bounded acquisition area")
    tiles = [tile(x,y,cache) for x,y in cells]
    elements = {(e["type"],e["id"]): e for t in tiles for e in t["elements"]}
    nodes, graph = build_graph(elements.values())
    if not graph:
        raise ValueError("No mapped walking network")
    # Choose one connected walking component for the itinerary. A tiny detached
    # car-park footway must not defeat a nearby connected mapped path.
    components, unseen = [], set(graph)
    while unseen:
        start=next(iter(unseen)); stack=[start]; group={start};unseen.remove(start)
        while stack:
            for n in graph[stack.pop()]:
                if n in unseen:
                    unseen.remove(n);group.add(n);stack.append(n)
        if len(group) >= 20:
            components.append(group)
    def norm(text):
        return "".join(c for c in unicodedata.normalize("NFKD",text.lower()) if c.isalnum() and not unicodedata.combining(c))
    named = {}
    for node in nodes.values():
        if node.get("tags",{}).get("natural") == "peak":
            for k in ("name","name:en"):
                if node["tags"].get(k):
                    named[norm(node["tags"][k])] = node
    corrected = []
    for lat,lon,label in anchors:
        peak=named.get(norm(label))
        if peak and metres((lat,lon),(peak["lat"],peak["lon"])) < 6000:
            corrected.append((peak["lat"],peak["lon"],label,"exact named OSM peak"))
        else:
            corrected.append((lat,lon,label,"proposed search anchor"))
    candidates=[]
    for group in components:
        matches=[]
        for lat,lon,label,basis in corrected:
            nearest=min(group,key=lambda n:metres((lat,lon),(nodes[n]["lat"],nodes[n]["lon"])))
            distance=metres((lat,lon),(nodes[nearest]["lat"],nodes[nearest]["lon"]))
            matches.append((nearest,distance))
        if all(d<=850 for _,d in matches):
            candidates.append((sum(d for _,d in matches),matches))
    if not candidates:
        raise ValueError("No single mapped walking component covers all proposed anchors within 850 m; individual preparation required")
    matches=min(candidates,key=lambda x:x[0])[1]
    resolved = []
    for (lat,lon,label,basis),(nearest,distance) in zip(corrected,matches):
        resolved.append({"label": label, "proposedLat":lat,"proposedLon":lon,"anchorBasis":basis,"nodeId":nearest,"offsetM":round(distance,1)})
    chain = [resolved[0]["nodeId"]]
    for anchor in resolved[1:]:
        chain.extend(shortest(graph, chain[-1], anchor["nodeId"])[1:])
    if len(chain) < 2 or len(chain) > 20000:
        raise ValueError("Draft has unsupported point count")
    coords = [[nodes[n]["lon"], nodes[n]["lat"]] for n in chain]
    length = sum(metres((a[1],a[0]),(b[1],b[0])) for a,b in zip(coords,coords[1:]))
    if length > 60000:
        raise ValueError(f"Draft exceeds 60 km ({length/1000:.1f} km); anchor/variant review required")
    edge_records = [{"wayId": graph[a][b][1], "fromNode":a,"toNode":b} for a,b in zip(chain,chain[1:])]
    way_ids = {e["wayId"] for e in edge_records}
    chain_nodes=set(chain)
    source_elements = [e for e in elements.values() if
                       (e["type"] == "node" and e["id"] in chain_nodes) or
                       (e["type"] == "way" and e["id"] in way_ids)]
    snapshot = {"format":"summitready-osm-network-draft-v1",
                "elements":source_elements,"orderedSourceEdges":edge_records,
                "proposedAnchors":resolved,
                "sourceTiles":[{k:v for k,v in t.items() if k != "elements"} for t in tiles],
                "contributorPersonalMetadataIncluded":False,
                "transform":"Shortest existing mapped walking-edge chains through proposed itinerary anchors; no extra geometry, safety clearance or variant verification."}
    source = json.dumps(snapshot,separators=(",",":"),ensure_ascii=False)
    if len(source.encode()) > 2_000_000:
        raise ValueError("Source evidence exceeds 2 MB")
    manifest = [{
        "name": row["routeName"] + " — proposed network itinerary",
        "provider":"OpenStreetMap","licence":"ODbL-1.0",
        "licenceUrl":"https://opendatacommons.org/licenses/odbl/1-0/",
        "attribution":"© OpenStreetMap contributors",
        "url":"https://www.openstreetmap.org/copyright",
        "sha256":hashlib.sha256(source.encode()).hexdigest(),
        "sourceCapturedAt":datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "expeditionRouteKey":key,"fullExpeditionVariantConfirmed":False,
        "rightsReviewComplete":False,"routeAccessReviewed":False,
        "draftMethod":"osm-network-proposed-itinerary-v1",
        "scope":"Connected OSM path draft through proposed anchors, not a sourced named-route itinerary. Start/parking, ridge/scramble variant, return and access need owner review. No heights invented.",
        "proposedAnchors":resolved,
        "planningEstimates":{"existingExpeditionDistanceKm":row["currentDistancesKm"][0],"existingExpeditionAscentM":row["currentAscentsM"][0]},
        "expeditionIds":row["expeditionIds"],
    }]
    candidate = {"candidateKey":row["routeName"]+" — route draft",
                 "revisionVersion":"osm-network-"+hashlib.sha256(source.encode()).hexdigest()[:16],
                 "geometryFile":json.dumps({"type":"LineString","coordinates":coords},separators=(",",":")),
                 "sourceManifest":manifest}
    (out / f"{key}.input.json").write_text(json.dumps(candidate,ensure_ascii=False))
    (out / f"{key}.source.json").write_text(source)
    return {"routeKey":key,"status":"prepared","points":len(coords),"lengthKm":round(length/1000,2),"anchors":resolved}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--audit",required=True)
    parser.add_argument("--output",required=True)
    parser.add_argument("--keys")
    args=parser.parse_args()
    out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
    cache=out/"network-cache";cache.mkdir(exist_ok=True)
    config=json.loads(Path(__file__).with_name("expedition-network-itineraries.json").read_text())
    rows={r["routeKeys"][0]:r for r in json.loads(Path(args.audit).read_text())["priorities"]}
    report=[]
    for key,anchors in config.items():
        if key.startswith("_") or (args.keys and key not in args.keys.split(",")):
            continue
        throttled=False
        try:
            result=prepare(key,anchors,rows[key],out,cache)
        except Exception as e:
            result={"routeKey":key,"status":"blocked","reason":str(e)}
            throttled=getattr(e,"code",None) in (429,509)
        report.append(result)
        (out/"preparation.json").write_text(json.dumps(report,indent=2,ensure_ascii=False))
        print(json.dumps(result,ensure_ascii=False),flush=True)
        if throttled:
            print(json.dumps({"providerStopped":True,"reason":"Provider quota exhausted; remaining routes were not requested."}),flush=True)
            break


if __name__=="__main__":
    main()
