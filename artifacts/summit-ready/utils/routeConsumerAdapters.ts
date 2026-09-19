import {
  matchRoutes,
  type RouteMatchResult,
} from "./routeMatching";
import {
  selectCanonicalRoute,
  mapExpeditionStage,
  type CanonicalRouteRecord,
  type ExpeditionLocalStageRoute,
  type RouteIntelligence,
  type RouteReadResult,
} from "./routeIntelligence";
import type { NearbyHill } from "../context/AppContext";

export type RouteReferenceStatus = "verified" | "degraded" | "unavailable";

export type ConsumerRouteReference = {
  routeIdentityKey: string | null;
  summitIdentityKey: string | null;
  status: RouteReferenceStatus;
  label: string;
  reason: string;
};

/**
 * Maps an app hill DTO to a display-only route reference. This never promotes
 * a legacy/generated record to canonical trust.
 */
export function routeReferenceFromNearbyHill(hill: NearbyHill): ConsumerRouteReference {
  const routeIdentityKey = hill.routeIdentityKey?.trim() || null;
  const summitIdentityKey = hill.summitIdentityKey?.trim() || null;
  if (routeIdentityKey) {
    return {
      routeIdentityKey,
      summitIdentityKey,
      status: "degraded",
      label: "Route reference available",
      reason: "The route is referenced, but a verified SDE record was not supplied.",
    };
  }

  return {
    routeIdentityKey: null,
    summitIdentityKey,
    status: "unavailable",
    label: "Route identity unavailable",
    reason: "This recommendation has no stable canonical route identity.",
  };
}

export type TrainingRouteIntelligence = {
  target: RouteReadResult<RouteIntelligence> | null;
  matches: RouteMatchResult;
};

export type ExpeditionStageRouteIntelligence = {
  reference: ConsumerRouteReference;
  stage: ExpeditionLocalStageRoute;
  targetRoute: RouteReadResult<RouteIntelligence> | null;
  dna: RouteMatchResult;
};

/**
 * Adapts one persisted Expedition stage to the shared canonical route boundary.
 * A legacy/generated stage remains a compatibility reference and never inherits
 * SDE trust merely because its display name or metrics look familiar.
 */
export function buildExpeditionStageRouteIntelligence(
  stage: NearbyHill,
  records: readonly CanonicalRouteRecord[],
  targetRouteId?: string | null,
): ExpeditionStageRouteIntelligence {
  const routeId = stage.routeIdentityKey?.trim() || null;
  const canonical = routeId
    ? selectCanonicalRoute({ routeId, candidates: records })
    : {
        availability: "unavailable" as const,
        value: null,
        reasons: ["missing_identity" as const],
      };
  const stageReference: ConsumerRouteReference = canonical.value
    ? {
        routeIdentityKey: canonical.value.route.version.routeId,
        summitIdentityKey: canonical.value.mountain.id,
        status: canonical.availability === "available" ? "verified" : "degraded",
        label: canonical.availability === "available"
          ? "SummitReady verified route"
          : "Canonical route needs verification",
        reason: canonical.availability === "available"
          ? "Stable SDE route identity, provenance and route facts are available."
          : "A canonical identity exists, but one or more verified route facts are incomplete.",
      }
    : routeReferenceFromNearbyHill(stage);
  const stageSnapshot = {
    name: stage.name,
    simulatedElevationGainM: Math.max(0, stage.totalElevation ?? stage.elevation ?? 0),
    routeIdentityKey: stage.routeIdentityKey,
    summitIdentityKey: stage.summitIdentityKey ?? stage.summitId,
  };
  const targetRoute = targetRouteId
    ? selectCanonicalRoute({ routeId: targetRouteId, candidates: records })
    : null;
  const dna = targetRouteId
    ? buildTrainingRouteIntelligence(targetRouteId, records, routeId ? [routeId] : []).matches
    : {
        availability: "unavailable" as const,
        targetRouteId: null,
        matches: [] as [],
        filtered: [],
        error: "invalid_target_identity" as const,
      };

  return {
    reference: stageReference,
    stage: mapExpeditionStage(stageSnapshot, canonical),
    targetRoute,
    dna,
  };
}

/**
 * Scores Training candidates only when the caller has canonical records for
 * both the target and candidates. Empty records intentionally produce an
 * unavailable result rather than a name/metric approximation.
 */
export function buildTrainingRouteIntelligence(
  targetRouteId: string | null | undefined,
  records: readonly CanonicalRouteRecord[],
  candidateRouteIds: readonly string[] = [],
): TrainingRouteIntelligence {
  if (!targetRouteId) {
    return {
      target: null,
      matches: {
        availability: "unavailable",
        targetRouteId: null,
        matches: [],
        filtered: [],
        error: "invalid_target_identity",
      },
    };
  }

  const targetRecord = selectCanonicalRoute({ routeId: targetRouteId, candidates: records });
  if (!targetRecord.value) {
    return {
      target: null,
      matches: {
        availability: "unavailable",
        targetRouteId,
        matches: [],
        filtered: [],
        error: "target_identity_mismatch",
      },
    };
  }

  const targetIntelligence = targetRecord.value;
  const candidates = records
    .filter(record => candidateRouteIds.includes(record.route.version.routeId))
    .map(record => selectCanonicalRoute({
      routeId: record.route.version.routeId,
      candidates: records,
    }).value)
    .filter((record): record is NonNullable<typeof record> => Boolean(record));

  return {
    target: targetRecord,
    matches: matchRoutes({
      targetRouteId,
      target: targetIntelligence,
      candidates,
      limit: 3,
    }),
  };
}