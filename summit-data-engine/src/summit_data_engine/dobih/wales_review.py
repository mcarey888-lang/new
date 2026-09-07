"""Prepare a source-preserving, review-only catalogue of Welsh DoBIH hills."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import shutil
import urllib.request
import zipfile
from collections import Counter
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path
from tempfile import mkdtemp
from typing import Any

from summit_data_engine.dobih.xlsx import write_review_workbook

SOURCE_URL = "https://www.hill-bagging.co.uk/dobih-downloads/hillcsv.zip"
SOURCE_ORGANISATION = "The Database of British and Irish Hills (DoBIH)"
LICENCE_NAME = "Creative Commons Attribution 4.0 International (CC BY 4.0)"
LICENCE_URL = "https://creativecommons.org/licenses/by/4.0/"
ATTRIBUTION_URL = "https://www.hill-bagging.co.uk/dobih"
DEFAULT_RAW_ROOT = Path("data/raw/dobih")
DEFAULT_OUTPUT_ROOT = Path("data/processed/dobih")

NORMALIZED_HEADERS = [
    "canonical_id",
    "source_dataset",
    "source_version",
    "source_url",
    "source_file_name",
    "source_file_size_bytes",
    "source_sha256",
    "source_csv_sha256",
    "source_downloaded_at_utc",
    "source_licence",
    "source_attribution",
    "country_normalized",
    "latitude_normalized",
    "longitude_normalized",
    "elevation_m_normalized",
    "prominence_m_normalized",
    "summit_verification_status",
    "gpt_review_status",
    "gpt_flags",
    "claude_review_status",
    "claude_flags",
    "discrepancy_status",
    "import_status",
    "qa_status",
    "qa_flags",
]

NUMERIC_NORMALIZED_HEADERS = {
    "source_file_size_bytes",
    "latitude_normalized",
    "longitude_normalized",
    "elevation_m_normalized",
    "prominence_m_normalized",
}

WALES_BOUNDS = {
    "min_latitude": Decimal("51.2"),
    "max_latitude": Decimal("53.5"),
    "min_longitude": Decimal("-5.6"),
    "max_longitude": Decimal("-2.4"),
}

_GRID_REF_6 = re.compile(r"^[A-Z]{2}\d{6}$")
_GRID_REF_10 = re.compile(r"^[A-Z]{2}\d{10}$")
_VERSION_MEMBER = re.compile(r"^DoBIH_v(?P<version>\d+(?:_\d+)*)\.csv$", re.IGNORECASE)
_BORDER_ENGLISH_COUNTIES = ("Cheshire", "Gloucestershire", "Herefordshire", "Shropshire")


@dataclass(frozen=True)
class SourceIdentity:
    version: str
    downloaded_at_utc: str
    zip_path: Path
    zip_filename: str
    zip_size_bytes: int
    zip_sha256: str
    csv_path: Path
    csv_filename: str
    csv_size_bytes: int
    csv_sha256: str


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while chunk := handle.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def _download_source(raw_root: Path, downloaded_at_utc: str) -> SourceIdentity:
    raw_root.mkdir(parents=True, exist_ok=True)
    temporary = raw_root / "hillcsv.zip.download"
    request = urllib.request.Request(
        SOURCE_URL,
        headers={"User-Agent": "SummitDataEngine/0.1 source-preserving importer"},
    )
    try:
        with urllib.request.urlopen(request, timeout=120) as response, temporary.open("wb") as out:
            shutil.copyfileobj(response, out, length=1024 * 1024)
        zip_sha256 = _sha256(temporary)
        with zipfile.ZipFile(temporary) as archive:
            csv_members = [
                member
                for member in archive.namelist()
                if _VERSION_MEMBER.fullmatch(Path(member).name)
            ]
            if len(csv_members) != 1:
                raise ValueError(
                    "expected exactly one versioned DoBIH CSV in hillcsv.zip; "
                    f"found {csv_members!r}"
                )
            csv_member = csv_members[0]
            match = _VERSION_MEMBER.fullmatch(Path(csv_member).name)
            if match is None:
                raise AssertionError("versioned member disappeared after validation")
            version = match.group("version").replace("_", ".")
            version_root = raw_root / f"v{version}"
            version_root.mkdir(parents=True, exist_ok=True)
            zip_path = version_root / "hillcsv.zip"
            if zip_path.exists():
                if _sha256(zip_path) != zip_sha256:
                    raise FileExistsError(
                        f"{zip_path} exists with a different hash; raw sources are immutable"
                    )
                temporary.unlink()
            else:
                temporary.replace(zip_path)
            csv_path = version_root / Path(csv_member).name
            with zipfile.ZipFile(zip_path) as preserved_archive:
                csv_bytes = preserved_archive.read(csv_member)
            csv_sha256 = hashlib.sha256(csv_bytes).hexdigest()
            if csv_path.exists():
                if _sha256(csv_path) != csv_sha256:
                    raise FileExistsError(
                        f"{csv_path} exists with a different hash; raw sources are immutable"
                    )
            else:
                csv_path.write_bytes(csv_bytes)
    except Exception:
        temporary.unlink(missing_ok=True)
        raise

    return SourceIdentity(
        version=version,
        downloaded_at_utc=downloaded_at_utc,
        zip_path=zip_path,
        zip_filename="hillcsv.zip",
        zip_size_bytes=zip_path.stat().st_size,
        zip_sha256=zip_sha256,
        csv_path=csv_path,
        csv_filename=csv_path.name,
        csv_size_bytes=csv_path.stat().st_size,
        csv_sha256=csv_sha256,
    )


def _read_source(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle, skipinitialspace=False)
        if reader.fieldnames is None:
            raise ValueError("DoBIH CSV has no header")
        raw_headers = reader.fieldnames
        headers = [header.strip() for header in raw_headers]
        if len(headers) != len(set(headers)):
            raise ValueError("DoBIH CSV contains duplicate column names")
        rows: list[dict[str, str]] = []
        for source_row in reader:
            row = {
                header: (source_row.get(original_header) or "")
                for header, original_header in zip(headers, raw_headers, strict=True)
            }
            rows.append(row)
    required = {"Number", "Name", "Country", "Latitude", "Longitude", "Metres", "Drop"}
    missing = required.difference(headers)
    if missing:
        raise ValueError(f"DoBIH CSV is missing required columns: {sorted(missing)}")
    return headers, rows


def _decimal(value: str) -> Decimal | None:
    stripped = value.strip()
    if not stripped:
        return None
    try:
        number = Decimal(stripped)
    except InvalidOperation:
        return None
    return number if number.is_finite() else None


def _normalized_decimal(value: str) -> str:
    number = _decimal(value)
    if number is None:
        return ""
    rendered = format(number.normalize(), "f")
    return "0" if rendered in {"-0", ""} else rendered


def _border_source_signal(row: Mapping[str, str]) -> bool:
    county = row.get("County", "")
    topo_section = row.get("Topo Section", "").strip().upper()
    combined_notes = " ".join(
        row.get(field, "") for field in ("Name", "Observations", "Comments")
    ).casefold()
    return (
        any(county_name.casefold() in county.casefold() for county_name in _BORDER_ENGLISH_COUNTIES)
        or topo_section.startswith("EC")
        or ("england" in combined_notes and "wales" in combined_notes)
    )


def _duplicate_values(
    rows: Sequence[Mapping[str, str]],
    key: str,
    transform: Any | None = None,
) -> set[str]:
    counts: Counter[str] = Counter()
    for row in rows:
        value = row.get(key, "").strip()
        if value:
            counts[transform(value) if transform else value] += 1
    return {value for value, count in counts.items() if count > 1}


def _coordinate_key(row: Mapping[str, str]) -> str:
    latitude = _normalized_decimal(row.get("Latitude", ""))
    longitude = _normalized_decimal(row.get("Longitude", ""))
    return f"{latitude},{longitude}" if latitude and longitude else ""


def _record_flags(
    row: Mapping[str, str],
    duplicate_ids: set[str],
    duplicate_names: set[str],
    duplicate_coordinates: set[str],
) -> list[str]:
    flags: list[str] = []
    hill_id = row.get("Number", "").strip()
    if not hill_id:
        flags.append("missing_dobih_id")
    elif not hill_id.isdigit():
        flags.append("invalid_dobih_id")
    elif hill_id in duplicate_ids:
        flags.append("duplicate_dobih_id")

    name = row.get("Name", "").strip()
    if not name:
        flags.append("missing_name")
    elif name.casefold() in duplicate_names:
        flags.append("duplicate_name")

    latitude_raw = row.get("Latitude", "")
    longitude_raw = row.get("Longitude", "")
    latitude = _decimal(latitude_raw)
    longitude = _decimal(longitude_raw)
    if not latitude_raw.strip() or not longitude_raw.strip():
        flags.append("missing_coordinates")
    else:
        if latitude is None:
            flags.append("invalid_latitude")
        elif not Decimal("-90") <= latitude <= Decimal("90"):
            flags.append("latitude_out_of_range")
        if longitude is None:
            flags.append("invalid_longitude")
        elif not Decimal("-180") <= longitude <= Decimal("180"):
            flags.append("longitude_out_of_range")
        if latitude is not None and longitude is not None and not (
            WALES_BOUNDS["min_latitude"] <= latitude <= WALES_BOUNDS["max_latitude"]
            and WALES_BOUNDS["min_longitude"]
            <= longitude
            <= WALES_BOUNDS["max_longitude"]
        ):
            flags.append("coordinates_outside_plausible_wales_bounds")

    coordinate_key = _coordinate_key(row)
    if coordinate_key and coordinate_key in duplicate_coordinates:
        flags.append("duplicate_coordinates")

    height_raw = row.get("Metres", "")
    height = _decimal(height_raw)
    if not height_raw.strip():
        flags.append("missing_height")
    elif height is None:
        flags.append("invalid_height")
    elif height <= 0:
        flags.append("non_positive_height")

    prominence_raw = row.get("Drop", "")
    prominence = _decimal(prominence_raw)
    if prominence_raw.strip() and prominence is None:
        flags.append("invalid_prominence")
    elif prominence is not None and prominence < 0:
        flags.append("negative_prominence")

    for field in ("Feet", "Col height", "Xcoord", "Ycoord"):
        value = row.get(field, "")
        if value.strip() and _decimal(value) is None:
            flags.append(f"invalid_numeric:{field}")

    grid_ref = re.sub(r"\s+", "", row.get("Grid ref", "").upper())
    if grid_ref and _GRID_REF_6.fullmatch(grid_ref) is None:
        flags.append("malformed_grid_reference")
    grid_ref_10 = re.sub(r"\s+", "", row.get("Grid ref 10", "").upper())
    if grid_ref_10 and _GRID_REF_10.fullmatch(grid_ref_10) is None:
        flags.append("malformed_grid_reference_10")

    if _border_source_signal(row):
        flags.append("england_wales_border_source_signal")
    return flags


def _height_band(value: str) -> str:
    height = _decimal(value)
    if height is None:
        return "missing_or_invalid"
    if height < 200:
        return "under_200_m"
    if height < 400:
        return "200_to_399_9_m"
    if height < 600:
        return "400_to_599_9_m"
    if height < 800:
        return "600_to_799_9_m"
    return "800_m_and_over"


def _classification_counts(rows: Iterable[Mapping[str, str]]) -> dict[str, int]:
    counts: Counter[str] = Counter()
    for row in rows:
        for classification in row.get("Classification", "").split(","):
            classification = classification.strip()
            if classification:
                counts[classification] += 1
    return dict(sorted(counts.items(), key=lambda item: (-item[1], item[0])))


def _build_review_rows(
    source_rows: Sequence[dict[str, str]], identity: SourceIdentity
) -> list[dict[str, str]]:
    wales_rows = [row for row in source_rows if row.get("Country", "") == "W"]
    duplicate_ids = _duplicate_values(wales_rows, "Number")
    duplicate_names = _duplicate_values(wales_rows, "Name", str.casefold)
    coordinate_counts = Counter(_coordinate_key(row) for row in wales_rows)
    duplicate_coordinates = {
        key for key, count in coordinate_counts.items() if key and count > 1
    }

    review_rows: list[dict[str, str]] = []
    for source_row in wales_rows:
        flags = _record_flags(
            source_row, duplicate_ids, duplicate_names, duplicate_coordinates
        )
        hill_id = source_row.get("Number", "").strip()
        normalized = {
            "canonical_id": f"dobih:{hill_id}" if hill_id else "",
            "source_dataset": "DoBIH",
            "source_version": identity.version,
            "source_url": SOURCE_URL,
            "source_file_name": identity.csv_filename,
            "source_file_size_bytes": str(identity.csv_size_bytes),
            "source_sha256": identity.zip_sha256,
            "source_csv_sha256": identity.csv_sha256,
            "source_downloaded_at_utc": identity.downloaded_at_utc,
            "source_licence": f"{LICENCE_NAME} ({LICENCE_URL})",
            "source_attribution": (
                f"The Database of British and Irish Hills v{identity.version}; "
                f"{ATTRIBUTION_URL}"
            ),
            "country_normalized": "Wales",
            "latitude_normalized": _normalized_decimal(source_row.get("Latitude", "")),
            "longitude_normalized": _normalized_decimal(source_row.get("Longitude", "")),
            "elevation_m_normalized": _normalized_decimal(source_row.get("Metres", "")),
            "prominence_m_normalized": _normalized_decimal(source_row.get("Drop", "")),
            "summit_verification_status": "source_backed",
            "gpt_review_status": "pending",
            "gpt_flags": "",
            "claude_review_status": "pending",
            "claude_flags": "",
            "discrepancy_status": "pending",
            "import_status": "not_imported",
            "qa_status": "warning" if flags else "pass",
            "qa_flags": ";".join(flags),
        }
        review_rows.append(source_row | normalized)
    return review_rows


def _summary(
    identity: SourceIdentity,
    source_rows: Sequence[Mapping[str, str]],
    review_rows: Sequence[Mapping[str, str]],
) -> dict[str, object]:
    qa_counts: Counter[str] = Counter()
    for row in review_rows:
        qa_counts.update(flag for flag in row.get("qa_flags", "").split(";") if flag)
    height_bands = Counter(_height_band(row.get("Metres", "")) for row in review_rows)
    return {
        "source_organisation": SOURCE_ORGANISATION,
        "source_version": identity.version,
        "source_url": SOURCE_URL,
        "source_file_name": identity.csv_filename,
        "source_zip_filename": identity.zip_filename,
        "source_zip_size_bytes": identity.zip_size_bytes,
        "source_csv_size_bytes": identity.csv_size_bytes,
        "source_sha256": identity.zip_sha256,
        "source_csv_sha256": identity.csv_sha256,
        "downloaded_at_utc": identity.downloaded_at_utc,
        "licence": LICENCE_NAME,
        "licence_url": LICENCE_URL,
        "preferred_attribution": (
            f"The Database of British and Irish Hills v{identity.version}; "
            f"{ATTRIBUTION_URL}"
        ),
        "filter_method": "Exact match on the source DoBIH Country field: Country == 'W'.",
        "source_column_count": len(source_rows[0]) if source_rows else 0,
        "source_header_label_normalization": (
            "Leading/trailing delimiter-format spaces are removed from column labels only; "
            "source cell values are preserved verbatim."
        ),
        "total_source_records": len(source_rows),
        "total_wales_records": len(review_rows),
        "counts_by_classification": _classification_counts(review_rows),
        "counts_by_height_band": dict(sorted(height_bands.items())),
        "missing_data_counts": {
            "dobih_id": sum(not row.get("Number", "").strip() for row in review_rows),
            "name": sum(not row.get("Name", "").strip() for row in review_rows),
            "coordinates": sum(
                not row.get("Latitude", "").strip() or not row.get("Longitude", "").strip()
                for row in review_rows
            ),
            "height": sum(not row.get("Metres", "").strip() for row in review_rows),
            "prominence": sum(not row.get("Drop", "").strip() for row in review_rows),
        },
        "qa_records_passing": sum(row.get("qa_status") == "pass" for row in review_rows),
        "qa_records_with_warnings": sum(
            row.get("qa_status") == "warning" for row in review_rows
        ),
        "qa_flag_counts": dict(sorted(qa_counts.items())),
        "review_state": "Pending independent GPT and Claude review; not imported.",
    }


def _write_csv(path: Path, headers: Sequence[str], rows: Iterable[Mapping[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".part")
    with temporary.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=headers, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)
    temporary.replace(path)


def _write_readme(path: Path, identity: SourceIdentity, summary: Mapping[str, object]) -> None:
    content = f"""# Wales DoBIH review dataset

## Scope

This is a read-only preparation export. It has not been inserted into PostGIS or
the Summit Ready production database. It contains no AI-generated or AI-corrected
geographic facts. All records remain `source_backed`, `not_imported`, and pending
independent GPT and Claude review.

## Source and attribution

- Source organisation: {SOURCE_ORGANISATION}
- Release: v{identity.version}
- Download URL: {SOURCE_URL}
- Retrieved: {identity.downloaded_at_utc}
- Preserved ZIP: `{identity.zip_path}`
- ZIP bytes: {identity.zip_size_bytes}
- ZIP SHA-256: `{identity.zip_sha256}`
- Contained CSV: `{identity.csv_filename}`
- CSV bytes: {identity.csv_size_bytes}
- CSV SHA-256: `{identity.csv_sha256}`
- Licence: [{LICENCE_NAME}]({LICENCE_URL})
- Preferred attribution: The Database of British and Irish Hills v{identity.version},
  linked to {ATTRIBUTION_URL}

The underlying summit dataset was created and is maintained by DoBIH, not Summit Ready.

## Wales filtering

The CSV schema was inspected at runtime. Every source record whose exact `Country`
value is `W` is included. No elevation, classification, popularity, or list-membership
threshold is applied. This produced {summary["total_wales_records"]} Welsh records from
{summary["total_source_records"]} total source records. England/Wales border records
remain included whenever DoBIH assigns `Country == W`.

## Field handling

All {len(_read_source(identity.csv_path)[0])} source columns are retained in source
order. DoBIH's delimiter-format spaces around CSV header labels are removed so labels
such as ` Name` are exported as `Name`; source cell values themselves are preserved
verbatim. Separate normalized and review columns are appended. Blank source values
remain blank; no replacement values are fabricated. `canonical_id` is
`dobih:<Number>`.

## Deterministic QA

QA adds flags but never rejects or edits a source record. Checks cover missing,
duplicate, or invalid IDs; missing/duplicate names; coordinate presence and numeric
ranges; conservative plausible-Wales bounds (latitude 51.2–53.5, longitude -5.6–-2.4);
missing, invalid, or non-positive heights; invalid or negative prominence; invalid core
numeric fields; exact duplicate coordinates; malformed 6- and 10-figure OS grid
references; and source-backed England/Wales border signals.

A border signal is raised only when the DoBIH row itself names an adjacent English
county, uses an `EC` topographic section, or explicitly mentions both England and Wales
in its name/notes. It is a review flag, not a correction or exclusion.

## Deliverables

- `wales_dobih_full.csv`: all source and normalized review fields.
- `wales_dobih_review.xlsx`: the same records with filters, frozen headers, warning
  highlighting, and a summary sheet.
- `wales_dobih_summary.json`: source identity, counts, missing data, and QA totals.
- `wales_dobih_discrepancies.csv`: only records with deterministic QA warnings.
- `README_WALES_REVIEW.md`: this document.
"""
    path.write_text(content, encoding="utf-8")


def prepare_wales_review(
    raw_root: Path = DEFAULT_RAW_ROOT,
    output_root: Path = DEFAULT_OUTPUT_ROOT,
    downloaded_at_utc: str | None = None,
) -> dict[str, object]:
    """Download the current DoBIH CSV and create the Wales review package."""
    retrieved = downloaded_at_utc or datetime.now(UTC).replace(microsecond=0).isoformat()
    identity = _download_source(raw_root, retrieved)
    source_headers, source_rows = _read_source(identity.csv_path)
    review_rows = _build_review_rows(source_rows, identity)
    summary = _summary(identity, source_rows, review_rows)
    output_directory = output_root / f"v{identity.version}" / "wales"
    headers = [*source_headers, *NORMALIZED_HEADERS]
    filenames = {
        "full_csv": "wales_dobih_full.csv",
        "review_xlsx": "wales_dobih_review.xlsx",
        "summary_json": "wales_dobih_summary.json",
        "discrepancies_csv": "wales_dobih_discrepancies.csv",
        "readme": "README_WALES_REVIEW.md",
    }
    outputs = {key: output_directory / filename for key, filename in filenames.items()}

    if output_directory.exists():
        if not all(path.is_file() for path in outputs.values()):
            raise FileExistsError(
                f"{output_directory} is an incomplete review package; inspect it manually"
            )
        existing_summary = json.loads(outputs["summary_json"].read_text(encoding="utf-8"))
        if existing_summary.get("source_sha256") != identity.zip_sha256:
            raise FileExistsError(
                f"{output_directory} belongs to a different source hash; "
                "review packages are immutable"
            )
        summary = existing_summary
    else:
        version_output_root = output_directory.parent
        version_output_root.mkdir(parents=True, exist_ok=True)
        staging_directory = Path(
            mkdtemp(prefix=".wales-build-", dir=version_output_root)
        )
        staging_outputs = {
            key: staging_directory / filename for key, filename in filenames.items()
        }
        try:
            _write_csv(staging_outputs["full_csv"], headers, review_rows)
            _write_csv(
                staging_outputs["discrepancies_csv"],
                headers,
                (row for row in review_rows if row["qa_status"] == "warning"),
            )
            staging_outputs["summary_json"].write_text(
                json.dumps(summary, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            write_review_workbook(
                staging_outputs["review_xlsx"],
                headers,
                review_rows,
                summary,
                NUMERIC_NORMALIZED_HEADERS,
                retrieved,
            )
            _write_readme(staging_outputs["readme"], identity, summary)
            staging_directory.replace(output_directory)
        except Exception:
            shutil.rmtree(staging_directory, ignore_errors=True)
            raise

    return {
        "identity": identity,
        "summary": summary,
        "outputs": outputs,
        "highest_20": sorted(
            review_rows,
            key=lambda row: _decimal(row.get("Metres", "")) or Decimal("-Infinity"),
            reverse=True,
        )[:20],
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--raw-root", type=Path, default=DEFAULT_RAW_ROOT)
    parser.add_argument("--output-root", type=Path, default=DEFAULT_OUTPUT_ROOT)
    args = parser.parse_args(argv)
    result = prepare_wales_review(args.raw_root, args.output_root)
    identity = result["identity"]
    if not isinstance(identity, SourceIdentity):
        raise TypeError("unexpected source identity")
    outputs = result["outputs"]
    if not isinstance(outputs, Mapping):
        raise TypeError("unexpected output paths")
    print(
        json.dumps(
            {
                "version": identity.version,
                "summary": result["summary"],
                "outputs": {
                    str(key): str(value) for key, value in outputs.items()
                },
                "highest_20": result["highest_20"],
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0