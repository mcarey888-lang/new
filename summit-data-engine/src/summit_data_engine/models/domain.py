"""Serializable domain values with explicit evidence and status."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from enum import StrEnum
from typing import Any, Literal

from shapely.geometry import mapping  # type: ignore[import-untyped]
from shapely.geometry.base import BaseGeometry  # type: ignore[import-untyped]


class VerificationStatus(StrEnum):
    IMPORTED = "imported"
    PROCESSED = "processed"
    NEEDS_REVIEW = "needs_review"
    VERIFIED = "verified"
    REJECTED = "rejected"


class RightsClassification(StrEnum):
    """How an external source may be used by the engine."""

    FACTUAL_IDENTITY_ONLY = "factual_identity_only"
    REUSABLE_GEOMETRY = "reusable_geometry"
    UNCLEAR = "unclear"


CheckOutcome = Literal["pass", "fail", "indeterminate"]


@dataclass(frozen=True)
class Diagnostic:
    code: str
    outcome: CheckOutcome
    message: str
    details: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class SourceBundle:
    source_type: Literal["osm_pbf", "dem_raster"]
    provider: str
    source_url: str
    licence: str
    local_path: str
    sha256: str
    size_bytes: int
    retrieved_at: str
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class FactualAnchor:
    """A short fact locator, not a copy of source prose."""

    key: str
    value: str
    locator: str | None = None


@dataclass(frozen=True)
class EvidenceSourceRecord:
    """Versioned rights assessment for one external evidence source."""

    source_key: str
    version: str
    publisher: str
    title: str
    url: str
    rights_classification: RightsClassification
    geometry_reuse_allowed: bool
    factual_anchors: tuple[FactualAnchor, ...]
    rights_statement: str | None = None
    retrieved_at: str | None = None

    def __post_init__(self) -> None:
        if self.geometry_reuse_allowed != (
            self.rights_classification is RightsClassification.REUSABLE_GEOMETRY
        ):
            raise ValueError(
                "geometry_reuse_allowed must be true only for reusable_geometry evidence"
            )
        if not self.rights_statement and (
            self.rights_classification is RightsClassification.REUSABLE_GEOMETRY
        ):
            raise ValueError("reusable geometry requires an explicit rights statement")
        if not self.factual_anchors:
            raise ValueError("evidence must contain at least one concise factual anchor")


@dataclass(frozen=True)
class RouteIdentity:
    """A versioned assertion that a named route exists."""

    identity_key: str
    version: str
    mountain_key: str
    canonical_name: str
    aliases: tuple[str, ...] = ()
    status: VerificationStatus = VerificationStatus.NEEDS_REVIEW


@dataclass(frozen=True)
class RouteDefinition:
    """A versioned interpretation of a route identity."""

    definition_key: str
    version: str
    route_identity_key: str
    route_identity_version: str
    description: str
    evidence_source_keys: tuple[str, ...] = ()
    factual_anchors: tuple[FactualAnchor, ...] = ()
    status: VerificationStatus = VerificationStatus.NEEDS_REVIEW


@dataclass(frozen=True)
class MountainVerification:
    """Versioned review state backed by evidence, never implied by ingestion."""

    mountain_key: str
    version: str
    evidence_source_keys: tuple[str, ...]
    status: VerificationStatus = VerificationStatus.NEEDS_REVIEW


@dataclass(frozen=True)
class EvidenceCatalog:
    """A complete versioned evidence package for independent review."""

    catalog_version: str
    retrieved_at: str
    mountain_key: str
    route_identities: tuple[RouteIdentity, ...]
    route_definitions: tuple[RouteDefinition, ...]
    mountain_verification: MountainVerification
    sources: tuple[EvidenceSourceRecord, ...]


@dataclass(frozen=True)
class SummitFeature:
    name: str
    osm_id: int
    osm_type: str
    longitude: float
    latitude: float
    tags: dict[str, Any]


@dataclass
class ElevationSample:
    sequence: int
    distance_m: float
    raw_elevation_m: float
    smoothed_elevation_m: float
    gradient_percent: float | None


@dataclass
class ElevationProfile:
    calculation_version: str
    sample_spacing_m: float
    smoothing_method: str
    smoothing_parameters: dict[str, Any]
    distance_m: float
    total_ascent_m: float
    total_descent_m: float
    min_elevation_m: float
    max_elevation_m: float
    nodata_count: int
    samples: list[ElevationSample]

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class RouteCandidate:
    requested_name: str
    source_name: str | None
    source_ids: list[str]
    status: VerificationStatus
    resolution_method: str
    geometry: BaseGeometry | None
    tags: dict[str, Any] = field(default_factory=dict)
    diagnostics: list[Diagnostic] = field(default_factory=list)
    elevation_profile: ElevationProfile | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "requested_name": self.requested_name,
            "source_name": self.source_name,
            "source_ids": self.source_ids,
            "status": self.status.value,
            "resolution_method": self.resolution_method,
            "geometry": mapping(self.geometry) if self.geometry is not None else None,
            "tags": self.tags,
            "diagnostics": [asdict(item) for item in self.diagnostics],
            "elevation_profile": (
                self.elevation_profile.to_dict() if self.elevation_profile else None
            ),
        }
