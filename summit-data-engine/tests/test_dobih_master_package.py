from __future__ import annotations

import csv
import hashlib
import json
import zipfile
from collections import Counter
from pathlib import Path

import pytest

from summit_data_engine.dobih.master_package import (
    DOBIH_SOURCE_HEADERS,
    EXPECTED_HEADERS,
    PREPARED_HEADERS,
    load_import_package,
)

ORIGINAL_SOURCE_BYTES = b"retained original DoBIH source fixture\n"
SOURCE_HASH = hashlib.sha256(ORIGINAL_SOURCE_BYTES).hexdigest()


def _row(
    source_id: str,
    name: str,
    *,
    elevation: str,
    prominence: str,
    col_height: str,
    classifications: str,
    final_status: str,
    qa_status: str,
    qa_flags: str,
    reason: str,
) -> dict[str, str]:
    row = {header: "" for header in EXPECTED_HEADERS}
    row.update(
        {
            "Number": source_id,
            "Name": name,
            "Region": "Test region",
            "County": "Test county",
            "Classification": classifications,
            "Metres": elevation,
            "Drop": prominence,
            "Col height": col_height,
            "Grid ref": "SH123456",
            "Feature": "rock",
            "Country": "W",
            "Latitude": "53.1",
            "Longitude": "-3.9",
            "summit_ready_canonical_id": f"dobih:{source_id}",
            "country_normalized": "Wales",
            "latitude_normalized": "53.1",
            "longitude_normalized": "-3.9",
            "elevation_m_normalized": elevation,
            "prominence_m_normalized": prominence,
            "col_height_m_normalized": col_height,
            "source_dataset": "Database of British and Irish Hills (DoBIH)",
            "source_version": "v18.5",
            "source_release_date": "2026-07-26",
            "source_file_sha256": SOURCE_HASH,
            "source_license": "CC BY 4.0",
            "source_attribution": "DoBIH v18.5 test attribution",
            "source_trust": "trusted_source",
            "final_verification_status": final_status,
            "needs_review_reason": reason,
            "qa_status": qa_status,
            "qa_flags": qa_flags,
            "data_priority": "1",
            "ai_fallback_allowed": "true",
        }
    )
    return row


def _valid_rows() -> list[dict[str, str]]:
    return [
        _row(
            "15584",
            "Grassholm Island",
            elevation="42",
            prominence="42",
            col_height="0",
            classifications="0, SIB",
            final_status="needs_review",
            qa_status="review",
            qa_flags="known_wales_coordinate_review",
            reason="Preserve source coordinates pending targeted review.",
        ),
        _row(
            "1965",
            "Carnedd Llewelyn",
            elevation="1061.8",
            prominence="747.5",
            col_height="314.3",
            classifications="Ma,F,Sim",
            final_status="trusted_source",
            qa_status="info",
            qa_flags="known_wales_recent_revision_info",
            reason="INFO: retain the DoBIH 1061.8 m value.",
        ),
    ]


def _write_package(
    tmp_path: Path,
    rows: list[dict[str, str]],
) -> tuple[Path, Path, Path, Path]:
    original_source_path = tmp_path / "DoBIH_v18_5.csv"
    original_source_path.write_bytes(ORIGINAL_SOURCE_BYTES)
    csv_path = tmp_path / "dobih_v18_5_full_import_ready.csv"
    with csv_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=EXPECTED_HEADERS)
        writer.writeheader()
        writer.writerows(rows)
    country_counts = dict(Counter(row["country_normalized"] for row in rows))
    classification_counts = dict(
        Counter(
            code
            for row in rows
            for item in row["Classification"].split(",")
            if (code := item.strip())
        )
    )
    summary = {
        "version": "v18.5",
        "source_sha256": SOURCE_HASH,
        "total_records": len(rows),
        "country_counts": country_counts,
        "classification_counts": classification_counts,
    }
    summary_path = tmp_path / "dobih_v18_5_full_import_summary.json"
    summary_path.write_text(json.dumps(summary), encoding="utf-8")
    zip_path = tmp_path / "master.zip"
    with zipfile.ZipFile(zip_path, "w") as archive:
        archive.write(csv_path, csv_path.name)
        archive.write(summary_path, summary_path.name)
    return csv_path, summary_path, original_source_path, zip_path


def test_load_import_package_preserves_source_and_normalizes_classes(tmp_path: Path) -> None:
    csv_path, summary_path, original_source_path, zip_path = _write_package(
        tmp_path, _valid_rows()
    )

    package = load_import_package(
        csv_path,
        summary_path,
        original_source_path=original_source_path,
        package_path=zip_path,
        expected_package_sha256=None,
        expected_record_count=2,
    )

    grassholm, carnedd = package.records
    assert package.import_csv_sha256
    assert grassholm.raw_payload.keys() == set(DOBIH_SOURCE_HEADERS)
    assert grassholm.prepared_payload.keys() == set(PREPARED_HEADERS)
    assert grassholm.classifications == ("0", "SIB")
    assert grassholm.final_verification_status == "needs_review"
    assert carnedd.elevation_m == 1061.8
    assert carnedd.prominence_m == 747.5
    assert carnedd.col_height_m == 314.3


def test_rejects_duplicate_dobih_number(tmp_path: Path) -> None:
    rows = _valid_rows()
    duplicate = dict(rows[1])
    duplicate["Number"] = "15584"
    duplicate["summit_ready_canonical_id"] = "dobih:15584"
    csv_path, summary_path, original_source_path, zip_path = _write_package(
        tmp_path, [*rows, duplicate]
    )

    with pytest.raises(ValueError, match="duplicate DoBIH Number"):
        load_import_package(
            csv_path,
            summary_path,
            original_source_path=original_source_path,
            package_path=zip_path,
            expected_package_sha256=None,
            expected_record_count=3,
        )


def test_rejects_prepared_height_that_changes_metres(tmp_path: Path) -> None:
    rows = _valid_rows()
    rows[1]["elevation_m_normalized"] = "1064"
    csv_path, summary_path, original_source_path, zip_path = _write_package(tmp_path, rows)

    with pytest.raises(ValueError, match="normalized elevation changed"):
        load_import_package(
            csv_path,
            summary_path,
            original_source_path=original_source_path,
            package_path=zip_path,
            expected_package_sha256=None,
            expected_record_count=2,
        )


def test_rejects_grassholm_without_review_status(tmp_path: Path) -> None:
    rows = _valid_rows()
    rows[0]["final_verification_status"] = "trusted_source"
    csv_path, summary_path, original_source_path, zip_path = _write_package(tmp_path, rows)

    with pytest.raises(ValueError, match="Grassholm Island"):
        load_import_package(
            csv_path,
            summary_path,
            original_source_path=original_source_path,
            package_path=zip_path,
            expected_package_sha256=None,
            expected_record_count=2,
        )


def test_rejects_substituted_original_source_even_when_package_is_self_consistent(
    tmp_path: Path,
) -> None:
    csv_path, summary_path, original_source_path, zip_path = _write_package(
        tmp_path, _valid_rows()
    )
    original_source_path.write_bytes(b"substituted source with a different hash\n")

    with pytest.raises(ValueError, match="original DoBIH CSV SHA-256"):
        load_import_package(
            csv_path,
            summary_path,
            original_source_path=original_source_path,
            package_path=zip_path,
            expected_package_sha256=None,
            expected_record_count=2,
        )