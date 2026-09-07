"""Strict reader for the externally reviewed DoBIH v18.5 master package."""

from __future__ import annotations

import csv
import hashlib
import json
import zipfile
from collections import Counter
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any

from summit_data_engine.util.provenance import canonical_json_sha256, file_sha256

DOBIH_SOURCE_HEADERS = (
    "Number",
    "Name",
    "Parent (SMC)",
    "Parent name (SMC)",
    "Section",
    "Region",
    "Area",
    "Island",
    "Topo Section",
    "County",
    "Classification",
    "Map 1:50k",
    "Map 1:25k",
    "Metres",
    "Feet",
    "Grid ref",
    "Grid ref 10",
    "Drop",
    "Col grid ref",
    "Col height",
    "Feature",
    "Observations",
    "Survey",
    "Climbed",
    "Country",
    "County Top",
    "Revision",
    "Comments",
    "Streetmap/MountainViews",
    "Google Maps",
    "Hill-bagging",
    "Xcoord",
    "Ycoord",
    "Latitude",
    "Longitude",
    "GridrefXY",
    "_Section",
    "Parent (Ma)",
    "Parent name (Ma)",
    "MVNumber",
    "Ma",
    "Ma=",
    "Hu",
    "Hu=",
    "Tu",
    "Sim",
    "5",
    "M",
    "MT",
    "F",
    "C",
    "G",
    "D",
    "DT",
    "Hew",
    "N",
    "Dew",
    "DDew",
    "HF",
    "4",
    "3",
    "2",
    "1",
    "0",
    "W",
    "WO",
    "B",
    "E",
    "HHB",
    "Sy",
    "Fel",
    "CoH",
    "CoH=",
    "CoU",
    "CoU=",
    "CoA",
    "CoA=",
    "CoL",
    "CoL=",
    "SIB",
    "sMa",
    "sHu",
    "sSim",
    "s5",
    "s4",
    "Mur",
    "CT",
    "GT",
    "BL",
    "Bg",
    "Y",
    "Cm",
    "T100",
    "xMT",
    "xC",
    "xG",
    "xN",
    "xDT",
    "Dil",
    "VL",
    "A",
    "Ca",
    "Bin",
    "O",
    "Un",
)

PREPARED_HEADERS = (
    "summit_ready_canonical_id",
    "country_normalized",
    "latitude_normalized",
    "longitude_normalized",
    "elevation_m_normalized",
    "prominence_m_normalized",
    "col_height_m_normalized",
    "source_dataset",
    "source_version",
    "source_release_date",
    "source_file_sha256",
    "source_license",
    "source_attribution",
    "source_trust",
    "final_verification_status",
    "needs_review_reason",
    "qa_status",
    "qa_flags",
    "data_priority",
    "ai_fallback_allowed",
)

EXPECTED_HEADERS = (*DOBIH_SOURCE_HEADERS, *PREPARED_HEADERS)
EXPECTED_RECORD_COUNT = 21_576
KNOWN_V18_5_PACKAGE_SHA256 = "a33d20710f783e6ac68868e94b3db0b53a2c5ba0cc1265f20136e4235425f700"


@dataclass(frozen=True)
class PreparedDobihRecord:
    source_feature_id: str
    canonical_source_key: str
    name: str
    country: str
    region: str | None
    area: str | None
    county: str | None
    elevation_m: float
    prominence_m: float
    col_height_m: float
    latitude: float
    longitude: float
    grid_reference: str
    summit_feature: str | None
    classifications: tuple[str, ...]
    source_dataset: str
    source_version: str
    source_release_date: date
    source_file_sha256: str
    source_license: str
    source_attribution: str
    source_trust: str
    final_verification_status: str
    needs_review_reason: str | None
    qa_status: str
    qa_flags: tuple[str, ...]
    data_priority: int
    ai_fallback_allowed: bool
    raw_payload: dict[str, str]
    prepared_payload: dict[str, str]
    import_payload_sha256: str


@dataclass(frozen=True)
class DobihImportPackage:
    csv_path: Path
    summary_path: Path
    original_source_path: Path
    package_path: Path | None
    import_csv_sha256: str
    original_source_sha256: str
    package_sha256: str | None
    summary: dict[str, Any]
    records: tuple[PreparedDobihRecord, ...]


def _required(value: str, field: str, row_number: int) -> str:
    if not value.strip():
        raise ValueError(f"row {row_number}: {field} is required")
    return value


def _number(value: str, field: str, row_number: int) -> float:
    try:
        return float(_required(value, field, row_number))
    except ValueError as exc:
        raise ValueError(f"row {row_number}: {field} must be numeric") from exc


def _assert_same_number(
    source_value: float,
    normalized_value: str,
    field: str,
    row_number: int,
) -> None:
    if abs(source_value - _number(normalized_value, field, row_number)) > 1e-9:
        raise ValueError(f"row {row_number}: normalized {field} changed the source value")


def _parse_record(row: dict[str, str], row_number: int) -> PreparedDobihRecord:
    raw = {header: row[header] for header in DOBIH_SOURCE_HEADERS}
    prepared = {header: row[header] for header in PREPARED_HEADERS}
    source_feature_id = _required(raw["Number"], "Number", row_number).strip()
    if not source_feature_id.isdigit():
        raise ValueError(f"row {row_number}: Number must contain only digits")

    canonical_source_key = _required(
        prepared["summit_ready_canonical_id"],
        "summit_ready_canonical_id",
        row_number,
    ).strip()
    expected_key = f"dobih:{source_feature_id}"
    if canonical_source_key != expected_key:
        raise ValueError(
            f"row {row_number}: canonical ID {canonical_source_key!r} "
            f"does not match {expected_key!r}"
        )

    elevation_m = _number(raw["Metres"], "Metres", row_number)
    prominence_m = _number(raw["Drop"], "Drop", row_number)
    col_height_m = _number(raw["Col height"], "Col height", row_number)
    latitude = _number(raw["Latitude"], "Latitude", row_number)
    longitude = _number(raw["Longitude"], "Longitude", row_number)
    if elevation_m < 0 or prominence_m < 0 or col_height_m < 0:
        raise ValueError(f"row {row_number}: height, prominence and col height must be nonnegative")
    if not -90 <= latitude <= 90 or not -180 <= longitude <= 180:
        raise ValueError(f"row {row_number}: coordinates are outside WGS84 ranges")

    _assert_same_number(elevation_m, prepared["elevation_m_normalized"], "elevation", row_number)
    _assert_same_number(
        prominence_m,
        prepared["prominence_m_normalized"],
        "prominence",
        row_number,
    )
    _assert_same_number(
        col_height_m,
        prepared["col_height_m_normalized"],
        "col height",
        row_number,
    )
    _assert_same_number(latitude, prepared["latitude_normalized"], "latitude", row_number)
    _assert_same_number(longitude, prepared["longitude_normalized"], "longitude", row_number)

    final_status = _required(
        prepared["final_verification_status"],
        "final_verification_status",
        row_number,
    ).strip()
    if final_status not in {"trusted_source", "needs_review"}:
        raise ValueError(
            f"row {row_number}: unsupported final verification status {final_status!r}"
        )
    qa_status = _required(prepared["qa_status"], "qa_status", row_number).strip()
    if qa_status not in {"pass", "info", "review"}:
        raise ValueError(f"row {row_number}: unsupported QA status {qa_status!r}")
    if prepared["ai_fallback_allowed"].strip().lower() not in {"true", "false"}:
        raise ValueError(f"row {row_number}: ai_fallback_allowed must be true or false")
    needs_review_reason = prepared["needs_review_reason"].strip() or None
    if final_status == "needs_review" and needs_review_reason is None:
        raise ValueError(f"row {row_number}: needs_review requires a reason")

    classifications = tuple(
        dict.fromkeys(
            code
            for item in raw["Classification"].split(",")
            if (code := item.strip())
        )
    )
    if not classifications:
        raise ValueError(f"row {row_number}: Classification is required")
    qa_flags = tuple(
        flag
        for item in prepared["qa_flags"].split(";")
        if (flag := item.strip())
    )
    try:
        data_priority = int(_required(prepared["data_priority"], "data_priority", row_number))
    except ValueError as exc:
        raise ValueError(f"row {row_number}: data_priority must be an integer") from exc
    if data_priority <= 0:
        raise ValueError(f"row {row_number}: data_priority must be positive")

    return PreparedDobihRecord(
        source_feature_id=source_feature_id,
        canonical_source_key=canonical_source_key,
        name=_required(raw["Name"], "Name", row_number),
        country=_required(prepared["country_normalized"], "country_normalized", row_number),
        region=raw["Region"].strip() or None,
        area=raw["Area"].strip() or None,
        county=raw["County"].strip() or None,
        elevation_m=elevation_m,
        prominence_m=prominence_m,
        col_height_m=col_height_m,
        latitude=latitude,
        longitude=longitude,
        grid_reference=_required(raw["Grid ref"], "Grid ref", row_number),
        summit_feature=raw["Feature"].strip() or None,
        classifications=classifications,
        source_dataset=_required(prepared["source_dataset"], "source_dataset", row_number),
        source_version=_required(prepared["source_version"], "source_version", row_number),
        source_release_date=date.fromisoformat(
            _required(prepared["source_release_date"], "source_release_date", row_number)
        ),
        source_file_sha256=_required(
            prepared["source_file_sha256"], "source_file_sha256", row_number
        ),
        source_license=_required(prepared["source_license"], "source_license", row_number),
        source_attribution=_required(
            prepared["source_attribution"], "source_attribution", row_number
        ),
        source_trust=_required(prepared["source_trust"], "source_trust", row_number),
        final_verification_status=final_status,
        needs_review_reason=needs_review_reason,
        qa_status=qa_status,
        qa_flags=qa_flags,
        data_priority=data_priority,
        ai_fallback_allowed=prepared["ai_fallback_allowed"].strip().lower() == "true",
        raw_payload=raw,
        prepared_payload=prepared,
        import_payload_sha256=canonical_json_sha256({"raw": raw, "prepared": prepared}),
    )


def _validate_summary(
    records: tuple[PreparedDobihRecord, ...],
    summary: dict[str, Any],
) -> None:
    expected_total = summary.get("total_records")
    if expected_total != len(records):
        raise ValueError(
            f"summary total_records={expected_total!r} does not match CSV rows={len(records)}"
        )
    country_counts = dict(Counter(record.country for record in records))
    if summary.get("country_counts") != country_counts:
        raise ValueError("summary country_counts do not match the import CSV")
    classification_counts = dict(
        Counter(code for record in records for code in record.classifications)
    )
    if summary.get("classification_counts") != classification_counts:
        raise ValueError("summary classification_counts do not match normalized CSV classes")
    source_hashes = {record.source_file_sha256 for record in records}
    if source_hashes != {summary.get("source_sha256")}:
        raise ValueError("source_file_sha256 does not match the package summary")
    versions = {record.source_version for record in records}
    if versions != {summary.get("version")}:
        raise ValueError("source_version does not match the package summary")


def load_import_package(
    csv_path: Path,
    summary_path: Path,
    *,
    original_source_path: Path,
    package_path: Path | None = None,
    expected_package_sha256: str | None = KNOWN_V18_5_PACKAGE_SHA256,
    expected_record_count: int = EXPECTED_RECORD_COUNT,
) -> DobihImportPackage:
    """Read and fully validate the import package before any database write."""
    csv_path = csv_path.resolve()
    summary_path = summary_path.resolve()
    original_source_path = original_source_path.resolve()
    package_path = package_path.resolve() if package_path else None
    if not csv_path.is_file() or not summary_path.is_file() or not original_source_path.is_file():
        raise FileNotFoundError(
            "the import CSV, summary JSON and retained original DoBIH CSV are required"
        )

    package_sha256: str | None = None
    if package_path is not None:
        package_sha256 = file_sha256(package_path)
        if expected_package_sha256 is not None and package_sha256 != expected_package_sha256:
            raise ValueError(
                f"package SHA-256 {package_sha256} does not match {expected_package_sha256}"
            )
        with zipfile.ZipFile(package_path) as archive:
            corrupt_member = archive.testzip()
            if corrupt_member is not None:
                raise ValueError(f"ZIP integrity check failed at {corrupt_member}")
            for member, extracted in (
                (csv_path.name, csv_path),
                (summary_path.name, summary_path),
            ):
                if member not in archive.namelist():
                    raise ValueError(f"package is missing {member}")
                member_sha256 = hashlib.sha256(archive.read(member)).hexdigest()
                if member_sha256 != file_sha256(extracted):
                    raise ValueError(f"extracted {member} differs from the package member")

    raw_summary = json.loads(summary_path.read_text(encoding="utf-8"))
    if not isinstance(raw_summary, dict):
        raise ValueError("summary JSON must contain an object")
    summary: dict[str, Any] = raw_summary
    original_source_sha256 = file_sha256(original_source_path)
    if original_source_sha256 != summary.get("source_sha256"):
        raise ValueError(
            "retained original DoBIH CSV SHA-256 does not match the package summary"
        )

    records: list[PreparedDobihRecord] = []
    seen_ids: set[str] = set()
    with csv_path.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if tuple(reader.fieldnames or ()) != EXPECTED_HEADERS:
            raise ValueError("import CSV headers do not match the reviewed 125-column contract")
        for row_number, raw_row in enumerate(reader, start=2):
            if any(value is None for value in raw_row.values()):
                raise ValueError(f"row {row_number}: malformed or missing CSV columns")
            row = {key: value or "" for key, value in raw_row.items()}
            record = _parse_record(row, row_number)
            if record.source_feature_id in seen_ids:
                raise ValueError(f"row {row_number}: duplicate DoBIH Number")
            seen_ids.add(record.source_feature_id)
            records.append(record)

    immutable_records = tuple(records)
    if len(immutable_records) != expected_record_count:
        raise ValueError(
            f"expected {expected_record_count} records, found {len(immutable_records)}"
        )
    _validate_summary(immutable_records, summary)

    by_id = {record.source_feature_id: record for record in immutable_records}
    grassholm = by_id.get("15584")
    if (
        grassholm is None
        or grassholm.name != "Grassholm Island"
        or grassholm.final_verification_status != "needs_review"
        or grassholm.needs_review_reason is None
    ):
        raise ValueError("DoBIH 15584 must remain Grassholm Island with needs_review status")
    carnedd = by_id.get("1965")
    if (
        carnedd is None
        or carnedd.name != "Carnedd Llewelyn"
        or carnedd.elevation_m != 1061.8
        or carnedd.needs_review_reason is None
    ):
        raise ValueError("DoBIH 1965 must retain 1061.8 m and its informational note")

    return DobihImportPackage(
        csv_path=csv_path,
        summary_path=summary_path,
        original_source_path=original_source_path,
        package_path=package_path,
        import_csv_sha256=file_sha256(csv_path),
        original_source_sha256=original_source_sha256,
        package_sha256=package_sha256,
        summary=summary,
        records=immutable_records,
    )