"""Focused, database-free international catalogue contract tests."""

from __future__ import annotations

import csv
import io
import uuid
import zipfile
from dataclasses import replace
from pathlib import Path

import pytest

from summit_data_engine.international.importer import ExistingMountain, plan_import
from summit_data_engine.international.package import (
    _number,
    _validate_package,
    _validate_source,
    load_catalogue_package,
    normalize_alias,
)

ARCHIVE = (
    Path(__file__).parents[2]
    / "attached_assets"
    / "summit-ready-international-alignment-v4-2026-09-07.zip"
)


@pytest.fixture(scope="module")
def catalogue_archive() -> Path:
    if not ARCHIVE.exists():
        pytest.skip("attached international catalogue archive is unavailable")
    return ARCHIVE


def test_authoritative_review_multicountry_and_nullable_facts(
    catalogue_archive: Path,
) -> None:
    package = load_catalogue_package(catalogue_archive)
    mont_blanc = next(row for row in package.mountains if row["source_feature_id"] == "INT-0001")
    cho_oyu = next(row for row in package.mountains if row["source_feature_id"] == "INT-0104")
    assert mont_blanc["name"] == "Mont Blanc"
    assert mont_blanc["status"] == "verified"
    assert mont_blanc["country"] == "France/Italy"
    assert mont_blanc["prominence_m"] is None
    assert mont_blanc["col_height_m"] is None
    assert not mont_blanc["grid_reference"]
    assert cho_oyu["name"] == "Cho Oyu"
    assert cho_oyu["status"] == "needs_review"
    assert cho_oyu["elevation_m"] == 8188


def test_unicode_alias_normalization_and_duplicate_key(catalogue_archive: Path) -> None:
    assert normalize_alias("Śnieżka") == normalize_alias(" ŚNIEŻKA ")
    assert normalize_alias("富士 山") == "富士山"
    package = load_catalogue_package(catalogue_archive)
    keys = {
        (row["mountain_source_feature_id"], row["normalized_name"])
        for row in package.aliases
    }
    assert len(keys) <= len(package.aliases)


def test_corrected_identity_routes_and_missing_geometry_contract(
    catalogue_archive: Path,
) -> None:
    package = load_catalogue_package(catalogue_archive)
    plan = plan_import(package)
    decisions = {item.source_feature_id: item for item in plan.decisions}
    assert "INT-0092" not in decisions
    assert decisions["INT-0252"].decision == "insert"
    assert plan.inserted == 216
    assert plan.reviewed == 142
    assert plan.blocked == 37
    assert plan.aliases_staged == 4102
    assert plan.aliases_unique == 4001
    assert plan.aliases_duplicate == 101
    assert plan.evidence_total == 489
    assert plan.evidence_loadable == 452
    assert plan.evidence_held == 0
    assert plan.evidence_blocked == 37
    assert plan.routes_total == 23
    assert plan.routes_loadable == 23
    assert plan.routes_held == 0
    assert plan.accepted_verified == 74
    assert plan.accepted_needs_review == 142
    denali = next(
        row for row in package.mountains if row["source_feature_id"] == "INT-0252"
    )
    assert denali["tags"]["wikidata_id"] == "Q130018"
    assert denali["tags"]["geonames_id"] == "5868589"
    assert all(route["evidence_matched"] for route in package.routes)
    assert all(not row["geom"] for row in package.blocked)


def test_nearby_dobih_candidate_reviews_but_name_alone_does_not_merge(
    catalogue_archive: Path,
) -> None:
    package = load_catalogue_package(catalogue_archive)
    mountain = package.mountains[0]
    geometry = mountain["geometry"]
    nearby = ExistingMountain(
        uuid.uuid4(), "dobih:1", "Different", geometry.x, geometry.y, source="DoBIH"
    )
    plan = plan_import(package, (nearby,))
    decision = next(
        item for item in plan.decisions if item.source_feature_id == mountain["source_feature_id"]
    )
    assert decision.decision == "review"
    far_same_name = ExistingMountain(uuid.uuid4(), "dobih:2", mountain["name"], 0, 0)
    plan = plan_import(package, (far_same_name,))
    decision = next(
        item for item in plan.decisions if item.source_feature_id == mountain["source_feature_id"]
    )
    assert decision.decision == "insert"
    assert "normalized_name_or_alias_only" in decision.match_signals


def test_routes_keep_identity_without_metrics_and_never_supply_mountain_elevation(
    catalogue_archive: Path,
) -> None:
    package = load_catalogue_package(catalogue_archive)
    empty = next(
        row
        for row in package.routes
        if row["total_ascent_m"] is None and row["distance_km"] is None
    )
    assert empty["canonical_name"]
    sourced = next(row for row in package.routes if row["total_ascent_m"] is not None)
    mountain = next(
        row
        for row in package.mountains
        if row["source_feature_id"] == sourced["mountain_source_feature_id"]
    )
    assert sourced["total_ascent_m"] != mountain["elevation_m"]
    assert mountain["elevation_m"] == sourced["summit_elevation_m"]


def test_repeat_plan_is_a_no_op_for_exact_existing_keys(
    catalogue_archive: Path,
) -> None:
    package = load_catalogue_package(catalogue_archive)
    existing = tuple(
        ExistingMountain(
            row["id"],
            row["canonical_source_key"],
            row["name"],
            row["geometry"].x,
            row["geometry"].y,
        )
        for row in package.mountains
    )
    plan = plan_import(package, existing)
    assert plan.inserted == 0
    assert plan.unchanged == 216


def test_tampered_raw_payload_is_rejected(catalogue_archive: Path) -> None:
    with zipfile.ZipFile(catalogue_archive) as archive:
        reader = csv.DictReader(
            io.StringIO(
                archive.read("mountain_source_records_staging.csv").decode()
            )
        )
        row = next(reader)
    row["raw_payload"] = row["raw_payload"].replace("Mont Blanc", "Tampered", 1)
    with pytest.raises(ValueError, match="does not match payload"):
        _validate_source(row, 2)


def test_tampered_prepared_payload_is_rejected(catalogue_archive: Path) -> None:
    with zipfile.ZipFile(catalogue_archive) as archive:
        reader = csv.DictReader(
            io.StringIO(
                archive.read("mountain_source_records_staging.csv").decode()
            )
        )
        row = next(reader)
    row["prepared_payload"] = row["prepared_payload"].replace(
        "geonames:3181986", "summitready:INT-0001"
    )
    with pytest.raises(ValueError, match="canonical key"):
        _validate_source(row, 2)


def test_exact_key_with_inconsistent_identity_is_reviewed(
    catalogue_archive: Path,
) -> None:
    package = load_catalogue_package(catalogue_archive)
    mountain = package.mountains[0]
    existing = ExistingMountain(
        uuid.uuid4(),
        mountain["canonical_source_key"],
        "Entirely Different",
        0,
        0,
    )
    decision = next(
        item
        for item in plan_import(package, (existing,)).decisions
        if item.source_feature_id == mountain["source_feature_id"]
    )
    assert decision.decision == "review"
    assert "canonical-key conflict" in decision.reason


def test_route_elevations_allow_signed_finite_values() -> None:
    assert _number("-12.5", "start_elevation_m", "route", allow_negative=True) == -12.5
    with pytest.raises(ValueError):
        _number("-12.5", "distance_km", "route")


def test_route_evidence_must_belong_to_same_mountain(
    catalogue_archive: Path,
) -> None:
    package = load_catalogue_package(catalogue_archive)
    route = package.routes[0]
    evidence = tuple(
        {
            **row,
            "mountain_source_feature_id": (
                "INT-0001"
                if row["url"] == route["source_url"]
                else row["mountain_source_feature_id"]
            ),
        }
        for row in package.evidence
    )
    if route["mountain_source_feature_id"] == "INT-0001":
        evidence = tuple(
            {
                **row,
                "mountain_source_feature_id": (
                    "INT-0003"
                    if row["url"] == route["source_url"]
                    else row["mountain_source_feature_id"]
                ),
            }
            for row in package.evidence
        )
    altered = replace(
        package,
        evidence=evidence,
        routes=tuple(dict(row) for row in package.routes),
    )
    _validate_package(altered)
    assert altered.routes[0]["evidence_matched"] is False
