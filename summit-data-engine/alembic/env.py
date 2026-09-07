"""Alembic environment for the isolated engine database."""

from __future__ import annotations

from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool

from alembic import context
from summit_data_engine.config.settings import EngineSettings
from summit_data_engine.db import SCHEMA, Base

config = context.config
if config.config_file_name:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def include_name(name: str | None, type_: str, parent_names: dict[str, str | None]) -> bool:
    """Exclude every schema except the one owned by this application."""
    if type_ == "schema":
        return name == SCHEMA
    schema_name = parent_names.get("schema_name")
    return schema_name in (None, SCHEMA)


def run_migrations_offline() -> None:
    settings = EngineSettings()
    context.configure(
        url=settings.require_engine_database_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_schemas=True,
        include_name=include_name,
        version_table_schema=SCHEMA,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    settings = EngineSettings()
    section = config.get_section(config.config_ini_section) or {}
    section["sqlalchemy.url"] = settings.require_engine_database_url()
    connectable = engine_from_config(section, prefix="sqlalchemy.", poolclass=pool.NullPool)
    with connectable.connect() as connection:
        # Alembic creates its version table before the first revision runs, so
        # a blank database needs the owned schema bootstrapped first.
        connection.exec_driver_sql(f'CREATE SCHEMA IF NOT EXISTS "{SCHEMA}"')
        connection.exec_driver_sql(
            f"""
            CREATE TABLE IF NOT EXISTS "{SCHEMA}".alembic_version (
              version_num VARCHAR(128) NOT NULL PRIMARY KEY
            )
            """
        )
        connection.exec_driver_sql(
            f"""
            ALTER TABLE "{SCHEMA}".alembic_version
            ALTER COLUMN version_num TYPE VARCHAR(128)
            """
        )
        connection.commit()
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            include_schemas=True,
            include_name=include_name,
            version_table_schema=SCHEMA,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()