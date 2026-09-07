"""Transactional, idempotent import of the reviewed DoBIH master package."""

from __future__ import annotations

import argparse
import json
import uuid
from dataclasses import asdict, dataclass
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any

from geoalchemy2.elements import WKTElement
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from summit_data_engine.db import (
    Mountain,
    MountainClassification,
    MountainSourceRecord,
    SourceBundle,
    VerificationStatus,
    create_database_engine,
    create_session_factory,
)
from summit_data_engine.dobih.master_package import (
    EXPECTED_RECORD_COUNT,
    KNOWN_V18_5_PACKAGE_SHA256,
    DobihImportPackage,
    PreparedDobihRecord,
    load_import_package,
)
from summit_data_engine.dobih.reporting import run_benchmarks, validate_database

DEFAULT_PACKAGE_DIR = Path("data/raw/dobih/v18.5/master")
DEFAULT_CSV_PATH = DEFAULT_PACKAGE_DIR / "dobih_v18_5_full_import_ready.csv"
DEFAULT_SUMMARY_PATH = DEFAULT_PACKAGE_DIR / "dobih_v18_5_full_import_summary.json"
DEFAULT_ZIP_PATH = DEFAULT_PACKAGE_DIR / "summit_ready_dobih_master_package_v18_5.zip"
DEFAULT_ORIGINAL_SOURCE_PATH = Path("data/raw/dobih/v18.5/DoBIH_v18_5.csv")
SOURCE_URL = "https://www.hill-bagging.co.uk/dobih"


@dataclass
class ImportCounters:
    source_records_seen: int = 0
    source_records_inserted: int = 0
    source_records_unchanged: int = 0
    mountains_inserted: int = 0
    mountains_updated: int = 0
    mountains_unchanged: int = 0
    classifications_inserted: int = 0
    classifications_unchanged: int = 0
    failed: int = 0


class ImportValidationError(RuntimeError):
    """Raised inside the write transaction when database validation fails."""


@dataclass(frozen=True)
class _MountainState:
    mountain: Mountain
    longitude: float
    latitude: float


def _bundle_metadata(package: DobihImportPackage) -> dict[str, Any]:
    first = package.records[0]
    return {
        "dataset": first.source_dataset,
        "version": first.source_version,
        "release_date": first.source_release_date.isoformat(),
        "record_count": len(package.records),
        "import_ready_csv_sha256": package.import_csv_sha256,
        "original_source_csv_sha256": package.original_source_sha256,
        "master_package_sha256": package.package_sha256,
        "source_attribution": first.source_attribution,
        "prepared_package": True,
    }


def _get_or_create_bundle(session: Session, package: DobihImportPackage) -> SourceBundle:
    existing = session.scalar(
        select(SourceBundle).where(SourceBundle.sha256 == package.import_csv_sha256)
    )
    first = package.records[0]
    if existing is not None:
        if (
            existing.provider != first.source_dataset
            or existing.licence != first.source_license
            or existing.provenance_version != first.source_version
        ):
            raise ValueError("existing source bundle hash has conflicting DoBIH provenance")
        return existing

    bundle = SourceBundle(
        id=uuid.uuid4(),
        source_type="dobih_csv",
        provider=first.source_dataset,
        source_url=SOURCE_URL,
        licence=first.source_license,
        local_path=str(package.csv_path),
        sha256=package.import_csv_sha256,
        size_bytes=package.csv_path.stat().st_size,
        retrieved_at=datetime.now(UTC),
        metadata_json=_bundle_metadata(package),
        provenance_version=first.source_version,
    )
    session.add(bundle)
    return bundle


def _mountain_values(record: PreparedDobihRecord) -> dict[str, Any]:
    return {
        "name": record.name,
        "canonical_source_key": record.canonical_source_key,
        "country": record.country,
        "region": record.region,
        "area": record.area,
        "county": record.county,
        "elevation_m": record.elevation_m,
        "prominence_m": record.prominence_m,
        "col_height_m": record.col_height_m,
        "grid_reference": record.grid_reference,
        "summit_feature": record.summit_feature,
        "status": (
            VerificationStatus.NEEDS_REVIEW
            if record.final_verification_status == "needs_review"
            else VerificationStatus.IMPORTED
        ),
        "tags": {
            "canonical_source": "dobih",
            "source_version": record.source_version,
            "source_trust": record.source_trust,
        },
    }


def _new_mountain(
    record: PreparedDobihRecord,
    bundle: SourceBundle,
) -> Mountain:
    return Mountain(
        id=uuid.uuid4(),
        source_bundle_id=bundle.id,
        source_feature_id=record.source_feature_id,
        provenance_version=record.source_version,
        geom=WKTElement(f"POINT({record.longitude} {record.latitude})", srid=4326),
        **_mountain_values(record),
    )


def _update_mountain_if_needed(
    state: _MountainState,
    record: PreparedDobihRecord,
) -> bool:
    changed = False
    for attribute, value in _mountain_values(record).items():
        if getattr(state.mountain, attribute) != value:
            setattr(state.mountain, attribute, value)
            changed = True
    if state.longitude != record.longitude or state.latitude != record.latitude:
        state.mountain.geom = WKTElement(
            f"POINT({record.longitude} {record.latitude})",
            srid=4326,
        )
        changed = True
    return changed


def _new_source_record(
    record: PreparedDobihRecord,
    mountain: Mountain,
    bundle: SourceBundle,
) -> MountainSourceRecord:
    return MountainSourceRecord(
        id=uuid.uuid4(),
        mountain_id=mountain.id,
        source_bundle_id=bundle.id,
        source_dataset=record.source_dataset,
        source_version=record.source_version,
        source_feature_id=record.source_feature_id,
        source_release_date=record.source_release_date,
        name=record.name,
        country=record.country,
        region=record.region,
        area=record.area,
        county=record.county,
        elevation_m=record.elevation_m,
        prominence_m=record.prominence_m,
        col_height_m=record.col_height_m,
        grid_reference=record.grid_reference,
        summit_feature=record.summit_feature,
        geom=WKTElement(f"POINT({record.longitude} {record.latitude})", srid=4326),
        source_file_sha256=record.source_file_sha256,
        source_license=record.source_license,
        source_attribution=record.source_attribution,
        source_trust=record.source_trust,
        final_verification_status=record.final_verification_status,
        needs_review_reason=record.needs_review_reason,
        qa_status=record.qa_status,
        qa_flags=list(record.qa_flags),
        data_priority=record.data_priority,
        ai_fallback_allowed=record.ai_fallback_allowed,
        raw_payload=record.raw_payload,
        prepared_payload=record.prepared_payload,
        import_payload_sha256=record.import_payload_sha256,
    )


def _load_mountains(
    session: Session,
    canonical_keys: tuple[str, ...],
) -> dict[str, _MountainState]:
    rows = session.execute(
        select(
            Mountain,
            func.ST_X(Mountain.geom),
            func.ST_Y(Mountain.geom),
        ).where(Mountain.canonical_source_key.in_(canonical_keys))
    )
    return {
        mountain.canonical_source_key: _MountainState(
            mountain=mountain,
            longitude=float(longitude),
            latitude=float(latitude),
        )
        for mountain, longitude, latitude in rows
        if mountain.canonical_source_key is not None
    }


def _latest_release_dates(
    session: Session,
    mountain_ids: tuple[uuid.UUID, ...],
) -> dict[uuid.UUID, date]:
    if not mountain_ids:
        return {}
    rows = session.execute(
        select(
            MountainSourceRecord.mountain_id,
            func.max(MountainSourceRecord.source_release_date),
        )
        .where(MountainSourceRecord.mountain_id.in_(mountain_ids))
        .group_by(MountainSourceRecord.mountain_id)
    )
    return {
        mountain_id: release_date
        for mountain_id, release_date in rows
        if release_date is not None
    }


def import_package(
    session: Session,
    package: DobihImportPackage,
) -> ImportCounters:
    """Import a fully validated package inside the caller's transaction."""
    counters = ImportCounters(source_records_seen=len(package.records))
    bundle = _get_or_create_bundle(session, package)
    canonical_keys = tuple(record.canonical_source_key for record in package.records)
    mountains = _load_mountains(session, canonical_keys)
    latest_dates = _latest_release_dates(
        session,
        tuple(state.mountain.id for state in mountains.values()),
    )

    first = package.records[0]
    existing_source_records = {
        source_record.source_feature_id: source_record
        for source_record in session.scalars(
            select(MountainSourceRecord).where(
                MountainSourceRecord.source_dataset == first.source_dataset,
                MountainSourceRecord.source_version == first.source_version,
            )
        )
    }
    existing_classifications: dict[uuid.UUID, set[str]] = {}
    if existing_source_records:
        for source_record_id, code in session.execute(
            select(
                MountainClassification.source_record_id,
                MountainClassification.classification_code,
            ).where(
                MountainClassification.source_record_id.in_(
                    tuple(item.id for item in existing_source_records.values())
                )
            )
        ):
            existing_classifications.setdefault(source_record_id, set()).add(code)

    for record in package.records:
        state = mountains.get(record.canonical_source_key)
        if state is None:
            mountain = _new_mountain(record, bundle)
            session.add(mountain)
            state = _MountainState(mountain, record.longitude, record.latitude)
            mountains[record.canonical_source_key] = state
            counters.mountains_inserted += 1
        elif record.source_release_date >= latest_dates.get(
            state.mountain.id, record.source_release_date
        ):
            if _update_mountain_if_needed(state, record):
                counters.mountains_updated += 1
            else:
                counters.mountains_unchanged += 1
        else:
            counters.mountains_unchanged += 1

        existing_source = existing_source_records.get(record.source_feature_id)
        if existing_source is not None:
            if existing_source.import_payload_sha256 != record.import_payload_sha256:
                raise ValueError(
                    "immutable DoBIH release row changed for "
                    f"{record.source_version}/{record.source_feature_id}"
                )
            if existing_source.source_bundle_id != bundle.id:
                raise ValueError(
                    "DoBIH release identity already belongs to a different source bundle"
                )
            stored_classes = existing_classifications.get(existing_source.id, set())
            if stored_classes != set(record.classifications):
                raise ValueError(
                    f"stored classifications differ for DoBIH {record.source_feature_id}"
                )
            counters.source_records_unchanged += 1
            counters.classifications_unchanged += len(record.classifications)
            continue

        source_record = _new_source_record(record, state.mountain, bundle)
        session.add(source_record)
        counters.source_records_inserted += 1
        for classification in record.classifications:
            session.add(
                MountainClassification(
                    id=uuid.uuid4(),
                    source_record_id=source_record.id,
                    classification_code=classification,
                )
            )
            counters.classifications_inserted += 1

    session.flush()
    return counters


def import_and_validate(
    session: Session,
    package: DobihImportPackage,
) -> tuple[ImportCounters, dict[str, Any]]:
    """Import and validate before the caller's transaction can commit."""
    counters = import_package(session, package)
    validation = validate_database(session, package)
    if not validation["ready"]:
        raise ImportValidationError(
            "database validation failed: " + "; ".join(validation["errors"])
        )
    return counters, validation


def _write_report(report: dict[str, Any], output_path: Path | None) -> None:
    rendered = json.dumps(report, indent=2, ensure_ascii=False, default=str)
    print(rendered)
    if output_path is not None:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(rendered + "\n", encoding="utf-8")


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--csv", type=Path, default=DEFAULT_CSV_PATH)
    parser.add_argument("--summary", type=Path, default=DEFAULT_SUMMARY_PATH)
    parser.add_argument(
        "--original-source",
        type=Path,
        default=DEFAULT_ORIGINAL_SOURCE_PATH,
    )
    parser.add_argument("--package", type=Path, default=DEFAULT_ZIP_PATH)
    parser.add_argument(
        "--expected-package-sha256",
        default=KNOWN_V18_5_PACKAGE_SHA256,
    )
    parser.add_argument("--expected-record-count", type=int, default=EXPECTED_RECORD_COUNT)
    parser.add_argument("--validate-only", action="store_true")
    parser.add_argument("--report-output", type=Path)
    return parser


def main() -> None:
    args = _parser().parse_args()
    package = load_import_package(
        args.csv,
        args.summary,
        original_source_path=args.original_source,
        package_path=args.package,
        expected_package_sha256=args.expected_package_sha256,
        expected_record_count=args.expected_record_count,
    )
    package_report = {
        "package_sha256": package.package_sha256,
        "import_csv_sha256": package.import_csv_sha256,
        "original_source_sha256": package.original_source_sha256,
        "record_count": len(package.records),
        "version": package.records[0].source_version,
    }
    if args.validate_only:
        _write_report({"package": package_report, "validated": True}, args.report_output)
        return

    engine = create_database_engine()
    sessions = create_session_factory(engine)
    with sessions.begin() as session:
        counters, validation = import_and_validate(session, package)
        benchmarks = run_benchmarks(session, package.records[0].source_version)
    report = {
        "package": package_report,
        "import": asdict(counters),
        "validation": validation,
        "benchmarks": benchmarks,
    }
    _write_report(report, args.report_output)


if __name__ == "__main__":
    main()