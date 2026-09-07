from __future__ import annotations

import os
from dataclasses import replace
from datetime import date
from pathlib import Path

import pytest
from sqlalchemy import select

from summit_data_engine.db import (
    Mountain,
    MountainSourceRecord,
    SourceBundle,
    create_database_engine,
    create_session_factory,
)
from summit_data_engine.dobih import importer as importer_module
from summit_data_engine.dobih.importer import (
    DEFAULT_CSV_PATH,
    DEFAULT_ORIGINAL_SOURCE_PATH,
    DEFAULT_SUMMARY_PATH,
    DEFAULT_ZIP_PATH,
    ImportValidationError,
    import_and_validate,
    import_package,
)
from summit_data_engine.dobih.master_package import DobihImportPackage, load_import_package
from summit_data_engine.dobih.reporting import run_benchmarks, validate_database
from summit_data_engine.util.provenance import canonical_json_sha256

pytestmark = [
    pytest.mark.database,
    pytest.mark.skipif(
        os.getenv("RUN_DOBIH_DATABASE_TESTS") != "1",
        reason="set RUN_DOBIH_DATABASE_TESTS=1 for the explicit engine database check",
    ),
]


@pytest.fixture(scope="module")
def package() -> DobihImportPackage:
    return load_import_package(
        Path(DEFAULT_CSV_PATH),
        Path(DEFAULT_SUMMARY_PATH),
        original_source_path=Path(DEFAULT_ORIGINAL_SOURCE_PATH),
        package_path=Path(DEFAULT_ZIP_PATH),
    )


def _later_release(package: DobihImportPackage) -> DobihImportPackage:
    original = next(record for record in package.records if record.source_feature_id == "1965")
    raw_payload = dict(original.raw_payload)
    raw_payload["Metres"] = "1062.0"
    prepared_payload = dict(original.prepared_payload)
    prepared_payload.update(
        {
            "elevation_m_normalized": "1062",
            "source_version": "v18.6-test",
            "source_release_date": "2027-01-01",
            "source_file_sha256": "e" * 64,
        }
    )
    later = replace(
        original,
        source_version="v18.6-test",
        source_release_date=date(2027, 1, 1),
        source_file_sha256="e" * 64,
        elevation_m=1062.0,
        raw_payload=raw_payload,
        prepared_payload=prepared_payload,
        import_payload_sha256=canonical_json_sha256(
            {"raw": raw_payload, "prepared": prepared_payload}
        ),
    )
    return DobihImportPackage(
        csv_path=package.csv_path,
        summary_path=package.summary_path,
        original_source_path=package.original_source_path,
        package_path=None,
        import_csv_sha256="f" * 64,
        original_source_sha256="e" * 64,
        package_sha256=None,
        summary={
            "source_sha256": "e" * 64,
            "country_counts": {"Wales": 1},
            "classification_counts": {
                code: 1 for code in later.classifications
            },
        },
        records=(later,),
    )


def test_imported_release_counts_provenance_spatial_queries_and_benchmarks(
    package: DobihImportPackage,
) -> None:
    sessions = create_session_factory(create_database_engine())
    with sessions() as session:
        validation = validate_database(session, package)
        benchmarks = run_benchmarks(session, "v18.5")

    assert validation["ready"], validation["errors"]
    assert validation["migration_revision"] == "0006_international_catalogue"
    assert validation["counts"]["source_records"] == 21_576
    assert validation["counts"]["invalid_spatial_records"] == 0
    assert benchmarks["exact_id_lookup"]["result"]["source_feature_id"] == "1965"
    assert len(benchmarks["nearest_hill"]["results"]) == 5
    lookup_by_name = {
        lookup["requested_name"]: lookup
        for lookup in benchmarks["name_search"]["lookups"]
    }
    assert lookup_by_name["Tryfan"]["result"]["dobih_id"] == "1977"
    assert lookup_by_name["Musbury Tor"]["found"] is False


def test_repeat_import_is_entirely_unchanged(package: DobihImportPackage) -> None:
    sessions = create_session_factory(create_database_engine())
    with sessions.begin() as session:
        counters = import_package(session, package)
        assert counters.source_records_inserted == 0
        assert counters.source_records_unchanged == 21_576
        assert counters.mountains_inserted == 0
        assert counters.mountains_updated == 0
        assert counters.mountains_unchanged == 21_576
        assert counters.classifications_inserted == 0
        assert counters.classifications_unchanged == 33_369


def test_later_release_keeps_v18_5_snapshot_query_stable(
    package: DobihImportPackage,
) -> None:
    sessions = create_session_factory(create_database_engine())
    later_package = _later_release(package)
    with sessions() as session:
        transaction = session.begin()
        import_package(session, later_package)
        old_height = session.scalar(
            select(MountainSourceRecord.elevation_m).where(
                MountainSourceRecord.source_version == "v18.5",
                MountainSourceRecord.source_feature_id == "1965",
            )
        )
        new_height = session.scalar(
            select(MountainSourceRecord.elevation_m).where(
                MountainSourceRecord.source_version == "v18.6-test",
                MountainSourceRecord.source_feature_id == "1965",
            )
        )
        current_height = session.scalar(
            select(Mountain.elevation_m).where(
                Mountain.canonical_source_key == "dobih:1965"
            )
        )
        assert old_height == 1061.8
        assert new_height == 1062.0
        assert current_height == 1062.0
        transaction.rollback()

    with sessions() as session:
        assert session.scalar(
            select(MountainSourceRecord.id).where(
                MountainSourceRecord.source_version == "v18.6-test"
            )
        ) is None
        assert session.scalar(
            select(Mountain.elevation_m).where(
                Mountain.canonical_source_key == "dobih:1965"
            )
        ) == 1061.8


def test_failed_validation_rolls_back_bundle_release_and_projection(
    package: DobihImportPackage,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    sessions = create_session_factory(create_database_engine())
    later_package = _later_release(package)
    monkeypatch.setattr(
        importer_module,
        "validate_database",
        lambda _session, _package: {"ready": False, "errors": ["injected failure"]},
    )
    with (
        pytest.raises(ImportValidationError, match="injected failure"),
        sessions.begin() as session,
    ):
        import_and_validate(session, later_package)

    with sessions() as session:
        assert session.scalar(
            select(MountainSourceRecord.id).where(
                MountainSourceRecord.source_version == "v18.6-test"
            )
        ) is None
        assert session.scalar(
            select(SourceBundle.id).where(SourceBundle.sha256 == "f" * 64)
        ) is None
        assert session.scalar(
            select(Mountain.elevation_m).where(
                Mountain.canonical_source_key == "dobih:1965"
            )
        ) == 1061.8