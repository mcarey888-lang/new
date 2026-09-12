"""Migration contract checks that do not need PostgreSQL."""

from __future__ import annotations

import re
from pathlib import Path

from summit_data_engine.config import EngineSettings
from summit_data_engine.db import SCHEMA, Base, VerificationStatus

MIGRATIONS = sorted((Path(__file__).parents[1] / "alembic" / "versions").glob("*.py"))


def test_expected_tables_and_statuses_are_declared() -> None:
    expected = {
        "source_bundles",
        "mountains",
        "mountain_source_records",
        "mountain_aliases",
        "mountain_classifications",
        "routes",
        "route_sources",
        "route_validation",
        "route_elevation_profiles",
        "route_elevation_samples",
        "evidence_sources",
        "route_identities",
        "route_definitions",
        "route_facts",
        "route_definition_evidence",
        "mountain_verifications",
        "mountain_verification_evidence",
        "route_geometries",
        "route_geometry_members",
        "dem_tiles",
        "route_elevation_profile_sources",
    }
    assert {table.name for table in Base.metadata.tables.values()} == expected
    assert SCHEMA == "public"
    assert {table.schema for table in Base.metadata.tables.values()} == {"public"}
    assert EngineSettings().engine_db_schema == "public"
    assert {status.value for status in VerificationStatus} == {
        "imported",
        "processed",
        "needs_review",
        "verified",
        "rejected",
    }


def test_migration_contains_postgis_indexes_and_immutability_contract() -> None:
    migration = "\n".join(path.read_text() for path in MIGRATIONS)
    assert "CREATE EXTENSION IF NOT EXISTS postgis" in migration
    assert "pg_extension" in migration
    assert migration.count('postgresql_using="gist"') >= 2
    assert "reject_immutable_field_update" in migration
    assert "BEFORE UPDATE OF" in migration
    for table in Base.metadata.tables.values():
        assert f'"{table.name}"' in migration


def test_explicit_migration_identifiers_fit_postgresql_limit() -> None:
    migration = "\n".join(path.read_text() for path in MIGRATIONS)
    explicit_names = re.findall(r'name="([^"]+)"', migration)
    assert explicit_names
    assert all(len(name) <= 63 for name in explicit_names)


def test_alembic_bootstraps_its_owned_version_table_schema() -> None:
    env = (Path(__file__).parents[1] / "alembic" / "env.py").read_text()
    assert "CREATE SCHEMA IF NOT EXISTS" in env
    assert "version_num VARCHAR(128)" in env
    assert "ALTER COLUMN version_num TYPE VARCHAR(128)" in env
    assert 'VERSION_SCHEMA = "summit_data_engine"' in env
    assert "version_table_schema=VERSION_SCHEMA" in env


def test_0002_follows_0001_and_preserves_version_fields() -> None:
    migration = next(path for path in MIGRATIONS if path.name.startswith("0002_")).read_text()
    assert 'down_revision: str | Sequence[str] | None = "0001_isolated_engine_schema"' in migration
    assert "rights_classification" in migration
    assert "geometry_reuse_allowed" in migration
    assert migration.count("_immutable") >= 2
    for table in ("route_identities", "route_definitions", "mountain_verifications"):
        assert f'"{table}"' in migration


def test_0003_adds_versioned_dobih_facts_without_a_competing_mountain_table() -> None:
    migration = next(path for path in MIGRATIONS if path.name.startswith("0003_")).read_text()
    assert (
        'down_revision: str | Sequence[str] | None = '
        '"0002_evidence_rights_and_versioned_routes"'
    ) in migration
    assert '"mountain_source_records"' in migration
    assert '"mountain_classifications"' in migration
    assert '"canonical_source_key"' in migration
    assert '"elevation_m"' in migration
    assert '"prominence_m"' in migration
    assert "ST_X(geom) BETWEEN -180 AND 180" in migration
    assert "trg_mountain_source_records_immutable" not in migration
    assert '_immutable(\n        "mountain_source_records"' in migration


def test_0004_preserves_queryable_release_fact_snapshots() -> None:
    migration = next(path for path in MIGRATIONS if path.name.startswith("0004_")).read_text()
    assert 'down_revision: str | Sequence[str] | None = "0003_dobih_hill_catalogue"' in migration
    assert "UPDATE {SCHEMA}.mountain_source_records AS r" in migration
    assert '"elevation_m"' in migration
    assert '"prominence_m"' in migration
    assert '"col_height_m"' in migration
    assert '"geom"' in migration
    assert "ix_mountain_source_records_geom_gist" in migration
    assert "SNAPSHOT_COLUMNS" in migration


def test_0005_indexes_the_api_name_and_geography_expressions() -> None:
    migration = next(path for path in MIGRATIONS if path.name.startswith("0005_")).read_text()
    assert 'down_revision: str | Sequence[str] | None = "0004_release_fact_snapshots"' in migration
    assert "ix_msr_normalized_name" in migration
    assert "lower(regexp_replace(btrim(name)" in migration
    assert "ix_msr_geom_geography_gist" in migration
    assert "USING gist ((geom::geography))" in migration


def test_0006_adds_nullable_international_facts_aliases_and_routes() -> None:
    migration = next(path for path in MIGRATIONS if path.name.startswith("0006_")).read_text()
    assert 'down_revision: str | Sequence[str] | None = "0005_api_lookup_indexes"' in migration
    assert '"mountain_aliases"' in migration
    assert '"route_facts"' in migration
    assert '"source_record_id"' in migration
    assert '"evidence_source_id"' in migration
    assert '"total_ascent_m"' in migration
    assert "nullable=True" in migration
    assert "trg_route_facts_immutable" not in migration
    assert '_immutable(\n        "route_facts"' in migration


def test_0007_publishes_all_model_tables_and_preserves_legacy_version_table() -> None:
    migration = next(path for path in MIGRATIONS if path.name.startswith("0007_")).read_text()
    assert 'down_revision: str | Sequence[str] | None = "0006_international_catalogue"' in migration
    assert 'LEGACY_SCHEMA = "summit_data_engine"' in migration
    assert 'TARGET_SCHEMA = "public"' in migration
    assert "ALTER TABLE" in migration
    assert "SET SCHEMA" in migration
    assert 'version_table_schema' not in migration
    for table in Base.metadata.tables.values():
        assert f'"{table.name}"' in migration
    assert "verification_status" in migration
    assert "rights_classification" in migration
    assert "reject_immutable_field_update" in migration


def test_models_include_btree_and_gist_indexes() -> None:
    indexes = [index for table in Base.metadata.tables.values() for index in table.indexes]
    assert any(index.dialect_options["postgresql"].get("using") == "gist" for index in indexes)
    assert any(index.dialect_options["postgresql"].get("using") == "btree" for index in indexes)