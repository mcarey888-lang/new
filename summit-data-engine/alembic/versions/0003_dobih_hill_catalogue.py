"""Add versioned DoBIH facts to the canonical mountain catalogue."""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0003_dobih_hill_catalogue"
down_revision: str | Sequence[str] | None = "0002_evidence_rights_and_versioned_routes"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "summit_data_engine"
uuid = postgresql.UUID(as_uuid=True)
jsonb = postgresql.JSONB(astext_type=sa.Text())


def _immutable(table: str, columns: Sequence[str]) -> None:
    op.execute(
        f"CREATE TRIGGER trg_{table}_immutable BEFORE UPDATE OF {', '.join(columns)} "
        f"ON {SCHEMA}.{table} FOR EACH ROW "
        f"EXECUTE FUNCTION {SCHEMA}.reject_immutable_field_update()"
    )


def upgrade() -> None:
    now = sa.text("CURRENT_TIMESTAMP")

    op.add_column("mountains", sa.Column("canonical_source_key", sa.String(200)), schema=SCHEMA)
    op.add_column("mountains", sa.Column("country", sa.String(100)), schema=SCHEMA)
    op.add_column("mountains", sa.Column("region", sa.String(200)), schema=SCHEMA)
    op.add_column("mountains", sa.Column("area", sa.String(200)), schema=SCHEMA)
    op.add_column("mountains", sa.Column("county", sa.String(200)), schema=SCHEMA)
    op.add_column("mountains", sa.Column("elevation_m", sa.Float()), schema=SCHEMA)
    op.add_column("mountains", sa.Column("prominence_m", sa.Float()), schema=SCHEMA)
    op.add_column("mountains", sa.Column("col_height_m", sa.Float()), schema=SCHEMA)
    op.add_column("mountains", sa.Column("grid_reference", sa.String(32)), schema=SCHEMA)
    op.add_column("mountains", sa.Column("summit_feature", sa.String(300)), schema=SCHEMA)
    op.create_unique_constraint(
        "uq_mountains_canonical_source_key",
        "mountains",
        ["canonical_source_key"],
        schema=SCHEMA,
    )
    op.create_check_constraint(
        "ck_mountains_elevation_m_nonnegative",
        "mountains",
        "elevation_m IS NULL OR elevation_m >= 0",
        schema=SCHEMA,
    )
    op.create_check_constraint(
        "ck_mountains_prominence_m_nonnegative",
        "mountains",
        "prominence_m IS NULL OR prominence_m >= 0",
        schema=SCHEMA,
    )
    op.create_check_constraint(
        "ck_mountains_col_height_m_nonnegative",
        "mountains",
        "col_height_m IS NULL OR col_height_m >= 0",
        schema=SCHEMA,
    )
    op.create_check_constraint(
        "ck_mountains_geom_coordinate_range",
        "mountains",
        "ST_X(geom) BETWEEN -180 AND 180 AND ST_Y(geom) BETWEEN -90 AND 90",
        schema=SCHEMA,
    )
    op.create_index(
        "ix_mountains_name",
        "mountains",
        ["name"],
        schema=SCHEMA,
        postgresql_using="btree",
    )
    op.create_index(
        "ix_mountains_country_region",
        "mountains",
        ["country", "region"],
        schema=SCHEMA,
        postgresql_using="btree",
    )
    op.create_index(
        "ix_mountains_elevation_prominence",
        "mountains",
        ["elevation_m", "prominence_m"],
        schema=SCHEMA,
        postgresql_using="btree",
    )

    op.create_table(
        "mountain_source_records",
        sa.Column("id", uuid, nullable=False),
        sa.Column("mountain_id", uuid, nullable=False),
        sa.Column("source_bundle_id", uuid, nullable=False),
        sa.Column("source_dataset", sa.String(200), nullable=False),
        sa.Column("source_version", sa.String(100), nullable=False),
        sa.Column("source_feature_id", sa.String(200), nullable=False),
        sa.Column("source_release_date", sa.Date(), nullable=False),
        sa.Column("source_file_sha256", sa.String(64), nullable=False),
        sa.Column("source_license", sa.Text(), nullable=False),
        sa.Column("source_attribution", sa.Text(), nullable=False),
        sa.Column("source_trust", sa.String(32), nullable=False),
        sa.Column("final_verification_status", sa.String(32), nullable=False),
        sa.Column("needs_review_reason", sa.Text()),
        sa.Column("qa_status", sa.String(32), nullable=False),
        sa.Column("qa_flags", jsonb, server_default=sa.text("'[]'::jsonb"), nullable=False),
        sa.Column("data_priority", sa.Integer(), nullable=False),
        sa.Column("ai_fallback_allowed", sa.Boolean(), nullable=False),
        sa.Column("raw_payload", jsonb, nullable=False),
        sa.Column("prepared_payload", jsonb, nullable=False),
        sa.Column("import_payload_sha256", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=now, nullable=False),
        sa.CheckConstraint(
            "data_priority > 0",
            name="ck_mountain_source_records_data_priority_positive",
        ),
        sa.CheckConstraint(
            "final_verification_status IN ('trusted_source', 'needs_review')",
            name="ck_mountain_source_records_final_verification_status_valid",
        ),
        sa.CheckConstraint(
            "qa_status IN ('pass', 'info', 'review')",
            name="ck_mountain_source_records_qa_status_valid",
        ),
        sa.CheckConstraint(
            "length(source_file_sha256) = 64",
            name="ck_mountain_source_records_source_file_sha256_length",
        ),
        sa.CheckConstraint(
            "length(import_payload_sha256) = 64",
            name="ck_mountain_source_records_import_payload_sha256_length",
        ),
        sa.ForeignKeyConstraint(
            ["mountain_id"],
            [f"{SCHEMA}.mountains.id"],
            name="fk_mountain_source_records_mountain_id_mountains",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["source_bundle_id"],
            [f"{SCHEMA}.source_bundles.id"],
            name="fk_mountain_source_records_source_bundle_id_source_bundles",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_mountain_source_records"),
        sa.UniqueConstraint(
            "source_dataset",
            "source_version",
            "source_feature_id",
            name="uq_mountain_source_records_dataset_version_feature",
        ),
        sa.UniqueConstraint(
            "source_bundle_id",
            "source_feature_id",
            name="uq_mountain_source_records_bundle_feature",
        ),
        schema=SCHEMA,
    )
    op.create_index(
        "ix_mountain_source_records_source_feature",
        "mountain_source_records",
        ["source_dataset", "source_feature_id"],
        schema=SCHEMA,
        postgresql_using="btree",
    )
    op.create_index(
        "ix_mountain_source_records_version_status",
        "mountain_source_records",
        ["source_version", "final_verification_status", "qa_status"],
        schema=SCHEMA,
        postgresql_using="btree",
    )
    op.create_index(
        "ix_mountain_source_records_mountain_release",
        "mountain_source_records",
        ["mountain_id", "source_release_date"],
        schema=SCHEMA,
        postgresql_using="btree",
    )
    op.create_index(
        "ix_mountain_source_records_source_bundle_id",
        "mountain_source_records",
        ["source_bundle_id"],
        schema=SCHEMA,
        postgresql_using="btree",
    )

    op.create_table(
        "mountain_classifications",
        sa.Column("id", uuid, nullable=False),
        sa.Column("source_record_id", uuid, nullable=False),
        sa.Column("classification_code", sa.String(32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=now, nullable=False),
        sa.ForeignKeyConstraint(
            ["source_record_id"],
            [f"{SCHEMA}.mountain_source_records.id"],
            name="fk_mountain_classifications_source_record_id_source_records",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_mountain_classifications"),
        sa.UniqueConstraint(
            "source_record_id",
            "classification_code",
            name="uq_mountain_classifications_record_code",
        ),
        schema=SCHEMA,
    )
    op.create_index(
        "ix_mountain_classifications_code",
        "mountain_classifications",
        ["classification_code"],
        schema=SCHEMA,
        postgresql_using="btree",
    )

    _immutable(
        "mountain_source_records",
        (
            "mountain_id",
            "source_bundle_id",
            "source_dataset",
            "source_version",
            "source_feature_id",
            "source_release_date",
            "source_file_sha256",
            "source_license",
            "source_attribution",
            "source_trust",
            "final_verification_status",
            "needs_review_reason",
            "qa_status",
            "qa_flags",
            "data_priority",
            "ai_fallback_allowed",
            "raw_payload",
            "prepared_payload",
            "import_payload_sha256",
        ),
    )
    _immutable(
        "mountain_classifications",
        ("source_record_id", "classification_code"),
    )


def downgrade() -> None:
    op.drop_table("mountain_classifications", schema=SCHEMA)
    op.drop_table("mountain_source_records", schema=SCHEMA)

    op.drop_index("ix_mountains_elevation_prominence", table_name="mountains", schema=SCHEMA)
    op.drop_index("ix_mountains_country_region", table_name="mountains", schema=SCHEMA)
    op.drop_index("ix_mountains_name", table_name="mountains", schema=SCHEMA)
    op.drop_constraint("ck_mountains_geom_coordinate_range", "mountains", schema=SCHEMA)
    op.drop_constraint("ck_mountains_col_height_m_nonnegative", "mountains", schema=SCHEMA)
    op.drop_constraint("ck_mountains_prominence_m_nonnegative", "mountains", schema=SCHEMA)
    op.drop_constraint("ck_mountains_elevation_m_nonnegative", "mountains", schema=SCHEMA)
    op.drop_constraint("uq_mountains_canonical_source_key", "mountains", schema=SCHEMA)

    for column in (
        "summit_feature",
        "grid_reference",
        "col_height_m",
        "prominence_m",
        "elevation_m",
        "county",
        "area",
        "region",
        "country",
        "canonical_source_key",
    ):
        op.drop_column("mountains", column, schema=SCHEMA)