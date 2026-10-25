#!/usr/bin/env python3
"""Offline, review-only OSM pilot. No network, DB, GPX export or app changes."""
import argparse
import base64
import collections
import datetime
import hashlib
import heapq
import html
import json
import math
from pathlib import Path
import xml.etree.ElementTree as ET

RELATION_ID = "4004198"
BRIDGE_ID = "152280675"
SUMMIT_NODE = "8755297244"
SAFE_TAGS = {
    "name", "name:en", "name:cy", "type", "route", "network", "from", "to", "via",
    "operator", "highway", "surface", "sac_scale", "trail_visibility", "incline",
    "foot", "access", "foot:conditional", "access:conditional", "oneway:foot",
    "bridge", "tunnel", "designation", "step_count",
}


def read_osm(path):
    raw = Path(path).read_bytes()
    if len(raw) > 25_000_000:
        raise ValueError("Pilot source exceeds the bounded 25 MB input limit")
    root = ET.fromstring(raw)
    if root.tag != "osm":
        raise ValueError("Expected an OSM XML response")
    result = {kind: {} for kind in ("node", "way", "relation")}
    for kind in result:
        for element in root.findall(kind):
            item = {key: element.get(key) for key in ("id", "version", "timestamp")}
            if not item["id"] or not item["version"]:
                raise ValueError("Unversioned source object")
            item["tags"] = {t.get("k"): t.get("v") for t in element.findall("tag") if t.get("k") in SAFE_TAGS}
            if kind == "node":
                item.update(lat=float(element.get("lat")), lon=float(element.get("lon")))
                if not (math.isfinite(item["lat"]) and math.isfinite(item["lon"])
                        and -90 <= item["lat"] <= 90 and -180 <= item["lon"] <= 180):
                    raise ValueError("Invalid source coordinates")
            elif kind == "way":
                item["nodes"] = [n.get("ref") for n in element.findall("nd")]
            else:
                item["members"] = [m.attrib for m in element.findall("member")]
            result[kind][item["id"]] = item
    # Contributor usernames, user IDs and changeset IDs are deliberately omitted.
    return result, hashlib.sha256(raw).hexdigest()


def merge_sources(first, second):
    merged = {}
    for kind in ("node", "way", "relation"):
        merged[kind] = dict(first[kind])
        for identity, item in second[kind].items():
            if identity in merged[kind] and merged[kind][identity] != item:
                raise ValueError(f"Mixed source snapshots disagree about {kind}/{identity}; refetch consistently")
            merged[kind][identity] = item
    return merged


def distance(a, b):
    p, q = math.radians(a["lat"]), math.radians(b["lat"])
    d = math.radians(b["lon"] - a["lon"])
    h = math.sin((q-p)/2)**2 + math.cos(p)*math.cos(q)*math.sin(d/2)**2
    return 2 * 6_371_000 * math.asin(min(1, math.sqrt(h)))


def source_graph(way_ids, source):
    graph = collections.defaultdict(set)
    owners = {}
    for identity in way_ids:
        way = source["way"].get(identity)
        if not way or len(way["nodes"]) < 2:
            raise ValueError(f"Missing or empty source way {identity}")
        for a, b in zip(way["nodes"], way["nodes"][1:]):
            if a not in source["node"] or b not in source["node"] or a == b:
                raise ValueError("Source way has missing or repeated adjacent nodes")
            edge = tuple(sorted((a, b)))
            if edge in owners:
                raise ValueError("Overlapping source edges require explicit review")
            owners[edge] = identity
            graph[a].add(b)
            graph[b].add(a)
    return graph, owners


def components(graph):
    remaining, result = set(graph), []
    while remaining:
        stack, seen = [next(iter(remaining))], set()
        while stack:
            node = stack.pop()
            if node not in seen:
                seen.add(node)
                stack.extend(graph[node] - seen)
        remaining -= seen
        result.append(seen)
    return result


def ordered_chain(graph, start):
    ends = [node for node, neighbors in graph.items() if len(neighbors) == 1]
    if len(components(graph)) != 1 or len(ends) != 2 or any(len(v) > 2 for v in graph.values()) or start not in ends:
        raise ValueError("Not one unambiguous connected open chain; no snapping or invented joins allowed")
    chain, previous, current = [], None, start
    while current is not None:
        chain.append(current)
        following = graph[current] - {previous}
        previous, current = current, next(iter(following)) if following else None
    if len(chain) != len(graph):
        raise ValueError("Chain did not traverse the entire source graph")
    return chain


def summit_access(source, start, summit, radius=250):
    """Suggested mapped-edge connection only, never an approved hiking route."""
    graph = collections.defaultdict(list)
    for identity, way in source["way"].items():
        tags = way["tags"]
        if (tags.get("highway") not in {"path", "footway", "steps", "bridleway"}
                or tags.get("foot") in {"no", "private"} or tags.get("access") in {"no", "private"}
                or tags.get("oneway:foot", "no") not in {"no", "false", "0"}):
            continue
        for a, b in zip(way["nodes"], way["nodes"][1:]):
            if a not in source["node"] or b not in source["node"]:
                continue
            if max(distance(source["node"][n], source["node"][summit]) for n in (a, b)) > radius:
                continue
            length = distance(source["node"][a], source["node"][b])
            graph[a].append((b, length, identity))
            graph[b].append((a, length, identity))
    if start not in graph:
        raise ValueError("No bounded mapped summit access from the relation endpoint")
    goal = min(graph, key=lambda n: distance(source["node"][n], source["node"][summit]))
    offset = distance(source["node"][goal], source["node"][summit])
    if offset > 5:
        raise ValueError("No mapped summit-area endpoint within 5 metres; do not add a straight line")
    queue, seen = [(0.0, start, [])], set()
    while queue:
        length, node, edges = heapq.heappop(queue)
        if node in seen:
            continue
        seen.add(node)
        if node == goal:
            if length > 300:
                raise ValueError("Summit access exceeds the bounded pilot length")
            return edges, offset
        for target, edge_length, identity in graph[node]:
            if target not in seen:
                heapq.heappush(queue, (length + edge_length, target, edges + [(node, target, identity)]))
    raise ValueError("Summit access is disconnected")


def render_review(candidate, source, chain, extension, output):
    selected = [source["node"][n] for n in chain]
    lat0 = sum(n["lat"] for n in selected)/len(selected)
    xy = lambda n: (n["lon"]*math.cos(math.radians(lat0)), n["lat"])
    coords = [xy(n) for n in selected]
    x0, x1 = min(x for x, _ in coords), max(x for x, _ in coords)
    y0, y1 = min(y for _, y in coords), max(y for _, y in coords)
    scale = min(640/(x1-x0), 700/(y1-y0))
    point = lambda identity: (40+(xy(source["node"][identity])[0]-x0)*scale,
                              760-(xy(source["node"][identity])[1]-y0)*scale)
    line = " ".join(f"{x:.2f},{y:.2f}" for x, y in map(point, chain))
    bridge = source["way"][BRIDGE_ID]["nodes"]
    parts = [f'<polyline points="{line}" fill="none" stroke="#4ce0a1" stroke-width="4"/>']
    for ids, color in [(bridge, "#ffcc56"), ([a for a, _, _ in extension]+[extension[-1][1]], "#67adff")]:
        parts.append('<polyline points="'+" ".join(f"{x:.2f},{y:.2f}" for x,y in map(point,ids))
                     +f'" fill="none" stroke="{color}" stroke-width="7"/>')
    for identity, label, color in [(chain[0], "Proposed start", "#ffcc56"), (chain[-1], "Summit-area finish", "#67adff")]:
        x, y = point(identity)
        parts.append(f'<circle cx="{x}" cy="{y}" r="7" fill="{color}"/><text x="{x+12}" y="{y+5}" fill="white">{label}</text>')
    e = html.escape
    downloads = " · ".join(
        f'<a download="{name}" href="data:application/json;base64,{base64.b64encode((output/name).read_bytes()).decode()}">{label}</a>'
        for name, label in [("candidate.json", "Candidate manifest"), ("proposed-route.geojson", "Review-only GeoJSON"),
                            ("source-snapshot.json", "Sanitised OSM source snapshot")]
    )
    body = f"""<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width">
    <title>Watkin Path — review-only route pilot</title><style>
    body{{font:16px/1.6 system-ui,sans-serif;background:#081411;color:#e7f3ec;max-width:1100px;margin:auto;padding:28px}}
    h1,h2{{line-height:1.2}}a{{color:#72dfb1}}.warning{{padding:20px;background:#302719;border-left:4px solid #ffcc56}}
    .layout{{display:grid;grid-template-columns:1fr 1fr;gap:28px}}svg{{width:100%;background:#12251f;border-radius:12px}}
    dt{{color:#9bb4a6}}dd{{margin:0 0 14px}}li{{margin-bottom:10px}}
    @media(max-width:760px){{.layout{{grid-template-columns:1fr}}}}</style>
    <h1>Watkin Path: first route-data pilot</h1><p>Candidate only · Not imported · Not approved for navigation</p>
    <p class="warning">This is a review drawing, not a navigation map or safety assessment. No existing expedition,
    route facts, artwork or user progress has been changed. The proposed route must not be published until reviewed.</p>
    <div class="layout"><div><svg viewBox="0 0 820 810" role="img" aria-label="Schematic of the mapped source route, proposed bridge inclusion and summit access">
    {''.join(parts)}</svg><p>North up. Green: mapped relation ways. Yellow: omitted mapped bridge.
    Blue: suggested mapped summit access. No straight-line gap filling; no basemap, terrain or hazards shown.</p></div>
    <div><h2>Candidate measurements</h2><dl><dt>One-way horizontal line length</dt><dd>{candidate['distance']['oneWayHorizontalKm']:.3f} km</dd>
    <dt>Proposed out-and-back horizontal length</dt><dd>{candidate['distance']['outAndBackHorizontalKm']:.3f} km</dd>
    <dt>Existing expedition figure — unchanged, not verified here</dt><dd>13 km / 1,015 m ascent</dd>
    <dt>Ascent from this pilot</dt><dd>Unavailable. No DEM/elevation profile has been calculated.</dd>
    <dt>Summit-area endpoint offset from OSM peak marker</dt><dd>{candidate['checks']['summitAreaOffsetM']:.2f} m.
    No artificial edge connects to the marker.</dd></dl>
    <h2>What the source needs</h2><ul>
    <li>The relation has {candidate['checks']['sourceMemberCount']} member entries and {candidate['checks']['uniqueRelationWays']} unique ways.
    One repeated way was explicitly deduplicated in this proposal, not silently treated as extra distance.</li>
    <li>The raw relation has {candidate['checks']['rawConnectedComponents']} disconnected components.
    The mapped bridge, way {BRIDGE_ID}, joins exact shared node IDs.</li>
    <li>The named relation ends before the summit. The summit-access suggestion uses mapped walking/step edges;
    it is a proposal, not evidence that this is the operator-approved route.</li></ul></div></div>
    <h2>Review required before linking</h2><ol>{''.join(f'<li>{e(x)}</li>' for x in candidate['reviewRequired'])}</ol>
    <h2>Existing expedition link preview</h2><p>These {len(candidate['linkPreview'])} stage placements use the existing Watkin key.
    They are a preview only; no route or summit link was saved.</p><ul>
    {''.join(f"<li>{e(s['challengeId'])}: {e(s['challengeName'])} — stage {s['stageOrder']}</li>" for s in candidate['linkPreview'])}</ul>
    <h2>Download review data</h2><p>{downloads}</p><p>These are route-review files, not the expedition bulk-import format.
    Do not use the GeoJSON for navigation or paste the manifest into the expedition importer.</p>
    <h2>Provenance and reuse</h2><p>© OpenStreetMap contributors.
    <a href="https://www.openstreetmap.org/copyright">ODbL / attribution and applicable share-alike obligations</a>.
    This derived candidate is offered under ODbL 1.0; publication obligations still need implementation.</p>
    <p><a href="https://www.openstreetmap.org/relation/{RELATION_ID}">Watkin Path relation {RELATION_ID}</a>,
    version {e(candidate['source']['relationVersion'])}. Snapshot checksums and exact way/node versions are in the accompanying candidate/source files.
    Contributor usernames and user IDs are excluded.</p></html>"""
    (output/"review.html").write_text(body)


def build(args):
    relation_source, relation_hash = read_osm(args.relation)
    map_source, map_hash = read_osm(args.context)
    source = merge_sources(map_source, relation_source)
    relation = relation_source["relation"][RELATION_ID]
    if any(m["type"] != "way" or m.get("role") for m in relation["members"]):
        raise ValueError("This pilot does not silently interpret non-way or role-qualified members")
    raw_ids = [m["ref"] for m in relation["members"]]
    unique_ids = list(dict.fromkeys(raw_ids))
    duplicates = [identity for identity, count in collections.Counter(raw_ids).items() if count > 1]
    raw_graph, _ = source_graph(unique_ids, source)
    raw_component_count = len(components(raw_graph))
    bridge = source["way"].get(BRIDGE_ID)
    if not bridge or bridge["tags"].get("bridge") != "yes" or bridge["tags"].get("name") != "Watkin Path":
        raise ValueError("The proposed bridge is not the expected versioned, named mapped footbridge")
    graph, owners = source_graph(unique_ids+[BRIDGE_ID], source)
    ends = [n for n,v in graph.items() if len(v)==1]
    if len(ends)!=2:
        raise ValueError("Bridge proposal did not produce two route endpoints")
    start = max(ends, key=lambda n: distance(source["node"][n], source["node"][SUMMIT_NODE]))
    base_chain = ordered_chain(graph, start)
    extension, offset = summit_access(source, base_chain[-1], SUMMIT_NODE)
    if not extension:
        raise ValueError("Expected an explicit summit access proposal for this pilot")
    chain = base_chain + [b for _,b,_ in extension]
    if len(chain)!=len(set(chain)):
        raise ValueError("Summit proposal repeats an earlier route node")
    edges = [(a,b,owners[tuple(sorted((a,b)))]) for a,b in zip(base_chain,base_chain[1:])] + extension
    length = sum(distance(source["node"][a],source["node"][b]) for a,b,_ in edges)
    audit = json.loads(Path(args.audit).read_text())
    summits = audit.get("watkinSummitCandidates", [])
    if len(summits)!=1:
        raise ValueError("Trusted summit lookup is missing or ambiguous; do not invent a catalogue ID")
    summit = summits[0]
    if distance({"lat":summit["latitude"],"lon":summit["longitude"]},source["node"][SUMMIT_NODE])>25:
        raise ValueError("Trusted summit and OSM peak are not a close identity match")
    links = [{"challengeId":s["challenge_id"],"challengeName":s["challenge_name"],"stageOrder":s["stage_order"],
              "existingRouteKey":s["route_key"]} for s in audit["stages"] if s["route_key"]=="watkin"]
    captured = datetime.datetime.now(datetime.timezone.utc).isoformat()
    source_hash = hashlib.sha256((relation_hash+map_hash).encode()).hexdigest()
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    output = Path(args.output)/f"watkin-v{relation['version']}-{source_hash[:12]}-{stamp}"
    output.mkdir(parents=True, exist_ok=False)
    full_chain = chain + list(reversed(chain[:-1]))
    return_edges = [(b,a,w) for a,b,w in reversed(edges)]
    candidate = {"format":"summitready-route-review-candidate-v1","candidateId":f"osm-watkin-{source_hash[:16]}",
      "status":"needs_human_review","canonicalVerified":False,"navigationReady":False,"imported":False,
      "capturedAt":captured,"routeName":"Snowdon via Watkin Path — proposed out-and-back","catalogueMountain":summit,
      "source":{"provider":"OpenStreetMap","relationId":RELATION_ID,"relationVersion":relation["version"],
                "relationUrl":f"https://www.openstreetmap.org/relation/{RELATION_ID}",
                "relationResponseSha256":relation_hash,"contextResponseSha256":map_hash,
                "licence":"ODbL-1.0","licenceUrl":"https://opendatacommons.org/licenses/odbl/1-0/",
                "attribution":"© OpenStreetMap contributors","contributorPersonalMetadataIncluded":False},
      "checks":{"sourceMemberCount":len(raw_ids),"uniqueRelationWays":len(unique_ids),"duplicateWayIds":duplicates,
                "rawConnectedComponents":raw_component_count,"proposedConnectedComponents":1,
                "inventedEdges":0,"bridgeWayId":BRIDGE_ID,"proposedAccessWayIds":list(dict.fromkeys(w for _,_,w in extension)),
                "summitAreaOffsetM":offset,"geometryNodeCount":len(full_chain),"oneWayNodeCount":len(chain),
                "exactGeometryVersionValidationPersisted":False},
      "distance":{"method":"Haversine over actual OSM nodes; horizontal geometry, not GPS or terrain-corrected",
                  "oneWayHorizontalKm":length/1000,"outAndBackHorizontalKm":length*2/1000,
                  "ascentM":None,"elevationProfile":None,"existingExpeditionDistanceKm":13,"existingExpeditionAscentM":1015},
      "reviewRequired":["Confirm the precise Pont Bethania start/finish and access, parking and current restrictions.",
         "Review the repeated relation member and the proposed inclusion of the mapped bridge.",
         "Review the summit-access suggestion and reverse journey; mapped paths alone do not establish safety or access.",
         "Check terrain, exposure, scrambling, seasonality and temporary closures with suitable independent evidence.",
         "Calculate and validate an elevation profile using a reusable DEM; never substitute summit height for ascent.",
         "Review the distance discrepancy against the unchanged 13 km expedition figure and the chosen start point.",
         "Implement ODbL attribution and applicable share-alike obligations for this derived route database.",
         "Persist validation tied to these exact geometry/source versions before enabling canonical geometry.",
         "Approve the route variant explicitly, then link stages deliberately without rewriting saved user snapshots."],
      "geometryFile":"proposed-route.geojson","sourceSnapshotFile":"source-snapshot.json","linkPreview":links,
      "orderedSourceEdges":[{"fromNode":a,"toNode":b,"wayId":w,"wayVersion":source["way"][w]["version"]}
                            for a,b,w in edges+return_edges]}
    geojson={"type":"FeatureCollection","features":[{"type":"Feature",
      "properties":{"candidateId":candidate["candidateId"],"status":"needs_human_review","navigationReady":False,
                    "direction":"proposed out-and-back, retracing mapped source edges for the return",
                    "attribution":"© OpenStreetMap contributors","licence":"ODbL-1.0",
                    "licenceUrl":"https://opendatacommons.org/licenses/odbl/1-0/",
                    "sourceUrl":f"https://www.openstreetmap.org/relation/{RELATION_ID}"},
      "geometry":{"type":"LineString","coordinates":[[source["node"][n]["lon"],source["node"][n]["lat"]] for n in full_chain]}}]}
    selected_ways=set(unique_ids+[BRIDGE_ID]+[w for _,_,w in extension])
    selected_nodes={n for w in selected_ways for n in source["way"][w]["nodes"]}|{SUMMIT_NODE}
    snapshot={"relation":relation,"ways":[source["way"][w] for w in sorted(selected_ways)],
              "nodes":[source["node"][n] for n in sorted(selected_nodes)],"licence":"ODbL-1.0",
              "licenceUrl":"https://opendatacommons.org/licenses/odbl/1-0/",
              "sourceUrl":f"https://www.openstreetmap.org/relation/{RELATION_ID}",
              "attribution":"© OpenStreetMap contributors"}
    candidate["geometrySha256"] = hashlib.sha256(json.dumps(geojson,indent=2,ensure_ascii=False).encode()).hexdigest()
    candidate["sourceSnapshotSha256"] = hashlib.sha256(json.dumps(snapshot,indent=2,ensure_ascii=False).encode()).hexdigest()
    for name, value in [("candidate.json",candidate),("proposed-route.geojson",geojson),("source-snapshot.json",snapshot)]:
        (output/name).write_text(json.dumps(value,indent=2,ensure_ascii=False))
    render_review(candidate,source,chain,extension,output)
    print(json.dumps({"output":str(output),"status":candidate["status"],"checks":candidate["checks"],
                      "distance":candidate["distance"],"stageLinkPreviews":len(links)},indent=2))


if __name__ == "__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--relation",required=True)
    parser.add_argument("--context",required=True)
    parser.add_argument("--audit",required=True)
    parser.add_argument("--output",default="generated-artifacts/route-pilot")
    build(parser.parse_args())
