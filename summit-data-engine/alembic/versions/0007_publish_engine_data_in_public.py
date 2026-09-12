"""Move engine data objects from the legacy schema into public."""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0007_publish_engine_data_in_public"
down_revision: str | Sequence[str] | None = "0006_international_catalogue"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

LEGACY_SCHEMA = "summit_data_engine"
TARGET_SCHEMA = "public"

# Keep this list aligned with the declarative models and the create_table
# operations in revisions 0001-0006.  alembic_version is deliberately absent:
# it is the compatibility anchor for the existing revision chain.
ENGINE_TABLES = (
    "source_bundles",
    "mountains",
    "mountain_source_records",
    "mountain_classifications",
    "mountain_aliases",
    "routes",
    "route_sources",
    "route_validation",
    "route_elevation_profiles",
    "route_elevation_samples",
    "evidence_sources",
    "route_identities",
    "route_definitions",
    "route_definition_evidence",
    "route_facts",
    "mountain_verifications",
    "mountain_verification_evidence",
    "route_geometries",
    "route_geometry_members",
    "dem_tiles",
    "route_elevation_profile_sources",
)


def _preflight_upgrade() -> None:
    """Fail before any DDL if a public object would be displaced."""
    op.execute(
        f"""
        DO $$
        DECLARE
          table_name text;
        BEGIN
          FOREACH table_name IN ARRAY ARRAY[
            {", ".join(repr(table_name) for table_name in ENGINE_TABLES)}
          ] LOOP
            IF to_regclass(format('%I.%I', '{TARGET_SCHEMA}', table_name)) IS NOT NULL THEN
              RAISE EXCEPTION
                'Cannot publish Summit Data Engine table %.%: public object already exists',
                '{TARGET_SCHEMA}', table_name;
            END IF;
            IF to_regclass(format('%I.%I', '{LEGACY_SCHEMA}', table_name)) IS NULL THEN
              RAISE EXCEPTION
                'Cannot publish Summit Data Engine table %.%: legacy table is missing',
                '{LEGACY_SCHEMA}', table_name;
            END IF;
          END LOOP;

          IF EXISTS (
            SELECT 1
            FROM pg_type AS t
            JOIN pg_namespace AS n ON n.oid = t.typnamespace
            WHERE n.nspname = '{TARGET_SCHEMA}'
              AND t.typname IN ('verification_status', 'rights_classification')
          ) THEN
            RAISE EXCEPTION
              'Cannot publish Summit Data Engine enum: public enum object already exists';
          END IF;
          IF EXISTS (
            SELECT 1
            FROM pg_indexes AS source_index
            WHERE source_index.schemaname = '{LEGACY_SCHEMA}'
              AND source_index.tablename = ANY(ARRAY[
                {", ".join(repr(table_name) for table_name in ENGINE_TABLES)}
              ])
              AND to_regclass(
                format('%I.%I', '{TARGET_SCHEMA}', source_index.indexname)
              ) IS NOT NULL
          ) THEN
            RAISE EXCEPTION
              'Cannot publish Summit Data Engine index: public object already exists';
          END IF;
          IF to_regprocedure('{TARGET_SCHEMA}.reject_immutable_field_update()')
             IS NOT NULL THEN
            RAISE EXCEPTION
              'Cannot publish Summit Data Engine function: public function already exists';
          END IF;
        END $$;
        """
    )


def _preflight_downgrade() -> None:
    """Fail before reversing if the legacy destination is occupied."""
    op.execute(
        f"""
        DO $$
        DECLARE
          table_name text;
        BEGIN
          FOREACH table_name IN ARRAY ARRAY[
            {", ".join(repr(table_name) for table_name in ENGINE_TABLES)}
          ] LOOP
            IF to_regclass(format('%I.%I', '{LEGACY_SCHEMA}', table_name)) IS NOT NULL THEN
              RAISE EXCEPTION
                'Cannot restore Summit Data Engine table %.%: legacy object already exists',
                '{LEGACY_SCHEMA}', table_name;
            END IF;
            IF to_regclass(format('%I.%I', '{TARGET_SCHEMA}', table_name)) IS NULL THEN
              RAISE EXCEPTION
                'Cannot restore Summit Data Engine table %.%: public table is missing',
                '{TARGET_SCHEMA}', table_name;
            END IF;
          END LOOP;

          IF EXISTS (
            SELECT 1
            FROM pg_type AS t
            JOIN pg_namespace AS n ON n.oid = t.typnamespace
            WHERE n.nspname = '{LEGACY_SCHEMA}'
              AND t.typname IN ('verification_status', 'rights_classification')
          ) THEN
            RAISE EXCEPTION
              'Cannot restore Summit Data Engine enum: legacy enum object already exists';
          END IF;
          IF EXISTS (
            SELECT 1
            FROM pg_indexes AS source_index
            WHERE source_index.schemaname = '{TARGET_SCHEMA}'
              AND source_index.tablename = ANY(ARRAY[
                {", ".join(repr(table_name) for table_name in ENGINE_TABLES)}
              ])
              AND to_regclass(
                format('%I.%I', '{LEGACY_SCHEMA}', source_index.indexname)
              ) IS NOT NULL
          ) THEN
            RAISE EXCEPTION
              'Cannot restore Summit Data Engine index: legacy object already exists';
          END IF;
          IF to_regprocedure('{LEGACY_SCHEMA}.reject_immutable_field_update()')
             IS NOT NULL THEN
            RAISE EXCEPTION
              'Cannot restore Summit Data Engine function: legacy function already exists';
          END IF;
        END $$;
        """
    )


def upgrade() -> None:
    # Alembic wraps this revision in one transaction.  PostgreSQL updates
    # foreign-key and trigger dependencies as each relation changes schema.
    _preflight_upgrade()
    for table_name in ENGINE_TABLES:
        op.execute(
            f'ALTER TABLE "{LEGACY_SCHEMA}"."{table_name}" '
            f'SET SCHEMA "{TARGET_SCHEMA}"'
        )
    op.execute(
        f'ALTER TYPE "{LEGACY_SCHEMA}"."verification_status" '
        f'SET SCHEMA "{TARGET_SCHEMA}"'
    )
    op.execute(
        f'ALTER TYPE "{LEGACY_SCHEMA}"."rights_classification" '
        f'SET SCHEMA "{TARGET_SCHEMA}"'
    )
    op.execute(
        f'ALTER FUNCTION "{LEGACY_SCHEMA}".reject_immutable_field_update() '
        f'SET SCHEMA "{TARGET_SCHEMA}"'
    )


def downgrade() -> None:
    _preflight_downgrade()
    op.execute(f'CREATE SCHEMA IF NOT EXISTS "{LEGACY_SCHEMA}"')
    for table_name in reversed(ENGINE_TABLES):
        op.execute(
            f'ALTER TABLE "{TARGET_SCHEMA}"."{table_name}" '
            f'SET SCHEMA "{LEGACY_SCHEMA}"'
        )
    op.execute(
        f'ALTER TYPE "{TARGET_SCHEMA}"."verification_status" '
        f'SET SCHEMA "{LEGACY_SCHEMA}"'
    )
    op.execute(
        f'ALTER TYPE "{TARGET_SCHEMA}"."rights_classification" '
        f'SET SCHEMA "{LEGACY_SCHEMA}"'
    )
    op.execute(
        f'ALTER FUNCTION "{TARGET_SCHEMA}".reject_immutable_field_update() '
        f'SET SCHEMA "{LEGACY_SCHEMA}"'
    )