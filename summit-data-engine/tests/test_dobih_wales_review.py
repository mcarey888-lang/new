from __future__ import annotations

import csv
import json
import zipfile
from pathlib import Path
from xml.etree import ElementTree

from summit_data_engine.dobih.wales_review import (
    NORMALIZED_HEADERS,
    SourceIdentity,
    _build_review_rows,
    _read_source,
    _summary,
    _write_csv,
)
from summit_data_engine.dobih.xlsx import write_review_workbook

SOURCE_HEADERS = [
    "Number",
    "Name",
    "Country",
    "County",
    "Topo Section",
    "Classification",
    "Metres",
    "Feet",
    "Grid ref",
    "Grid ref 10",
    "Drop",
    "Col height",
    "Latitude",
    "Longitude",
    "Xcoord",
    "Ycoord",
    "Observations",
    "Comments",
]


def identity(tmp_path: Path) -> SourceIdentity:
    zip_path = tmp_path / "hillcsv.zip"
    csv_path = tmp_path / "DoBIH_v18_5.csv"
    zip_path.write_bytes(b"zip")
    csv_path.write_text("source", encoding="utf-8")
    return SourceIdentity(
        version="18.5",
        downloaded_at_utc="2026-08-25T14:00:00+00:00",
        zip_path=zip_path,
        zip_filename="hillcsv.zip",
        zip_size_bytes=3,
        zip_sha256="a" * 64,
        csv_path=csv_path,
        csv_filename=csv_path.name,
        csv_size_bytes=6,
        csv_sha256="b" * 64,
    )


def source_row(**overrides: str) -> dict[str, str]:
    row = {
        "Number": "100",
        "Name": "Test Hill",
        "Country": "W",
        "County": "Powys",
        "Topo Section": "WM01",
        "Classification": "Tu,Sim",
        "Metres": "500.0",
        "Feet": "1640",
        "Grid ref": "SO123456",
        "Grid ref 10": "SO 12345 45678",
        "Drop": "45.6",
        "Col height": "454.4",
        "Latitude": "52.1",
        "Longitude": "-3.2",
        "Xcoord": "312345",
        "Ycoord": "245678",
        "Observations": "",
        "Comments": "",
    }
    row.update(overrides)
    return row


def test_read_source_inspects_and_preserves_all_columns(tmp_path: Path) -> None:
    source = tmp_path / "source.csv"
    with source.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=SOURCE_HEADERS)
        writer.writeheader()
        writer.writerow(source_row(Comments="  source note "))

    headers, rows = _read_source(source)

    assert headers == SOURCE_HEADERS
    assert rows[0]["Comments"] == "  source note "
    assert rows[0]["Metres"] == "500.0"


def test_wales_filter_and_normalized_fields_do_not_overwrite_source(tmp_path: Path) -> None:
    rows = [
        source_row(),
        source_row(
            Number="101",
            Name="English Hill",
            Country="E",
            Latitude="52.2",
            Longitude="-2.1",
        ),
        source_row(Number="102", Name="Whitespace code", Country=" W"),
    ]

    review = _build_review_rows(rows, identity(tmp_path))

    assert len(review) == 1
    assert review[0]["canonical_id"] == "dobih:100"
    assert review[0]["country_normalized"] == "Wales"
    assert review[0]["Metres"] == "500.0"
    assert review[0]["elevation_m_normalized"] == "500"
    assert review[0]["summit_verification_status"] == "source_backed"
    assert review[0]["gpt_review_status"] == "pending"
    assert review[0]["claude_review_status"] == "pending"
    assert review[0]["import_status"] == "not_imported"


def test_source_header_delimiter_spaces_are_normalized_but_values_are_verbatim(
    tmp_path: Path,
) -> None:
    source = tmp_path / "source.csv"
    source.write_text(
        "Number, Name, Country, Latitude, Longitude, Metres, Drop, Comments\n"
        "1,Hill,W,52.1,-3.2,400,30,  deliberate leading space\n",
        encoding="utf-8",
    )

    headers, rows = _read_source(source)

    assert headers == [
        "Number",
        "Name",
        "Country",
        "Latitude",
        "Longitude",
        "Metres",
        "Drop",
        "Comments",
    ]
    assert rows[0]["Comments"] == "  deliberate leading space"


def test_deterministic_qa_flags_without_rejecting_records(tmp_path: Path) -> None:
    rows = [
        source_row(
            Number="100",
            Name="Repeated",
            County="Herefordshire, Powys",
            Topo_Section="EC03",
            Grid_ref="BAD",
        ),
        source_row(
            Number="100",
            Name="Repeated",
            Metres="",
            Drop="-2",
            Latitude="not-a-number",
            Longitude="-3.2",
        ),
    ]
    rows[0]["Topo Section"] = rows[0].pop("Topo_Section")
    rows[0]["Grid ref"] = rows[0].pop("Grid_ref")

    review = _build_review_rows(rows, identity(tmp_path))
    first_flags = set(review[0]["qa_flags"].split(";"))
    second_flags = set(review[1]["qa_flags"].split(";"))

    assert {
        "duplicate_dobih_id",
        "duplicate_name",
        "england_wales_border_source_signal",
        "malformed_grid_reference",
    } <= first_flags
    assert {
        "duplicate_dobih_id",
        "duplicate_name",
        "missing_height",
        "negative_prominence",
        "invalid_latitude",
    } <= second_flags
    assert all(row["qa_status"] == "warning" for row in review)
    assert len(review) == 2


def test_summary_counts_classifications_missing_data_and_qa(tmp_path: Path) -> None:
    source_rows = [
        source_row(),
        source_row(
            Number="101",
            Name="Second",
            Classification="Tu",
            Metres="",
            Latitude="52.2",
            Longitude="-3.3",
        ),
        source_row(Number="102", Name="English", Country="E"),
    ]
    review = _build_review_rows(source_rows, identity(tmp_path))

    summary = _summary(identity(tmp_path), source_rows, review)

    assert summary["total_source_records"] == 3
    assert summary["total_wales_records"] == 2
    assert summary["counts_by_classification"] == {"Tu": 2, "Sim": 1}
    assert summary["missing_data_counts"]["height"] == 1  # type: ignore[index]
    assert summary["qa_records_with_warnings"] == 1


def test_csv_and_xlsx_exports_are_valid_and_contain_review_data(tmp_path: Path) -> None:
    rows = _build_review_rows([source_row()], identity(tmp_path))
    headers = [*SOURCE_HEADERS, *NORMALIZED_HEADERS]
    csv_path = tmp_path / "review.csv"
    xlsx_path = tmp_path / "review.xlsx"
    summary = {"source_version": "18.5", "total_wales_records": 1}

    _write_csv(csv_path, headers, rows)
    write_review_workbook(
        xlsx_path,
        headers,
        rows,
        summary,
        {"latitude_normalized", "longitude_normalized", "elevation_m_normalized"},
        "2026-08-25T14:00:00+00:00",
    )

    with csv_path.open(encoding="utf-8-sig", newline="") as handle:
        exported = list(csv.DictReader(handle))
    assert exported[0]["canonical_id"] == "dobih:100"
    assert exported[0]["qa_status"] == "pass"

    with zipfile.ZipFile(xlsx_path) as workbook:
        names = set(workbook.namelist())
        assert "xl/worksheets/sheet1.xml" in names
        assert "xl/worksheets/sheet2.xml" in names
        ElementTree.fromstring(workbook.read("xl/worksheets/sheet1.xml"))
        data_xml = workbook.read("xl/worksheets/sheet1.xml").decode()
        assert "dobih:100" in data_xml
        assert "<f>" not in data_xml

    json.dumps(summary)