/** Transport-only contract. No mobile imports or database access. */
export type EngineStatus = "imported" | "processed" | "needs_review" | "verified" | "rejected";
export type Availability = "available" | "degraded" | "ambiguous" | "unavailable";
export interface RouteProvenance {
  provider: string; sourceUrl?: string; licence?: string; attribution?: string;
  retrievedAt?: string; sourceHash?: string; importPayloadHash?: string;
  provenanceVersion: string;
  rightsClassification: "factual_identity_only" | "reusable_geometry" | "unclear";
  qaFlags: string[];
}
export interface RouteEvidence extends RouteProvenance {
  evidenceId?: string; evidenceType: "source" | "activity" | "community" | "dem" | "qa";
}
export interface VersionedRoute {
  identityKey: string; version: string;
  routeId: `sde:route:${string}@${string}`; mountainId: `sde:mountain:${string}`;
}
export interface CanonicalIdentity {
  version: VersionedRoute; canonicalName: string; aliases: string[];
  status: EngineStatus; provenance: RouteProvenance;
}
export interface CanonicalRouteRecord {
  mountain: {
    id: `sde:mountain:${string}`; canonicalName: string; aliases: string[];
    countryOrRegion?: string; summitElevationM?: number;
    verification: { engineStatus: EngineStatus; productLifecycle: "generated_planned" | "recorded" | "community_confirmed" | "summitready_verified"; qaFlags: string[]; verifiedAt?: string };
    provenance: RouteProvenance;
    routes: Array<{ version: VersionedRoute; canonicalName: string; status: EngineStatus; availability: Availability }>;
  };
  route: CanonicalIdentity;
  definition?: {
    identity: CanonicalIdentity; definitionVersion: string; definitionKey: string;
    description?: string; startLabel?: string;
    direction?: "out_and_back" | "loop" | "point_to_point" | "unknown";
    evidence: RouteEvidence[]; status: EngineStatus;
  };
  facts?: {
    distanceM?: number; ascentM?: number; descentM?: number; minimumElevationM?: number;
    maximumElevationM?: number; startElevationM?: number; summitElevationM?: number; typicalDurationS?: number;
    gradient?: { meanPercent?: number; maximumPercent?: number; profileVersion: string };
    terrain?: { value: string; source: RouteEvidence };
    technicalCharacter?: { value: string; source: RouteEvidence };
  };
  geometry?: {
    geometryVersion: string; coordinateReferenceSystem: "EPSG:4326";
    coordinates: ReadonlyArray<readonly [number, number]>;
    direction: "forward" | "reverse" | "unknown"; derivationMethod: string;
    sourceMembers: RouteEvidence[]; topologyStatus: "complete" | "incomplete" | "invalid";
  };
  elevationProfile?: {
    profileVersion: string; samples: ReadonlyArray<{ distanceM: number; elevationM: number | null }>;
    spacingM?: number; smoothingMethod?: string; calculationVersion: string;
    nodataCount: number; demSources: RouteEvidence[];
  };
  source: "canonical"; requestedVersion?: string;
  trust?: {
    engineStatus: EngineStatus;
    productLifecycle: "summitready_verified";
    evidence: RouteEvidence[];
    rightsClassification: string;
  };
  attribution?: RouteProvenance[];
}
