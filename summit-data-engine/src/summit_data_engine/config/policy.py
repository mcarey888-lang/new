"""Versioned deterministic processing and validation policy."""

from __future__ import annotations

import tomllib
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class ExtractionPolicy:
    bbox_padding_degrees: float


@dataclass(frozen=True)
class ElevationPolicy:
    calculation_version: str
    sample_spacing_m: float
    median_window: int
    vertical_deadband_m: float
    max_nodata_fraction: float


@dataclass(frozen=True)
class RouteValidationPolicy:
    min_route_length_m: float
    max_route_length_m: float
    min_elevation_m: float
    max_elevation_m: float
    max_segment_jump_m: float
    summit_reach_tolerance_m: float
    duplicate_hausdorff_tolerance_m: float


@dataclass(frozen=True)
class ValidationPolicy:
    version: str
    extraction: ExtractionPolicy
    elevation: ElevationPolicy
    validation: RouteValidationPolicy


def load_validation_policy(path: Path) -> ValidationPolicy:
    with path.open("rb") as handle:
        raw = tomllib.load(handle)
    return ValidationPolicy(
        version=str(raw["version"]),
        extraction=ExtractionPolicy(**raw["extraction"]),
        elevation=ElevationPolicy(**raw["elevation"]),
        validation=RouteValidationPolicy(**raw["validation"]),
    )