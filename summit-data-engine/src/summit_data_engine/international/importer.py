"""Plan or transactionally import the Summit Ready international catalogue."""

from __future__ import annotations

import argparse
import json
import math
import os
import uuid
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Literal

from geoalchemy2.elements import WKTElement
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from summit_data_engine.db.models import (
    EvidenceSource,
    Mountain,
    MountainAlias,
    MountainSourceRecord,
    MountainVerification,
    MountainVerificationEvidence,
    RouteDefinition,
    RouteFact,
    RouteIdentity,
    SourceBundle,
    VerificationStatus,
)
from summit_data_engine.international.package import (
    CATALOGUE_NAME,
    CataloguePackage,
    load_catalogue_package,
    normalize_alias,
)
from summit_data_engine.models.domain import RightsClassification

MATCH_DISTANCE_METRES = 250.0
_UUID_NAMESPACE = uuid.UUID("6f490642-ca2e-4b22-ae85-5a8d084b7f87")
DecisionKind = Literal["insert", "existing", "review", "blocked"]


@dataclass(frozen=True)
class ExistingMountain:
    id: uuid.UUID
    canonical_source_key: str | None
    name: str
    longitude: float
    latitude: float
    aliases: tuple[str, ...] = ()
    source: str = "existing"


@dataclass(frozen=True)
class MatchDecision:
    source_feature_id: str
    decision: DecisionKind
    reason: str
    name: str = ""
    status: str = ""
    existing_mountain_id: uuid.UUID | None = None
    distance_m: float | None = None
    match_signals: tuple[str, ...] = ()


@dataclass(frozen=True)
class ImportPlan:
    decisions: tuple[MatchDecision, ...]
    inserted: int
    updated: int
    unchanged: int
    reviewed: int
    blocked: int
    failed: int
    review_records: tuple[dict[str, Any], ...]
    source_rows: int
    source_rows_proposed: int
    aliases_staged: int
    aliases_unique: int
    aliases_duplicate: int
    alias_decisions: tuple[dict[str, Any], ...]
    evidence_total: int
    evidence_loadable: int
    evidence_held: int
    evidence_blocked: int
    routes_total: int
    routes_loadable: int
    routes_held: int
    accepted_verified: int
    accepted_needs_review: int
    collision_records: tuple[dict[str, Any], ...]
    match_signals: tuple[dict[str, Any], ...]


@dataclass
class ImportCounters:
    inserted: int = 0
    updated: int = 0
    unchanged: int = 0
    reviewed: int = 0
    blocked: int = 0
    failed: int = 0
    details: dict[str, int] = field(default_factory=dict)


def _distance_m(
    longitude_a: float,
    latitude_a: float,
    longitude_b: float,
    latitude_b: float,
) -> float:
    radius = 6_371_008.8
    latitude_1 = math.radians(latitude_a)
    latitude_2 = math.radians(latitude_b)
    delta_latitude = latitude_2 - latitude_1
    delta_longitude = math.radians(longitude_b - longitude_a)
    haversine = (
        math.sin(delta_latitude / 2) ** 2
        + math.cos(latitude_1)
        * math.cos(latitude_2)
        * math.sin(delta_longitude / 2) ** 2
    )
    return radius * 2 * math.asin(min(1.0, math.sqrt(haversine)))


def plan_import(
    package: CataloguePackage,
    existing_mountains: tuple[ExistingMountain, ...] = (),
) -> ImportPlan:
    """Make conservative, deterministic decisions without mutating a session."""
    by_key: dict[str, list[dict[str, Any]]] = {}
    for mountain in package.mountains:
        by_key.setdefault(mountain["canonical_source_key"], []).append(mountain)
    colliding_ids = {
        mountain["source_feature_id"]
        for group in by_key.values()
        if len(group) > 1
        for mountain in group
    }
    existing_by_key = {
        mountain.canonical_source_key: mountain
        for mountain in existing_mountains
        if mountain.canonical_source_key
    }
    decisions: list[MatchDecision] = []
    review_records: list[dict[str, Any]] = []
    package_aliases: dict[str, set[str]] = {}
    for alias in package.aliases:
        package_aliases.setdefault(alias["mountain_source_feature_id"], set()).add(
            alias["normalized_name"]
        )
    for mountain in package.mountains:
        feature_id = mountain["source_feature_id"]
        names = {normalize_alias(mountain["name"])} | package_aliases.get(
            feature_id, set()
        )
        if feature_id in colliding_ids:
            reason = f"package canonical-key collision: {mountain['canonical_source_key']}"
            decision = MatchDecision(
                feature_id, "review", reason, mountain["name"], mountain["status"]
            )
            decisions.append(decision)
            review_records.append(asdict(decision))
            continue
        exact = existing_by_key.get(mountain["canonical_source_key"])
        if exact is not None:
            distance = _distance_m(
                mountain["geometry"].x,
                mountain["geometry"].y,
                exact.longitude,
                exact.latitude,
            )
            existing_names = {normalize_alias(exact.name)} | {
                normalize_alias(alias) for alias in exact.aliases
            }
            signals = ["canonical_key"]
            if distance <= MATCH_DISTANCE_METRES:
                signals.append("coordinates_within_250m")
            if names & existing_names:
                signals.append("normalized_name_or_alias")
            if (
                distance <= MATCH_DISTANCE_METRES
                and "normalized_name_or_alias" in signals
            ):
                decisions.append(
                    MatchDecision(
                        feature_id,
                        "existing",
                        "consistent exact canonical identity",
                        mountain["name"],
                        mountain["status"],
                        exact.id,
                        distance,
                        tuple(signals),
                    )
                )
            else:
                decision = MatchDecision(
                    feature_id,
                    "review",
                    "canonical-key conflict: identity signals are inconsistent",
                    mountain["name"],
                    mountain["status"],
                    exact.id,
                    distance,
                    tuple(signals),
                )
                decisions.append(decision)
                review_records.append(asdict(decision))
            continue
        geometry = mountain["geometry"]
        assert geometry is not None
        nearby = sorted(
            (
                (
                    _distance_m(
                        geometry.x,
                        geometry.y,
                        candidate.longitude,
                        candidate.latitude,
                    ),
                    candidate,
                )
                for candidate in existing_mountains
            ),
            key=lambda item: item[0],
        )
        if nearby and nearby[0][0] <= MATCH_DISTANCE_METRES:
            distance, candidate = nearby[0]
            candidate_names = {normalize_alias(candidate.name)} | {
                normalize_alias(alias) for alias in candidate.aliases
            }
            signals = ["coordinates_within_250m"]
            if names & candidate_names:
                signals.append("normalized_name_or_alias")
            reason = (
                f"potential {candidate.source} coordinate overlap within "
                f"{MATCH_DISTANCE_METRES:.0f}m"
            )
            decision = MatchDecision(
                feature_id,
                "review",
                reason,
                mountain["name"],
                mountain["status"],
                candidate.id,
                distance,
                tuple(signals),
            )
            decisions.append(decision)
            review_records.append(asdict(decision))
            continue
        name_matches = [
            candidate
            for candidate in existing_mountains
            if names
            & (
                {normalize_alias(candidate.name)}
                | {normalize_alias(alias) for alias in candidate.aliases}
            )
        ]
        far_signals = ("normalized_name_or_alias_only",) if name_matches else ()
        reason = (
            "name/alias signal only; no identity or coordinate match"
            if name_matches
            else "no identity or coordinate match"
        )
        decision = MatchDecision(
            feature_id,
            "insert",
            reason,
            mountain["name"],
            mountain["status"],
            match_signals=far_signals,
        )
        decisions.append(decision)
        if mountain["status"] == "needs_review":
            review_records.append(
                {
                    **asdict(decision),
                    "decision": "review",
                    "reason": "source status needs_review",
                }
            )
    for mountain in package.blocked:
        decision = MatchDecision(
            mountain["source_feature_id"],
            "blocked",
            "MISSING_REQUIRED_GEOMETRY",
            mountain["name"],
            mountain["status"],
        )
        decisions.append(decision)
        review_records.append(asdict(decision))
    reviewed = len(
        {
            row["source_feature_id"]
            for row in review_records
            if row["decision"] != "blocked"
        }
    )
    accepted_ids = {
        decision.source_feature_id
        for decision in decisions
        if decision.decision in {"insert", "existing"}
    }
    blocked_ids = {row["source_feature_id"] for row in package.blocked}
    alias_seen: set[tuple[str, str]] = set()
    alias_decisions: list[dict[str, Any]] = []
    for alias in package.aliases:
        key = (alias["mountain_source_feature_id"], alias["normalized_name"])
        duplicate = key in alias_seen
        alias_seen.add(key)
        alias_decisions.append(
            {
                "id": str(alias["id"]),
                "mountain_source_feature_id": key[0],
                "name": alias["name"],
                "normalized_name": key[1],
                "decision": (
                    "duplicate"
                    if duplicate
                    else "loadable"
                    if key[0] in accepted_ids
                    else "blocked"
                    if key[0] in blocked_ids
                    else "held"
                ),
            }
        )
    evidence_loadable = sum(
        row["mountain_source_feature_id"] in accepted_ids for row in package.evidence
    )
    evidence_blocked = sum(
        row["mountain_source_feature_id"] in blocked_ids for row in package.evidence
    )
    route_loadable = sum(
        row["mountain_source_feature_id"] in accepted_ids
        and row.get("evidence_matched", False)
        for row in package.routes
    )
    mountain_by_id = {
        row["source_feature_id"]: row for row in package.mountains
    }
    collision_records = tuple(
        asdict(decision)
        for decision in decisions
        if decision.source_feature_id in colliding_ids
    )
    match_signal_rows = tuple(
        asdict(decision) for decision in decisions if decision.match_signals
    )
    return ImportPlan(
        decisions=tuple(decisions),
        inserted=sum(decision.decision == "insert" for decision in decisions),
        updated=0,
        unchanged=sum(decision.decision == "existing" for decision in decisions),
        reviewed=reviewed,
        blocked=len(package.blocked),
        failed=0,
        review_records=tuple(review_records),
        source_rows=len(package.source_records),
        source_rows_proposed=len(accepted_ids),
        aliases_staged=len(package.aliases),
        aliases_unique=len(alias_seen),
        aliases_duplicate=len(package.aliases) - len(alias_seen),
        alias_decisions=tuple(alias_decisions),
        evidence_total=len(package.evidence),
        evidence_loadable=evidence_loadable,
        evidence_held=len(package.evidence) - evidence_loadable - evidence_blocked,
        evidence_blocked=evidence_blocked,
        routes_total=len(package.routes),
        routes_loadable=route_loadable,
        routes_held=len(package.routes) - route_loadable,
        accepted_verified=sum(
            mountain_by_id[feature_id]["status"] == "verified"
            for feature_id in accepted_ids
        ),
        accepted_needs_review=sum(
            mountain_by_id[feature_id]["status"] == "needs_review"
            for feature_id in accepted_ids
        ),
        collision_records=collision_records,
        match_signals=match_signal_rows,
    )


def load_existing_mountains(session: Session) -> tuple[ExistingMountain, ...]:
    """Read comparison candidates, including aliases, without changing the database."""
    alias_rows: dict[uuid.UUID, list[str]] = {}
    for mountain_id, name in session.execute(
        select(MountainAlias.mountain_id, MountainAlias.name)
    ):
        alias_rows.setdefault(mountain_id, []).append(name)
    rows = session.execute(
        select(Mountain, func.ST_X(Mountain.geom), func.ST_Y(Mountain.geom))
    )
    return tuple(
        ExistingMountain(
            mountain.id,
            mountain.canonical_source_key,
            mountain.name,
            float(longitude),
            float(latitude),
            tuple(alias_rows.get(mountain.id, ())),
            "DoBIH" if (mountain.canonical_source_key or "").startswith("dobih:") else "existing",
        )
        for mountain, longitude, latitude in rows
    )


def _verification_status(value: str) -> VerificationStatus:
    return (
        VerificationStatus.VERIFIED
        if value == "verified"
        else VerificationStatus.NEEDS_REVIEW
    )


def _bundle(session: Session, package: CataloguePackage) -> SourceBundle:
    existing = session.scalar(
        select(SourceBundle).where(SourceBundle.sha256 == package.package_sha256)
    )
    if existing is not None:
        if (
            existing.provider != CATALOGUE_NAME
            or existing.provenance_version != package.catalogue_version
        ):
            raise ValueError("package hash is already assigned to conflicting provenance")
        return existing
    bundle = SourceBundle(
        id=uuid.uuid5(_UUID_NAMESPACE, f"bundle:{package.package_sha256}"),
        source_type="international_catalogue_zip",
        provider=CATALOGUE_NAME,
        source_url="package://summit-ready-international-catalogue",
        licence="Mixed factual sources; see evidence_sources",
        local_path=str(package.archive_path),
        sha256=package.package_sha256,
        size_bytes=package.archive_path.stat().st_size,
        retrieved_at=datetime.now(UTC),
        metadata_json={
            "catalogue_version": package.catalogue_version,
            "member_sha256": package.member_sha256,
        },
        provenance_version=package.catalogue_version,
    )
    session.add(bundle)
    return bundle


def _source_record(
    row: dict[str, Any],
    mountain: Mountain,
    bundle: SourceBundle,
) -> MountainSourceRecord:
    geometry = row["geometry"]
    assert geometry is not None
    return MountainSourceRecord(
        id=uuid.uuid5(
            _UUID_NAMESPACE,
            f"source:{row['source_version']}:{row['mountain_source_feature_id']}",
        ),
        mountain_id=mountain.id,
        source_bundle_id=bundle.id,
        source_dataset=row["source_dataset"],
        source_version=row["source_version"],
        source_feature_id=row["mountain_source_feature_id"],
        source_release_date=datetime.fromisoformat(row["source_release_date"]).date(),
        name=row["name"],
        country=row["country"],
        region=row["region"] or None,
        area=row["area"] or None,
        county=row["county"] or None,
        elevation_m=row["elevation_m"],
        prominence_m=row["prominence_m"],
        col_height_m=row["col_height_m"],
        grid_reference=row["grid_reference"] or None,
        summit_feature=row["summit_feature"] or None,
        geom=WKTElement(geometry.wkt, srid=4326),
        source_file_sha256=row["source_file_sha256"],
        source_license=row["source_license"],
        source_attribution=row["source_attribution"],
        source_trust=row["source_trust"],
        final_verification_status=row["final_verification_status"],
        needs_review_reason=row["needs_review_reason"] or None,
        qa_status=row["qa_status"],
        qa_flags=row["qa_flags"],
        data_priority=row["data_priority"],
        ai_fallback_allowed=row["ai_fallback_allowed"],
        raw_payload=row["raw_payload"],
        prepared_payload=row["prepared_payload"],
        import_payload_sha256=row["import_payload_sha256"],
    )


def import_package(
    session: Session,
    package: CataloguePackage,
    *,
    plan: ImportPlan | None = None,
) -> ImportCounters:
    """Apply one plan in the caller's transaction; an exception rolls it all back."""
    plan = plan or plan_import(package, load_existing_mountains(session))
    counters = ImportCounters(
        reviewed=plan.reviewed, blocked=plan.blocked, failed=plan.failed
    )
    bundle = _bundle(session, package)
    decisions = {decision.source_feature_id: decision for decision in plan.decisions}
    accepted_ids = {
        feature_id
        for feature_id, decision in decisions.items()
        if decision.decision in {"insert", "existing"}
    }
    mountain_rows = {
        row["source_feature_id"]: row
        for row in package.mountains
        if row["source_feature_id"] in accepted_ids
    }
    existing_by_id = {
        mountain.id: mountain
        for mountain in session.scalars(
            select(Mountain).where(
                Mountain.id.in_(
                    tuple(
                        decision.existing_mountain_id
                        for decision in decisions.values()
                        if decision.existing_mountain_id is not None
                    )
                )
            )
        )
    }
    mountains: dict[str, Mountain] = {}
    for feature_id, row in mountain_rows.items():
        decision = decisions[feature_id]
        if decision.existing_mountain_id is not None:
            mountains[feature_id] = existing_by_id[decision.existing_mountain_id]
            counters.unchanged += 1
            continue
        geometry = row["geometry"]
        assert geometry is not None
        mountain = Mountain(
            id=row["id"],
            source_bundle_id=bundle.id,
            source_feature_id=feature_id,
            canonical_source_key=row["canonical_source_key"],
            name=row["name"],
            country=row["country"] or None,
            region=row["region"] or None,
            area=row["area"] or None,
            county=row["county"] or None,
            elevation_m=row["elevation_m"],
            prominence_m=row["prominence_m"],
            col_height_m=row["col_height_m"],
            grid_reference=row["grid_reference"] or None,
            summit_feature=row["summit_feature"] or None,
            status=_verification_status(row["status"]),
            geom=WKTElement(geometry.wkt, srid=4326),
            tags=row["tags"],
            provenance_version=row["provenance_version"],
        )
        session.add(mountain)
        mountains[feature_id] = mountain
        counters.inserted += 1
    session.flush()

    source_by_feature: dict[str, MountainSourceRecord] = {}
    for row in package.source_records:
        feature_id = row["mountain_source_feature_id"]
        if feature_id not in mountains:
            continue
        existing = session.scalar(
            select(MountainSourceRecord).where(
                MountainSourceRecord.source_dataset == row["source_dataset"],
                MountainSourceRecord.source_version == row["source_version"],
                MountainSourceRecord.source_feature_id == feature_id,
            )
        )
        if existing is not None:
            immutable_values = {
                "mountain_id": mountains[feature_id].id,
                "source_bundle_id": bundle.id,
                "source_release_date": datetime.fromisoformat(
                    row["source_release_date"]
                ).date(),
                "name": row["name"],
                "country": row["country"],
                "region": row["region"] or None,
                "area": row["area"] or None,
                "county": row["county"] or None,
                "elevation_m": row["elevation_m"],
                "prominence_m": row["prominence_m"],
                "col_height_m": row["col_height_m"],
                "grid_reference": row["grid_reference"] or None,
                "summit_feature": row["summit_feature"] or None,
                "source_file_sha256": row["source_file_sha256"],
                "source_license": row["source_license"],
                "source_attribution": row["source_attribution"],
                "source_trust": row["source_trust"],
                "final_verification_status": row["final_verification_status"],
                "needs_review_reason": row["needs_review_reason"] or None,
                "qa_status": row["qa_status"],
                "qa_flags": row["qa_flags"],
                "data_priority": row["data_priority"],
                "ai_fallback_allowed": row["ai_fallback_allowed"],
                "raw_payload": row["raw_payload"],
                "prepared_payload": row["prepared_payload"],
                "import_payload_sha256": row["import_payload_sha256"],
            }
            if any(
                getattr(existing, key) != value
                for key, value in immutable_values.items()
            ):
                raise ValueError(f"immutable source release changed for {feature_id}")
            source_by_feature[feature_id] = existing
            counters.unchanged += 1
            continue
        source = _source_record(row, mountains[feature_id], bundle)
        session.add(source)
        source_by_feature[feature_id] = source
        counters.details["source_records"] = counters.details.get("source_records", 0) + 1
    session.flush()

    evidence_by_identity: dict[tuple[str, str], EvidenceSource] = {}
    evidence_by_feature: dict[str, list[EvidenceSource]] = {}
    for row in package.evidence:
        feature_id = row["mountain_source_feature_id"]
        if feature_id not in mountains:
            continue
        evidence = session.scalar(
            select(EvidenceSource).where(
                EvidenceSource.source_key == row["source_key"],
                EvidenceSource.version == row["version"],
            )
        )
        if evidence is None:
            evidence = EvidenceSource(
                id=row["id"],
                source_key=row["source_key"],
                version=row["version"],
                publisher=row["publisher"],
                title=row["title"],
                url=row["url"],
                rights_classification=RightsClassification.FACTUAL_IDENTITY_ONLY,
                rights_statement=row["rights_statement"] or None,
                geometry_reuse_allowed=False,
                factual_anchors=[
                    {"key": anchor, "value": feature_id}
                    for anchor in row["factual_anchors"]
                ],
                retrieved_at=datetime.fromisoformat(
                    row["retrieved_at"].replace("Z", "+00:00")
                ),
            )
            session.add(evidence)
            counters.details["evidence"] = counters.details.get("evidence", 0) + 1
        else:
            expected_anchors = [
                {"key": anchor, "value": feature_id}
                for anchor in row["factual_anchors"]
            ]
            if (
                evidence.id != row["id"]
                or evidence.publisher != row["publisher"]
                or evidence.title != row["title"]
                or evidence.url != row["url"]
                or evidence.rights_classification
                != RightsClassification.FACTUAL_IDENTITY_ONLY
                or evidence.rights_statement != (row["rights_statement"] or None)
                or evidence.geometry_reuse_allowed
                or evidence.factual_anchors != expected_anchors
                or evidence.retrieved_at
                != datetime.fromisoformat(row["retrieved_at"].replace("Z", "+00:00"))
            ):
                raise ValueError(
                    f"immutable evidence changed for {row['source_key']}"
                )
            counters.details["evidence_unchanged"] = (
                counters.details.get("evidence_unchanged", 0) + 1
            )
        evidence_by_identity[(feature_id, row["url"])] = evidence
        evidence_by_feature.setdefault(feature_id, []).append(evidence)
    session.flush()

    processed_aliases: set[tuple[str, str]] = set()
    for row in package.aliases:
        feature_id = row["mountain_source_feature_id"]
        if feature_id not in mountains:
            continue
        normalized = normalize_alias(row["name"])
        alias_key = (feature_id, normalized)
        if alias_key in processed_aliases:
            counters.details["aliases_duplicate"] = (
                counters.details.get("aliases_duplicate", 0) + 1
            )
            continue
        processed_aliases.add(alias_key)
        existing_alias = session.scalar(
            select(MountainAlias).where(
                MountainAlias.mountain_id == mountains[feature_id].id,
                MountainAlias.normalized_name == normalized,
            )
        )
        identity_evidence = [
            evidence
            for evidence in evidence_by_feature.get(feature_id, ())
            if any(
                anchor.get("key") == "identity_coordinates_aliases"
                for anchor in evidence.factual_anchors
            )
        ]
        evidence_source_id = (
            identity_evidence[0].id if len(identity_evidence) == 1 else None
        )
        if existing_alias is not None:
            if (
                existing_alias.id != row["id"]
                or existing_alias.source_record_id != source_by_feature[feature_id].id
                or existing_alias.evidence_source_id != evidence_source_id
                or existing_alias.name != row["name"]
                or existing_alias.language_or_note != (row["language_or_note"] or None)
                or existing_alias.status != _verification_status(row["status"])
                or existing_alias.provenance_version != row["provenance_version"]
            ):
                raise ValueError(
                    f"immutable alias changed for {feature_id}/{normalized}"
                )
            counters.details["aliases_unchanged"] = (
                counters.details.get("aliases_unchanged", 0) + 1
            )
            continue
        session.add(
            MountainAlias(
                id=row["id"],
                mountain_id=mountains[feature_id].id,
                source_record_id=source_by_feature[feature_id].id,
                evidence_source_id=evidence_source_id,
                name=row["name"],
                normalized_name=normalized,
                language_or_note=row["language_or_note"] or None,
                status=_verification_status(row["status"]),
                provenance_version=row["provenance_version"],
            )
        )
        counters.details["aliases"] = counters.details.get("aliases", 0) + 1

    for feature_id, mountain in mountains.items():
        verification_id = uuid.uuid5(
            _UUID_NAMESPACE, f"verification:{package.catalogue_version}:{feature_id}"
        )
        verification = session.get(MountainVerification, verification_id)
        if verification is None:
            verification = MountainVerification(
                id=verification_id,
                mountain_id=mountain.id,
                version=package.catalogue_version,
                state=mountain.status,
                review_notes=(
                    "Source catalogue requires review"
                    if mountain.status == VerificationStatus.NEEDS_REVIEW
                    else None
                ),
            )
            session.add(verification)
            for evidence in evidence_by_feature.get(feature_id, ()):
                session.add(
                    MountainVerificationEvidence(
                        id=uuid.uuid5(
                            _UUID_NAMESPACE,
                            f"verification-evidence:{verification_id}:{evidence.id}",
                        ),
                        mountain_verification_id=verification_id,
                        evidence_source_id=evidence.id,
                    )
                )
    session.flush()

    for row in package.routes:
        feature_id = row["mountain_source_feature_id"]
        if feature_id not in mountains or not row.get("evidence_matched", False):
            continue
        identity_id = uuid.uuid5(
            _UUID_NAMESPACE, f"route-identity:{row['route_source_feature_id']}"
        )
        definition_id = uuid.uuid5(
            _UUID_NAMESPACE,
            f"route-definition:{row['route_source_feature_id']}:{row['provenance_version']}",
        )
        identity = session.get(RouteIdentity, identity_id)
        expected_status = _verification_status(row["status"])
        if identity is None:
            session.add(
                RouteIdentity(
                    id=identity_id,
                    mountain_id=mountains[feature_id].id,
                    identity_key=f"international:{row['route_source_feature_id']}",
                    version=row["provenance_version"],
                    canonical_name=row["canonical_name"],
                    aliases=row["aliases"],
                    status=expected_status,
                )
            )
            session.flush()
        elif (
            identity.mountain_id != mountains[feature_id].id
            or identity.identity_key
            != f"international:{row['route_source_feature_id']}"
            or identity.version != row["provenance_version"]
            or identity.canonical_name != row["canonical_name"]
            or identity.aliases != row["aliases"]
            or identity.status != expected_status
        ):
            raise ValueError(
                f"immutable route identity changed for {row['route_source_feature_id']}"
            )
        definition = session.get(RouteDefinition, definition_id)
        if definition is None:
            session.add(
                RouteDefinition(
                    id=definition_id,
                    route_identity_id=identity_id,
                    version=row["provenance_version"],
                    description=row["requested_name"],
                    status=expected_status,
                )
            )
            session.flush()
        elif (
            definition.route_identity_id != identity_id
            or definition.version != row["provenance_version"]
            or definition.description != row["requested_name"]
            or definition.status != expected_status
        ):
            raise ValueError(
                f"immutable route definition changed for {row['route_source_feature_id']}"
            )
        fact_id = uuid.uuid5(_UUID_NAMESPACE, f"route-fact:{definition_id}")
        evidence = evidence_by_identity.get((feature_id, row["source_url"]))
        if evidence is None:
            raise ValueError(
                f"route evidence is missing for {row['route_source_feature_id']}"
            )
        fact = session.get(RouteFact, fact_id)
        fact_values = {
            "route_definition_id": definition_id,
            "source_bundle_id": bundle.id,
            "evidence_source_id": evidence.id,
            "version": row["provenance_version"],
            "start_name": row["start_name"] or None,
            "start_elevation_m": row["start_elevation_m"],
            "summit_elevation_m": row["summit_elevation_m"],
            "distance_km": row["distance_km"],
            "total_ascent_m": row["total_ascent_m"],
            "total_descent_m": None,
            "typical_duration_hours": row["typical_duration_hours"],
            "status": expected_status,
            "qa_flags": row["qa_flags"],
            "provenance_version": row["provenance_version"],
        }
        if fact is None:
            session.add(
                RouteFact(
                    id=fact_id,
                    **fact_values,
                )
            )
            counters.details["routes"] = counters.details.get("routes", 0) + 1
        elif any(getattr(fact, key) != value for key, value in fact_values.items()):
            raise ValueError(
                f"immutable route facts changed for {row['route_source_feature_id']}"
            )
        else:
            counters.details["routes_unchanged"] = (
                counters.details.get("routes_unchanged", 0) + 1
            )
    session.flush()
    return counters


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("package", type=Path)
    parser.add_argument("--expected-package-sha256")
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--report-output", type=Path)
    return parser


def main() -> None:
    args = _parser().parse_args()
    package = load_catalogue_package(
        args.package, expected_package_sha256=args.expected_package_sha256
    )
    if args.apply:
        from summit_data_engine.db.session import (
            create_database_engine,
            create_session_factory,
        )

        engine = create_database_engine()
        sessions = create_session_factory(engine)
        with sessions.begin() as session:
            plan = plan_import(package, load_existing_mountains(session))
            counters = import_package(session, package, plan=plan)
        report: dict[str, Any] = {
            "mode": "apply",
            "package_sha256": package.package_sha256,
            "catalogue_version": package.catalogue_version,
            "counts": asdict(counters),
            "decisions": [asdict(item) for item in plan.decisions],
            "review_records": plan.review_records,
        }
    else:
        existing: tuple[ExistingMountain, ...] = ()
        if os.environ.get("ENGINE_DATABASE_URL"):
            from summit_data_engine.db.session import (
                create_database_engine,
                create_session_factory,
            )

            engine = create_database_engine()
            sessions = create_session_factory(engine)
            with sessions() as session:
                existing = load_existing_mountains(session)
                session.rollback()
        plan = plan_import(package, existing)
        report = {
            "mode": "dry-run",
            "database_mutations": 0,
            "package_sha256": package.package_sha256,
            "catalogue_version": package.catalogue_version,
            "counts": {
                "inserted": plan.inserted,
                "updated": plan.updated,
                "unchanged": plan.unchanged,
                "reviewed": plan.reviewed,
                "blocked": plan.blocked,
                "failed": plan.failed,
            },
            "decisions": [asdict(item) for item in plan.decisions],
            "review_records": plan.review_records,
            "staged": {
                "source_rows": plan.source_rows,
                "source_rows_proposed": plan.source_rows_proposed,
                "aliases": {
                    "staged": plan.aliases_staged,
                    "unique": plan.aliases_unique,
                    "duplicate": plan.aliases_duplicate,
                },
                "evidence": {
                    "total": plan.evidence_total,
                    "loadable": plan.evidence_loadable,
                    "held": plan.evidence_held,
                    "blocked": plan.evidence_blocked,
                },
                "routes": {
                    "total": plan.routes_total,
                    "loadable": plan.routes_loadable,
                    "held": plan.routes_held,
                },
                "accepted_verified": plan.accepted_verified,
                "accepted_needs_review": plan.accepted_needs_review,
            },
            "alias_decisions": plan.alias_decisions,
            "collision_records": plan.collision_records,
            "match_signals": plan.match_signals,
        }
    rendered = json.dumps(report, indent=2, ensure_ascii=False, default=str)
    print(rendered)
    if args.report_output:
        args.report_output.parent.mkdir(parents=True, exist_ok=True)
        args.report_output.write_text(rendered + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
