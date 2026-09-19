import {
  matchRoutes,
  type RouteMatchResult,
} from "./routeMatching";
import {
  selectCanonicalRoute,
  type CanonicalRouteRecord,
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
  const hasStableRouteId = routeIdentityKey?.startsWith("sde:route:") ?? false;
  const isVerified = hill.routeDataStatus === "verified" && hasStableRouteId;

  if (isVerified) {
    return {
      routeIdentityKey,
      summitIdentityKey,
      status: "verified",
      label: "SummitReady verified route",
      reason: "Stable route identity and verified route facts are available.",
    };
  }

  if (routeIdentityKey) {
    return {
      routeIdentityKey,
      summitIdentityKey,
      status: "degraded",
      label: "Route reference available",
      reason: "The route is referenced, but its verified provenance is not available here.",
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