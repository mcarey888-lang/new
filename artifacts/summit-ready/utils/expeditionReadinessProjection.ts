import {
  evaluateReadiness,
  type ReadinessInput,
} from "./readinessV2";

export interface ExpeditionReadinessRoute {
  routeIdentityKey?: string | null;
  routeDataStatus?: string | null;
  dataSource?: string | null;
  confidence?: string | null;
  distanceKm?: number | null;
  ascentM?: number | null;
  durationMinutes?: number | null;
}

export type ExpeditionReadinessProjection =
  | {
      available: true;
      before: number;
      after: number;
      delta: number;
      routeCount: number;
      mountainExperienceDelta: number | null;
      estimated: true;
      explanation: string;
    }
  | {
      available: false;
      reason: string;
    };

function eligibleRoute(route: ExpeditionReadinessRoute): boolean {
  return Boolean(
    route.routeIdentityKey?.trim()
    && route.routeDataStatus === "verified"
    && route.confidence === "verified"
    && route.dataSource?.trim()
    && typeof route.distanceKm === "number"
    && Number.isFinite(route.distanceKm)
    && route.distanceKm > 0
    && typeof route.ascentM === "number"
    && Number.isFinite(route.ascentM)
    && route.ascentM > 0,
  );
}

/**
 * Preview the readiness change only for an explicit scenario in which the
 * supplied, verified outdoor routes are completed. Projected items are manual
 * scenario evidence: this never claims GPS validation or creates canonical IDs.
 */
export function projectExpeditionReadiness(
  input: ReadinessInput | null | undefined,
  routes: readonly ExpeditionReadinessRoute[],
): ExpeditionReadinessProjection {
  if (!input) {
    return {
      available: false,
      reason: "Readiness impact is unavailable until a training objective and eligible activity history are available.",
    };
  }

  if (
    (!input.target.mountainId && !input.target.routeId)
    || !(typeof input.target.distanceKm === "number" && Number.isFinite(input.target.distanceKm) && input.target.distanceKm > 0)
    || !(typeof input.target.ascentM === "number" && Number.isFinite(input.target.ascentM) && input.target.ascentM > 0)
  ) {
    return {
      available: false,
      reason: "Readiness impact is unavailable because this training objective does not have a stable identity and reliable distance/ascent targets.",
    };
  }

  const eligibleRoutes = routes.filter(eligibleRoute);
  const uniqueRoutes = [...new Map(
    eligibleRoutes.map(route => [route.routeIdentityKey!.trim(), route]),
  ).values()];
  if (!uniqueRoutes.length) {
    return {
      available: false,
      reason: "The selected routes do not include verified route identities and complete route metrics. Choosing or starting an expedition is not completed outdoor training, so no readiness estimate is shown.",
    };
  }

  const before = evaluateReadiness(input);
  if (before.overallScore === null) {
    return {
      available: false,
      reason: "Readiness impact is unavailable until eligible completed activity history is recorded.",
    };
  }

  const projectedEvidence = uniqueRoutes.map((route, index) => ({
    evidenceId: `projected-expedition-route-${index + 1}`,
    ownerId: input.ownerId,
    source: "manual" as const,
    completedAt: input.asOf,
    distanceKm: route.distanceKm,
    ascentM: route.ascentM,
    durationMinutes: route.durationMinutes,
    completed: true,
    gpsQuality: null,
    stableSourceId: `projection:${route.routeIdentityKey!.trim()}`,
    terrainTags: ["outdoor"],
  }));
  const after = evaluateReadiness({
    ...input,
    evidence: [...input.evidence, ...projectedEvidence],
  });
  if (after.overallScore === null) {
    return {
      available: false,
      reason: "Readiness impact could not be estimated from the available evidence.",
    };
  }

  return {
    available: true,
    before: before.overallScore,
    after: after.overallScore,
    delta: after.overallScore - before.overallScore,
    routeCount: uniqueRoutes.length,
    mountainExperienceDelta:
      before.dimensions.mountainExperience.score === null || after.dimensions.mountainExperience.score === null
        ? null
        : after.dimensions.mountainExperience.score - before.dimensions.mountainExperience.score,
    estimated: true,
    explanation: "Scenario assumes one real completion of each verified route, recorded as a manual activity. It does not claim GPS validation or count virtual/repeat elevation. This is a training heuristic, not a safety or summit guarantee.",
  };
}