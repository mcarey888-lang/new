"""Deterministically rebuild the corrected international catalogue release."""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import uuid
import zipfile
from collections.abc import Iterable
from pathlib import Path
from typing import Any

from summit_data_engine.international.package import (
    ALIAS_HEADERS,
    ARCHIVE_MEMBERS,
    BLOCKED_HEADERS,
    EVIDENCE_HEADERS,
    MOUNTAIN_HEADERS,
    ROUTE_HEADERS,
    SOURCE_HEADERS,
    load_catalogue_package,
)

OLD_VERSION = "international-v3-2026-09-06"
NEW_VERSION = "international-v4-2026-09-07"
NEW_RELEASE_DATE = "2026-09-07"
SHADOW_DENALI_ID = "INT-0092"
CANONICAL_DENALI_ID = "INT-0252"
WIKIDATA_URL = "https://www.wikidata.org/wiki/Q130018"
GEONAMES_URL = "https://www.geonames.org/5868589/"
WHITNEY_ROUTE_URL = "https://www.nps.gov/seki/planyourvisit/whitney.htm"
DENALI_ROUTE_URL = "https://www.nps.gov/dena/planyourvisit/mountainfaqs.htm"
ZIP_TIMESTAMP = (2026, 9, 7, 0, 0, 0)


def _read_rows(content: bytes) -> list[dict[str, str]]:
    reader = csv.DictReader(io.StringIO(content.decode("utf-8-sig"), newline=""))
    return [dict(row) for row in reader]


def _write_rows(
    headers: Iterable[str],
    rows: Iterable[dict[str, str]],
) -> bytes:
    output = io.StringIO(newline="")
    writer = csv.DictWriter(output, fieldnames=list(headers), lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
    return output.getvalue().encode("utf-8")


def _json_text(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def _deterministic_evidence_id(
    mountain_id: str,
    source_key: str,
    url: str,
) -> str:
    identity = f"summitready:{NEW_VERSION}:{mountain_id}:{source_key}:{url}"
    return str(uuid.uuid5(uuid.NAMESPACE_URL, identity))


def _version_rows(rows: list[dict[str, str]], field: str) -> None:
    for row in rows:
        row[field] = NEW_VERSION


def _add_qa_flag(row: dict[str, str], flag: str) -> None:
    flags = json.loads(row["qa_flags"])
    if flag not in flags:
        flags.append(flag)
    row["qa_flags"] = _json_text(flags)


def _correct_mountains(
    canonical: list[dict[str, str]],
    blocked: list[dict[str, str]],
) -> list[dict[str, str]]:
    canonical = [
        row for row in canonical if row["source_feature_id"] != SHADOW_DENALI_ID
    ]
    _version_rows(canonical, "provenance_version")
    _version_rows(blocked, "provenance_version")
    denali = next(
        row for row in canonical if row["source_feature_id"] == CANONICAL_DENALI_ID
    )
    denali["area"] = "Alaska Range"
    tags = json.loads(denali["tags"])
    tags["wikidata_id"] = "Q130018"
    tags["mountain_range"] = "Alaska Range"
    denali["tags"] = _json_text(tags)
    return canonical


def _correct_source_records(
    rows: list[dict[str, str]],
) -> list[dict[str, str]]:
    rows = [
        row
        for row in rows
        if row["mountain_source_feature_id"] != SHADOW_DENALI_ID
    ]
    for row in rows:
        row["source_version"] = NEW_VERSION
        row["source_release_date"] = NEW_RELEASE_DATE
    denali = next(
        row
        for row in rows
        if row["mountain_source_feature_id"] == CANONICAL_DENALI_ID
    )
    denali["area"] = "Alaska Range"
    raw = json.loads(denali["raw_payload"])
    raw["mountain_range"] = "Alaska Range"
    raw["wikidata_id"] = "Q130018"
    raw["primary_source"] = (
        "US National Park Service + Wikidata + GeoNames identity"
    )
    raw["last_reviewed"] = NEW_RELEASE_DATE
    denali["raw_payload"] = _json_text(raw)
    for row in rows:
        row["import_payload_sha256"] = hashlib.sha256(
            row["raw_payload"].encode("utf-8")
        ).hexdigest()
    return rows


def _correct_aliases(rows: list[dict[str, str]]) -> list[dict[str, str]]:
    rows = [
        row
        for row in rows
        if row["mountain_source_feature_id"] != SHADOW_DENALI_ID
    ]
    _version_rows(rows, "provenance_version")
    return rows


def _identity_evidence(
    shadow_rows: list[dict[str, str]],
) -> list[dict[str, str]]:
    corrected: list[dict[str, str]] = []
    keys = {
        WIKIDATA_URL: "summitready:INT-0252:wikidata-identity",
        GEONAMES_URL: "summitready:INT-0252:geonames-identity",
    }
    for row in shadow_rows:
        source_key = keys[row["url"]]
        updated = {
            **row,
            "id": _deterministic_evidence_id(
                CANONICAL_DENALI_ID, source_key, row["url"]
            ),
            "mountain_source_feature_id": CANONICAL_DENALI_ID,
            "source_key": source_key,
            "version": NEW_VERSION,
            "title": row["title"].replace(SHADOW_DENALI_ID, CANONICAL_DENALI_ID),
            "retrieved_at": f"{NEW_RELEASE_DATE}T00:00:00Z",
        }
        corrected.append(updated)
    return corrected


def _route_evidence(
    mountain_id: str,
    route_id: str,
    publisher: str,
    title: str,
    url: str,
    anchors: list[str],
) -> dict[str, str]:
    source_key = f"summitready:{mountain_id}:route:{route_id}"
    return {
        "id": _deterministic_evidence_id(mountain_id, source_key, url),
        "mountain_source_feature_id": mountain_id,
        "source_key": source_key,
        "version": NEW_VERSION,
        "publisher": publisher,
        "title": title,
        "url": url,
        "rights_classification": "reference_only",
        "rights_statement": "Citation/source reference",
        "geometry_reuse_allowed": "false",
        "factual_anchors": _json_text(anchors),
        "retrieved_at": f"{NEW_RELEASE_DATE}T00:00:00Z",
    }


def _correct_evidence(rows: list[dict[str, str]]) -> list[dict[str, str]]:
    shadow = [
        row
        for row in rows
        if row["mountain_source_feature_id"] == SHADOW_DENALI_ID
    ]
    rows = [
        row
        for row in rows
        if row["mountain_source_feature_id"] != SHADOW_DENALI_ID
    ]
    _version_rows(rows, "version")
    rows.extend(_identity_evidence(shadow))
    rows.append(
        _route_evidence(
            "INT-0136",
            "IR-0005",
            "US National Park Service",
            "Mount Whitney Trail identity, elevations and distance evidence",
            WHITNEY_ROUTE_URL,
            [
                "route_identity",
                "start_name",
                "start_elevation_m",
                "summit_elevation_m",
                "one_way_distance_km",
            ],
        )
    )
    rows.append(
        _route_evidence(
            CANONICAL_DENALI_ID,
            "IR-0007",
            "US National Park Service",
            "West Buttress identity and expedition duration evidence",
            DENALI_ROUTE_URL,
            ["route_identity", "typical_duration_range"],
        )
    )
    return rows


def _correct_routes(rows: list[dict[str, str]]) -> list[dict[str, str]]:
    _version_rows(rows, "provenance_version")
    whitney = next(row for row in rows if row["route_source_feature_id"] == "IR-0005")
    _add_qa_flag(whitney, "DISTANCE_IS_ROUND_TRIP_FROM_17_1_KM_ONE_WAY_SOURCE")
    denali = next(row for row in rows if row["route_source_feature_id"] == "IR-0007")
    denali["source_url"] = DENALI_ROUTE_URL
    denali["typical_duration_hours"] = "456"
    denali["qa_flags"] = _json_text(
        ["DURATION_IS_MIDPOINT_OF_17_TO_21_DAY_RANGE"]
    )
    return rows


def _correct_document(name: str, content: bytes) -> bytes:
    text = content.decode("utf-8-sig").replace(OLD_VERSION, NEW_VERSION)
    if name in {"complete-replit-instructions.md", "replit-alignment-handoff.md"}:
        text = text.replace(
            "217 mountains with valid required geometry",
            "216 mountains with valid required geometry",
        )
        text = text.replace("4,203 staged aliases", "4,102 staged aliases")
        text = text.replace(
            "487 staged evidence records", "489 staged evidence records"
        )
        text = text.replace("217 geometry-complete", "216 geometry-complete")
        text = text.replace("217 canonical mountain", "216 canonical mountain")
        text = text.replace(
            "74 of those loadable rows are `verified`; 143 remain `needs_review`.",
            "74 of those loadable rows are `verified`; 142 remain `needs_review`.",
        )
        text = text.replace(
            "Import only the 217 geometry-complete Mountain rows.",
            "Import only the 216 geometry-complete Mountain rows.",
        )
    if name == "replit-alignment-handoff.md":
        text += (
            "\n## Corrected v4 identity and route evidence\n\n"
            "- `INT-0092` was a shadow extraction of Denali (`Q130018`, "
            "GeoNames `5868589`) and is merged into verified `INT-0252`.\n"
            "- Route-specific NPS evidence now supports `IR-0005` and `IR-0007`.\n"
            "- Whitney distance is explicitly marked as a round trip derived "
            "from the published 17.1 km one-way route.\n"
            "- Denali duration is the midpoint of the NPS 17–21 day average range.\n"
        )
    return text.encode("utf-8")


def rebuild_catalogue(source: Path, output: Path) -> str:
    """Rebuild v3 as a byte-reproducible corrected v4 archive."""
    package = load_catalogue_package(source)
    if package.catalogue_version != OLD_VERSION:
        raise ValueError(f"expected {OLD_VERSION}, got {package.catalogue_version}")
    with zipfile.ZipFile(source) as archive:
        members = {name: archive.read(name) for name in ARCHIVE_MEMBERS}

    canonical = _correct_mountains(
        _read_rows(members["canonical_mountains_staging.csv"]),
        _read_rows(members["mountains_blocked_missing_geometry.csv"]),
    )
    blocked = _read_rows(members["mountains_blocked_missing_geometry.csv"])
    _version_rows(blocked, "provenance_version")
    sources = _correct_source_records(
        _read_rows(members["mountain_source_records_staging.csv"])
    )
    aliases = _correct_aliases(
        _read_rows(members["mountain_aliases_staging.csv"])
    )
    evidence = _correct_evidence(
        _read_rows(members["evidence_sources_staging.csv"])
    )
    routes = _correct_routes(_read_rows(members["routes_staging.csv"]))

    members["canonical_mountains_staging.csv"] = _write_rows(
        MOUNTAIN_HEADERS, canonical
    )
    members["mountains_blocked_missing_geometry.csv"] = _write_rows(
        BLOCKED_HEADERS, blocked
    )
    members["mountain_source_records_staging.csv"] = _write_rows(
        SOURCE_HEADERS, sources
    )
    members["mountain_aliases_staging.csv"] = _write_rows(ALIAS_HEADERS, aliases)
    members["evidence_sources_staging.csv"] = _write_rows(
        EVIDENCE_HEADERS, evidence
    )
    members["routes_staging.csv"] = _write_rows(ROUTE_HEADERS, routes)
    for name in ARCHIVE_MEMBERS:
        if name.endswith(".md"):
            members[name] = _correct_document(name, members[name])

    output.parent.mkdir(parents=True, exist_ok=True)
    buffer = io.BytesIO()
    with zipfile.ZipFile(
        buffer,
        "w",
        compression=zipfile.ZIP_DEFLATED,
        compresslevel=9,
    ) as archive:
        for name in ARCHIVE_MEMBERS:
            info = zipfile.ZipInfo(name, ZIP_TIMESTAMP)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.create_system = 3
            info.external_attr = 0o644 << 16
            archive.writestr(info, members[name], compress_type=zipfile.ZIP_DEFLATED)
    payload = buffer.getvalue()
    output.write_bytes(payload)
    load_catalogue_package(output)
    return hashlib.sha256(payload).hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Build the corrected deterministic v4 international catalogue"
    )
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    print(rebuild_catalogue(args.source, args.output))


if __name__ == "__main__":
    main()