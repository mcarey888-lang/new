"""Create the isolated Summit Data Engine schema."""

from __future__ import annotations

from collections.abc import Sequence

import geoalchemy2
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0001_isolated_engine_schema"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "summit_data_engine"
STATUS_VALUES = ("imported", "processed", "needs_review", "verified", "rejected")
status = postgresql.ENUM(
    *STATUS_VALUES,
    name="verification_status",
    schema=SCHEMA,
    create_type=False,
)


def upgrade() -> None:
    # PostGIS is a database prerequisite. Creating it is idempotent, while the
    # explicit check gives operators a useful failure on restricted services.
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")
    op.execute(
        "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') "
        "THEN RAISE EXCEPTION 'PostGIS extension is required'; END IF; END $$"
    )
    op.execute(f'CREATE SCHEMA IF NOT EXISTS "{SCHEMA}"')
    status.create(op.get_bind(), checkfirst=True)

    uuid = postgresql.UUID(as_uuid=True)
    jsonb = postgresql.JSONB(astext_type=sa.Text())
    now = sa.text("CURRENT_TIMESTAMP")

    op.create_table(
        "source_bundles",
        sa.Column("id", uuid, nullable=False),
        sa.Column("source_type", sa.String(32), nullable=False),
        sa.Column("provider", sa.String(200), nullable=False),
        sa.Column("source_url", sa.Text(), nullable=False),
        sa.Column("licence", sa.Text(), nullable=False),
        sa.Column("local_path", sa.Text(), nullable=False),
        sa.Column("sha256", sa.String(64), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("retrieved_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("metadata", jsonb, server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("provenance_version", sa.String(100), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=now, nullable=False),
        sa.CheckConstraint("size_bytes >= 0", name="ck_source_bundles_size_bytes_nonnegative"),
        sa.PrimaryKeyConstraint("id", name="pk_source_bundles"),
        sa.UniqueConstraint("sha256", name="uq_source_bundles_sha256"),
        schema=SCHEMA,
    )
    op.create_index(
        "ix_source_bundles_provider_retrieved_at",
        "source_bundles",
        ["provider", "retrieved_at"],
        schema=SCHEMA,
        postgresql_using="btree",
    )
    op.create_table(
        "mountains",
        sa.Column("id", uuid, nullable=False),
        sa.Column("source_bundle_id", uuid, nullable=False),
        sa.Column("source_feature_id", sa.String(200), nullable=False),
        sa.Column("name", sa.String(300), nullable=False),
        sa.Column("status", status, nullable=False),
        sa.Column(
            "geom",
            geoalchemy2.Geometry("POINT", srid=4326, spatial_index=False),
            nullable=False,
        ),
        sa.Column("tags", jsonb, server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("provenance_version", sa.String(100), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=now, nullable=False),
        sa.ForeignKeyConstraint(
            ["source_bundle_id"],
            [f"{SCHEMA}.source_bundles.id"],
            name="fk_mountains_source_bundle_id_source_bundles",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_mountains"),
        sa.UniqueConstraint(
            "source_bundle_id",
            "source_feature_id",
            name="uq_mountains_source_bundle_feature",
        ),
        schema=SCHEMA,
    )
    op.create_index(
        "ix_mountains_status_name",
        "mountains",
        ["status", "name"],
        schema=SCHEMA,
        postgresql_using="btree",
    )
    op.create_index(
        "ix_mountains_geom_gist",
        "mountains",
        ["geom"],
        unique=False,
        schema=SCHEMA,
        postgresql_using="gist",
    )
    op.create_table(
        "routes",
        sa.Column("id", uuid, nullable=False),
        sa.Column("mountain_id", uuid, nullable=False),
        sa.Column("requested_name", sa.String(300), nullable=False),
        sa.Column("source_name", sa.String(300), nullable=True),
        sa.Column("resolution_method", sa.String(100), nullable=False),
        sa.Column("status", status, nullable=False),
        sa.Column(
            "geom",
            geoalchemy2.Geometry("LINESTRING", srid=4326, spatial_index=False),
            nullable=True,
        ),
        sa.Column("tags", jsonb, server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("provenance_version", sa.String(100), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=now, nullable=False),
        sa.ForeignKeyConstraint(
            ["mountain_id"],
            [f"{SCHEMA}.mountains.id"],
            name="fk_routes_mountain_id_mountains",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_routes"),
        schema=SCHEMA,
    )
    op.create_index(
        "ix_routes_mountain_status",
        "routes",
        ["mountain_id", "status"],
        schema=SCHEMA,
        postgresql_using="btree",
    )
    op.create_index(
        "ix_routes_geom_gist",
        "routes",
        ["geom"],
        schema=SCHEMA,
        postgresql_using="gist",
    )
    op.create_table(
        "route_sources",
        sa.Column("id", uuid, nullable=False),
        sa.Column("route_id", uuid, nullable=False),
        sa.Column("source_bundle_id", uuid, nullable=False),
        sa.Column("source_feature_id", sa.String(200), nullable=False),
        sa.Column("evidence", jsonb, server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("provenance_version", sa.String(100), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=now, nullable=False),
        sa.ForeignKeyConstraint(
            ["route_id"],
            [f"{SCHEMA}.routes.id"],
            name="fk_route_sources_route_id_routes",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["source_bundle_id"],
            [f"{SCHEMA}.source_bundles.id"],
            name="fk_route_sources_source_bundle_id_source_bundles",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_route_sources"),
        sa.UniqueConstraint(
            "route_id",
            "source_bundle_id",
            "source_feature_id",
            name="uq_route_sources_route_bundle_feature",
        ),
        schema=SCHEMA,
    )
    op.create_index(
        "ix_route_sources_source_bundle_id",
        "route_sources",
        ["source_bundle_id"],
        schema=SCHEMA,
        postgresql_using="btree",
    )
    op.create_table(
        "route_validation",
        sa.Column("id", uuid, nullable=False),
        sa.Column("route_id", uuid, nullable=False),
        sa.Column("validation_version", sa.String(100), nullable=False),
        sa.Column("outcome", sa.String(20), nullable=False),
        sa.Column("diagnostics", jsonb, server_default=sa.text("'[]'::jsonb"), nullable=False),
        sa.Column("validated_at", sa.DateTime(timezone=True), server_default=now, nullable=False),
        sa.ForeignKeyConstraint(
            ["route_id"],
            [f"{SCHEMA}.routes.id"],
            name="fk_route_validation_route_id_routes",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_route_validation"),
        sa.UniqueConstraint(
            "route_id", "validation_version", name="uq_route_validation_route_version"
        ),
        schema=SCHEMA,
    )
    op.create_index(
        "ix_route_validation_route_outcome",
        "route_validation",
        ["route_id", "outcome"],
        schema=SCHEMA,
        postgresql_using="btree",
    )
    op.create_table(
        "route_elevation_profiles",
        sa.Column("id", uuid, nullable=False),
        sa.Column("route_id", uuid, nullable=False),
        sa.Column("source_bundle_id", uuid, nullable=False),
        sa.Column("calculation_version", sa.String(100), nullable=False),
        sa.Column("sample_spacing_m", sa.Float(), nullable=False),
        sa.Column("smoothing_method", sa.String(100), nullable=False),
        sa.Column("smoothing_parameters", jsonb, nullable=False),
        sa.Column("distance_m", sa.Float(), nullable=False),
        sa.Column("total_ascent_m", sa.Float(), nullable=False),
        sa.Column("total_descent_m", sa.Float(), nullable=False),
        sa.Column("min_elevation_m", sa.Float(), nullable=False),
        sa.Column("max_elevation_m", sa.Float(), nullable=False),
        sa.Column("nodata_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=now, nullable=False),
        sa.CheckConstraint(
            "sample_spacing_m > 0", name="ck_route_elevation_profiles_sample_spacing_positive"
        ),
        sa.CheckConstraint(
            "distance_m >= 0", name="ck_route_elevation_profiles_distance_nonnegative"
        ),
        sa.ForeignKeyConstraint(
            ["route_id"],
            [f"{SCHEMA}.routes.id"],
            name="fk_route_elevation_profiles_route_id_routes",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["source_bundle_id"],
            [f"{SCHEMA}.source_bundles.id"],
            name="fk_route_elevation_profiles_source_bundle_id_source_bundles",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_route_elevation_profiles"),
        sa.UniqueConstraint(
            "route_id",
            "source_bundle_id",
            "calculation_version",
            name="uq_route_elevation_profiles_route_source_version",
        ),
        schema=SCHEMA,
    )
    op.create_index(
        "ix_route_elevation_profiles_route_id",
        "route_elevation_profiles",
        ["route_id"],
        schema=SCHEMA,
        postgresql_using="btree",
    )
    op.create_table(
        "route_elevation_samples",
        sa.Column("id", uuid, nullable=False),
        sa.Column("profile_id", uuid, nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("distance_m", sa.Float(), nullable=False),
        sa.Column("raw_elevation_m", sa.Float(), nullable=False),
        sa.Column("smoothed_elevation_m", sa.Float(), nullable=False),
        sa.Column("gradient_percent", sa.Float(), nullable=True),
        sa.CheckConstraint(
            "sequence >= 0", name="ck_route_elevation_samples_sequence_nonnegative"
        ),
        sa.CheckConstraint(
            "distance_m >= 0", name="ck_route_elevation_samples_distance_nonnegative"
        ),
        sa.ForeignKeyConstraint(
            ["profile_id"],
            [f"{SCHEMA}.route_elevation_profiles.id"],
            name="fk_route_elevation_samples_profile_id_route_elevation_profiles",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_route_elevation_samples"),
        sa.UniqueConstraint(
            "profile_id", "sequence", name="uq_route_elevation_samples_profile_sequence"
        ),
        schema=SCHEMA,
    )
    op.create_index(
        "ix_route_elevation_samples_profile_distance",
        "route_elevation_samples",
        ["profile_id", "distance_m"],
        schema=SCHEMA,
        postgresql_using="btree",
    )

    # Provenance and algorithm versions identify reproducible records and may
    # never be rewritten in place; a new row/version must be inserted instead.
    op.execute(
        f"""
        CREATE FUNCTION {SCHEMA}.reject_immutable_field_update()
        RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
          RAISE EXCEPTION 'immutable provenance/version fields cannot be updated';
        END $$;
        """
    )
    immutable = {
        "source_bundles": ["sha256", "provenance_version"],
        "mountains": ["source_bundle_id", "source_feature_id", "provenance_version"],
        "routes": ["provenance_version"],
        "route_sources": [
            "route_id",
            "source_bundle_id",
            "source_feature_id",
            "provenance_version",
        ],
        "route_validation": ["route_id", "validation_version"],
        "route_elevation_profiles": [
            "route_id",
            "source_bundle_id",
            "calculation_version",
        ],
        "route_elevation_samples": ["profile_id", "sequence"],
    }
    for table, columns in immutable.items():
        op.execute(
            f"CREATE TRIGGER trg_{table}_immutable BEFORE UPDATE OF {', '.join(columns)} "
            f"ON {SCHEMA}.{table} FOR EACH ROW "
            f"EXECUTE FUNCTION {SCHEMA}.reject_immutable_field_update()"
        )


def downgrade() -> None:
    op.execute(f'DROP SCHEMA IF EXISTS "{SCHEMA}" CASCADE')
    # PostGIS is shared database infrastructure and is deliberately retained.