"""Database validation and benchmark reporting for imported DoBIH releases."""

from __future__ import annotations

import statistics
import time
from collections.abc import Mapping
from datetime import date, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session

from summit_data_engine.dobih.master_package import DobihImportPackage

BENCHMARK_NAMES = {
    "Tryfan": "Tryfan",
    "Yr Wyddfa/Snowdon": "Snowdon - Yr Wyddfa",
    "Carnedd Llewelyn": "Carnedd Llewelyn",
    "Pen y Fan": "Pen y Fan",
    "Scafell Pike": "Scafell Pike",
    "Helvellyn": "Helvellyn",
    "Ben Nevis": "Ben Nevis [Beinn Nibheis]",
    "Kinder Scout": "Kinder Scout",
    "Musbury Tor": "Musbury Tor",
}


def _plain(value: Any) -> Any:
    if isinstance(value, (date, datetime, UUID)):
        return str(value)
    if isinstance(value, Mapping):
        return {str(key): _plain(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_plain(item) for item in value]
    return value


def _one_mapping(
    session: Session,
    sql: str,
    params: dict[str, Any],
) -> dict[str, Any]:
    row = session.execute(text(sql), params).mappings().one()
    return {key: _plain(value) for key, value in row.items()}


def _all_mappings(
    session: Session,
    sql: str,
    params: dict[str, Any],
) -> list[dict[str, Any]]:
    rows = session.execute(text(sql), params).mappings()
    return [{key: _plain(value) for key, value in row.items()} for row in rows]


def validate_database(
    session: Session,
    package: DobihImportPackage,
) -> dict[str, Any]:
    """Validate counts, source provenance, facts and spatial integrity."""
    first = package.records[0]
    params = {
        "dataset": first.source_dataset,
        "version": first.source_version,
        "expected_count": len(package.records),
    }
    counts = _one_mapping(
        session,
        """
        SELECT
          count(*) AS source_records,
          count(DISTINCT r.source_feature_id) AS unique_source_ids,
          count(DISTINCT r.mountain_id) AS matched_mountains,
          count(DISTINCT m.canonical_source_key) AS unique_canonical_keys,
          count(*) FILTER (WHERE r.name IS NULL OR btrim(r.name) = '') AS missing_names,
          count(*) FILTER (WHERE r.geom IS NULL) AS missing_coordinates,
          count(*) FILTER (WHERE r.elevation_m IS NULL) AS missing_elevation,
          count(*) FILTER (WHERE r.prominence_m IS NULL) AS missing_prominence,
          count(*) FILTER (
            WHERE r.geom IS NULL
               OR ST_SRID(r.geom) <> 4326
               OR NOT ST_IsValid(r.geom)
               OR ST_X(r.geom) NOT BETWEEN -180 AND 180
               OR ST_Y(r.geom) NOT BETWEEN -90 AND 90
          ) AS invalid_spatial_records
        FROM public.mountain_source_records r
        JOIN public.mountains m ON m.id = r.mountain_id
        WHERE r.source_dataset = :dataset AND r.source_version = :version
        """,
        params,
    )
    country_rows = _all_mappings(
        session,
        """
        SELECT r.country, count(*) AS record_count
        FROM public.mountain_source_records r
        WHERE r.source_dataset = :dataset AND r.source_version = :version
        GROUP BY r.country
        ORDER BY r.country
        """,
        params,
    )
    status_rows = _all_mappings(
        session,
        """
        SELECT r.final_verification_status, r.qa_status, count(*) AS record_count
        FROM public.mountain_source_records r
        WHERE r.source_dataset = :dataset AND r.source_version = :version
        GROUP BY r.final_verification_status, r.qa_status
        ORDER BY r.final_verification_status, r.qa_status
        """,
        params,
    )
    classification_rows = _all_mappings(
        session,
        """
        SELECT c.classification_code, count(*) AS record_count
        FROM public.mountain_classifications c
        JOIN public.mountain_source_records r ON r.id = c.source_record_id
        WHERE r.source_dataset = :dataset AND r.source_version = :version
        GROUP BY c.classification_code
        ORDER BY c.classification_code
        """,
        params,
    )
    provenance = _one_mapping(
        session,
        """
        SELECT
          count(DISTINCT b.id) AS source_bundle_count,
          min(b.sha256) AS import_csv_sha256,
          min(b.provider) AS provider,
          min(b.licence) AS licence,
          min(r.source_file_sha256) AS original_source_sha256,
          count(DISTINCT r.source_file_sha256) AS original_source_hash_count
        FROM public.mountain_source_records r
        JOIN public.source_bundles b ON b.id = r.source_bundle_id
        WHERE r.source_dataset = :dataset AND r.source_version = :version
        """,
        params,
    )
    special_records = _all_mappings(
        session,
        """
        SELECT
          r.source_feature_id AS dobih_id,
          r.name,
          r.elevation_m,
          r.prominence_m,
          ST_Y(r.geom) AS latitude,
          ST_X(r.geom) AS longitude,
          r.final_verification_status,
          r.qa_status,
          r.qa_flags,
          r.needs_review_reason
        FROM public.mountain_source_records r
        WHERE r.source_dataset = :dataset
          AND r.source_version = :version
          AND r.source_feature_id IN ('15584', '1965')
        ORDER BY r.source_feature_id
        """,
        params,
    )
    revision = _one_mapping(
        session,
        """
        SELECT version_num
        FROM summit_data_engine.alembic_version
        """,
        {},
    )
    indexes = _all_mappings(
        session,
        """
        SELECT tablename, indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename IN (
            'mountains',
            'mountain_source_records',
            'mountain_classifications'
          )
        ORDER BY tablename, indexname
        """,
        {},
    )

    errors: list[str] = []
    expected_count = len(package.records)
    for field in (
        "source_records",
        "unique_source_ids",
        "matched_mountains",
        "unique_canonical_keys",
    ):
        if counts[field] != expected_count:
            errors.append(f"{field}={counts[field]} (expected {expected_count})")
    for field in (
        "missing_names",
        "missing_coordinates",
        "missing_elevation",
        "missing_prominence",
        "invalid_spatial_records",
    ):
        if counts[field] != 0:
            errors.append(f"{field}={counts[field]} (expected 0)")

    country_counts = {str(row["country"]): row["record_count"] for row in country_rows}
    if country_counts != package.summary["country_counts"]:
        errors.append("database country counts do not match the package summary")
    classification_counts = {
        str(row["classification_code"]): row["record_count"] for row in classification_rows
    }
    if classification_counts != package.summary["classification_counts"]:
        errors.append("database classification counts do not match the package summary")
    if provenance["source_bundle_count"] != 1:
        errors.append("release records do not reference exactly one source bundle")
    if provenance["import_csv_sha256"] != package.import_csv_sha256:
        errors.append("source bundle hash does not match the import-ready CSV")
    if provenance["original_source_sha256"] != package.original_source_sha256:
        errors.append("release provenance does not retain the original DoBIH CSV hash")
    if provenance["original_source_hash_count"] != 1:
        errors.append("release records contain inconsistent original source hashes")

    special_by_id = {str(row["dobih_id"]): row for row in special_records}
    grassholm = special_by_id.get("15584")
    if (
        grassholm is None
        or grassholm["name"] != "Grassholm Island"
        or grassholm["final_verification_status"] != "needs_review"
    ):
        errors.append("Grassholm Island special handling is not preserved")
    carnedd = special_by_id.get("1965")
    if (
        carnedd is None
        or carnedd["name"] != "Carnedd Llewelyn"
        or carnedd["elevation_m"] != 1061.8
        or not carnedd["needs_review_reason"]
    ):
        errors.append("Carnedd Llewelyn height or informational note is not preserved")

    return {
        "ready": not errors,
        "errors": errors,
        "migration_revision": revision["version_num"],
        "counts": counts,
        "country_counts": country_counts,
        "status_counts": status_rows,
        "classification_counts": classification_counts,
        "provenance": provenance,
        "special_records": special_records,
        "indexes": indexes,
    }


NAME_LOOKUP_SQL = """
SELECT
  r.source_feature_id AS dobih_id,
  r.name,
  r.elevation_m,
  r.prominence_m,
  ST_Y(r.geom) AS latitude,
  ST_X(r.geom) AS longitude,
  r.country,
  r.source_dataset AS source,
  r.source_version,
  r.final_verification_status AS supplied_status,
  COALESCE(classes.codes, ARRAY[]::varchar[]) AS classifications,
  count(*) OVER () AS exact_name_matches
FROM public.mountain_source_records r
LEFT JOIN LATERAL (
  SELECT array_agg(c.classification_code ORDER BY c.classification_code) AS codes
  FROM public.mountain_classifications c
  WHERE c.source_record_id = r.id
) classes ON true
WHERE r.source_version = :version AND r.name = :name
ORDER BY r.prominence_m DESC, r.elevation_m DESC, r.source_feature_id
LIMIT 1
"""

EXACT_ID_SQL = """
SELECT r.source_feature_id
FROM public.mountain_source_records r
JOIN public.mountains m ON m.id = r.mountain_id
WHERE r.source_version = :version AND m.canonical_source_key = :canonical_key
"""

NEAREST_SQL = """
SELECT
  r.source_feature_id AS dobih_id,
  r.name,
  r.elevation_m,
  r.prominence_m,
  ST_Y(r.geom) AS latitude,
  ST_X(r.geom) AS longitude,
  r.country,
  ST_DistanceSphere(
    r.geom,
    ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)
  ) AS distance_m
FROM public.mountain_source_records r
WHERE r.source_version = :version
ORDER BY r.geom <-> ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)
LIMIT 5
"""


def _timed(
    session: Session,
    sql: str,
    params: dict[str, Any],
    *,
    repeats: int = 15,
) -> tuple[float, list[dict[str, Any]]]:
    session.execute(text(sql), params).all()
    samples: list[float] = []
    result: list[dict[str, Any]] = []
    for _ in range(repeats):
        started = time.perf_counter()
        rows = session.execute(text(sql), params).mappings().all()
        samples.append((time.perf_counter() - started) * 1000)
        result = [{key: _plain(value) for key, value in row.items()} for row in rows]
    return round(statistics.median(samples), 3), result


def run_benchmarks(session: Session, source_version: str) -> dict[str, Any]:
    """Time exact identity, exact-name and nearest-neighbour lookups."""
    exact_id_ms, exact_id_rows = _timed(
        session,
        EXACT_ID_SQL,
        {"version": source_version, "canonical_key": "dobih:1965"},
    )
    lookups: list[dict[str, Any]] = []
    name_timings: list[float] = []
    for requested_name, stored_name in BENCHMARK_NAMES.items():
        median_ms, rows = _timed(
            session,
            NAME_LOOKUP_SQL,
            {"version": source_version, "name": stored_name},
        )
        name_timings.append(median_ms)
        lookups.append(
            {
                "requested_name": requested_name,
                "stored_name_query": stored_name,
                "median_ms": median_ms,
                "found": bool(rows),
                "result": rows[0] if rows else None,
            }
        )

    spatial_ms, spatial_rows = _timed(
        session,
        NEAREST_SQL,
        {
            "version": source_version,
            "longitude": -3.9975,
            "latitude": 53.1146,
        },
    )
    return {
        "exact_id_lookup": {
            "canonical_key": "dobih:1965",
            "median_ms": exact_id_ms,
            "result": exact_id_rows[0] if exact_id_rows else None,
        },
        "name_search": {
            "median_across_requested_names_ms": round(statistics.median(name_timings), 3),
            "lookups": lookups,
        },
        "nearest_hill": {
            "origin": {"longitude": -3.9975, "latitude": 53.1146},
            "median_ms": spatial_ms,
            "results": spatial_rows,
        },
    }