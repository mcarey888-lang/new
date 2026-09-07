"""Database engine and session construction."""

from __future__ import annotations

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

from summit_data_engine.config.settings import EngineSettings


def create_database_engine(settings: EngineSettings | None = None, **kwargs: object) -> Engine:
    """Create an engine from the standalone engine URL only."""
    engine_settings = settings or EngineSettings()
    return create_engine(engine_settings.require_engine_database_url(), **kwargs)


def create_session_factory(engine: Engine) -> sessionmaker[Session]:
    """Create SQLAlchemy 2 sessions bound to an explicit engine."""
    return sessionmaker(bind=engine, class_=Session, expire_on_commit=False)