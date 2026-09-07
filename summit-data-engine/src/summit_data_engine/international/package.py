"""Strict, side-effect-free reader for the international catalogue archive."""

from __future__ import annotations

import csv
import hashlib
import io
import json
import math
import re
import unicodedata
import uuid
import zipfile
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from shapely import wkt  # type: ignore[import-untyped]
from shapely.geometry import Point  # type: ignore[import-untyped]

CATALOGUE_NAME = "Summit Ready International Mountain Catalogue"
ARCHIVE_MEMBERS = (
    "complete-replit-instructions.md",
    "canonical_mountains_staging.csv",
    "mountains_blocked_missing_geometry.csv",
    "mountain_source_records_staging.csv",
    "mountain_aliases_staging.csv",
    "evidence_sources_staging.csv",
    "routes_staging.csv",
    "field_mapping.csv",
    "schema_gaps.csv",
    "replit-alignment-handoff.md",
)
MOUNTAIN_HEADERS = (
    "id", "source_bundle_id", "source_feature_id", "canonical_source_key", "name",
    "status", "geom", "tags", "provenance_version", "country", "region", "area",
    "county", "elevation_m", "prominence_m", "col_height_m", "grid_reference",
    "summit_feature",
)
BLOCKED_HEADERS = (*MOUNTAIN_HEADERS, "block_reason")
SOURCE_HEADERS = (
    "mountain_source_feature_id", "source_dataset", "source_version",
    "source_release_date", "source_file_sha256", "source_license",
    "source_attribution", "source_trust", "final_verification_status",
    "needs_review_reason", "qa_status", "qa_flags", "data_priority",
    "ai_fallback_allowed", "name", "country", "region", "area", "county",
    "elevation_m", "prominence_m", "col_height_m", "grid_reference",
    "summit_feature", "geom", "raw_payload", "prepared_payload",
    "import_payload_sha256",
)
ALIAS_HEADERS = (
    "id", "mountain_source_feature_id", "name", "language_or_note", "status",
    "provenance_version",
)
EVIDENCE_HEADERS = (
    "id", "mountain_source_feature_id", "source_key", "version", "publisher",
    "title", "url", "rights_classification", "rights_statement",
    "geometry_reuse_allowed", "factual_anchors", "retrieved_at",
)
ROUTE_HEADERS = (
    "route_source_feature_id", "mountain_source_feature_id", "requested_name",
    "canonical_name", "aliases", "start_name", "start_elevation_m",
    "summit_elevation_m", "total_ascent_m", "distance_km",
    "typical_duration_hours", "status", "source_url", "qa_flags",
    "provenance_version",
)
HEX64 = re.compile(r"^[0-9a-f]{64}$")


@dataclass(frozen=True)
class CataloguePackage:
    archive_path: Path
    package_sha256: str
    catalogue_version: str
    member_sha256: dict[str, str]
    mountains: tuple[dict[str, Any], ...]
    blocked: tuple[dict[str, Any], ...]
    source_records: tuple[dict[str, Any], ...]
    aliases: tuple[dict[str, Any], ...]
    evidence: tuple[dict[str, Any], ...]
    routes: tuple[dict[str, Any], ...]


def normalize_alias(value: str) -> str:
    """Normalize without discarding non-ASCII letters or numbers."""
    normalized = unicodedata.normalize("NFKC", value).casefold()
    result = "".join(character for character in normalized if character.isalnum())
    if not result:
        raise ValueError("alias has no Unicode letters or numbers")
    return result


def _required(row: dict[str, str], field: str, context: str) -> str:
    value = row[field].strip()
    if not value:
        raise ValueError(f"{context}: {field} is required")
    return value


def _uuid(value: str, field: str, context: str) -> uuid.UUID:
    try:
        return uuid.UUID(_required({field: value}, field, context))
    except ValueError as exc:
        raise ValueError(f"{context}: {field} must be a UUID") from exc


def _number(
    value: str,
    field: str,
    context: str,
    *,
    required: bool = False,
    positive: bool = False,
    allow_negative: bool = False,
) -> float | None:
    value = value.strip()
    if not value:
        if required:
            raise ValueError(f"{context}: {field} is required")
        return None
    try:
        result = float(value)
    except ValueError as exc:
        raise ValueError(f"{context}: {field} must be numeric") from exc
    if (
        not math.isfinite(result)
        or (not allow_negative and result < 0)
        or (positive and result == 0)
    ):
        comparison = "positive" if positive else "nonnegative and finite"
        raise ValueError(f"{context}: {field} must be {comparison}")
    return result


def _json(value: str, field: str, context: str, expected: type[Any]) -> Any:
    try:
        result = json.loads(value)
    except json.JSONDecodeError as exc:
        raise ValueError(f"{context}: {field} must be valid JSON") from exc
    if not isinstance(result, expected):
        raise ValueError(f"{context}: {field} has the wrong JSON type")
    return result


def _rows(content: bytes, headers: tuple[str, ...], member: str) -> list[dict[str, str]]:
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text, newline=""))
    if tuple(reader.fieldnames or ()) != headers:
        raise ValueError(f"{member}: headers do not exactly match the catalogue contract")
    rows = list(reader)
    if any(None in row for row in rows):
        raise ValueError(f"{member}: row contains fields beyond the declared headers")
    return rows


def _point(value: str, context: str) -> Point:
    try:
        geometry = wkt.loads(value)
    except Exception as exc:
        raise ValueError(f"{context}: geom must be valid WKT") from exc
    if not isinstance(geometry, Point) or geometry.is_empty or geometry.has_z:
        raise ValueError(f"{context}: geom must be a two-dimensional POINT")
    if not (-180 <= geometry.x <= 180 and -90 <= geometry.y <= 90):
        raise ValueError(f"{context}: coordinates are outside WGS84 ranges")
    return geometry


def _canonical_key(raw: dict[str, Any], feature_id: str) -> str:
    geonames = str(raw.get("geonames_id") or "").strip()
    wikidata = str(raw.get("wikidata_id") or "").strip()
    if geonames:
        return f"geonames:{geonames}"
    if wikidata:
        return f"wikidata:{wikidata}"
    return f"summitready:{feature_id}"


def _validate_mountain(
    row: dict[str, str], number: int, *, blocked: bool = False
) -> dict[str, Any]:
    context = f"{'blocked' if blocked else 'mountain'} row {number}"
    _uuid(row["id"], "id", context)
    if row["source_bundle_id"] != "ASSIGN_ON_IMPORT":
        raise ValueError(f"{context}: source_bundle_id must be ASSIGN_ON_IMPORT")
    feature_id = _required(row, "source_feature_id", context)
    if not re.fullmatch(r"INT-\d{4}", feature_id):
        raise ValueError(f"{context}: invalid source_feature_id")
    status = _required(row, "status", context)
    if status not in {"verified", "needs_review"}:
        raise ValueError(f"{context}: invalid status")
    tags = _json(row["tags"], "tags", context, dict)
    for field in ("name", "provenance_version", "country"):
        _required(row, field, context)
    if tags.get("catalogue_id") != feature_id:
        raise ValueError(f"{context}: tags catalogue_id does not match")
    expected_key = _canonical_key(tags, feature_id)
    if _required(row, "canonical_source_key", context) != expected_key:
        raise ValueError(f"{context}: canonical key does not follow GeoNames/Wikidata order")
    geometry = None if blocked else _point(_required(row, "geom", context), context)
    if blocked and (
        row["geom"].strip() or row["block_reason"] != "MISSING_REQUIRED_GEOMETRY"
    ):
        raise ValueError(f"{context}: blocked row must have missing geometry")
    return {
        **row,
        "id": uuid.UUID(row["id"]),
        "tags": tags,
        "geometry": geometry,
        "elevation_m": _number(row["elevation_m"], "elevation_m", context, required=True),
        "prominence_m": _number(row["prominence_m"], "prominence_m", context),
        "col_height_m": _number(row["col_height_m"], "col_height_m", context),
    }


def _validate_source(row: dict[str, str], number: int) -> dict[str, Any]:
    context = f"source record row {number}"
    feature_id = _required(row, "mountain_source_feature_id", context)
    if _required(row, "source_dataset", context) != CATALOGUE_NAME:
        raise ValueError(f"{context}: unexpected source_dataset")
    for field in (
        "source_version",
        "source_license",
        "source_attribution",
        "source_trust",
        "name",
        "country",
    ):
        _required(row, field, context)
    date.fromisoformat(_required(row, "source_release_date", context))
    for field in ("source_file_sha256", "import_payload_sha256"):
        if not HEX64.fullmatch(_required(row, field, context)):
            raise ValueError(f"{context}: {field} must be a lowercase SHA-256")
    if row["final_verification_status"] not in {"trusted_source", "needs_review"}:
        raise ValueError(f"{context}: invalid final_verification_status")
    if row["qa_status"] not in {"pass", "info", "review"}:
        raise ValueError(f"{context}: invalid qa_status")
    raw_payload_text = row["raw_payload"]
    raw = _json(raw_payload_text, "raw_payload", context, dict)
    prepared = _json(row["prepared_payload"], "prepared_payload", context, dict)
    computed_hash = hashlib.sha256(raw_payload_text.encode("utf-8")).hexdigest()
    if row["import_payload_sha256"] != computed_hash:
        raise ValueError(f"{context}: import_payload_sha256 does not match payload")
    if raw.get("mountain_id") != feature_id:
        raise ValueError(f"{context}: raw payload mountain_id does not match")
    if prepared.get("canonical_source_key") != _canonical_key(raw, feature_id):
        raise ValueError(f"{context}: prepared canonical key does not follow required order")
    flags = _json(row["qa_flags"], "qa_flags", context, list)
    if row["ai_fallback_allowed"].lower() not in {"true", "false"}:
        raise ValueError(f"{context}: ai_fallback_allowed must be boolean")
    geometry = _point(row["geom"], context) if row["geom"].strip() else None
    data_priority = int(_required(row, "data_priority", context))
    if data_priority <= 0:
        raise ValueError(f"{context}: data_priority must be positive")
    if (
        row["final_verification_status"] == "needs_review"
        and not row["needs_review_reason"].strip()
    ):
        raise ValueError(f"{context}: needs_review requires needs_review_reason")
    return {
        **row,
        "raw_payload": raw,
        "prepared_payload": prepared,
        "qa_flags": flags,
        "geometry": geometry,
        "elevation_m": _number(row["elevation_m"], "elevation_m", context, required=True),
        "prominence_m": _number(row["prominence_m"], "prominence_m", context),
        "col_height_m": _number(row["col_height_m"], "col_height_m", context),
        "data_priority": data_priority,
        "ai_fallback_allowed": row["ai_fallback_allowed"].lower() == "true",
    }


def _validate_package(package: CataloguePackage) -> None:
    expected_counts = {
        "mountains": 217,
        "blocked": 37,
        "source_records": 254,
        "aliases": 4203,
        "evidence": 487,
        "routes": 23,
    }
    actual_counts = {
        field: len(getattr(package, field)) for field in expected_counts
    }
    if actual_counts != expected_counts:
        raise ValueError(
            f"catalogue row counts do not match contract: {actual_counts!r}"
        )
    mountain_ids = {row["source_feature_id"] for row in package.mountains}
    blocked_ids = {row["source_feature_id"] for row in package.blocked}
    if mountain_ids & blocked_ids:
        raise ValueError("geometry-complete and blocked mountain IDs overlap")
    all_ids = mountain_ids | blocked_ids
    if len(all_ids) != len(package.mountains) + len(package.blocked):
        raise ValueError("duplicate mountain source_feature_id")
    record_uuids = [row["id"] for row in (*package.mountains, *package.blocked)]
    if len(set(record_uuids)) != len(record_uuids):
        raise ValueError("duplicate mountain UUID")
    source_ids = {row["mountain_source_feature_id"] for row in package.source_records}
    if source_ids != all_ids or len(source_ids) != len(package.source_records):
        raise ValueError("source records must reference every mountain exactly once")
    catalogue_rows = {
        row["source_feature_id"]: row for row in (*package.mountains, *package.blocked)
    }
    for source in package.source_records:
        catalogue = catalogue_rows[source["mountain_source_feature_id"]]
        if (
            source["prepared_payload"]["canonical_source_key"]
            != catalogue["canonical_source_key"]
            or source["name"] != catalogue["name"]
            or source["country"] != catalogue["country"]
            or source["region"] != catalogue["region"]
            or source["area"] != catalogue["area"]
            or source["county"] != catalogue["county"]
            or source["elevation_m"] != catalogue["elevation_m"]
            or source["prominence_m"] != catalogue["prominence_m"]
            or source["col_height_m"] != catalogue["col_height_m"]
            or source["grid_reference"] != catalogue["grid_reference"]
            or source["summit_feature"] != catalogue["summit_feature"]
            or (source["geometry"] is None) != (catalogue["geometry"] is None)
            or (
                source["geometry"] is not None
                and not source["geometry"].equals_exact(catalogue["geometry"], 0)
            )
            or source["final_verification_status"]
            != ("trusted_source" if catalogue["status"] == "verified" else "needs_review")
        ):
            raise ValueError("source record does not match its canonical mountain")
    for collection, label in (
        (package.aliases, "alias"),
        (package.evidence, "evidence"),
    ):
        ids = [row["id"] for row in collection]
        if len(ids) != len(set(ids)):
            raise ValueError(f"duplicate {label} UUID")
    evidence_keys = [
        (row["source_key"], row["version"]) for row in package.evidence
    ]
    if len(evidence_keys) != len(set(evidence_keys)):
        raise ValueError("duplicate evidence (source_key, version)")
    route_ids = [row["route_source_feature_id"] for row in package.routes]
    if len(route_ids) != len(set(route_ids)):
        raise ValueError("duplicate route_source_feature_id")
    for collection, label in (
        (package.aliases, "alias"),
        (package.evidence, "evidence"),
        (package.routes, "route"),
    ):
        for row in collection:
            if row["mountain_source_feature_id"] not in all_ids:
                raise ValueError(f"{label} references an unknown mountain")
    versions = {
        row["provenance_version"] for row in (*package.mountains, *package.blocked)
    } | {row["source_version"] for row in package.source_records} | {
        row["provenance_version"] for row in package.aliases
    } | {row["version"] for row in package.evidence} | {
        row["provenance_version"] for row in package.routes
    }
    if versions != {package.catalogue_version}:
        raise ValueError("catalogue contains inconsistent provenance versions")
    evidence_identity = {
        (row["mountain_source_feature_id"], row["url"]) for row in package.evidence
    }
    for route in package.routes:
        key = (route["mountain_source_feature_id"], route["source_url"])
        route["evidence_matched"] = key in evidence_identity


def load_catalogue_package(
    archive_path: Path,
    *,
    expected_package_sha256: str | None = None,
) -> CataloguePackage:
    """Load and fully validate an archive without opening a database connection."""
    archive_path = Path(archive_path)
    package_bytes = archive_path.read_bytes()
    package_hash = hashlib.sha256(package_bytes).hexdigest()
    if expected_package_sha256 is not None and package_hash != expected_package_sha256:
        raise ValueError("package SHA-256 does not match expected_package_sha256")
    with zipfile.ZipFile(io.BytesIO(package_bytes)) as archive:
        names = archive.namelist()
        if len(names) != len(set(names)) or set(names) != set(ARCHIVE_MEMBERS):
            raise ValueError("archive members do not exactly match the catalogue contract")
        if any("/" in name or "\\" in name for name in names):
            raise ValueError("archive contains unsafe member paths")
        archive.testzip()
        contents = {name: archive.read(name) for name in ARCHIVE_MEMBERS}

    mountain_rows = _rows(
        contents["canonical_mountains_staging.csv"], MOUNTAIN_HEADERS,
        "canonical_mountains_staging.csv",
    )
    blocked_rows = _rows(
        contents["mountains_blocked_missing_geometry.csv"], BLOCKED_HEADERS,
        "mountains_blocked_missing_geometry.csv",
    )
    source_rows = _rows(
        contents["mountain_source_records_staging.csv"], SOURCE_HEADERS,
        "mountain_source_records_staging.csv",
    )
    alias_rows = _rows(
        contents["mountain_aliases_staging.csv"], ALIAS_HEADERS,
        "mountain_aliases_staging.csv",
    )
    evidence_rows = _rows(
        contents["evidence_sources_staging.csv"], EVIDENCE_HEADERS,
        "evidence_sources_staging.csv",
    )
    route_rows = _rows(contents["routes_staging.csv"], ROUTE_HEADERS, "routes_staging.csv")

    mountains = tuple(
        _validate_mountain(row, number) for number, row in enumerate(mountain_rows, 2)
    )
    blocked = tuple(
        _validate_mountain(row, number, blocked=True)
        for number, row in enumerate(blocked_rows, 2)
    )
    sources = tuple(_validate_source(row, number) for number, row in enumerate(source_rows, 2))
    aliases: list[dict[str, Any]] = []
    for number, row in enumerate(alias_rows, 2):
        context = f"alias row {number}"
        _uuid(row["id"], "id", context)
        for field in ("mountain_source_feature_id", "provenance_version"):
            _required(row, field, context)
        _required(row, "name", context)
        if row["status"] not in {"verified", "needs_review"}:
            raise ValueError(f"{context}: invalid status")
        aliases.append(
            {
                **row,
                "id": uuid.UUID(row["id"]),
                "normalized_name": normalize_alias(row["name"]),
            }
        )
    evidence: list[dict[str, Any]] = []
    for number, row in enumerate(evidence_rows, 2):
        context = f"evidence row {number}"
        _uuid(row["id"], "id", context)
        for field in (
            "mountain_source_feature_id",
            "source_key",
            "version",
            "publisher",
            "title",
            "url",
            "retrieved_at",
        ):
            _required(row, field, context)
        if row["rights_classification"] != "reference_only":
            raise ValueError(f"{context}: unsupported staged rights classification")
        if row["geometry_reuse_allowed"].lower() != "false":
            raise ValueError(f"{context}: reference-only evidence cannot supply geometry")
        datetime.fromisoformat(row["retrieved_at"].replace("Z", "+00:00"))
        parsed_url = urlparse(row["url"])
        if parsed_url.scheme not in {"http", "https"} or not parsed_url.netloc:
            raise ValueError(f"{context}: url must be absolute HTTP(S)")
        factual_anchors = _json(
            row["factual_anchors"], "factual_anchors", context, list
        )
        if not factual_anchors or not all(
            isinstance(anchor, str) and anchor.strip() for anchor in factual_anchors
        ):
            raise ValueError(f"{context}: factual_anchors must contain nonblank strings")
        evidence.append(
            {
                **row,
                "id": uuid.UUID(row["id"]),
                "rights_classification": "factual_identity_only",
                "factual_anchors": factual_anchors,
            }
        )
    routes: list[dict[str, Any]] = []
    for number, row in enumerate(route_rows, 2):
        context = f"route row {number}"
        for field in (
            "route_source_feature_id", "mountain_source_feature_id", "requested_name",
            "canonical_name", "provenance_version",
        ):
            _required(row, field, context)
        if row["status"] not in {"verified", "needs_review"}:
            raise ValueError(f"{context}: invalid status")
        routes.append(
            {
                **row,
                "aliases": _json(row["aliases"], "aliases", context, list),
                "qa_flags": _json(row["qa_flags"], "qa_flags", context, list),
                "start_elevation_m": _number(
                    row["start_elevation_m"],
                    "start_elevation_m",
                    context,
                    allow_negative=True,
                ),
                "summit_elevation_m": _number(
                    row["summit_elevation_m"],
                    "summit_elevation_m",
                    context,
                    allow_negative=True,
                ),
                "total_ascent_m": _number(row["total_ascent_m"], "total_ascent_m", context),
                "distance_km": _number(row["distance_km"], "distance_km", context),
                "typical_duration_hours": _number(
                    row["typical_duration_hours"],
                    "typical_duration_hours",
                    context,
                    positive=True,
                ),
            }
        )
        parsed_url = urlparse(row["source_url"])
        if parsed_url.scheme not in {"http", "https"} or not parsed_url.netloc:
            raise ValueError(f"{context}: source_url must be absolute HTTP(S)")
    version = mountains[0]["provenance_version"]
    package = CataloguePackage(
        archive_path=archive_path,
        package_sha256=package_hash,
        catalogue_version=version,
        member_sha256={
            name: hashlib.sha256(content).hexdigest() for name, content in contents.items()
        },
        mountains=mountains,
        blocked=blocked,
        source_records=sources,
        aliases=tuple(aliases),
        evidence=tuple(evidence),
        routes=tuple(routes),
    )
    _validate_package(package)
    return package
