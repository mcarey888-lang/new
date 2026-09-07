"""Add rights-aware evidence and versioned route persistence."""

from __future__ import annotations

from collections.abc import Sequence

import geoalchemy2
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0002_evidence_rights_and_versioned_routes"
down_revision: str | Sequence[str] | None = "0001_isolated_engine_schema"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "summit_data_engine"
uuid = postgresql.UUID(as_uuid=True)
jsonb = postgresql.JSONB(astext_type=sa.Text())
status = postgresql.ENUM(
    "imported",
    "processed",
    "needs_review",
    "verified",
    "rejected",
    name="verification_status",
    schema=SCHEMA,
    create_type=False,
)
rights = postgresql.ENUM(
    "factual_identity_only",
    "reusable_geometry",
    "unclear",
    name="rights_classification",
    schema=SCHEMA,
    create_type=False,
)


def _immutable(table: str, columns: Sequence[str]) -> None:
    op.execute(
        f"CREATE TRIGGER trg_{table}_immutable BEFORE UPDATE OF {', '.join(columns)} "
        f"ON {SCHEMA}.{table} FOR EACH ROW "
        f"EXECUTE FUNCTION {SCHEMA}.reject_immutable_field_update()"
    )


def upgrade() -> None:
    bind = op.get_bind()
    rights.create(bind, checkfirst=True)
    now = sa.text("CURRENT_TIMESTAMP")

    op.create_table(
        "evidence_sources",
        sa.Column("id", uuid, nullable=False),
        sa.Column("source_key", sa.String(200), nullable=False),
        sa.Column("version", sa.String(100), nullable=False),
        sa.Column("publisher", sa.String(300), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column("rights_classification", rights, nullable=False),
        sa.Column("rights_statement", sa.Text(), nullable=True),
        sa.Column(
            "geometry_reuse_allowed", sa.Boolean(), server_default=sa.false(), nullable=False
        ),
        sa.Column("factual_anchors", jsonb, server_default=sa.text("'[]'::jsonb"), nullable=False),
        sa.Column("retrieved_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=now, nullable=False),
        sa.CheckConstraint(
            "(geometry_reuse_allowed = true AND "
            "rights_classification = 'reusable_geometry' AND rights_statement IS NOT NULL) OR "
            "(geometry_reuse_allowed = false AND "
            "rights_classification <> 'reusable_geometry')",
            name="ck_evidence_sources_geometry_reuse_requires_rights",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_evidence_sources"),
        sa.UniqueConstraint(
            "source_key", "version", name="uq_evidence_sources_source_key_version"
        ),
        schema=SCHEMA,
    )
    op.create_index(
        "ix_evidence_sources_publisher",
        "evidence_sources",
        ["publisher"],
        schema=SCHEMA,
        postgresql_using="btree",
    )
    op.create_table(
        "route_identities",
        sa.Column("id", uuid, nullable=False),
        sa.Column("mountain_id", uuid, nullable=False),
        sa.Column("identity_key", sa.String(200), nullable=False),
        sa.Column("version", sa.String(100), nullable=False),
        sa.Column("canonical_name", sa.String(300), nullable=False),
        sa.Column("aliases", jsonb, server_default=sa.text("'[]'::jsonb"), nullable=False),
        sa.Column("status", status, server_default="needs_review", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=now, nullable=False),
        sa.ForeignKeyConstraint(
            ["mountain_id"],
            [f"{SCHEMA}.mountains.id"],
            name="fk_route_identities_mountain_id_mountains",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_route_identities"),
        sa.UniqueConstraint(
            "identity_key", "version", name="uq_route_identities_identity_key_version"
        ),
        schema=SCHEMA,
    )
    op.create_index(
        "ix_route_identities_mountain_status",
        "route_identities",
        ["mountain_id", "status"],
        schema=SCHEMA,
    )
    op.create_table(
        "route_definitions",
        sa.Column("id", uuid, nullable=False),
        sa.Column("route_identity_id", uuid, nullable=False),
        sa.Column("route_id", uuid, nullable=True),
        sa.Column("version", sa.String(100), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("status", status, server_default="needs_review", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=now, nullable=False),
        sa.ForeignKeyConstraint(
            ["route_identity_id"],
            [f"{SCHEMA}.route_identities.id"],
            name="fk_route_definitions_route_identity_id_route_identities",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["route_id"],
            [f"{SCHEMA}.routes.id"],
            name="fk_route_definitions_route_id_routes",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_route_definitions"),
        sa.UniqueConstraint(
            "route_identity_id", "version", name="uq_route_definitions_route_identity_id_version"
        ),
        schema=SCHEMA,
    )
    op.create_index(
        "ix_route_definitions_identity_status",
        "route_definitions",
        ["route_identity_id", "status"],
        schema=SCHEMA,
    )
    op.create_table(
        "route_definition_evidence",
        sa.Column("id", uuid, nullable=False),
        sa.Column("route_definition_id", uuid, nullable=False),
        sa.Column("evidence_source_id", uuid, nullable=False),
        sa.Column("purpose", sa.String(100), nullable=False),
        sa.ForeignKeyConstraint(
            ["route_definition_id"],
            [f"{SCHEMA}.route_definitions.id"],
            name="fk_route_def_evidence_definition",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["evidence_source_id"],
            [f"{SCHEMA}.evidence_sources.id"],
            name="fk_route_def_evidence_source",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_route_definition_evidence"),
        sa.UniqueConstraint(
            "route_definition_id",
            "evidence_source_id",
            name="uq_route_definition_evidence_definition_source",
        ),
        schema=SCHEMA,
    )
    op.create_table(
        "mountain_verifications",
        sa.Column("id", uuid, nullable=False),
        sa.Column("mountain_id", uuid, nullable=False),
        sa.Column("version", sa.String(100), nullable=False),
        sa.Column("state", status, server_default="needs_review", nullable=False),
        sa.Column("review_notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=now, nullable=False),
        sa.ForeignKeyConstraint(
            ["mountain_id"],
            [f"{SCHEMA}.mountains.id"],
            name="fk_mountain_verifications_mountain_id_mountains",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_mountain_verifications"),
        sa.UniqueConstraint(
            "mountain_id", "version", name="uq_mountain_verifications_mountain_id_version"
        ),
        schema=SCHEMA,
    )
    op.create_index(
        "ix_mountain_verifications_state",
        "mountain_verifications",
        ["state"],
        schema=SCHEMA,
        postgresql_using="btree",
    )
    op.create_table(
        "mountain_verification_evidence",
        sa.Column("id", uuid, nullable=False),
        sa.Column("mountain_verification_id", uuid, nullable=False),
        sa.Column("evidence_source_id", uuid, nullable=False),
        sa.ForeignKeyConstraint(
            ["mountain_verification_id"],
            [f"{SCHEMA}.mountain_verifications.id"],
            name="fk_mountain_verification_evidence_verification",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["evidence_source_id"],
            [f"{SCHEMA}.evidence_sources.id"],
            name="fk_mountain_verification_evidence_source",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_mountain_verification_evidence"),
        sa.UniqueConstraint(
            "mountain_verification_id",
            "evidence_source_id",
            name="uq_mountain_verification_evidence_verification_source",
        ),
        schema=SCHEMA,
    )
    op.create_table(
        "route_geometries",
        sa.Column("id", uuid, nullable=False),
        sa.Column("route_definition_id", uuid, nullable=False),
        sa.Column("version", sa.String(100), nullable=False),
        sa.Column(
            "geom",
            geoalchemy2.Geometry("LINESTRING", srid=4326, spatial_index=False),
            nullable=False,
        ),
        sa.Column("derivation_method", sa.String(100), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=now, nullable=False),
        sa.ForeignKeyConstraint(
            ["route_definition_id"],
            [f"{SCHEMA}.route_definitions.id"],
            name="fk_route_geometries_route_definition_id_route_definitions",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_route_geometries"),
        sa.UniqueConstraint(
            "route_definition_id", "version", name="uq_route_geometries_definition_version"
        ),
        schema=SCHEMA,
    )
    op.create_index(
        "ix_route_geometries_geom_gist",
        "route_geometries",
        ["geom"],
        schema=SCHEMA,
        postgresql_using="gist",
    )
    op.create_table(
        "route_geometry_members",
        sa.Column("id", uuid, nullable=False),
        sa.Column("route_geometry_id", uuid, nullable=False),
        sa.Column("source_bundle_id", uuid, nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("source_member_type", sa.String(32), nullable=False),
        sa.Column("source_member_id", sa.String(200), nullable=False),
        sa.Column("direction", sa.Integer(), server_default="1", nullable=False),
        sa.CheckConstraint(
            "sequence >= 0", name="ck_route_geometry_members_sequence_nonnegative"
        ),
        sa.ForeignKeyConstraint(
            ["route_geometry_id"],
            [f"{SCHEMA}.route_geometries.id"],
            name="fk_route_geometry_members_route_geometry_id_route_geometries",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["source_bundle_id"],
            [f"{SCHEMA}.source_bundles.id"],
            name="fk_route_geometry_members_source_bundle_id_source_bundles",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_route_geometry_members"),
        sa.UniqueConstraint(
            "route_geometry_id",
            "sequence",
            name="uq_route_geometry_members_geometry_sequence",
        ),
        schema=SCHEMA,
    )
    op.create_table(
        "dem_tiles",
        sa.Column("id", uuid, nullable=False),
        sa.Column("source_bundle_id", uuid, nullable=False),
        sa.Column("tile_key", sa.String(200), nullable=False),
        sa.Column("sha256", sa.String(64), nullable=False),
        sa.Column(
            "footprint",
            geoalchemy2.Geometry("POLYGON", srid=4326, spatial_index=False),
            nullable=False,
        ),
        sa.Column("metadata", jsonb, server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=now, nullable=False),
        sa.ForeignKeyConstraint(
            ["source_bundle_id"],
            [f"{SCHEMA}.source_bundles.id"],
            name="fk_dem_tiles_source_bundle_id_source_bundles",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_dem_tiles"),
        sa.UniqueConstraint("source_bundle_id", "tile_key", name="uq_dem_tiles_bundle_tile"),
        schema=SCHEMA,
    )
    op.create_index(
        "ix_dem_tiles_footprint_gist",
        "dem_tiles",
        ["footprint"],
        schema=SCHEMA,
        postgresql_using="gist",
    )
    op.create_table(
        "route_elevation_profile_sources",
        sa.Column("id", uuid, nullable=False),
        sa.Column("profile_id", uuid, nullable=False),
        sa.Column("dem_tile_id", uuid, nullable=False),
        sa.ForeignKeyConstraint(
            ["profile_id"],
            [f"{SCHEMA}.route_elevation_profiles.id"],
            name="fk_route_elevation_profile_sources_profile",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["dem_tile_id"],
            [f"{SCHEMA}.dem_tiles.id"],
            name="fk_route_elevation_profile_sources_dem_tile",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_route_elevation_profile_sources"),
        sa.UniqueConstraint(
            "profile_id",
            "dem_tile_id",
            name="uq_route_elevation_profile_sources_profile_tile",
        ),
        schema=SCHEMA,
    )

    immutable = {
        "evidence_sources": [
            "source_key",
            "version",
            "publisher",
            "title",
            "url",
            "rights_classification",
            "rights_statement",
            "geometry_reuse_allowed",
            "factual_anchors",
            "retrieved_at",
        ],
        "route_identities": [
            "mountain_id",
            "identity_key",
            "version",
            "canonical_name",
            "aliases",
            "status",
        ],
        "route_definitions": [
            "route_identity_id",
            "route_id",
            "version",
            "description",
            "status",
        ],
        "route_definition_evidence": [
            "route_definition_id",
            "evidence_source_id",
            "purpose",
        ],
        "mountain_verifications": [
            "mountain_id",
            "version",
            "state",
            "review_notes",
        ],
        "mountain_verification_evidence": [
            "mountain_verification_id",
            "evidence_source_id",
        ],
        "route_geometries": [
            "route_definition_id",
            "version",
            "geom",
            "derivation_method",
        ],
        "route_geometry_members": [
            "route_geometry_id",
            "source_bundle_id",
            "sequence",
            "source_member_type",
            "source_member_id",
            "direction",
        ],
        "dem_tiles": [
            "source_bundle_id",
            "tile_key",
            "sha256",
            "footprint",
            "metadata",
        ],
        "route_elevation_profile_sources": ["profile_id", "dem_tile_id"],
    }
    for table, columns in immutable.items():
        _immutable(table, columns)


def downgrade() -> None:
    for table in (
        "route_elevation_profile_sources",
        "dem_tiles",
        "route_geometry_members",
        "route_geometries",
        "mountain_verification_evidence",
        "mountain_verifications",
        "route_definition_evidence",
        "route_definitions",
        "route_identities",
        "evidence_sources",
    ):
        op.drop_table(table, schema=SCHEMA)
    rights.drop(op.get_bind(), checkfirst=True)