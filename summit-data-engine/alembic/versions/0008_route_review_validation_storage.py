"""Add append-only exact-version route review storage; no route approvals."""
from pathlib import Path
from alembic import op

revision = "0008_route_review_validation_storage"
down_revision = "0007_publish_engine_data_in_public"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Never invoked at app startup or by publishing hooks. Development adoption
    # of a pre-existing catalogue is applied as a focused, reviewed transaction;
    # do not replay the old schema relocation chain over populated public tables.
    sql = Path(__file__).resolve().parents[2] / "sql" / "route_review_validation_v1.sql"
    op.execute(sql.read_text())


def downgrade() -> None:
    # Historical review/approval evidence must not be silently discarded.
    raise RuntimeError("Review evidence rollback requires a separately reviewed retention/migration plan")
