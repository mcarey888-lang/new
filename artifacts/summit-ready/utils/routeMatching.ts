import {
  evaluateMountainDna,
  type MountainDnaResult,
} from "./mountainDna";
import {
  parseSdeMountainId,
  parseSdeRouteId,
  type RouteFacts,
  type RouteIntelligence,
} from "./routeIntelligence";

export type RouteCandidatePredicate = (
  candidate: RouteIntelligence,
) => boolean;

export type RouteMatchRequest = {
  targetRouteId: string;
  target: RouteIntelligence;
  candidates: readonly RouteIntelligence[];
  limit?: number;
  /**
   * Deliberately separate from Mountain DNA. Callers may apply a future
   * radius/geographic predicate without changing the route similarity score.
   */
  candidatePredicate?: RouteCandidatePredicate;
};

export type RouteMatchFilterReason =
  | "self"
  | "invalid_identity"
  | "untrusted"
  | "rights_unclear"
  | "missing_geometry"
  | "insufficient_facts"
  | "candidate_predicate";

export type RouteMatchFilter = {
  routeId: string | null;
  reason: RouteMatchFilterReason;
};

export type RouteMatchError =
  | "invalid_target_identity"
  | "target_identity_mismatch"
  | "target_untrusted"
  | "target_rights_unclear"
  | "target_missing_geometry"
  | "target_insufficient_facts";

export type RouteMatch = {
  route: RouteIntelligence;
  dna: MountainDnaResult;
  whyMatched: string[];
};

export type RouteMatchResult =
  | {
      availability: "available" | "degraded";
      targetRouteId: string;
      matches: RouteMatch[];
      filtered: RouteMatchFilter[];
    }
  | {
      availability: "unavailable";
      targetRouteId: string | null;
      matches: [];
      filtered: RouteMatchFilter[];
      error: RouteMatchError;
    };

const CONFIDENCE_ORDER: Record<MountainDnaResult["confidence"], number> = {
  high: 3,
  moderate: 2,
  low: 1,
  unavailable: 0,
};

function finiteNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function hasSufficientFacts(facts: RouteFacts | null): boolean {
  return Boolean(
    facts &&
      finiteNonNegative(facts.distanceM) &&
      finiteNonNegative(facts.ascentM)
  );
}

function validTrust(route: RouteIntelligence): boolean {
  return (
    route.route.status === "verified" &&
    route.trust.engineStatus === "verified" &&
    route.trust.productLifecycle === "summitready_verified"
  );
}

function validIdentity(route: RouteIntelligence): boolean {
  const mountainId = parseSdeMountainId(route.mountain.id);
  const parsed = parseSdeRouteId(route.route.version.routeId);
  return Boolean(
    mountainId &&
      parsed &&
      parsed.routeId === route.route.version.routeId &&
      route.route.version.mountainId === mountainId &&
      parsed.identityKey === route.route.version.identityKey &&
      parsed.version === route.route.version.version,
  );
}

function validGeometry(route: RouteIntelligence): boolean {
  return Boolean(
    route.geometry &&
      route.geometry.topologyStatus === "complete" &&
      route.geometry.coordinates.length > 0 &&
      route.route.provenance.rightsClassification === "reusable_geometry",
  );
}

function filterReason(route: RouteIntelligence): RouteMatchFilterReason | null {
  if (!validIdentity(route)) return "invalid_identity";
  if (!validTrust(route)) return "untrusted";
  if (route.route.provenance.rightsClassification !== "reusable_geometry") {
    return "rights_unclear";
  }
  if (!validGeometry(route)) return "missing_geometry";
  if (!hasSufficientFacts(route.facts)) return "insufficient_facts";
  return null;
}

function whyMatched(dna: MountainDnaResult): string[] {
  const scored = dna.dimensions
    .filter((dimension) => dimension.status === "scored" && dimension.score !== null)
    .map((dimension) => `${dimension.name} ${dimension.score}%`);
  const missing = dna.missingDimensions.filter((dimension) =>
    dna.dimensions.some((item) => item.name === dimension && item.weight > 0),
  );
  return [
    `Mountain DNA ${dna.overallScore ?? 0}% (${dna.confidence} confidence)`,
    ...(scored.length ? [`Compared ${scored.join(", ")}.`] : []),
    ...(missing.length ? [`Unknown data: ${missing.join(", ")}.`] : []),
  ];
}

function unavailable(
  targetRouteId: string | null,
  error: RouteMatchError,
  filtered: RouteMatchFilter[] = [],
): RouteMatchResult {
  return {
    availability: "unavailable",
    targetRouteId,
    matches: [],
    filtered,
    error,
  };
}

export function matchRoutes(request: RouteMatchRequest): RouteMatchResult {
  const targetParsed = parseSdeRouteId(request.targetRouteId);
  if (!targetParsed) return unavailable(null, "invalid_target_identity");
  if (
    request.target.route.version.routeId !== request.targetRouteId ||
    !validIdentity(request.target)
  ) {
    return unavailable(request.targetRouteId, "target_identity_mismatch");
  }
  const targetReason = filterReason(request.target);
  if (targetReason === "untrusted") {
    return unavailable(request.targetRouteId, "target_untrusted");
  }
  if (targetReason === "rights_unclear") {
    return unavailable(request.targetRouteId, "target_rights_unclear");
  }
  if (targetReason === "missing_geometry") {
    return unavailable(request.targetRouteId, "target_missing_geometry");
  }
  if (targetReason === "insufficient_facts") {
    return unavailable(request.targetRouteId, "target_insufficient_facts");
  }
  if (targetReason) return unavailable(request.targetRouteId, "target_identity_mismatch");

  const filtered: RouteMatchFilter[] = [];
  const matches: RouteMatch[] = [];
  for (const candidate of request.candidates) {
    if (candidate.route.version.routeId === request.targetRouteId) {
      filtered.push({ routeId: candidate.route.version.routeId, reason: "self" });
      continue;
    }
    const reason = filterReason(candidate);
    if (reason) {
      filtered.push({ routeId: candidate.route.version.routeId ?? null, reason });
      continue;
    }
    if (request.candidatePredicate && !request.candidatePredicate(candidate)) {
      filtered.push({ routeId: candidate.route.version.routeId, reason: "candidate_predicate" });
      continue;
    }
    const dna = evaluateMountainDna({
      target: {
        route: request.target.route.version,
        facts: request.target.facts!,
        profile: request.target.elevationProfile ?? undefined,
        trust: request.target.trust,
        provenance: request.target.route.provenance,
      },
      candidate: {
        route: candidate.route.version,
        facts: candidate.facts!,
        profile: candidate.elevationProfile ?? undefined,
        trust: candidate.trust,
        provenance: candidate.route.provenance,
      },
    });
    matches.push({ route: candidate, dna, whyMatched: whyMatched(dna) });
  }

  matches.sort((left, right) =>
    (right.dna.overallScore ?? -1) - (left.dna.overallScore ?? -1) ||
    CONFIDENCE_ORDER[right.dna.confidence] - CONFIDENCE_ORDER[left.dna.confidence] ||
    left.route.route.version.routeId.localeCompare(right.route.route.version.routeId),
  );
  const limit = request.limit === undefined
    ? matches.length
    : Math.max(0, Math.floor(request.limit));
  return {
    availability: matches.some((match) => match.dna.state === "degraded")
      ? "degraded"
      : "available",
    targetRouteId: request.targetRouteId,
    matches: matches.slice(0, limit),
    filtered,
  };
}