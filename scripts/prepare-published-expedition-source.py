#!/usr/bin/env python3
"""Acquire an existing published named itinerary, never construct a new walk.

Only a single, explicitly ordered continuous route supplied by the publisher
is supported. No graph search, reordering, guessed reversals, gap-closing,
out-and-back synthesis, snapping or extra parking approaches.
"""
import csv
import hashlib
import json
import math
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE_URL = "https://hiking.waymarkedtrails.org/api/v1/details/relation/16155652"


def length_m(a, b):
    lat1, lat2 = math.radians(a[1]), math.radians(b[1])
    h = math.sin((lat2-lat1)/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin(math.radians(b[0]-a[0])/2)**2
    return 6371000 * 2 * math.asin(min(1, math.sqrt(h)))


def extract_published_track(source):
    """Serialize only the publisher's explicit order and orientation."""
    if (source.get("id") != 16155652 or source.get("tags", {}).get("route") != "hiking"
            or source.get("name") not in {"Bein Alligin Trail", "Beinn Alligin Trail"}):
        raise ValueError("Unexpected source identity or route type.")
    route = source.get("route", {})
    if route.get("linear") != "yes" or len(route.get("main", [])) != 1 or route.get("appendices"):
        raise ValueError("Published source is not one explicitly ordered continuous itinerary.")
    ways = route["main"][0].get("ways", [])
    if not ways:
        raise ValueError("No published source ways.")
    projected = []
    way_ids = []
    for way in ways:
        geometry = way.get("geometry", {})
        coords = geometry.get("coordinates")
        if geometry.get("type") != "LineString" or not isinstance(coords, list) or len(coords) < 2:
            raise ValueError("A source member has no usable LineString.")
        if any(len(p) != 2 or not all(isinstance(v, (int, float)) and math.isfinite(v) for v in p) for p in coords):
            raise ValueError("Invalid published coordinates.")
        if projected and projected[-1] != coords[0]:
            raise ValueError("Discontinuous published order: no reversal, bridge or inferred route permitted.")
        projected.extend(coords[1:] if projected else coords)
        way_ids.append(way["id"])
    if not 2 <= len(projected) <= 20000:
        raise ValueError("Source exceeds review geometry limits.")
    coordinates = [[math.degrees(x/6378137), math.degrees(2*math.atan(math.exp(y/6378137))-math.pi/2)]
                   for x, y in projected]
    if any(not (-6 < lon < -5 and 57 < lat < 58) for lon, lat in coordinates):
        raise ValueError("Published source is outside the expected Beinn Alligin area.")
    return coordinates, way_ids


def prepare():
    out = ROOT / "generated-artifacts/expedition-published-sources/prepared"
    out.mkdir(parents=True, exist_ok=True)
    source_file = out / "beinn_alligin.source.json"
    receipt_file = out / "beinn_alligin.receipt.json"
    if source_file.exists() and receipt_file.exists():
        raw = source_file.read_bytes()
        receipt = json.loads(receipt_file.read_text())
        if hashlib.sha256(raw).hexdigest() != receipt["sha256"]:
            raise ValueError("Previously captured original source changed.")
    else:
        request = urllib.request.Request(SOURCE_URL, headers={
            "User-Agent": "SummitReady-source-audit/1.0 (+https://summitready.uk)",
            "Accept": "application/json",
        })
        with urllib.request.urlopen(request, timeout=30) as response:
            if response.headers.get_content_type() != "application/json":
                raise ValueError("Publisher did not return JSON; no challenge or HTML is a source track.")
            raw = response.read(2_000_001)
        if len(raw) > 2_000_000:
            raise ValueError("Source exceeds protected evidence limit.")
        receipt = {"url": SOURCE_URL, "sha256": hashlib.sha256(raw).hexdigest(),
                   "capturedAt": datetime.now(timezone.utc).isoformat()}
    source = json.loads(raw)
    coordinates, ways = extract_published_track(source)
    source_file.write_bytes(raw)
    receipt_file.write_text(json.dumps(receipt, indent=2))
    end_gap = length_m(coordinates[0], coordinates[-1])
    length = sum(length_m(a,b) for a,b in zip(coordinates, coordinates[1:]))
    audit = json.loads((ROOT / "generated-artifacts/route-coverage/2026-10-26/audit.json").read_text())
    row = next(r for r in audit["priorities"] if r["routeKeys"] == ["beinn_alligin"])
    manifest = [{
        "name": source["name"], "provider": "OpenStreetMap",
        "url": "https://www.openstreetmap.org/relation/16155652",
        "sourceDownloadUrl": SOURCE_URL,
        "publishedMapUrl": "https://hiking.waymarkedtrails.org/#route?id=16155652",
        "relationId": "16155652", "sourceReference": source.get("tags", {}).get("ref"),
        "licence": "ODbL-1.0", "licenceUrl": "https://opendatacommons.org/licenses/odbl/1-0/",
        "attribution": "© OpenStreetMap contributors; data available under ODbL 1.0. Published route served by Waymarked Trails.",
        "licenceEvidenceUrl": "https://www.openstreetmap.org/copyright",
        "sha256": receipt["sha256"], "sourceCapturedAt": receipt["capturedAt"],
        "expeditionRouteKey": "beinn_alligin",
        "sourceAcquisition": "published_named_route",
        "sourceGeometryUnmodified": True, "sourceCRS": "EPSG:3857", "reviewCRS": "EPSG:4326",
        "geometryConversion": "Coordinate projection only; published member order/orientation retained. Adjacent duplicate seam vertices omitted. No ways or segments added, removed, reversed or reordered.",
        "publishedWayIdsInOrder": ways,
        "sourceEndpointSeparationM": round(end_gap, 2),
        "sourceLengthKm": round(length / 1000, 3),
        "sourceScope": "Published community-mapped mountain itinerary, pending owner and technical review; not an official guide's GPX or a safety guarantee.",
        "sourceMatchReference": {
            "url": "https://www.walkhighlands.co.uk/torridon/Beinnalligin.shtml",
            "use": "Independent factual comparison only. No publisher GPX, route coordinates, photographs or description copied.",
            "expectedFeatures": ["Coire Mhic Nobuil start/finish area", "Tom na Gruagaich", "Sgurr Mor", "Horns of Alligin"],
            "assessment": "Named route and overall area/length match; owner must inspect exact ridge variant and endpoints.",
        },
        "endpointNotice": f"Published endpoints are {end_gap:.0f} m apart near the start/finish road. Preserved exactly; not closed or connected artificially.",
        "fullExpeditionVariantConfirmed": False, "rightsReviewComplete": False, "routeAccessReviewed": False,
        "planningEstimates": {"existingExpeditionDistanceKm": row["currentDistancesKm"][0],
                              "existingExpeditionAscentM": row["currentAscentsM"][0]},
        "scope": "An acquired published track, not a waypoint-generated walk. Source licence allows reuse with attribution/share-alike obligations; app compliance, exact variant, access and safety require review.",
    }]
    payload = {"candidateKey": row["routeName"] + " — published source track",
               "revisionVersion": "published-osm-16155652-" + receipt["sha256"][:16],
               "geometryFile": json.dumps({"type":"LineString","coordinates":coordinates},separators=(",",":")),
               "sourceManifest": manifest}
    (out / "beinn_alligin.input.json").write_text(json.dumps(payload, indent=2))
    report = out.parent / "expedition-source-findings.csv"
    rejected = {
        "cmd": ("https://www.walkhighlands.co.uk/fortwilliam/carnmordeargarete.shtml",
                "Publisher export is personal-use only; retained OSM arete is only a fragment, not the full expedition walk."),
        "y3p": ("https://www.yorkshiredales.org.uk/park-authority/our-service-to-you/website-terms-and-conditions/",
                "Official publisher requires a commercial reuse licence; OSM relation 5671418 branches and is not one complete ordered itinerary. Relation 5643210 is a different walk in Somerset."),
        "liathach": ("https://www.openstreetmap.org/relation/16155653",
                     "Published OSM source consists of four disconnected chains; no inferred connections permitted."),
        "lochnagar": ("https://www.openstreetmap.org/relation/5649486",
                      "Lochnagar and Loch Muick is not the requested White Mounth circuit; source also is not one ordered continuous itinerary."),
        "cadair": ("https://www.openstreetmap.org/relation/1870230",
                   "Published Minffordd source is about 4.3 km with distant endpoints, not a complete supplied return circuit."),
        "helvellyn_edge": ("https://www.walkingbritain.co.uk/walk-1156-gps",
                          "Published GPX is private-use only; no app reuse permission. No permitted replacement acquired."),
        "watkin": ("https://www.openstreetmap.org/relation/4004198",
                   "Original published OSM source is not one ordered continuous complete out-and-back; previous assembled pilots remain withdrawn."),
        "llanberis": ("https://www.openstreetmap.org/relation/4004181",
                      "Retained published source is one-way; no complete published return itinerary acquired. Do not reverse it to manufacture a return."),
        "aonach_eagach": ("https://www.openstreetmap.org/relation/16127354",
                          "Original published point-to-point source already retained. Exact expedition variant, endpoints, access and technical review remain outstanding."),
    }
    with report.open("w", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["route_key", "route_name", "expedition_stage_uses", "status", "source_url", "licence", "finding"])
        for requirement in audit["priorities"]:
            key = requirement["routeKeys"][0]
            if key == "beinn_alligin":
                status, url, licence, finding = ("published_track_prepared_for_review", manifest[0]["url"], "ODbL-1.0",
                    f"Published named route retained without routing or repairs; 10.553 km, endpoints {end_gap:.0f} m apart. Owner/technical review outstanding.")
            else:
                url, finding = rejected.get(key, ("", "No matching published, reuse-permitted complete track confirmed in this sourcing pass. This is an explicit gap, not proof no such track exists."))
                status = "existing_source_only" if key in {"cmd", "aonach_eagach", "llanberis"} else "replacement_not_acquired"
                licence = "Not cleared for this full expedition itinerary"
            writer.writerow([key, requirement["routeName"], requirement["stageUses"], status, url, licence, finding])
    print(json.dumps({"routeKey":"beinn_alligin","source":SOURCE_URL,"publishedWays":len(ways),
                      "points":len(coordinates),"lengthKm":round(length/1000,3),
                      "endpointSeparationM":round(end_gap,2),"segmentsInvented":0,"technicalApproval":False}))


if __name__ == "__main__":
    prepare()
