#!/usr/bin/env python3
"""Bounded OSM route discovery; never invents geometry or approves a route."""
import argparse
import concurrent.futures
import datetime
import hashlib
import json
import time
import urllib.parse
import urllib.request
import unicodedata
from pathlib import Path

QUERIES = {
    "cmd": ["Carn Mor Dearg", "CMD Arete"],
    "cairngorm_macdui": ["Ben Macdui", "Cairn Gorm"],
    "lochnagar": ["Lochnagar", "White Mounth"],
    "watkin": ["Watkin"],
    "aonach_eagach": ["Aonach Eagach"],
    "fairfield": ["Fairfield"],
    "tryfan_north": ["Tryfan"],
    "an_teallach": ["An Teallach"],
    "braeriach": ["Braeriach"],
    "crib_goch": ["Crib Goch"],
    "liathach": ["Liathach"],
    "cruachan": ["Cruachan"],
    "carneddau": ["Carneddau"],
    "helvellyn_edge": ["Striding Edge", "Swirral Edge", "Helvellyn"],
    "scafell_corridor": ["Corridor Route", "Scafell Pike"],
    "y3p": ["Yorkshire Three Peaks"],
    "bla_bheinn": ["Bla Bheinn", "Blaven"],
    "edale_skyline": ["Edale Skyline"],
    "cautley": ["Cautley"],
    "beinn_alligin": ["Beinn Alligin"],
    "blencathra_sharp": ["Sharp Edge", "Blencathra"],
    "great_gable": ["Great Gable"],
    "high_street": ["Mardale", "High Street"],
    "great_ridge": ["Great Ridge", "Mam Tor"],
    "pen_y_ghent": ["Pen-y-ghent"],
    "whernside": ["Whernside"],
    "bleaklow": ["Wildboar", "Bleaklow"],
    "cadair": ["Minffordd", "Cadair Idris"],
    "crinkles": ["Crinkle Crags"],
    "ingleborough": ["Ingleborough"],
    "glyders": ["Glyder"],
    "llanberis": ["Llanberis Path"],
}


def fetch(url):
    request = urllib.request.Request(url, headers={
        "User-Agent": "SummitReady-development-route-review/1.0",
        "Accept": "application/json",
    })
    with urllib.request.urlopen(request, timeout=18) as response:
        raw = response.read(12_000_001)
    if len(raw) > 12_000_000:
        raise ValueError("Bounded source response exceeded 12 MB")
    return json.loads(raw), raw


def search(query):
    url = "https://hiking.waymarkedtrails.org/api/v1/list/search?" + urllib.parse.urlencode({
        "query": query, "limit": 10,
    })
    try:
        data, _ = fetch(url)
        return query, {"url": url, "results": data.get("results", []), "error": None}
    except Exception as exc:
        return query, {"url": url, "results": [], "error": type(exc).__name__}


def relevant(query, name):
    def words(text):
        return set("".join(c if c.isalnum() else " " for c in
                          unicodedata.normalize("NFKD", text.lower())
                          if not unicodedata.combining(c)).split())
    required = words(query) - {"the", "and", "via", "path", "route", "trail"}
    return bool(required) and required.issubset(words(name))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--audit", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)
    audit = json.loads(Path(args.audit).read_text())
    queries = sorted({q for values in QUERIES.values() for q in values})
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        found = dict(executor.map(search, queries))
    # A search hit is only a lead. Details must place it in the intended region;
    # no fuzzy result becomes a route identity or approved geometry.
    leads = {}
    for item in audit["priorities"]:
        key = item["routeKeys"][0]
        for query in QUERIES.get(key, []):
            for result in found[query]["results"]:
                if result.get("type") == "relation" and relevant(query, result.get("name", "")):
                    leads[str(result["id"])] = result
    details = {}
    for relation_id in leads:
        url = f"https://hiking.waymarkedtrails.org/api/v1/details/relation/{relation_id}"
        try:
            data, raw = fetch(url)
            bbox = data.get("bbox", [])
            # EPSG:3857 broad Great Britain extent. Never import global fuzzy hits.
            in_britain = len(bbox) == 4 and -900000 < bbox[0] < 250000 and 6300000 < bbox[1] < 8500000
            if in_britain:
                path = output / f"discovery-relation-{relation_id}.json"
                path.write_bytes(raw)
                details[relation_id] = {
                    "id": int(relation_id), "name": data.get("name"),
                    "url": f"https://www.openstreetmap.org/relation/{relation_id}",
                    "discoveryUrl": url, "discoverySha256": hashlib.sha256(raw).hexdigest(),
                    "bbox3857": bbox, "itinerary": data.get("itinerary", []),
                    "status": "unreviewed_source_lead",
                }
        except Exception:
            pass
        time.sleep(0.12)
    rows = []
    for item in audit["priorities"]:
        key = item["routeKeys"][0]
        ids = {str(r["id"]) for q in QUERIES.get(key, []) for r in found[q]["results"]
               if r.get("type") == "relation" and relevant(q, r.get("name", ""))}
        rows.append({
            **item,
            "searches": [{"query": q, **found[q]} for q in QUERIES.get(key, [])],
            "sourceLeads": [details[r] for r in sorted(ids) if r in details],
        })
    report = {
        "generatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "scope": "Development sourcing only; discovery hits do not verify route variants, rights or safety.",
        "summary": audit["summary"], "routes": rows,
    }
    (output / "sourcing.json").write_text(json.dumps(report, indent=2, ensure_ascii=False))
    print(json.dumps({"routes": len(rows), "searchFailures": sum(bool(r["error"]) for r in found.values()),
                      "britishSourceLeads": len(details)}, indent=2))
    for row in rows:
        print(row["routeKeys"][0], [(r["id"], r["name"]) for r in row["sourceLeads"]])


if __name__ == "__main__":
    main()
