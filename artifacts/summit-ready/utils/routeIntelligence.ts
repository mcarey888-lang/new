/**
 * Read-only, deterministic boundary for Summit Data Engine route intelligence.
 *
 * This module intentionally accepts DTO-shaped input rather than reaching into
 * the SDE database. It is safe for offline consumers and cannot promote local
 * or generated route records to canonical identity.
 */

export type SdeMountainId = `sde:mountain:${string}`;
export type SdeRouteId = `sde:route:${string}@${string}`;

export type RouteEngineStatus =
  | "imported"
  | "processed"
  | "needs_review"
  | "verified"
  | "rejected";

export type RouteProductLifecycle =
  | "generated_planned"
  | "recorded"
  | "community_confirmed"
  | "summitready_verified";

export type RouteAvailability =
  | "available"
  | "degraded"
  | "ambiguous"
  | "unavailable";

export type RouteDataReason =
  | "missing_identity"
  | "invalid_identity"
  | "missing_definition"
  | "missing_geometry"
  | "missing_elevation_profile"
  | "missing_metric"
  | "needs_review"
  | "rejected"
  | "rights_unclear"
  | "conflicting_evidence"
  | "version_not_found"
  | "ambiguous_lookup"
  | "stale_compatibility_record";

export type RouteReadResult<T> =
  | {
      availability: "available" | "degraded";
      value: T;
      reasons: RouteDataReason[];
    }
  | {
      availability: "ambiguous" | "unavailable";
      value: null;
      reasons: RouteDataReason[];
    };

export type RouteVersion = {
  identityKey: string;
  version: string;
  routeId: SdeRouteId;
  mountainId: SdeMountainId;
};

export type ProvenanceBundle = {
  provider: string;
  sourceUrl?: string;
  licence?: string;
  attribution?: string;
  retrievedAt?: string;
  sourceHash?: string;
  importPayloadHash?: string;
  provenanceVersion: string;
  rightsClassification:
    | "factual_identity_only"
    | "reusable_geometry"
    | "unclear";
  qaFlags: string[];
};

export type EvidenceReference = ProvenanceBundle & {
  evidenceId: string;
  evidenceType: "source" | "activity" | "community" | "dem" | "qa";
};

export type MountainVerification = {
  engineStatus: RouteEngineStatus;
  productLifecycle: RouteProductLifecycle;
  qaFlags: string[];
  verifiedAt?: string;
};

export type RouteSummary = {
  version: RouteVersion;
  canonicalName: string;
  status: RouteEngineStatus;
  availability: RouteAvailability;
};

export type Mountain = {
  id: SdeMountainId;
  canonicalName: string;
  aliases: string[];
  countryOrRegion?: string;
  summitElevationM?: number;
  verification: MountainVerification;
  provenance: ProvenanceBundle;
  routes: RouteSummary[];
};

export type RouteIdentity = {
  version: RouteVersion;
  canonicalName: string;
  aliases: string[];
  status: RouteEngineStatus;
  provenance: ProvenanceBundle;
};

export type RouteDefinition = {
  identity: RouteIdentity;
  definitionVersion: string;
  definitionKey: string;
  description?: string;
  direction?: "out_and_back" | "loop" | "point_to_point" | "unknown";
  evidence: EvidenceReference[];
  status: RouteEngineStatus;
};

export type GradientFacts = {
  meanPercent?: number;
  maximumPercent?: number;
  profileVersion: string;
};

export type SourcedValue<T> = {
  value: T;
  source: EvidenceReference;
};

export type RouteFacts = {
  distanceM?: number;
  ascentM?: number;
  descentM?: number;
  minimumElevationM?: number;
  maximumElevationM?: number;
  startElevationM?: number;
  summitElevationM?: number;
  typicalDurationS?: number;
  gradient?: GradientFacts;
  terrain?: SourcedValue<string>;
  technicalCharacter?: SourcedValue<string>;
};

export type RouteGeometry = {
  geometryVersion: string;
  coordinateReferenceSystem: "EPSG:4326";
  coordinates: ReadonlyArray<readonly [longitude: number, latitude: number]>;
  direction: "forward" | "reverse" | "unknown";
  derivationMethod: string;
  sourceMembers: EvidenceReference[];
  topologyStatus: "complete" | "incomplete" | "invalid";
};

export type RouteElevationProfile = {
  profileVersion: string;
  samples: ReadonlyArray<{
    distanceM: number;
    elevationM: number | null;
  }>;
  spacingM?: number;
  smoothingMethod?: string;
  calculationVersion: string;
  nodataCount: number;
  demSources: EvidenceReference[];
};

export type CanonicalRouteRecord = {
  mountain: Mountain;
  route: RouteIdentity;
  definition?: RouteDefinition;
  facts?: RouteFacts;
  geometry?: RouteGeometry;
  elevationProfile?: RouteElevationProfile;
  source: "canonical";
  requestedVersion?: string;
};

export type RouteIntelligence = {
  mountain: Mountain;
  route: RouteIdentity;
  definition: RouteDefinition | null;
  facts: RouteFacts | null;
  geometry: RouteGeometry | null;
  elevationProfile: RouteElevationProfile | null;
  trust: MountainVerification;
  attribution: ProvenanceBundle;
};

export type LegacyRouteReference = {
  source: "compatibility";
  sourceId: string;
  displayName?: string;
  routeIdentityKey?: string;
  mountainIdentityKey?: string;
};

export type TrainingTargetRoute = {
  route: RouteVersion | null;
  mountain: SdeMountainId | null;
  facts: RouteReadResult<RouteFacts>;
  trust: MountainVerification | null;
  source: "canonical" | "compatibility";
  demandStatus: "supported" | "degraded" | "unavailable";
};

export type ExpeditionLocalStageRoute = {
  route: RouteVersion | null;
  mountain: SdeMountainId | null;
  stageSnapshot: {
    name: string;
    simulatedElevationGainM: number;
    routeIdentityKey?: string;
    summitIdentityKey?: string;
  };
  routeFacts: RouteReadResult<RouteFacts>;
  source: "canonical" | "compatibility";
};

export type ExploreRoute = {
  route: RouteVersion | null;
  mountain: SdeMountainId | null;
  definition: RouteReadResult<RouteDefinition>;
  facts: RouteReadResult<RouteFacts>;
  geometry: RouteReadResult<RouteGeometry>;
  trust: MountainVerification | null;
  attribution: ProvenanceBundle | null;
  trackAvailability: "can_track" | "identity_only" | "unavailable";
};

const MOUNTAIN_PREFIX = "sde:mountain:";
const ROUTE_PREFIX = "sde:route:";

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function invalidResult<T>(reason: RouteDataReason): RouteReadResult<T> {
  return { availability: "unavailable", value: null, reasons: [reason] };
}

export function parseSdeMountainId(value: unknown): SdeMountainId | null {
  if (typeof value !== "string" || !value.startsWith(MOUNTAIN_PREFIX)) return null;
  const id = value.slice(MOUNTAIN_PREFIX.length).trim();
  return id && !id.includes(":") && !id.includes("@")
    ? (value as SdeMountainId)
    : null;
}

export function parseSdeRouteId(value: unknown): RouteVersion | null {
  if (typeof value !== "string" || !value.startsWith(ROUTE_PREFIX)) return null;
  const body = value.slice(ROUTE_PREFIX.length);
  const separator = body.lastIndexOf("@");
  if (separator <= 0 || separator === body.length - 1) return null;
  const identityKey = body.slice(0, separator).trim();
  const version = body.slice(separator + 1).trim();
  if (!nonEmpty(identityKey) || !nonEmpty(version) || identityKey.includes("@")) return null;
  return {
    identityKey,
    version,
    routeId: value as SdeRouteId,
    mountainId: "" as SdeMountainId,
  };
}

export function makeRouteVersion(
  mountainId: unknown,
  identityKey: unknown,
  version: unknown,
): RouteVersion | null {
  const parsedMountain = parseSdeMountainId(mountainId);
  if (!parsedMountain || !nonEmpty(identityKey) || !nonEmpty(version)) return null;
  const routeId = `${ROUTE_PREFIX}${identityKey.trim()}@${version.trim()}`;
  const parsedRoute = parseSdeRouteId(routeId);
  return parsedRoute
    ? { ...parsedRoute, mountainId: parsedMountain }
    : null;
}

function finiteNonNegative(value: unknown): boolean {
  return value === undefined || (typeof value === "number" && Number.isFinite(value) && value >= 0);
}

function factsReasons(facts: RouteFacts | undefined): RouteDataReason[] {
  if (!facts) return ["missing_metric"];
  const reasons: RouteDataReason[] = [];
  if (facts.distanceM === undefined || facts.ascentM === undefined) {
    reasons.push("missing_metric");
  }
  for (const value of [
    facts.distanceM,
    facts.ascentM,
    facts.descentM,
    facts.minimumElevationM,
    facts.maximumElevationM,
    facts.startElevationM,
    facts.summitElevationM,
    facts.typicalDurationS,
  ]) {
    if (!finiteNonNegative(value)) reasons.push("missing_metric");
  }
  if (facts.minimumElevationM !== undefined && facts.maximumElevationM !== undefined &&
      facts.minimumElevationM > facts.maximumElevationM) {
    reasons.push("missing_metric");
  }
  return reasons;
}

function availabilityForRecord(record: CanonicalRouteRecord): RouteReadResult<RouteIntelligence> {
  const mountainId = parseSdeMountainId(record.mountain.id);
  const routeVersion = parseSdeRouteId(record.route.version.routeId);
  const expectedVersion = makeRouteVersion(
    record.mountain.id,
    record.route.version.identityKey,
    record.route.version.version,
  );
  if (!mountainId || !routeVersion || !expectedVersion ||
      record.route.version.routeId !== expectedVersion.routeId ||
      record.route.version.mountainId !== mountainId) {
    return invalidResult("invalid_identity");
  }
  if (record.requestedVersion !== undefined &&
      record.requestedVersion !== record.route.version.version) {
    return invalidResult("version_not_found");
  }
  if (record.source !== "canonical") return invalidResult("invalid_identity");

  const reasons: RouteDataReason[] = [];
  if (record.route.status === "needs_review") reasons.push("needs_review");
  if (record.route.status === "rejected") reasons.push("rejected");
  if (record.route.provenance.rightsClassification === "unclear") reasons.push("rights_unclear");
  if (!record.definition) reasons.push("missing_definition");
  if (!record.geometry) reasons.push("missing_geometry");
  if (!record.elevationProfile) reasons.push("missing_elevation_profile");
  reasons.push(...factsReasons(record.facts));

  const trust: MountainVerification = record.mountain.verification;
  const value: RouteIntelligence = {
    mountain: record.mountain,
    route: record.route,
    definition: record.definition ?? null,
    facts: record.facts ?? null,
    geometry: record.geometry ?? null,
    elevationProfile: record.elevationProfile ?? null,
    trust,
    attribution: record.route.provenance,
  };
  const uniqueReasons = [...new Set(reasons)];
  const unavailable =
    uniqueReasons.includes("rejected") ||
    uniqueReasons.includes("rights_unclear") ||
    uniqueReasons.includes("conflicting_evidence");
  if (unavailable) {
    return { availability: "unavailable", value: null, reasons: uniqueReasons };
  }
  return {
    availability: uniqueReasons.length ? "degraded" : "available",
    value,
    reasons: uniqueReasons,
  };
}

export type RouteLookup = {
  routeId?: unknown;
  mountainId?: unknown;
  candidates: readonly CanonicalRouteRecord[];
};

export function selectCanonicalRoute(
  lookup: RouteLookup,
): RouteReadResult<RouteIntelligence> {
  if (lookup.routeId === undefined || lookup.routeId === null) {
    return invalidResult("missing_identity");
  }
  const parsed = parseSdeRouteId(lookup.routeId);
  const mountainId = lookup.mountainId === undefined
    ? null
    : parseSdeMountainId(lookup.mountainId);
  if (!parsed || (lookup.mountainId !== undefined && !mountainId)) {
    return invalidResult("invalid_identity");
  }
  const matches = lookup.candidates.filter(candidate =>
    candidate.route.version.routeId === lookup.routeId &&
    (!mountainId || candidate.mountain.id === mountainId),
  );
  if (matches.length === 0) return invalidResult("version_not_found");
  if (matches.length > 1) return invalidResult("ambiguous_lookup");
  return availabilityForRecord(matches[0]);
}

export function mapTrainingTarget(
  result: RouteReadResult<RouteIntelligence>,
  legacy?: LegacyRouteReference,
): TrainingTargetRoute {
  if (result.value && (result.availability === "available" || result.availability === "degraded")) {
    return {
      route: result.value.route.version,
      mountain: result.value.mountain.id,
      facts: result.value.facts
        ? { availability: result.availability, value: result.value.facts, reasons: result.reasons }
        : invalidResult("missing_metric"),
      trust: result.value.trust,
      source: "canonical",
      demandStatus: result.value.facts ? (result.availability === "available" ? "supported" : "degraded") : "unavailable",
    };
  }
  return {
    route: null,
    mountain: null,
    facts: invalidResult(legacy ? "stale_compatibility_record" : "missing_identity"),
    trust: null,
    source: legacy ? "compatibility" : "canonical",
    demandStatus: "unavailable",
  };
}

export function mapExpeditionStage(
  stageSnapshot: ExpeditionLocalStageRoute["stageSnapshot"],
  result: RouteReadResult<RouteIntelligence>,
): ExpeditionLocalStageRoute {
  const canonical = result.value;
  return {
    stageSnapshot,
    route: canonical?.route.version ?? null,
    mountain: canonical?.mountain.id ?? null,
    routeFacts: canonical?.facts
      ? { availability: result.availability, value: canonical.facts, reasons: result.reasons }
      : invalidResult(result.reasons[0] ?? "missing_identity"),
    source: canonical ? "canonical" : "compatibility",
  };
}

export function mapExploreRoute(
  result: RouteReadResult<RouteIntelligence>,
): ExploreRoute {
  const canonical = result.value;
  const unavailableDefinition = invalidResult<RouteDefinition>(result.reasons[0] ?? "missing_identity");
  const unavailableFacts = invalidResult<RouteFacts>(result.reasons[0] ?? "missing_metric");
  const unavailableGeometry = invalidResult<RouteGeometry>(result.reasons[0] ?? "missing_geometry");
  return {
    route: canonical?.route.version ?? null,
    mountain: canonical?.mountain.id ?? null,
    definition: canonical?.definition
      ? { availability: result.availability, value: canonical.definition, reasons: result.reasons }
      : unavailableDefinition,
    facts: canonical?.facts
      ? { availability: result.availability, value: canonical.facts, reasons: result.reasons }
      : unavailableFacts,
    geometry: canonical?.geometry
      ? { availability: result.availability, value: canonical.geometry, reasons: result.reasons }
      : unavailableGeometry,
    trust: canonical?.trust ?? null,
    attribution: canonical?.attribution ?? null,
    trackAvailability: canonical?.geometry
      ? "can_track"
      : canonical
        ? "identity_only"
        : "unavailable",
  };
}