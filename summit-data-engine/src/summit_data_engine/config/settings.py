"""Environment settings with a strict standalone database boundary."""

from __future__ import annotations

from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class EngineSettings(BaseSettings):
    """Settings read only from engine-prefixed variables and explicit source vars."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    engine_database_url: str | None = Field(default=None, alias="ENGINE_DATABASE_URL")
    engine_db_schema: str = Field(default="public", alias="ENGINE_DB_SCHEMA")
    raw_data_dir: Path = Field(default=Path("data/raw"), alias="RAW_DATA_DIR")
    processed_data_dir: Path = Field(default=Path("data/processed"), alias="PROCESSED_DATA_DIR")
    validation_policy_path: Path = Field(
        default=Path("config/validation_policy.toml"),
        alias="VALIDATION_POLICY_PATH",
    )
    calculation_version: str = Field(
        default="summitready_elevation_v1",
        alias="CALCULATION_VERSION",
    )
    validation_version: str = Field(
        default="summitready_validation_v1",
        alias="VALIDATION_VERSION",
    )
    metric_crs: str = Field(default="EPSG:27700", alias="METRIC_CRS")
    review_output_path: Path = Field(
        default=Path("data/processed/tryfan_review.html"),
        alias="REVIEW_OUTPUT_PATH",
    )

    def require_engine_database_url(self) -> str:
        """Return the engine URL or fail without inspecting generic workspace variables."""
        if not self.engine_database_url:
            raise RuntimeError(
                "ENGINE_DATABASE_URL is required for database operations. "
                "The standalone engine never falls back to DATABASE_URL."
            )
        if self.engine_database_url.startswith("postgresql://"):
            return self.engine_database_url.replace(
                "postgresql://",
                "postgresql+psycopg://",
                1,
            )
        return self.engine_database_url
