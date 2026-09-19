import type {
  RouteFacts,
  RouteVersion,
  MountainVerification,
  ProvenanceBundle,
  RouteElevationProfile,
} from "./routeIntelligence";

export const MOUNTAIN_DNA_MODEL_VERSION = "mountain-dna-v1";

export type MountainDnaInput = {
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
  evaluatorVersion?: string;
};

export type MountainDnaDimensionName =
  | "ascent"
  | "distance"
  | "steepness"
  | "terrain"
  | "technical"
  | "altitude"
  | "exposure"
  | "profileShape";

export type MountainDnaDimension = {
  name: MountainDnaDimensionName;
  score: number | null;
  weight: number;
  status: "scored" | "unknown" | "excluded";
  evidence: string[];
  explanation: string;
};

export type MountainDnaResult = {
  modelVersion: string;
  targetRouteId: string;
  candidateRouteId: string;
  overallScore: number | null;
  confidence: "high" | "moderate" | "low" | "unavailable";
  state: "ready" | "degraded" | "unavailable";
  dimensions: MountainDnaDimension[];
  missingDimensions: MountainDnaDimensionName[];
  explanations: string[];
};

const DIMENSION_WEIGHTS: Record<MountainDnaDimensionName, number> = {
  ascent: 0.35,
  distance: 0.25,
  steepness: 0.2,
  terrain: 0.1,
  technical: 0.1,
  altitude: 0,
  exposure: 0,
  profileShape: 0,
};

function finiteNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function trustedRoute(trust: MountainVerification, provenance: ProvenanceBundle): boolean {
  return trust.engineStatus === "verified" &&
    trust.productLifecycle === "summitready_verified" &&
    provenance.rightsClassification === "reusable_geometry";
}

function boundedScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value * 100) / 100));
}

/**
 * Symmetric ratio similarity. Equal values score 100; a zero/non-zero pair
 * scores 0; values are never imputed or allowed outside 0..100.
 */
function ratioSimilarity(left: number, right: number): number {
  if (left === 0 && right === 0) return 100;
  const largest = Math.max(left, right);
  return boundedScore((1 - Math.abs(left - right) / largest) * 100);
}

function normaliseLabel(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function categoricalSimilarity(left: string, right: string): number {
  return normaliseLabel(left) === normaliseLabel(right) ? 100 : 0;
}

function numericDimension(
  name: MountainDnaDimensionName,
  weight: number,
  target: number | undefined,
  candidate: number | undefined,
  explanation: string,
): MountainDnaDimension {
  if (!finiteNonNegative(target) || !finiteNonNegative(candidate)) {
    return {
      name,
      score: null,
      weight,
      status: "unknown",
      evidence: [],
      explanation: `${name} is unknown because both routes do not have a finite, non-negative sourced value.`,
    };
  }
  return {
    name,
    score: ratioSimilarity(target, candidate),
    weight,
    status: "scored",
    evidence: ["verified route facts"],
    explanation,
  };
}

function sourcedCategoricalDimension(
  name: "terrain" | "technical",
  weight: number,
  target: RouteFacts["terrain"] | RouteFacts["technicalCharacter"],
  candidate: RouteFacts["terrain"] | RouteFacts["technicalCharacter"],
): MountainDnaDimension {
  if (!target || !candidate ||
      !target.value.trim() || !candidate.value.trim() ||
      target.source.rightsClassification !== "reusable_geometry" ||
      candidate.source.rightsClassification !== "reusable_geometry") {
    return {
      name,
      score: null,
      weight,
      status: "unknown",
      evidence: [],
      explanation: `${name} is unknown because genuinely reusable sourced character is missing.`,
    };
  }
  return {
    name,
    score: categoricalSimilarity(target.value, candidate.value),
    weight,
    status: "scored",
    evidence: [target.source.evidenceId ?? "target source", candidate.source.evidenceId ?? "candidate source"],
    explanation: `${name} is compared only as an exact sourced category; no geographic or semantic guess is made.`,
  };
}

function profileMeanGrade(profile: RouteElevationProfile | undefined): number | undefined {
  if (!profile || profile.samples.length < 2) return undefined;
  let ascent = 0;
  let distance = 0;
  for (let index = 1; index < profile.samples.length; index += 1) {
    const previous = profile.samples[index - 1];
    const current = profile.samples[index];
    if (previous.elevationM === null || current.elevationM === null) continue;
    const segmentDistance = current.distanceM - previous.distanceM;
    if (!Number.isFinite(segmentDistance) || segmentDistance <= 0) continue;
    distance += segmentDistance;
    ascent += Math.max(0, current.elevationM - previous.elevationM);
  }
  return distance > 0 ? (ascent / distance) * 100 : undefined;
}

function steepness(facts: RouteFacts, profile?: RouteElevationProfile): number | undefined {
  if (facts.gradient && finiteNonNegative(facts.gradient.meanPercent)) {
    return facts.gradient.meanPercent;
  }
  if (finiteNonNegative(facts.ascentM) && finiteNonNegative(facts.distanceM) && facts.distanceM > 0) {
    return (facts.ascentM / facts.distanceM) * 100;
  }
  return profileMeanGrade(profile);
}

function unknownDimension(
  name: MountainDnaDimensionName,
  explanation: string,
): MountainDnaDimension {
  return {
    name,
    score: null,
    weight: DIMENSION_WEIGHTS[name],
    status: "unknown",
    evidence: [],
    explanation,
  };
}

export function evaluateMountainDna(input: MountainDnaInput): MountainDnaResult {
  const modelVersion = input.evaluatorVersion?.trim() || MOUNTAIN_DNA_MODEL_VERSION;
  const dimensions: MountainDnaDimension[] = [];
  const targetTrusted = trustedRoute(input.target.trust, input.target.provenance);
  const candidateTrusted = trustedRoute(input.candidate.trust, input.candidate.provenance);
  const trustworthy = targetTrusted && candidateTrusted;

  if (!trustworthy) {
    const excluded: MountainDnaDimension[] = (["ascent", "distance", "steepness", "terrain", "technical"] as const)
      .map(name => ({
        name,
        score: null,
        weight: DIMENSION_WEIGHTS[name],
        status: "excluded" as const,
        evidence: [],
        explanation: "Excluded because both routes must be SummitReady Verified with reusable geometry rights.",
      }));
    const missingDimensions = excluded.map(dimension => dimension.name);
    return {
      modelVersion,
      targetRouteId: input.target.route.routeId,
      candidateRouteId: input.candidate.route.routeId,
      overallScore: null,
      confidence: "unavailable",
      state: "unavailable",
      dimensions: [
        ...excluded,
        unknownDimension("altitude", "Altitude comparison is not enabled without a separately audited model."),
        unknownDimension("exposure", "Exposure is not present in the current trusted route facts."),
        unknownDimension("profileShape", "Profile-shape comparison is not present in the current trusted route facts."),
      ],
      missingDimensions: [
        ...missingDimensions,
        "altitude",
        "exposure",
        "profileShape",
      ],
      explanations: ["Mountain DNA is unavailable until both route records cross the verified provenance boundary."],
    };
  }

  dimensions.push(
    numericDimension("ascent", DIMENSION_WEIGHTS.ascent, input.target.facts.ascentM, input.candidate.facts.ascentM,
      "Ascent demand uses symmetric ratio similarity from verified total ascent."),
    numericDimension("distance", DIMENSION_WEIGHTS.distance, input.target.facts.distanceM, input.candidate.facts.distanceM,
      "Distance uses symmetric ratio similarity from verified route distance."),
    numericDimension("steepness", DIMENSION_WEIGHTS.steepness, steepness(input.target.facts, input.target.profile), steepness(input.candidate.facts, input.candidate.profile),
      "Steepness uses sourced mean grade, a profile-derived ascent/distance value, or a transparent facts derivation."),
    sourcedCategoricalDimension("terrain", DIMENSION_WEIGHTS.terrain, input.target.facts.terrain, input.candidate.facts.terrain),
    sourcedCategoricalDimension("technical", DIMENSION_WEIGHTS.technical, input.target.facts.technicalCharacter, input.candidate.facts.technicalCharacter),
    numericDimension("altitude", DIMENSION_WEIGHTS.altitude, input.target.facts.summitElevationM, input.candidate.facts.summitElevationM,
      "Altitude uses sourced summit elevation only; it does not infer exposure or acclimatisation."),
    unknownDimension("exposure", "Exposure is not present in the current trusted route facts."),
    unknownDimension("profileShape", "Profile-shape comparison is not present in the current trusted route facts."),
  );

  const scored = dimensions.filter(dimension => dimension.status === "scored" && dimension.score !== null && dimension.weight > 0);
  const totalWeight = scored.reduce((sum, dimension) => sum + dimension.weight, 0);
  const overallScore = totalWeight > 0
    ? boundedScore(scored.reduce((sum, dimension) => sum + dimension.score! * dimension.weight, 0) / totalWeight)
    : null;
  const missingDimensions = dimensions
    .filter(dimension => dimension.status !== "scored")
    .map(dimension => dimension.name);
  const missingWeightedDimensions = dimensions
    .filter(dimension => dimension.status !== "scored" && dimension.weight > 0);
  const confidence = scored.length >= 4 ? "high" : scored.length >= 2 ? "moderate" : scored.length === 1 ? "low" : "unavailable";
  const state = overallScore === null ? "unavailable" : missingWeightedDimensions.length ? "degraded" : "ready";

  return {
    modelVersion,
    targetRouteId: input.target.route.routeId,
    candidateRouteId: input.candidate.route.routeId,
    overallScore,
    confidence,
    state,
    dimensions,
    missingDimensions,
    explanations: [
      "Scores are deterministic route-to-route comparisons of available verified facts.",
      ...(missingDimensions.length ? ["Missing dimensions are excluded and never imputed."] : []),
    ],
  };
}