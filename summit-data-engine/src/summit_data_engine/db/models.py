"""SQLAlchemy persistence models for sourced and derived route data."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any

from geoalchemy2 import Geometry
from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from summit_data_engine.db.base import SCHEMA, Base
from summit_data_engine.models.domain import RightsClassification
from summit_data_engine.models.domain import VerificationStatus as VerificationStatus

status_type = Enum(
    VerificationStatus,
    name="verification_status",
    schema=SCHEMA,
    values_callable=lambda members: [member.value for member in members],
)
rights_type = Enum(
    RightsClassification,
    name="rights_classification",
    schema=SCHEMA,
    values_callable=lambda members: [member.value for member in members],
)


class SourceBundle(Base):
    __tablename__ = "source_bundles"
    __table_args__ = (
        CheckConstraint("size_bytes >= 0", name="size_bytes_nonnegative"),
        UniqueConstraint("sha256"),
        Index(
            "ix_source_bundles_provider_retrieved_at",
            "provider",
            "retrieved_at",
            postgresql_using="btree",
        ),
        {"schema": SCHEMA},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_type: Mapped[str] = mapped_column(String(32), nullable=False)
    provider: Mapped[str] = mapped_column(String(200), nullable=False)
    source_url: Mapped[str] = mapped_column(Text, nullable=False)
    licence: Mapped[str] = mapped_column(Text, nullable=False)
    local_path: Mapped[str] = mapped_column(Text, nullable=False)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False, info={"immutable": True})
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    retrieved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    metadata_json: Mapped[dict[str, Any]] = mapped_column(
        "metadata", JSONB, nullable=False, default=dict, server_default="{}"
    )
    provenance_version: Mapped[str] = mapped_column(
        String(100), nullable=False, info={"immutable": True}
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class Mountain(Base):
    __tablename__ = "mountains"
    __table_args__ = (
        UniqueConstraint("source_bundle_id", "source_feature_id"),
        UniqueConstraint("canonical_source_key"),
        CheckConstraint(
            "elevation_m IS NULL OR elevation_m >= 0",
            name="elevation_m_nonnegative",
        ),
        CheckConstraint(
            "prominence_m IS NULL OR prominence_m >= 0",
            name="prominence_m_nonnegative",
        ),
        CheckConstraint(
            "col_height_m IS NULL OR col_height_m >= 0",
            name="col_height_m_nonnegative",
        ),
        CheckConstraint(
            "ST_X(geom) BETWEEN -180 AND 180 AND ST_Y(geom) BETWEEN -90 AND 90",
            name="geom_coordinate_range",
        ),
        Index("ix_mountains_status_name", "status", "name", postgresql_using="btree"),
        Index("ix_mountains_name", "name", postgresql_using="btree"),
        Index("ix_mountains_country_region", "country", "region", postgresql_using="btree"),
        Index(
            "ix_mountains_elevation_prominence",
            "elevation_m",
            "prominence_m",
            postgresql_using="btree",
        ),
        Index("ix_mountains_geom_gist", "geom", postgresql_using="gist"),
        {"schema": SCHEMA},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_bundle_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey(f"{SCHEMA}.source_bundles.id", ondelete="RESTRICT"), nullable=False
    )
    source_feature_id: Mapped[str] = mapped_column(String(200), nullable=False)
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    canonical_source_key: Mapped[str | None] = mapped_column(String(200))
    country: Mapped[str | None] = mapped_column(String(100))
    region: Mapped[str | None] = mapped_column(String(200))
    area: Mapped[str | None] = mapped_column(String(200))
    county: Mapped[str | None] = mapped_column(String(200))
    elevation_m: Mapped[float | None] = mapped_column(Float)
    prominence_m: Mapped[float | None] = mapped_column(Float)
    col_height_m: Mapped[float | None] = mapped_column(Float)
    grid_reference: Mapped[str | None] = mapped_column(String(32))
    summit_feature: Mapped[str | None] = mapped_column(String(300))
    status: Mapped[VerificationStatus] = mapped_column(status_type, nullable=False)
    geom: Mapped[Any] = mapped_column(
        Geometry("POINT", srid=4326, spatial_index=False), nullable=False
    )
    tags: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    provenance_version: Mapped[str] = mapped_column(
        String(100), nullable=False, info={"immutable": True}
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    routes: Mapped[list[Route]] = relationship(back_populates="mountain")
    source_records: Mapped[list[MountainSourceRecord]] = relationship(back_populates="mountain")


class MountainSourceRecord(Base):
    """Immutable facts and review state for one source release."""

    __tablename__ = "mountain_source_records"
    __table_args__ = (
        UniqueConstraint("source_dataset", "source_version", "source_feature_id"),
        UniqueConstraint("source_bundle_id", "source_feature_id"),
        CheckConstraint("data_priority > 0", name="data_priority_positive"),
        CheckConstraint(
            "final_verification_status IN ('trusted_source', 'needs_review')",
            name="final_verification_status_valid",
        ),
        CheckConstraint(
            "qa_status IN ('pass', 'info', 'review')",
            name="qa_status_valid",
        ),
        CheckConstraint("length(source_file_sha256) = 64", name="source_file_sha256_length"),
        CheckConstraint("length(import_payload_sha256) = 64", name="import_payload_sha256_length"),
        CheckConstraint("elevation_m >= 0", name="elevation_m_nonnegative"),
        CheckConstraint(
            "prominence_m IS NULL OR prominence_m >= 0", name="prominence_m_nonnegative"
        ),
        CheckConstraint(
            "col_height_m IS NULL OR col_height_m >= 0", name="col_height_m_nonnegative"
        ),
        CheckConstraint(
            "ST_X(geom) BETWEEN -180 AND 180 AND ST_Y(geom) BETWEEN -90 AND 90",
            name="geom_coordinate_range",
        ),
        Index(
            "ix_mountain_source_records_source_feature",
            "source_dataset",
            "source_feature_id",
            postgresql_using="btree",
        ),
        Index(
            "ix_mountain_source_records_version_status",
            "source_version",
            "final_verification_status",
            "qa_status",
            postgresql_using="btree",
        ),
        Index(
            "ix_mountain_source_records_mountain_release",
            "mountain_id",
            "source_release_date",
            postgresql_using="btree",
        ),
        Index(
            "ix_mountain_source_records_source_bundle_id",
            "source_bundle_id",
            postgresql_using="btree",
        ),
        Index("ix_mountain_source_records_name", "name", postgresql_using="btree"),
        Index(
            "ix_mountain_source_records_country_region",
            "country",
            "region",
            postgresql_using="btree",
        ),
        Index(
            "ix_mountain_source_records_elevation_prominence",
            "elevation_m",
            "prominence_m",
            postgresql_using="btree",
        ),
        Index("ix_mountain_source_records_geom_gist", "geom", postgresql_using="gist"),
        Index(
            "ix_msr_normalized_name",
            text("lower(regexp_replace(btrim(name), '\\s+', ' ', 'g'))"),
            postgresql_using="btree",
        ),
        Index(
            "ix_msr_geom_geography_gist",
            text("(geom::geography)"),
            postgresql_using="gist",
        ),
        {"schema": SCHEMA},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    mountain_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey(f"{SCHEMA}.mountains.id", ondelete="RESTRICT"), nullable=False
    )
    source_bundle_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey(f"{SCHEMA}.source_bundles.id", ondelete="RESTRICT"), nullable=False
    )
    source_dataset: Mapped[str] = mapped_column(String(200), nullable=False)
    source_version: Mapped[str] = mapped_column(String(100), nullable=False)
    source_feature_id: Mapped[str] = mapped_column(String(200), nullable=False)
    source_release_date: Mapped[date] = mapped_column(nullable=False)
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    country: Mapped[str] = mapped_column(String(100), nullable=False)
    region: Mapped[str | None] = mapped_column(String(200))
    area: Mapped[str | None] = mapped_column(String(200))
    county: Mapped[str | None] = mapped_column(String(200))
    elevation_m: Mapped[float] = mapped_column(Float, nullable=False)
    prominence_m: Mapped[float | None] = mapped_column(Float)
    col_height_m: Mapped[float | None] = mapped_column(Float)
    grid_reference: Mapped[str | None] = mapped_column(String(32))
    summit_feature: Mapped[str | None] = mapped_column(String(300))
    geom: Mapped[Any] = mapped_column(
        Geometry("POINT", srid=4326, spatial_index=False), nullable=False
    )
    source_file_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    source_license: Mapped[str] = mapped_column(Text, nullable=False)
    source_attribution: Mapped[str] = mapped_column(Text, nullable=False)
    source_trust: Mapped[str] = mapped_column(String(32), nullable=False)
    final_verification_status: Mapped[str] = mapped_column(String(32), nullable=False)
    needs_review_reason: Mapped[str | None] = mapped_column(Text)
    qa_status: Mapped[str] = mapped_column(String(32), nullable=False)
    qa_flags: Mapped[list[str]] = mapped_column(
        JSONB, nullable=False, default=list, server_default="[]"
    )
    data_priority: Mapped[int] = mapped_column(Integer, nullable=False)
    ai_fallback_allowed: Mapped[bool] = mapped_column(Boolean, nullable=False)
    raw_payload: Mapped[dict[str, str]] = mapped_column(JSONB, nullable=False)
    prepared_payload: Mapped[dict[str, str]] = mapped_column(JSONB, nullable=False)
    import_payload_sha256: Mapped[str] = mapped_column(
        String(64), nullable=False, info={"immutable": True}
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    mountain: Mapped[Mountain] = relationship(back_populates="source_records")
    classifications: Mapped[list[MountainClassification]] = relationship(
        back_populates="source_record"
    )


class MountainClassification(Base):
    """One normalized DoBIH classification attached to a release record."""

    __tablename__ = "mountain_classifications"
    __table_args__ = (
        UniqueConstraint("source_record_id", "classification_code"),
        Index(
            "ix_mountain_classifications_code",
            "classification_code",
            postgresql_using="btree",
        ),
        {"schema": SCHEMA},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_record_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey(f"{SCHEMA}.mountain_source_records.id", ondelete="CASCADE"), nullable=False
    )
    classification_code: Mapped[str] = mapped_column(String(32), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    source_record: Mapped[MountainSourceRecord] = relationship(back_populates="classifications")


class MountainAlias(Base):
    """A Unicode-normalized alternate mountain name with explicit provenance."""

    __tablename__ = "mountain_aliases"
    __table_args__ = (
        UniqueConstraint("mountain_id", "normalized_name"),
        CheckConstraint("btrim(name) <> ''", name="name_nonblank"),
        CheckConstraint("btrim(normalized_name) <> ''", name="normalized_name_nonblank"),
        CheckConstraint(
            "language_or_note IS NULL OR btrim(language_or_note) <> ''",
            name="language_or_note_nonblank",
        ),
        CheckConstraint("btrim(provenance_version) <> ''", name="provenance_nonblank"),
        Index("ix_mountain_aliases_normalized_name", "normalized_name"),
        Index("ix_mountain_aliases_name_lower", func.lower(text("name"))),
        {"schema": SCHEMA},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    mountain_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey(f"{SCHEMA}.mountains.id", ondelete="RESTRICT"), nullable=False
    )
    source_record_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey(f"{SCHEMA}.mountain_source_records.id", ondelete="RESTRICT")
    )
    evidence_source_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey(f"{SCHEMA}.evidence_sources.id", ondelete="RESTRICT")
    )
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    normalized_name: Mapped[str] = mapped_column(String(300), nullable=False)
    language_or_note: Mapped[str | None] = mapped_column(String(200))
    status: Mapped[VerificationStatus] = mapped_column(status_type, nullable=False)
    provenance_version: Mapped[str] = mapped_column(
        String(100), nullable=False, info={"immutable": True}
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class Route(Base):
    __tablename__ = "routes"
    __table_args__ = (
        Index("ix_routes_mountain_status", "mountain_id", "status", postgresql_using="btree"),
        Index("ix_routes_geom_gist", "geom", postgresql_using="gist"),
        {"schema": SCHEMA},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    mountain_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey(f"{SCHEMA}.mountains.id", ondelete="RESTRICT"), nullable=False
    )
    requested_name: Mapped[str] = mapped_column(String(300), nullable=False)
    source_name: Mapped[str | None] = mapped_column(String(300))
    resolution_method: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[VerificationStatus] = mapped_column(status_type, nullable=False)
    geom: Mapped[Any | None] = mapped_column(
        Geometry("LINESTRING", srid=4326, spatial_index=False)
    )
    tags: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    provenance_version: Mapped[str] = mapped_column(
        String(100), nullable=False, info={"immutable": True}
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    mountain: Mapped[Mountain] = relationship(back_populates="routes")
    sources: Mapped[list[RouteSource]] = relationship(
        back_populates="route", cascade="all, delete-orphan"
    )
    validations: Mapped[list[RouteValidation]] = relationship(
        back_populates="route", cascade="all, delete-orphan"
    )
    elevation_profiles: Mapped[list[RouteElevationProfile]] = relationship(
        back_populates="route", cascade="all, delete-orphan"
    )


class RouteSource(Base):
    __tablename__ = "route_sources"
    __table_args__ = (
        UniqueConstraint("route_id", "source_bundle_id", "source_feature_id"),
        Index(
            "ix_route_sources_source_bundle_id",
            "source_bundle_id",
            postgresql_using="btree",
        ),
        {"schema": SCHEMA},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    route_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey(f"{SCHEMA}.routes.id", ondelete="CASCADE"), nullable=False
    )
    source_bundle_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey(f"{SCHEMA}.source_bundles.id", ondelete="RESTRICT"), nullable=False
    )
    source_feature_id: Mapped[str] = mapped_column(String(200), nullable=False)
    evidence: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    provenance_version: Mapped[str] = mapped_column(
        String(100), nullable=False, info={"immutable": True}
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    route: Mapped[Route] = relationship(back_populates="sources")


class RouteValidation(Base):
    __tablename__ = "route_validation"
    __table_args__ = (
        UniqueConstraint("route_id", "validation_version"),
        Index(
            "ix_route_validation_route_outcome",
            "route_id",
            "outcome",
            postgresql_using="btree",
        ),
        {"schema": SCHEMA},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    route_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey(f"{SCHEMA}.routes.id", ondelete="CASCADE"), nullable=False
    )
    validation_version: Mapped[str] = mapped_column(
        String(100), nullable=False, info={"immutable": True}
    )
    outcome: Mapped[str] = mapped_column(String(20), nullable=False)
    diagnostics: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False, default=list)
    validated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    route: Mapped[Route] = relationship(back_populates="validations")


class RouteElevationProfile(Base):
    __tablename__ = "route_elevation_profiles"
    __table_args__ = (
        CheckConstraint("sample_spacing_m > 0", name="sample_spacing_positive"),
        CheckConstraint("distance_m >= 0", name="distance_nonnegative"),
        UniqueConstraint("route_id", "source_bundle_id", "calculation_version"),
        Index(
            "ix_route_elevation_profiles_route_id",
            "route_id",
            postgresql_using="btree",
        ),
        {"schema": SCHEMA},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    route_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey(f"{SCHEMA}.routes.id", ondelete="CASCADE"), nullable=False
    )
    source_bundle_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey(f"{SCHEMA}.source_bundles.id", ondelete="RESTRICT"), nullable=False
    )
    calculation_version: Mapped[str] = mapped_column(
        String(100), nullable=False, info={"immutable": True}
    )
    sample_spacing_m: Mapped[float] = mapped_column(Float, nullable=False)
    smoothing_method: Mapped[str] = mapped_column(String(100), nullable=False)
    smoothing_parameters: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    distance_m: Mapped[float] = mapped_column(Float, nullable=False)
    total_ascent_m: Mapped[float] = mapped_column(Float, nullable=False)
    total_descent_m: Mapped[float] = mapped_column(Float, nullable=False)
    min_elevation_m: Mapped[float] = mapped_column(Float, nullable=False)
    max_elevation_m: Mapped[float] = mapped_column(Float, nullable=False)
    nodata_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    route: Mapped[Route] = relationship(back_populates="elevation_profiles")
    samples: Mapped[list[RouteElevationSample]] = relationship(
        back_populates="profile",
        cascade="all, delete-orphan",
        order_by="RouteElevationSample.sequence",
    )


class RouteElevationSample(Base):
    __tablename__ = "route_elevation_samples"
    __table_args__ = (
        CheckConstraint("sequence >= 0", name="sequence_nonnegative"),
        CheckConstraint("distance_m >= 0", name="distance_nonnegative"),
        UniqueConstraint("profile_id", "sequence"),
        Index(
            "ix_route_elevation_samples_profile_distance",
            "profile_id",
            "distance_m",
            postgresql_using="btree",
        ),
        {"schema": SCHEMA},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    profile_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey(f"{SCHEMA}.route_elevation_profiles.id", ondelete="CASCADE"),
        nullable=False,
    )
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    distance_m: Mapped[float] = mapped_column(Float, nullable=False)
    raw_elevation_m: Mapped[float] = mapped_column(Float, nullable=False)
    smoothed_elevation_m: Mapped[float] = mapped_column(Float, nullable=False)
    gradient_percent: Mapped[float | None] = mapped_column(Float)

    profile: Mapped[RouteElevationProfile] = relationship(back_populates="samples")


class EvidenceSource(Base):
    """Versioned external source and its conservative rights assessment."""

    __tablename__ = "evidence_sources"
    __table_args__ = (
        UniqueConstraint("source_key", "version"),
        CheckConstraint(
            "(geometry_reuse_allowed = true AND "
            "rights_classification = 'reusable_geometry' AND rights_statement IS NOT NULL) OR "
            "(geometry_reuse_allowed = false AND "
            "rights_classification <> 'reusable_geometry')",
            name="geometry_reuse_requires_rights",
        ),
        Index("ix_evidence_sources_publisher", "publisher", postgresql_using="btree"),
        {"schema": SCHEMA},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_key: Mapped[str] = mapped_column(String(200), nullable=False, info={"immutable": True})
    version: Mapped[str] = mapped_column(String(100), nullable=False, info={"immutable": True})
    publisher: Mapped[str] = mapped_column(String(300), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    url: Mapped[str] = mapped_column(Text, nullable=False)
    rights_classification: Mapped[RightsClassification] = mapped_column(
        rights_type, nullable=False
    )
    rights_statement: Mapped[str | None] = mapped_column(Text)
    geometry_reuse_allowed: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    factual_anchors: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB, nullable=False, default=list, server_default="[]"
    )
    retrieved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class RouteIdentity(Base):
    """Versioned identity independent of any particular geometry."""

    __tablename__ = "route_identities"
    __table_args__ = (
        UniqueConstraint("identity_key", "version"),
        Index("ix_route_identities_mountain_status", "mountain_id", "status"),
        {"schema": SCHEMA},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    mountain_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey(f"{SCHEMA}.mountains.id", ondelete="RESTRICT"), nullable=False
    )
    identity_key: Mapped[str] = mapped_column(String(200), nullable=False, info={"immutable": True})
    version: Mapped[str] = mapped_column(String(100), nullable=False, info={"immutable": True})
    canonical_name: Mapped[str] = mapped_column(String(300), nullable=False)
    aliases: Mapped[list[str]] = mapped_column(
        JSONB, nullable=False, default=list, server_default="[]"
    )
    status: Mapped[VerificationStatus] = mapped_column(
        status_type, nullable=False, default=VerificationStatus.NEEDS_REVIEW
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class RouteDefinition(Base):
    """Versioned interpretation of a route identity."""

    __tablename__ = "route_definitions"
    __table_args__ = (
        UniqueConstraint("route_identity_id", "version"),
        Index("ix_route_definitions_identity_status", "route_identity_id", "status"),
        {"schema": SCHEMA},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    route_identity_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey(f"{SCHEMA}.route_identities.id", ondelete="RESTRICT"), nullable=False
    )
    route_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey(f"{SCHEMA}.routes.id", ondelete="RESTRICT")
    )
    version: Mapped[str] = mapped_column(String(100), nullable=False, info={"immutable": True})
    description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[VerificationStatus] = mapped_column(
        status_type, nullable=False, default=VerificationStatus.NEEDS_REVIEW
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class RouteDefinitionEvidence(Base):
    __tablename__ = "route_definition_evidence"
    __table_args__ = (
        UniqueConstraint("route_definition_id", "evidence_source_id"),
        {"schema": SCHEMA},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    route_definition_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey(f"{SCHEMA}.route_definitions.id", ondelete="CASCADE"), nullable=False
    )
    evidence_source_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey(f"{SCHEMA}.evidence_sources.id", ondelete="RESTRICT"), nullable=False
    )
    purpose: Mapped[str] = mapped_column(String(100), nullable=False)


class RouteFact(Base):
    """Immutable published facts for a versioned route definition."""

    __tablename__ = "route_facts"
    __table_args__ = (
        UniqueConstraint("route_definition_id", "version"),
        CheckConstraint(
            "start_name IS NULL OR btrim(start_name) <> ''",
            name="start_name_nonblank",
        ),
        CheckConstraint(
            "btrim(version) <> '' AND btrim(provenance_version) <> ''",
            name="versions_nonblank",
        ),
        CheckConstraint(
            "start_elevation_m IS NULL OR "
            "(start_elevation_m > '-Infinity'::float8 "
            "AND start_elevation_m < 'Infinity'::float8)",
            name="start_elevation_valid",
        ),
        CheckConstraint(
            "summit_elevation_m IS NULL OR "
            "(summit_elevation_m > '-Infinity'::float8 "
            "AND summit_elevation_m < 'Infinity'::float8)",
            name="summit_elevation_valid",
        ),
        CheckConstraint(
            "distance_km IS NULL OR "
            "(distance_km >= 0 AND distance_km < 'Infinity'::float8)",
            name="distance_valid",
        ),
        CheckConstraint(
            "total_ascent_m IS NULL OR "
            "(total_ascent_m >= 0 AND total_ascent_m < 'Infinity'::float8)",
            name="ascent_valid",
        ),
        CheckConstraint(
            "total_descent_m IS NULL OR "
            "(total_descent_m >= 0 AND total_descent_m < 'Infinity'::float8)",
            name="descent_valid",
        ),
        CheckConstraint(
            "typical_duration_hours IS NULL OR "
            "(typical_duration_hours > 0 AND typical_duration_hours < 'Infinity'::float8)",
            name="duration_valid",
        ),
        Index("ix_route_facts_definition_status", "route_definition_id", "status"),
        {"schema": SCHEMA},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    route_definition_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey(f"{SCHEMA}.route_definitions.id", ondelete="RESTRICT"), nullable=False
    )
    source_bundle_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey(f"{SCHEMA}.source_bundles.id", ondelete="RESTRICT"), nullable=False
    )
    evidence_source_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey(f"{SCHEMA}.evidence_sources.id", ondelete="RESTRICT")
    )
    version: Mapped[str] = mapped_column(String(100), nullable=False, info={"immutable": True})
    start_name: Mapped[str | None] = mapped_column(String(300))
    start_elevation_m: Mapped[float | None] = mapped_column(Float)
    summit_elevation_m: Mapped[float | None] = mapped_column(Float)
    distance_km: Mapped[float | None] = mapped_column(Float)
    total_ascent_m: Mapped[float | None] = mapped_column(Float)
    total_descent_m: Mapped[float | None] = mapped_column(Float)
    typical_duration_hours: Mapped[float | None] = mapped_column(Float)
    status: Mapped[VerificationStatus] = mapped_column(status_type, nullable=False)
    qa_flags: Mapped[list[str]] = mapped_column(
        JSONB, nullable=False, default=list, server_default="[]"
    )
    provenance_version: Mapped[str] = mapped_column(
        String(100), nullable=False, info={"immutable": True}
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class MountainVerification(Base):
    __tablename__ = "mountain_verifications"
    __table_args__ = (
        UniqueConstraint("mountain_id", "version"),
        Index("ix_mountain_verifications_state", "state", postgresql_using="btree"),
        {"schema": SCHEMA},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    mountain_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey(f"{SCHEMA}.mountains.id", ondelete="RESTRICT"), nullable=False
    )
    version: Mapped[str] = mapped_column(String(100), nullable=False, info={"immutable": True})
    state: Mapped[VerificationStatus] = mapped_column(
        status_type, nullable=False, default=VerificationStatus.NEEDS_REVIEW
    )
    review_notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class MountainVerificationEvidence(Base):
    __tablename__ = "mountain_verification_evidence"
    __table_args__ = (
        UniqueConstraint("mountain_verification_id", "evidence_source_id"),
        {"schema": SCHEMA},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    mountain_verification_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey(f"{SCHEMA}.mountain_verifications.id", ondelete="CASCADE"), nullable=False
    )
    evidence_source_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey(f"{SCHEMA}.evidence_sources.id", ondelete="RESTRICT"), nullable=False
    )


class RouteGeometry(Base):
    __tablename__ = "route_geometries"
    __table_args__ = (
        UniqueConstraint("route_definition_id", "version"),
        Index("ix_route_geometries_geom_gist", "geom", postgresql_using="gist"),
        {"schema": SCHEMA},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    route_definition_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey(f"{SCHEMA}.route_definitions.id", ondelete="RESTRICT"), nullable=False
    )
    version: Mapped[str] = mapped_column(String(100), nullable=False, info={"immutable": True})
    geom: Mapped[Any] = mapped_column(
        Geometry("LINESTRING", srid=4326, spatial_index=False), nullable=False
    )
    derivation_method: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class RouteGeometryMember(Base):
    __tablename__ = "route_geometry_members"
    __table_args__ = (
        CheckConstraint("sequence >= 0", name="sequence_nonnegative"),
        UniqueConstraint("route_geometry_id", "sequence"),
        {"schema": SCHEMA},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    route_geometry_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey(f"{SCHEMA}.route_geometries.id", ondelete="CASCADE"), nullable=False
    )
    source_bundle_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey(f"{SCHEMA}.source_bundles.id", ondelete="RESTRICT"), nullable=False
    )
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    source_member_type: Mapped[str] = mapped_column(String(32), nullable=False)
    source_member_id: Mapped[str] = mapped_column(String(200), nullable=False)
    direction: Mapped[int] = mapped_column(Integer, nullable=False, default=1)


class DemTile(Base):
    __tablename__ = "dem_tiles"
    __table_args__ = (
        UniqueConstraint("source_bundle_id", "tile_key"),
        Index("ix_dem_tiles_footprint_gist", "footprint", postgresql_using="gist"),
        {"schema": SCHEMA},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_bundle_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey(f"{SCHEMA}.source_bundles.id", ondelete="RESTRICT"), nullable=False
    )
    tile_key: Mapped[str] = mapped_column(String(200), nullable=False, info={"immutable": True})
    sha256: Mapped[str] = mapped_column(String(64), nullable=False, info={"immutable": True})
    footprint: Mapped[Any] = mapped_column(
        Geometry("POLYGON", srid=4326, spatial_index=False), nullable=False
    )
    metadata_json: Mapped[dict[str, Any]] = mapped_column(
        "metadata", JSONB, nullable=False, default=dict, server_default="{}"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class RouteElevationProfileSource(Base):
    __tablename__ = "route_elevation_profile_sources"
    __table_args__ = (
        UniqueConstraint("profile_id", "dem_tile_id"),
        {"schema": SCHEMA},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    profile_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey(f"{SCHEMA}.route_elevation_profiles.id", ondelete="CASCADE"), nullable=False
    )
    dem_tile_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey(f"{SCHEMA}.dem_tiles.id", ondelete="RESTRICT"), nullable=False
    )