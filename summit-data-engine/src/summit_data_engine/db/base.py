"""Declarative base and database-wide constants."""

from __future__ import annotations

from sqlalchemy import MetaData
from sqlalchemy.orm import DeclarativeBase

# Engine-owned data is published in PostgreSQL's shared public schema.  The
# Alembic version table intentionally remains in the legacy engine schema; see
# alembic/env.py.
SCHEMA = "public"

NAMING_CONVENTION = {
    "ix": "ix_%(table_name)s_%(column_0_name)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    """Base for tables owned exclusively by the standalone data engine."""

    metadata = MetaData(schema=SCHEMA, naming_convention=NAMING_CONVENTION)