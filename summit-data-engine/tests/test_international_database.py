"""Opt-in transactional integration checks for the international importer."""

from __future__ import annotations

import os
import uuid
from datetime import date
from pathlib import Path

import pytest
from shapely.geometry import Point  # type: ignore[import-untyped]
from sqlalchemy import select
from sqlalchemy.orm import Session

from summit_data_engine.db import create_database_engine
from summit_data_engine.db.models import Mountain
from summit_data_engine.international.importer import import_package
from summit_data_engine.international.package import CataloguePackage
from summit_data_engine.util.provenance import canonical_json_sha256

pytestmark = pytest.mark.database


def _tiny_package(path: Path) -> CataloguePackage:
    feature_id = "INT-9001"
    version = "international-test-v1"
    mountain_id = uuid.uuid4()
    geometry = Point(-3.0, 52.0)
    raw = {
        "mountain_id": feature_id,
        "canonical_name": "Transaction Test Summit",
        "countries": "Test",
        "geonames_id": "",
        "wikidata_id": "",
    }
    prepared = {
        "canonical_source_key": f"summitready:{feature_id}",
        "verification_status": "verified_authoritative",
    }
    mountain = {
        "id": mountain_id,
        "source_feature_id": feature_id,
        "canonical_source_key": f"summitready:{feature_id}",
        "name": raw["canonical_name"],
        "status": "verified",
        "geometry": geometry,
        "tags": {"catalogue_id": feature_id},
        "provenance_version": version,
        "country": "Test",
        "region": "",
        "area": "",
        "county": "",
        "elevation_m": 100.0,
        "prominence_m": None,
        "col_height_m": None,
        "grid_reference": "",
        "summit_feature": "",
    }
    source = {
        "mountain_source_feature_id": feature_id,
        "source_dataset": "Summit Ready International Mountain Catalogue",
        "source_version": version,
        "source_release_date": date.today().isoformat(),
        "source_file_sha256": "1" * 64,
        "source_license": "test",
        "source_attribution": "test",
        "source_trust": "trusted_source",
        "final_verification_status": "trusted_source",
        "needs_review_reason": "",
        "qa_status": "pass",
        "qa_flags": [],
        "data_priority": 1,
        "ai_fallback_allowed": False,
        "name": mountain["name"],
        "country": "Test",
        "region": "",
        "area": "",
        "county": "",
        "elevation_m": 100.0,
        "prominence_m": None,
        "col_height_m": None,
        "grid_reference": "",
        "summit_feature": "",
        "geometry": geometry,
        "raw_payload": raw,
        "prepared_payload": prepared,
        "import_payload_sha256": canonical_json_sha256(
            {"raw": raw, "prepared": prepared}
        ),
    }
    evidence_id = uuid.uuid4()
    evidence = {
        "id": evidence_id,
        "mountain_source_feature_id": feature_id,
        "source_key": f"test:{feature_id}",
        "version": version,
        "publisher": "Test publisher",
        "title": "Test route identity",
        "url": "https://example.test/route",
        "rights_classification": "factual_identity_only",
        "rights_statement": "test",
        "geometry_reuse_allowed": "false",
        "factual_anchors": ["route_identity"],
        "retrieved_at": "2026-01-01T00:00:00Z",
    }
    route = {
        "route_source_feature_id": "IR-9001",
        "mountain_source_feature_id": feature_id,
        "requested_name": "Identity-only route",
        "canonical_name": "Identity-only route",
        "aliases": [],
        "start_name": "",
        "start_elevation_m": None,
        "summit_elevation_m": None,
        "total_ascent_m": None,
        "distance_km": None,
        "typical_duration_hours": None,
        "status": "needs_review",
        "source_url": evidence["url"],
        "qa_flags": [],
        "provenance_version": version,
        "evidence_matched": True,
    }
    return CataloguePackage(
        path,
        uuid.uuid4().hex * 2,
        version,
        {},
        (mountain,),
        (),
        (source,),
        (),
        (evidence,),
        (route,),
    )


@pytest.fixture
def database_session() -> Session:
    if os.environ.get("RUN_INTERNATIONAL_DATABASE_TESTS") != "1":
        pytest.skip("set RUN_INTERNATIONAL_DATABASE_TESTS=1 after migration 0006")
    url = os.environ.get("ENGINE_DATABASE_URL")
    if not url:
        pytest.skip("ENGINE_DATABASE_URL is required")
    engine = create_database_engine()
    connection = engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection)
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()
        engine.dispose()


def test_transaction_rollback_and_repeat_import_noop(
    database_session: Session,
    tmp_path: Path,
) -> None:
    archive = tmp_path / "tiny.zip"
    archive.write_bytes(b"test")
    package = _tiny_package(archive)
    nested = database_session.begin_nested()
    first = import_package(database_session, package)
    mountain = database_session.scalar(
        select(Mountain).where(Mountain.source_feature_id == "INT-9001")
    )
    assert mountain is not None
    assert mountain.elevation_m == 100
    second = import_package(database_session, package)
    assert first.inserted == 1
    assert second.inserted == 0
    assert second.unchanged >= 2
    assert mountain.elevation_m == 100
    nested.rollback()
    assert database_session.scalar(
        select(Mountain).where(Mountain.source_feature_id == "INT-9001")
    ) is None
