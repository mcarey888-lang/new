#!/usr/bin/env python3
"""Acquire exact named OSM source chains for private review, never full-route approval."""
import argparse
import collections
import datetime
import hashlib
import importlib.util
import json
import math
from pathlib import Path

spec = importlib.util.spec_from_file_location("discovery", Path(__file__).with_name("source-expedition-route-batch.py"))
discovery = importlib.util.module_from_spec(spec)
spec.loader.exec_module(discovery)

# These are explicit source leads, not assertions of an exact full expedition
# variant. Every imported line remains unbound, incomplete and unapproved.
SELECTED = {
    "cmd": 4004228,
    "aonach_eagach": 16127354,
    "braeriach": 18081370,
    "crib_goch": 4499076,
    "liathach": 16155653,
    "llanberis": 4004181,
}
SAFE_TAGS = {
    "name", "name:en", "name:cy", "type", "route", "network", "from", "to", "via",
    "highway", "surface", "sac_scale", "trail_visibility", "incline", "foot",
    "access", "foot:conditional", "access:conditional", "oneway:foot",
    "bridge", "tunnel", "designation", "step_count", "description", "note",
}


def source_chain(data):
    elements = data["elements"]
    relations = [e for e in elements if e["type"] == "relation"]
    if len(relations) != 1:
        raise ValueError("Nested or ambiguous relations require individual preparation")
    relation = relations[0]
    members = relation.get("members", [])
    if any(m["type"] == "relation" for m in members):
        raise ValueError("Nested relation cannot be flattened automatically")
    ids = [m["ref"] for m in members if m["type"] == "way"]
    if not ids or len(ids) != len(set(ids)):
        raise ValueError("Missing or repeated way members require individual preparation")
    ways = {e["id"]: e for e in elements if e["type"] == "way"}
    nodes = {e["id"]: e for e in elements if e["type"] == "node"}
    graph, owners = collections.defaultdict(set), {}
    for wid in ids:
        way = ways[wid]
        if len(way["nodes"]) < 2:
            raise ValueError("Empty source way")
        for a, b in zip(way["nodes"], way["nodes"][1:]):
            if a == b or a not in nodes or b not in nodes:
                raise ValueError("Missing nodes or repeated adjacent node")
            edge = tuple(sorted((a, b)))
            if edge in owners:
                raise ValueError("Repeated source edge requires individual preparation")
            owners[edge] = wid
            graph[a].add(b)
            graph[b].add(a)
    ends = [n for n in graph if len(graph[n]) == 1]
    if len(ends) != 2 or any(len(v) > 2 for v in graph.values()):
        raise ValueError("Not one unbranched open source chain; no invented joins")
    start = ways[ids[0]]["nodes"][0]
    if start not in ends:
        start = min(ends)
    chain, current, previous = [], start, None
    while current is not None:
        chain.append(current)
        following = graph[current] - {previous}
        previous, current = current, next(iter(following)) if following else None
        if len(chain) > len(graph):
            raise ValueError("Unexpected cycle")
    if len(chain) != len(graph):
        raise ValueError("Disconnected source geometry; no invented joins")
    coords = [[nodes[n]["lon"], nodes[n]["lat"]] for n in chain]
    if not 2 <= len(coords) <= 20000 or any(
        not all(isinstance(v, (float, int)) and math.isfinite(v) for v in p)
        or not (-9 < p[0] < 2 and 49 < p[1] < 60) for p in coords
    ):
        raise ValueError("Source coordinates outside bounded British review area")
    ordered = [{"wayId": owners[tuple(sorted((a, b)))], "fromNode": a, "toNode": b}
               for a, b in zip(chain, chain[1:])]
    return relation, coords, ordered


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--audit", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    out = Path(args.output)
    out.mkdir(parents=True, exist_ok=True)
    rows = {r["routeKeys"][0]: r for r in json.loads(Path(args.audit).read_text())["priorities"]}
    report = []
    for key, relation_id in SELECTED.items():
        url = f"https://api.openstreetmap.org/api/0.6/relation/{relation_id}/full.json"
        result = {"routeKey": key, "relationId": relation_id, "url": url}
        try:
            data, raw = discovery.fetch(url)
            relation, coords, ordered = source_chain(data)
            sanitized = []
            for e in data["elements"]:
                item = {k: e[k] for k in ("type", "id", "version", "timestamp", "lat", "lon", "nodes", "members") if k in e}
                if "version" not in item:
                    raise ValueError("Unversioned source object")
                item["tags"] = {k: v for k, v in e.get("tags", {}).items() if k in SAFE_TAGS}
                sanitized.append(item)
            snapshot = json.dumps({
                "format": "summitready-osm-source-chain-v1", "elements": sanitized,
                "orderedSourceEdges": ordered,
                "transform": "Reordered exact existing node-connected source edges only; no snapping, extra links, return leg or elevation.",
                "originalResponseSha256": hashlib.sha256(raw).hexdigest(),
                "contributorPersonalMetadataIncluded": False,
            }, separators=(",", ":"), ensure_ascii=False)
            if len(snapshot.encode()) > 2_000_000:
                raise ValueError("Sanitized snapshot exceeds protected companion limit")
            digest = hashlib.sha256(snapshot.encode()).hexdigest()
            row = rows[key]
            captured = datetime.datetime.now(datetime.timezone.utc).isoformat()
            manifest = [{
                "name": relation.get("tags", {}).get("name", row["routeName"]),
                "provider": "OpenStreetMap", "licence": "ODbL-1.0",
                "licenceUrl": "https://opendatacommons.org/licenses/odbl/1-0/",
                "attribution": "© OpenStreetMap contributors",
                "url": url, "relationId": str(relation_id),
                "relationVersion": str(relation["version"]), "sha256": digest,
                "sourceCapturedAt": captured, "expeditionRouteKey": key,
                "rightsReviewComplete": False, "routeAccessReviewed": False,
                "fullExpeditionVariantConfirmed": False,
                "scope": "Named source chain only. Full expedition start, finish, return leg and exact variant require separate preparation.",
                "planningEstimates": {
                    "existingExpeditionDistanceKm": row["currentDistancesKm"][0],
                    "existingExpeditionAscentM": row["currentAscentsM"][0],
                },
                "expeditionIds": row["expeditionIds"],
            }]
            candidate = {
                "candidateKey": row["routeName"] + " — source geometry only",
                "revisionVersion": f"osm-{relation_id}-v{relation['version']}-source-1",
                "geometryFile": json.dumps({"type": "LineString", "coordinates": coords}, separators=(",", ":")),
                "sourceManifest": manifest,
            }
            (out / f"{key}.source.json").write_text(snapshot)
            (out / f"{key}.input.json").write_text(json.dumps(candidate, ensure_ascii=False))
            result.update(status="source_geometry_prepared", points=len(coords), sourceName=manifest[0]["name"])
        except Exception as exc:
            result.update(status="blocked", reason=str(exc))
        report.append(result)
        print(json.dumps(result, ensure_ascii=False), flush=True)
    (out / "preparation.json").write_text(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
