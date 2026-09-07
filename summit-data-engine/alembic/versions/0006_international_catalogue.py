"""Add international catalogue aliases and versioned route facts."""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0006_international_catalogue"
down_revision: str | Sequence[str] | None = "0005_api_lookup_indexes"
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


def _immutable(table: str, columns: Sequence[str]) -> None:
    op.execute(
        f"CREATE TRIGGER trg_{table}_immutable BEFORE UPDATE OF {', '.join(columns)} "
        f"ON {SCHEMA}.{table} FOR EACH ROW "
        f"EXECUTE FUNCTION {SCHEMA}.reject_immutable_field_update()"
    )


def upgrade() -> None:
    for column in ("prominence_m", "col_height_m", "grid_reference"):
        op.alter_column(
            "mountain_source_records",
            column,
            existing_type=sa.Float() if column != "grid_reference" else sa.String(32),
            nullable=True,
            schema=SCHEMA,
        )

    now = sa.text("CURRENT_TIMESTAMP")
    op.create_table(
        "mountain_aliases",
        sa.Column("id", uuid, nullable=False),
        sa.Column("mountain_id", uuid, nullable=False),
        sa.Column("source_record_id", uuid, nullable=True),
        sa.Column("evidence_source_id", uuid, nullable=True),
        sa.Column("name", sa.String(300), nullable=False),
        sa.Column("normalized_name", sa.String(300), nullable=False),
        sa.Column("language_or_note", sa.String(200), nullable=True),
        sa.Column("status", status, nullable=False),
        sa.Column("provenance_version", sa.String(100), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=now, nullable=False),
        sa.CheckConstraint("btrim(name) <> ''", name="ck_mountain_aliases_name_nonblank"),
        sa.CheckConstraint(
            "btrim(normalized_name) <> ''",
            name="ck_mountain_aliases_normalized_name_nonblank",
        ),
        sa.CheckConstraint(
            "language_or_note IS NULL OR btrim(language_or_note) <> ''",
            name="ck_mountain_aliases_language_or_note_nonblank",
        ),
        sa.CheckConstraint(
            "btrim(provenance_version) <> ''",
            name="ck_mountain_aliases_provenance_nonblank",
        ),
        sa.ForeignKeyConstraint(
            ["mountain_id"], [f"{SCHEMA}.mountains.id"],
            name="fk_mountain_aliases_mountain_id_mountains", ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["source_record_id"], [f"{SCHEMA}.mountain_source_records.id"],
            name="fk_mountain_aliases_source_record", ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["evidence_source_id"], [f"{SCHEMA}.evidence_sources.id"],
            name="fk_mountain_aliases_evidence_source", ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_mountain_aliases"),
        sa.UniqueConstraint(
            "mountain_id", "normalized_name",
            name="uq_mountain_aliases_mountain_normalized_name",
        ),
        schema=SCHEMA,
    )
    op.create_index(
        "ix_mountain_aliases_normalized_name",
        "mountain_aliases",
        ["normalized_name"],
        schema=SCHEMA,
        postgresql_using="btree",
    )
    op.create_index(
        "ix_mountain_aliases_name_lower",
        "mountain_aliases",
        [sa.text("lower(name)")],
        schema=SCHEMA,
        postgresql_using="btree",
    )

    op.create_table(
        "route_facts",
        sa.Column("id", uuid, nullable=False),
        sa.Column("route_definition_id", uuid, nullable=False),
        sa.Column("source_bundle_id", uuid, nullable=False),
        sa.Column("evidence_source_id", uuid, nullable=True),
        sa.Column("version", sa.String(100), nullable=False),
        sa.Column("start_name", sa.String(300), nullable=True),
        sa.Column("start_elevation_m", sa.Float(), nullable=True),
        sa.Column("summit_elevation_m", sa.Float(), nullable=True),
        sa.Column("distance_km", sa.Float(), nullable=True),
        sa.Column("total_ascent_m", sa.Float(), nullable=True),
        sa.Column("total_descent_m", sa.Float(), nullable=True),
        sa.Column("typical_duration_hours", sa.Float(), nullable=True),
        sa.Column("status", status, nullable=False),
        sa.Column("qa_flags", jsonb, server_default=sa.text("'[]'::jsonb"), nullable=False),
        sa.Column("provenance_version", sa.String(100), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=now, nullable=False),
        sa.CheckConstraint(
            "start_name IS NULL OR btrim(start_name) <> ''",
            name="ck_route_facts_start_name_nonblank",
        ),
        sa.CheckConstraint(
            "btrim(version) <> '' AND btrim(provenance_version) <> ''",
            name="ck_route_facts_versions_nonblank",
        ),
        sa.CheckConstraint(
            "start_elevation_m IS NULL OR "
            "(start_elevation_m > '-Infinity'::float8 "
            "AND start_elevation_m < 'Infinity'::float8)",
            name="ck_route_facts_start_elevation_valid",
        ),
        sa.CheckConstraint(
            "summit_elevation_m IS NULL OR "
            "(summit_elevation_m > '-Infinity'::float8 "
            "AND summit_elevation_m < 'Infinity'::float8)",
            name="ck_route_facts_summit_elevation_valid",
        ),
        sa.CheckConstraint(
            "distance_km IS NULL OR (distance_km >= 0 AND distance_km < 'Infinity'::float8)",
            name="ck_route_facts_distance_valid",
        ),
        sa.CheckConstraint(
            "total_ascent_m IS NULL OR "
            "(total_ascent_m >= 0 AND total_ascent_m < 'Infinity'::float8)",
            name="ck_route_facts_ascent_valid",
        ),
        sa.CheckConstraint(
            "total_descent_m IS NULL OR "
            "(total_descent_m >= 0 AND total_descent_m < 'Infinity'::float8)",
            name="ck_route_facts_descent_valid",
        ),
        sa.CheckConstraint(
            "typical_duration_hours IS NULL OR "
            "(typical_duration_hours > 0 AND typical_duration_hours < 'Infinity'::float8)",
            name="ck_route_facts_duration_valid",
        ),
        sa.ForeignKeyConstraint(
            ["route_definition_id"], [f"{SCHEMA}.route_definitions.id"],
            name="fk_route_facts_route_definition", ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["source_bundle_id"], [f"{SCHEMA}.source_bundles.id"],
            name="fk_route_facts_source_bundle", ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["evidence_source_id"], [f"{SCHEMA}.evidence_sources.id"],
            name="fk_route_facts_evidence_source", ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_route_facts"),
        sa.UniqueConstraint(
            "route_definition_id", "version",
            name="uq_route_facts_definition_version",
        ),
        schema=SCHEMA,
    )
    op.create_index(
        "ix_route_facts_definition_status",
        "route_facts",
        ["route_definition_id", "status"],
        schema=SCHEMA,
    )
    _immutable(
        "mountain_aliases",
        (
            "mountain_id", "source_record_id", "evidence_source_id", "name",
            "normalized_name", "language_or_note", "status", "provenance_version",
        ),
    )
    _immutable(
        "route_facts",
        (
            "route_definition_id", "source_bundle_id", "evidence_source_id", "version",
            "start_name", "start_elevation_m", "summit_elevation_m", "distance_km",
            "total_ascent_m", "total_descent_m", "typical_duration_hours", "status",
            "qa_flags", "provenance_version",
        ),
    )


def downgrade() -> None:
    op.drop_table("route_facts", schema=SCHEMA)
    op.drop_table("mountain_aliases", schema=SCHEMA)
    for column in ("prominence_m", "col_height_m", "grid_reference"):
        op.alter_column(
            "mountain_source_records",
            column,
            existing_type=sa.Float() if column != "grid_reference" else sa.String(32),
            nullable=False,
            schema=SCHEMA,
        )
