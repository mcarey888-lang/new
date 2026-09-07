"""Regression tests for the deterministic corrected catalogue release."""

from __future__ import annotations

import hashlib
import zipfile
from pathlib import Path

from summit_data_engine.international.package import load_catalogue_package
from summit_data_engine.international.rebuild import (
    DENALI_ROUTE_URL,
    GEONAMES_URL,
    NEW_VERSION,
    WHITNEY_ROUTE_URL,
    WIKIDATA_URL,
    rebuild_catalogue,
)

SOURCE = (
    Path(__file__).parents[2]
    / "attached_assets"
    / "0_summit-ready-international-alignment-upload_1788803262874.zip"
)


def test_rebuild_is_byte_reproducible_and_resolves_held_records(
    tmp_path: Path,
) -> None:
    first = tmp_path / "first.zip"
    second = tmp_path / "second.zip"
    first_hash = rebuild_catalogue(SOURCE, first)
    second_hash = rebuild_catalogue(SOURCE, second)
    assert first.read_bytes() == second.read_bytes()
    assert first_hash == second_hash == hashlib.sha256(first.read_bytes()).hexdigest()

    package = load_catalogue_package(first, expected_package_sha256=first_hash)
    assert package.catalogue_version == NEW_VERSION
    assert len(package.mountains) == 216
    assert all(row["source_feature_id"] != "INT-0092" for row in package.mountains)
    denali_evidence_urls = {
        row["url"]
        for row in package.evidence
        if row["mountain_source_feature_id"] == "INT-0252"
    }
    assert {WIKIDATA_URL, GEONAMES_URL, DENALI_ROUTE_URL} <= denali_evidence_urls
    whitney = next(
        row for row in package.routes if row["route_source_feature_id"] == "IR-0005"
    )
    denali = next(
        row for row in package.routes if row["route_source_feature_id"] == "IR-0007"
    )
    assert whitney["source_url"] == WHITNEY_ROUTE_URL
    assert whitney["evidence_matched"]
    assert "DISTANCE_IS_ROUND_TRIP_FROM_17_1_KM_ONE_WAY_SOURCE" in whitney["qa_flags"]
    assert denali["source_url"] == DENALI_ROUTE_URL
    assert denali["typical_duration_hours"] == 456
    assert denali["evidence_matched"]

    with zipfile.ZipFile(first) as archive:
        instructions = archive.read("complete-replit-instructions.md").decode()
        handoff = archive.read("replit-alignment-handoff.md").decode()
    assert "216 mountains with valid required geometry" in instructions
    assert "4,102 staged aliases" in instructions
    assert "489 staged evidence records" in instructions
    assert "74 of those loadable rows are `verified`; 142 remain `needs_review`." in handoff
    assert "217 mountains with valid required geometry" not in instructions
    assert "143 remain `needs_review`" not in handoff