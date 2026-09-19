# Stage 7 Route Intelligence Model

**Checkpoint:** S7-C02 / S7-R02
**Scope:** canonical read contracts and lifecycle specification; documentation only.

This model follows `docs/STAGE_7_MOUNTAIN_ROUTE_AUDIT.md`. It describes a
read-only compatibility boundary over the independent Summit Data Engine (SDE).
It does not rename SDE persistence states, merge catalogues, change application
journey state, alter the GPS tracker, or require a production migration.

## 1. Identity and version rules

SDE identity is authoritative wherever it is present:

```text
MountainId = "sde:mountain:<mountains.id>"
RouteId    = "sde:route:<route_identities.identity_key>@<version>"
```

`identity_key` and `version` are opaque, non-empty, trimmed values. The
separator is part of the external contract; consumers must not parse or
reconstruct an ID from a display name. A route version identifies an immutable
route identity snapshot and its associated definition, facts, geometry, and
profile versions.

Display names, aliases, slugs, app serial IDs, spreadsheet rows, GPS activity
IDs, and coordinates are not cross-catalogue identities. Existing values such
as `route:v1:*` and `route:<slug>` remain compatibility identifiers until an
explicit, verified mapping is supplied. No fuzzy matching or automatic
identity migration is allowed.

```ts
type SdeMountainId = `sde:mountain:${string}`;
type SdeRouteId = `sde:route:${string}@${string}`;

type RouteVersion = {
  identityKey: string;
  version: string;
  routeId: SdeRouteId;
  mountainId: SdeMountainId;
};
```

The adapter must reject malformed or incomplete identities with an explicit
`invalid_identity` result. It must never silently substitute a name or slug.

## 2. Shared result and availability contract

Consumers need to distinguish trusted data, incomplete data, and no data:

```ts
type RouteAvailability =
  | "available"
  | "degraded"
  | "ambiguous"
  | "unavailable";

type RouteReadResult<T> =
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

type RouteDataReason =
  | "missing_identity"
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
```

`degraded` means the identity is usable but one or more optional facts are
unknown. `unavailable` means the requested canonical fact cannot be safely
presented. `ambiguous` requires user selection or a verified mapping. A cache
miss is not permission to use AI-generated coordinates or mark legacy data
verified.

## 3. Mountain

```ts
type Mountain = {
  id: SdeMountainId;
  canonicalName: string;
  aliases: string[];
  countryOrRegion?: string;
  summitElevationM?: number;
  verification: MountainVerification;
  provenance: ProvenanceBundle;
  routes: RouteSummary[];
};

type MountainVerification = {
  engineStatus:
    | "imported"
    | "processed"
    | "needs_review"
    | "verified"
    | "rejected";
  productLifecycle: "generated_planned"
    | "recorded"
    | "community_confirmed"
    | "summitready_verified";
  qaFlags: string[];
  verifiedAt?: string;
};

type RouteSummary = {
  version: RouteVersion;
  canonicalName: string;
  status: MountainVerification["engineStatus"];
  availability: RouteAvailability;
};
```

`productLifecycle` is an adapter presentation mapping only. The persisted SDE
values remain `imported`, `processed`, `needs_review`, `verified`, and
`rejected`; the adapter must not write or rename them. A GPS recording maps to
`recorded` evidence and cannot promote a route to `verified`.

## 4. Route identity and definition

```ts
type RouteIdentity = {
  version: RouteVersion;
  canonicalName: string;
  aliases: string[];
  status: MountainVerification["engineStatus"];
  provenance: ProvenanceBundle;
};

type RouteDefinition = {
  identity: RouteIdentity;
  definitionVersion: string;
  definitionKey: string;
  description?: string;
  direction?: "out_and_back" | "loop" | "point_to_point" | "unknown";
  evidence: EvidenceReference[];
  status: MountainVerification["engineStatus"];
};
```

The definition version is immutable in the SDE model. A changed route line,
facts calculation, source, or publication status creates a new version rather
than mutating a published object. An application reference to an old version
remains readable as historical context; recommendations should prefer the
newest explicitly published version only when the adapter is given that
relationship.

## 5. Facts and metrics

```ts
type RouteFacts = {
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

type GradientFacts = {
  meanPercent?: number;
  maximumPercent?: number;
  profileVersion: string;
};

type SourcedValue<T> = {
  value: T;
  source: EvidenceReference;
};
```

Only metrics backed by a published route definition, ordered geometry, and
appropriate provenance are returned. Missing terrain, exposure, difficulty,
weather, altitude, or profile metrics are `undefined` with a reason; they are
not estimated from a name, nearby route, AI response, or a user's activity.
Numeric validation rejects negative distance/ascent, non-finite values, and
contradictory bounds. An invalid metric makes that metric unavailable and
degrades the route result rather than invalidating unrelated verified facts.

## 6. Geometry and elevation profile

```ts
type RouteGeometry = {
  geometryVersion: string;
  coordinateReferenceSystem: "EPSG:4326";
  coordinates: ReadonlyArray<readonly [longitude: number, latitude: number]>;
  direction: "forward" | "reverse" | "unknown";
  derivationMethod: string;
  sourceMembers: EvidenceReference[];
  topologyStatus: "complete" | "incomplete" | "invalid";
};

type RouteElevationProfile = {
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
```

Geometry is canonical route geometry, not a recorded GPS trace. The adapter
must not snap, gap-fill, simplify, or overwrite it from activity coordinates.
An activity can reference a route through `ActivityRouteReference`, while its
GPS trace remains separate evidence. Incomplete topology or DEM coverage
returns `degraded`/`unavailable`; it does not create a verified profile.

## 7. Provenance, rights, and attribution

```ts
type ProvenanceBundle = {
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

type EvidenceReference = ProvenanceBundle & {
  evidenceId: string;
  evidenceType: "source" | "activity" | "community" | "dem" | "qa";
};
```

Rights `unclear` permits factual identity display only where the SDE policy
allows it; it does not permit reusable geometry or route imagery. A route is
not `summitready_verified` unless evidence, topology, metric calculation,
rights, hashes, and QA gates meet the SDE publication rules. Attribution must
travel with any client DTO that displays sourced geometry or facts.

## 8. Activity route reference

```ts
type ActivityRouteReference = {
  activityId: string;
  sourceType: string;
  sourceId: string;
  route?: RouteVersion;
  referenceKind: "planned" | "recorded" | "matched";
  recordedAt?: string;
  traceEvidenceAvailable: boolean;
};
```

The physical activity identity remains `(sourceType, sourceId)` and
`activityId` is not a route ID. A reference links an activity to a canonical
route; it does not alter route geometry, facts, verification, or provenance.
One activity may be linked to Training, Expedition, Explore, and a canonical
route without duplication.

## 9. Consumer contracts

### Training target route

```ts
type TrainingTargetRoute = {
  route: RouteVersion;
  mountain: SdeMountainId;
  facts: RouteReadResult<RouteFacts>;
  trust: MountainVerification;
  source: "canonical" | "compatibility";
  demandStatus: "supported" | "degraded" | "unavailable";
};
```

Training may retain its existing `SummitGoal` and hill shape. New targets carry
the SDE reference when supplied; legacy targets remain explicitly
`compatibility` and are not silently upgraded. Readiness 2.0 consumes only
approved demand facts through its existing boundary.

### Expedition local-stage route

```ts
type ExpeditionLocalStageRoute = {
  route?: RouteVersion;
  mountain?: SdeMountainId;
  stageSnapshot: {
    name: string;
    simulatedElevationGainM: number;
    routeIdentityKey?: string;
    summitIdentityKey?: string;
  };
  routeFacts: RouteReadResult<RouteFacts>;
  mountainDna?: MountainDnaInput;
};
```

The route reference explains a local analogue; it does not change simulated
progress semantics or turn simulated metres into real ascent. Stage 6 launch
identity and summit authority remain unchanged. If no verified route is
available, the stage remains actionable with an explicit unavailable/degraded
route-intelligence label.

### Explore route

```ts
type ExploreRoute = {
  route?: RouteVersion;
  mountain?: SdeMountainId;
  definition: RouteReadResult<RouteDefinition>;
  facts: RouteReadResult<RouteFacts>;
  geometry: RouteReadResult<RouteGeometry>;
  trust: MountainVerification | null;
  attribution: ProvenanceBundle | null;
  trackAvailability: "can_track" | "identity_only" | "unavailable";
};
```

Explore can browse canonical mountains/routes and expose trust/attribution.
Track uses the existing protected tracker with a stable launch context. Local
or generated routes remain distinguishable and cannot become verified merely
because an activity was recorded.

## 10. Missing, ambiguous, unverified, and version-change behavior

- **Missing identity:** return `unavailable / missing_identity`; do not infer
  from display name or coordinates.
- **Ambiguous lookup:** return `ambiguous / ambiguous_lookup` and require an
  explicit verified selection.
- **Missing definition, geometry, profile, or metric:** preserve available
  identity and facts, return `degraded`, and list the missing reason.
- **`needs_review` or `rejected`:** expose the engine state and do not label the
  route SummitReady Verified or use it as verified Mountain DNA input.
- **Unclear rights:** expose factual identity only where permitted; geometry
  and derived presentation remain unavailable.
- **Conflicting evidence:** fail closed for the conflicting object and retain
  the provenance diagnostics; never choose the most attractive value.
- **Version unavailable:** return `version_not_found`; do not silently resolve
  to another version. A separately documented alias may offer a replacement as
  a new reference, never as an in-place mutation.
- **Cache stale:** show the cached version and stale reason or return
  unavailable; never remove its version/provenance metadata.
- **Offline:** render a previously cached, versioned snapshot only with its
  trust/provenance metadata and stale state. Tracking and Save remain
  independent and must not be network-gated.

## 11. Mountain DNA input boundary

Mountain DNA is a deterministic route-to-route comparison, not an AI opinion.
The evaluator must receive immutable, already-audited inputs only:

```ts
type MountainDnaInput = {
  target: {
    route: RouteVersion;
    facts: RouteFacts;
    profile?: RouteElevationProfile;
    trust: MountainVerification;
    provenance: ProvenanceBundle;
  };
  candidate: {
    route: RouteVersion;
    facts: RouteFacts;
    profile?: RouteElevationProfile;
    trust: MountainVerification;
    provenance: ProvenanceBundle;
  };
  evaluatorVersion: string;
};
```

Only dimensions with trustworthy facts on both routes may be scored. Missing,
unverified, or incompatible-version dimensions must be reported as unknown or
degraded, not imputed. This checkpoint intentionally does not finalize weights,
normalization, confidence semantics, or an overall score; those belong to the
audited S7-C04 evaluator and must be justified by available evidence.

## 12. Compatibility and ownership boundaries

The future read adapter may map `canonical_hills`, seeded/live trail records,
Training hills, Expedition `NearbyHill`, and Explore records into these
contracts, but it must retain the source identifier and mark the result
`compatibility` when no SDE identity/version exists. It must not write back a
new canonical identity, migrate old rows, or merge duplicate mountains.

SDE migrations remain owned by `summit-data-engine`; no SummitReady production
schema or SQL is required. The GPS/offline tracker, Stage 6 Progress
Mountain/cinematic path, Readiness 2.0 boundary, Elevation Bank semantics,
canonical activity dedupe, auth/payment/privacy behavior, and PA-A2 remain
outside this model.

**S7-R02 status: COMPLETE**