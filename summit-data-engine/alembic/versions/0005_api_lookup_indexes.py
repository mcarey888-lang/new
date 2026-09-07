"""Add expression indexes for read-only API catalogue lookups."""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0005_api_lookup_indexes"
down_revision: str | Sequence[str] | None = "0004_release_fact_snapshots"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "summit_data_engine"


def upgrade() -> None:
    op.execute(
        f"""
        CREATE INDEX ix_msr_normalized_name
        ON {SCHEMA}.mountain_source_records
        (lower(regexp_replace(btrim(name), '\\s+', ' ', 'g')))
        """
    )
    op.execute(
        f"""
        CREATE INDEX ix_msr_geom_geography_gist
        ON {SCHEMA}.mountain_source_records
        USING gist ((geom::geography))
        """
    )


def downgrade() -> None:
    op.drop_index(
        "ix_msr_geom_geography_gist",
        table_name="mountain_source_records",
        schema=SCHEMA,
    )
    op.drop_index(
        "ix_msr_normalized_name",
        table_name="mountain_source_records",
        schema=SCHEMA,
    )