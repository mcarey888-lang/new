"""Keep normalized mountain facts immutable for every source release."""

from __future__ import annotations

from collections.abc import Sequence

import geoalchemy2
import sqlalchemy as sa

from alembic import op

revision: str = "0004_release_fact_snapshots"
down_revision: str | Sequence[str] | None = "0003_dobih_hill_catalogue"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "summit_data_engine"


def _immutable(columns: Sequence[str]) -> None:
    op.execute(
        f"CREATE TRIGGER trg_mountain_source_records_immutable "
        f"BEFORE UPDATE OF {', '.join(columns)} "
        f"ON {SCHEMA}.mountain_source_records FOR EACH ROW "
        f"EXECUTE FUNCTION {SCHEMA}.reject_immutable_field_update()"
    )


ORIGINAL_IMMUTABLE_COLUMNS = (
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
)

SNAPSHOT_COLUMNS = (
    "name",
    "country",
    "region",
    "area",
    "county",
    "elevation_m",
    "prominence_m",
    "col_height_m",
    "grid_reference",
    "summit_feature",
    "geom",
)


def upgrade() -> None:
    for column in (
        sa.Column("name", sa.String(300)),
        sa.Column("country", sa.String(100)),
        sa.Column("region", sa.String(200)),
        sa.Column("area", sa.String(200)),
        sa.Column("county", sa.String(200)),
        sa.Column("elevation_m", sa.Float()),
        sa.Column("prominence_m", sa.Float()),
        sa.Column("col_height_m", sa.Float()),
        sa.Column("grid_reference", sa.String(32)),
        sa.Column("summit_feature", sa.String(300)),
        sa.Column(
            "geom",
            geoalchemy2.Geometry("POINT", srid=4326, spatial_index=False),
        ),
    ):
        op.add_column("mountain_source_records", column, schema=SCHEMA)

    op.execute(
        f"""
        UPDATE {SCHEMA}.mountain_source_records AS r
        SET
          name = m.name,
          country = m.country,
          region = m.region,
          area = m.area,
          county = m.county,
          elevation_m = m.elevation_m,
          prominence_m = m.prominence_m,
          col_height_m = m.col_height_m,
          grid_reference = m.grid_reference,
          summit_feature = m.summit_feature,
          geom = m.geom
        FROM {SCHEMA}.mountains AS m
        WHERE m.id = r.mountain_id
        """
    )
    for column in (
        "name",
        "country",
        "elevation_m",
        "prominence_m",
        "col_height_m",
        "grid_reference",
        "geom",
    ):
        op.alter_column(
            "mountain_source_records",
            column,
            nullable=False,
            schema=SCHEMA,
        )

    op.create_check_constraint(
        "ck_mountain_source_records_elevation_m_nonnegative",
        "mountain_source_records",
        "elevation_m >= 0",
        schema=SCHEMA,
    )
    op.create_check_constraint(
        "ck_mountain_source_records_prominence_m_nonnegative",
        "mountain_source_records",
        "prominence_m >= 0",
        schema=SCHEMA,
    )
    op.create_check_constraint(
        "ck_mountain_source_records_col_height_m_nonnegative",
        "mountain_source_records",
        "col_height_m >= 0",
        schema=SCHEMA,
    )
    op.create_check_constraint(
        "ck_mountain_source_records_geom_coordinate_range",
        "mountain_source_records",
        "ST_X(geom) BETWEEN -180 AND 180 AND ST_Y(geom) BETWEEN -90 AND 90",
        schema=SCHEMA,
    )
    op.create_index(
        "ix_mountain_source_records_name",
        "mountain_source_records",
        ["name"],
        schema=SCHEMA,
        postgresql_using="btree",
    )
    op.create_index(
        "ix_mountain_source_records_country_region",
        "mountain_source_records",
        ["country", "region"],
        schema=SCHEMA,
        postgresql_using="btree",
    )
    op.create_index(
        "ix_mountain_source_records_elevation_prominence",
        "mountain_source_records",
        ["elevation_m", "prominence_m"],
        schema=SCHEMA,
        postgresql_using="btree",
    )
    op.create_index(
        "ix_mountain_source_records_geom_gist",
        "mountain_source_records",
        ["geom"],
        schema=SCHEMA,
        postgresql_using="gist",
    )

    op.execute(
        f"DROP TRIGGER trg_mountain_source_records_immutable "
        f"ON {SCHEMA}.mountain_source_records"
    )
    _immutable((*ORIGINAL_IMMUTABLE_COLUMNS, *SNAPSHOT_COLUMNS))


def downgrade() -> None:
    op.execute(
        f"DROP TRIGGER trg_mountain_source_records_immutable "
        f"ON {SCHEMA}.mountain_source_records"
    )
    _immutable(ORIGINAL_IMMUTABLE_COLUMNS)

    op.drop_index(
        "ix_mountain_source_records_geom_gist",
        table_name="mountain_source_records",
        schema=SCHEMA,
    )
    op.drop_index(
        "ix_mountain_source_records_elevation_prominence",
        table_name="mountain_source_records",
        schema=SCHEMA,
    )
    op.drop_index(
        "ix_mountain_source_records_country_region",
        table_name="mountain_source_records",
        schema=SCHEMA,
    )
    op.drop_index(
        "ix_mountain_source_records_name",
        table_name="mountain_source_records",
        schema=SCHEMA,
    )
    op.drop_constraint(
        "ck_mountain_source_records_geom_coordinate_range",
        "mountain_source_records",
        schema=SCHEMA,
    )
    op.drop_constraint(
        "ck_mountain_source_records_col_height_m_nonnegative",
        "mountain_source_records",
        schema=SCHEMA,
    )
    op.drop_constraint(
        "ck_mountain_source_records_prominence_m_nonnegative",
        "mountain_source_records",
        schema=SCHEMA,
    )
    op.drop_constraint(
        "ck_mountain_source_records_elevation_m_nonnegative",
        "mountain_source_records",
        schema=SCHEMA,
    )
    for column in reversed(SNAPSHOT_COLUMNS):
        op.drop_column("mountain_source_records", column, schema=SCHEMA)