import type { Hill } from "../../routes/hills-unified.js";
import type { TargetMountainProfile } from "../../routes/virtual-expedition.js";

export const DETERMINISTIC_MATCH_METHOD = "deterministic_route_facts_v1" as const;
export const QUICKEST_HIGH_SUMMITS_MATCH_METHOD = "quickest_high_summits_v1" as const;
/** Aggregate objective tolerances used by the minimum-summit matcher. */
export const QUICK_SUMMIT_NORMAL_ASCENT_TOLERANCE = 0.15;
export const QUICK_SUMMIT_NORMAL_DISTANCE_TOLERANCE = 0.20;
export const QUICK_SUMMIT_WIDE_ASCENT_TOLERANCE = 0.30;
export const QUICK_SUMMIT_WIDE_DISTANCE_TOLERANCE = 0.35;

export interface CandidateScoreComponents {
  ascentContribution: number;
  duration: number;
  gradeDifficulty: number;
  terrainRouteType: number;
  distance: number;
  hazardCompatibility: number;
}

export interface RankedCandidateRecord {
  name: string;
  routeIdentityKey?: string;
  score: number;
  components: CandidateScoreComponents;
  compatible: boolean;
  /** Additive deterministic evidence; compatible remains the legacy hazard gate. */
  eligible?: boolean;
  objectiveQuality?: number;
  rejectionReasons?: string[];
}

export interface DeterministicExpeditionMatch {
  rankedCandidates: RankedCandidateRecord[];
  selectedHills: Hill[];
  deterministicScore: number;
  achievedAscent: number;
  targetRatio: number;
  warnings: string[];
  matchMethod: typeof DETERMINISTIC_MATCH_METHOD | typeof QUICKEST_HIGH_SUMMITS_MATCH_METHOD;
  /** Additive aggregate route facts used by deterministic explanations. */
  achievedDistance: number;
  distanceRatio: number;
  achievedDurationMinutes: number;
  outingCount: number;
  distinctRouteCount: number;
  planSummary?: string;
  strongestAlternative?: string;
  /** Additive objective-fit diagnostics for API consumers. */
  toleranceMode: "normal" | "widened" | "approximate" | "none";
  toleranceLimits: { ascent: number; distance: number };
  selectionReason: string;
  matchDiagnostics: {
    targetAscent: number;
    plannedAscent: number;
    targetDistance: number;
    plannedDistance: number;
    ascentRatio: number;
    distanceRatio: number;
    withinNormal: boolean;
    withinWidened: boolean;
  };
}

export interface AdditionalSummitRecommendation {
  candidate: Hill;
  eligibleAlternatives: Hill[];
  deterministicIdentity: string;
  current: {
    gain: number;
    distance: number;
    gainRatio: number;
    distanceRatio: number;
    error: number;
  };
  projected: {
    gain: number;
    distance: number;
    gainRatio: number;
    distanceRatio: number;
    error: number;
    improvement: number;
  };
  provenance: {
    dataSource: string;
    routeDataStatus: string;
    routeIdentityKey: string | null;
    summitIdentityKey: string | null;
    confidence: "verified" | "calculated" | "estimated" | "unknown";
  };
  scheduleFit: {
    fitsExistingSchedule: boolean;
    assessment: string;
    additionalDayRecommended: boolean;
    /** Deterministic per-objective schedule contract (scheduleFit is retained for compatibility). */
    assignments: ScheduleAssignment[];
  };
  scheduleAssignments: ScheduleAssignment[];
}

export interface ScheduleAssignment {
  day: number;
  summitName: string;
  summitIdentityKey: string;
  routeIdentityKey: string | null;
  routeName: string | null;
  gain: number;
  distance: number | null;
  dataSource: string | null;
  routeDataStatus: string | null;
  relationship: "continuous_combined_route" | "separate_objective";
  confidence: "high" | "medium" | "estimated" | "low";
  reason: string;
  transitionConsideration: string;
}

function summitIdentity(hill: Hill): string {
  if (hill.summitIdentityKey) return hill.summitIdentityKey;
  // A route is not a new summit merely because its trailhead/record
  // coordinates differ. Explicit summit keys can distinguish genuinely
  // separate objectives with the same display name.
  return normaliseName(hill.name);
}

const OPTIMISATION_POOL_SIZE = 36;
const SAME_ROUTE_DISTANCE_KM = 2;
const MAX_DISTINCT_ROUTES = 8;
const MAX_REPEATS = 3;
const PRINCIPAL_SUMMIT_SEPARATION_KM = 0.75;
const MIN_KNOWN_PRINCIPAL_PROMINENCE_M = 30;

function normaliseName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function validCoordinates(hill: Hill): hill is Hill & { lat: number; lng: number } {
  return typeof hill.lat === "number"
    && Number.isFinite(hill.lat)
    && hill.lat >= -90
    && hill.lat <= 90
    && typeof hill.lng === "number"
    && Number.isFinite(hill.lng)
    && hill.lng >= -180
    && hill.lng <= 180;
}

function validTrailhead(hill: Hill): hill is Hill & { trailheadLat: number; trailheadLng: number } {
  return typeof hill.trailheadLat === "number" && Number.isFinite(hill.trailheadLat)
    && typeof hill.trailheadLng === "number" && Number.isFinite(hill.trailheadLng);
}

function haversineKm(
  a: Pick<Hill, "lat" | "lng"> & { lat: number; lng: number },
  b: Pick<Hill, "lat" | "lng"> & { lat: number; lng: number },
): number {
  const radians = Math.PI / 180;
  const deltaLat = (b.lat - a.lat) * radians;
  const deltaLng = (b.lng - a.lng) * radians;
  const v = Math.sin(deltaLat / 2) ** 2
    + Math.cos(a.lat * radians)
    * Math.cos(b.lat * radians)
    * Math.sin(deltaLng / 2) ** 2;
  return 12742 * Math.atan2(Math.sqrt(v), Math.sqrt(1 - v));
}

function sameGeographicRoute(a: Hill, b: Hill): boolean {
  if (a.routeIdentityKey && b.routeIdentityKey) {
    return a.routeIdentityKey === b.routeIdentityKey;
  }
  if (normaliseName(a.name) !== normaliseName(b.name)) return false;
  return !validCoordinates(a) || !validCoordinates(b) || haversineKm(a, b) <= SAME_ROUTE_DISTANCE_KM;
}

function geographicIdentity(hill: Hill): string {
  if (hill.routeIdentityKey) return hill.routeIdentityKey;
  const name = normaliseName(hill.name);
  return validCoordinates(hill)
    ? `${name}@${hill.lat},${hill.lng}`
    : `${name}@unknown`;
}

/**
 * Route records are never objectives merely because their names contain summit
 * words. Structured entity type and canonical linkage are authoritative.
 * Legacy records without either field remain eligible only when they have
 * complete, substantial route facts.
 */
function principalSummitEvidence(hill: Hill): { eligible: boolean; reason?: string } {
  if (["route", "ridge", "edge", "path", "trail", "way", "subsidiary_summit"].includes(hill.entityType ?? "")) {
    return { eligible: false, reason: "route-only or subsidiary entity is not a principal summit" };
  }
  if (hill.canonicalParentIdentityKey && hill.canonicalParentIdentityKey !== hill.summitIdentityKey) {
    return { eligible: false, reason: "canonical parent relationship is not reliable" };
  }
  // A route-shaped record cannot promote itself to a summit by attaching an
  // arbitrary summit key. Canonical/normalised summit records use routeType
  // "hill"; explicit route-shaped entity types were rejected above.
  if (hill.summitIdentityKey && hill.entityType == null && hill.routeType !== "hill") {
    return { eligible: false, reason: "route-shaped feature is not a principal summit" };
  }
  if (hill.entityType === "summit" || hill.entityType === "peak" || hill.entityType === "hill") {
    return { eligible: true };
  }
  if (hill.summitIdentityKey) return { eligible: true };
  return { eligible: true };
}

function stableHillCompare(a: Hill, b: Hill): number {
  return normaliseName(a.name).localeCompare(normaliseName(b.name), "en")
    || a.name.localeCompare(b.name, "en")
    || geographicIdentity(a).localeCompare(geographicIdentity(b), "en")
    || b.elevation - a.elevation;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function matchError(gain: number, distance: number, profile: Pick<TargetMountainProfile, "totalElevationGain" | "totalDistance">): number {
  return (profile.totalElevationGain > 0 ? Math.abs(gain / profile.totalElevationGain - 1) : 0)
    + (profile.totalDistance > 0 ? Math.abs(distance / profile.totalDistance - 1) : 0);
}

function routeConfidence(hill: Hill): "verified" | "calculated" | "estimated" | "unknown" {
  if (hill.routeDataStatus === "external_route") return "verified";
  if (hill.routeDataStatus === "terrain_calculated") return "calculated";
  if (hill.routeDataStatus === "seeded_estimate") return "estimated";
  return "unknown";
}

function additionalRouteEvidenceRank(hill: Hill): number {
  if (hill.routeDataStatus === "external_route") return 3;
  if (hill.dataSource === "canonical_verified") return 2;
  if (hill.routeDataStatus === "terrain_calculated") return 1;
  return 0;
}

/**
 * Suggests, but never selects, one more summit from the already discovered
 * candidate pool. This deliberately has no discovery or database fallback.
 */
export function recommendAdditionalSummit(
  candidates: Hill[],
  match: Pick<DeterministicExpeditionMatch, "selectedHills" | "rankedCandidates">,
  profile: TargetMountainProfile,
  difficultyPreference?: string | null,
): AdditionalSummitRecommendation | undefined {
  const currentGain = match.selectedHills.reduce((sum, hill) => sum + hill.elevation * hill.repeats, 0);
  const currentDistance = match.selectedHills.reduce((sum, hill) => sum + (hill.routeDistance ?? 0) * hill.repeats, 0);
  const currentError = matchError(currentGain, currentDistance, profile);
  const currentGainRatio = profile.totalElevationGain > 0 ? currentGain / profile.totalElevationGain : 0;
  const currentDistanceRatio = profile.totalDistance > 0 ? currentDistance / profile.totalDistance : 0;
  // An in-tolerance plan should not prominently recommend an addition.
  if (Math.abs(currentGainRatio - 1) <= QUICK_SUMMIT_NORMAL_ASCENT_TOLERANCE
    && Math.abs(currentDistanceRatio - 1) <= QUICK_SUMMIT_NORMAL_DISTANCE_TOLERANCE) return undefined;

  const selectedSummits = new Set(match.selectedHills.map(summitIdentity));
  const selectedRoutes = new Set(match.selectedHills.map(geographicIdentity));
  const records = new Map(match.rankedCandidates.map(record =>
    [record.routeIdentityKey ?? normaliseName(record.name), record]));
  const eligible = candidates
    .filter(hill => Number.isFinite(hill.elevation) && hill.elevation > 0)
    .filter(hill => !selectedSummits.has(summitIdentity(hill)) && !selectedRoutes.has(geographicIdentity(hill)))
    .filter(hill => {
      const record = records.get(hill.routeIdentityKey ?? normaliseName(hill.name));
      return record?.eligible === true && isNamedSummitCandidate(hill)
        && routeEvidence(hill).eligible
        && hazardScore(hill, profile).compatible
        && abilityCompatibility(hill, profile, difficultyPreference).compatible;
    })
    .sort((a, b) => stableHillCompare(a, b));
  const ranked = eligible.map(candidate => {
    const gain = currentGain + candidate.elevation;
    const distance = currentDistance + (candidate.routeDistance ?? 0);
    const error = matchError(gain, distance, profile);
    const gainRatio = profile.totalElevationGain > 0 ? gain / profile.totalElevationGain : 0;
    const distanceRatio = profile.totalDistance > 0 ? distance / profile.totalDistance : 0;
    const withinNormal = Math.abs(gainRatio - 1) <= QUICK_SUMMIT_NORMAL_ASCENT_TOLERANCE
      && Math.abs(distanceRatio - 1) <= QUICK_SUMMIT_NORMAL_DISTANCE_TOLERANCE;
    return { candidate, gain, distance, error, withinNormal };
  }).filter(item => item.error < currentError);
  if (!ranked.length) return undefined;
  ranked.sort((a, b) =>
    a.error - b.error
    || Number(b.withinNormal) - Number(a.withinNormal)
    || (b.candidate.summitElevationASL ?? -1) - (a.candidate.summitElevationASL ?? -1)
    || (b.candidate.summitProminenceM ?? -1) - (a.candidate.summitProminenceM ?? -1)
    || additionalRouteEvidenceRank(b.candidate) - additionalRouteEvidenceRank(a.candidate)
    || terrainScore(b.candidate, profile) - terrainScore(a.candidate, profile)
    || stableHillCompare(a.candidate, b.candidate));
  // A summit may have several verified routes, but it is one objective.
  // Retain the best route according to the same deterministic ordering used
  // for the recommendation, rather than exposing duplicate alternatives.
  const uniqueSummits = new Set<string>();
  const dedupedRanked = ranked.filter(item => {
    const identity = summitIdentity(item.candidate);
    if (uniqueSummits.has(identity)) return false;
    uniqueSummits.add(identity);
    return true;
  });
  const winner = dedupedRanked[0];
  if (!winner) return undefined;
  const scheduleAssignments = buildScheduleAssignments(match.selectedHills, winner.candidate, profile);
  const candidateAssignment = scheduleAssignments[scheduleAssignments.length - 1];
  const geographicallyCompatible = candidateAssignment.relationship === "continuous_combined_route";
  const currentMinutes = match.selectedHills.reduce(
    (sum, hill) => sum + (parseEstimatedMinutes(hill.estimatedTime) ?? 0) * hill.repeats, 0);
  const candidateMinutes = parseEstimatedMinutes(winner.candidate.estimatedTime) ?? 0;
  const fits = geographicallyCompatible
    && candidateAssignment.day <= profile.estimatedDays
    && currentGain + winner.candidate.elevation <= profile.maxDailyElevation * profile.estimatedDays
    && currentMinutes + candidateMinutes <= profile.estimatedDays * 7 * 60;
  return {
    candidate: materialiseHill(winner.candidate, 1),
    eligibleAlternatives: dedupedRanked
      .slice(1, 5)
      .map(item => materialiseHill(item.candidate, 1)),
    deterministicIdentity: summitIdentity(winner.candidate),
    current: { gain: currentGain, distance: currentDistance, gainRatio: currentGainRatio, distanceRatio: currentDistanceRatio, error: currentError },
    projected: {
      gain: winner.gain, distance: winner.distance,
      gainRatio: profile.totalElevationGain > 0 ? winner.gain / profile.totalElevationGain : 0,
      distanceRatio: profile.totalDistance > 0 ? winner.distance / profile.totalDistance : 0,
      error: winner.error, improvement: currentError - winner.error,
    },
    provenance: {
      dataSource: winner.candidate.dataSource ?? "unknown",
      routeDataStatus: winner.candidate.routeDataStatus ?? "unknown",
      routeIdentityKey: winner.candidate.routeIdentityKey ?? null,
      summitIdentityKey: winner.candidate.summitIdentityKey ?? null,
      confidence: routeConfidence(winner.candidate),
    },
    scheduleFit: {
      fitsExistingSchedule: fits,
      assessment: fits
        ? "Fits within the existing schedule using trusted route/trailhead compatibility."
        : "An additional day is recommended; independent or uncertain routes remain separate.",
      additionalDayRecommended: !fits,
      assignments: scheduleAssignments,
    },
    scheduleAssignments,
  };
}

function isNamedSummitCandidate(hill: Hill): boolean {
  return principalSummitEvidence(hill).eligible;
}

function proximityScore(actual: number, desired: number): number {
  return !Number.isFinite(actual) || actual <= 0 || desired <= 0 ? 0
    : clampScore(100 * Math.min(actual, desired) / Math.max(actual, desired));
}

function parseEstimatedMinutes(value: string | null | undefined): number | null {
  if (!value) return null;
  const range = value.match(/(\d+(?:\.\d+)?)\s*[–-]\s*(\d+(?:\.\d+)?)\s*h/i);
  if (range) return (Number(range[1]) + Number(range[2])) * 30;
  const hours = value.match(/(\d+(?:\.\d+)?)\s*h/i);
  if (hours) return Number(hours[1]) * 60;
  const minutes = value.match(/(\d+)\s*min/i);
  return minutes ? Number(minutes[1]) : null;
}

function scheduleRelationship(a: Hill, b: Hill): {
  relationship: ScheduleAssignment["relationship"];
  confidence: ScheduleAssignment["confidence"];
  reason: string;
} {
  if (a.routeIdentityKey && b.routeIdentityKey && a.routeIdentityKey === b.routeIdentityKey) {
    return {
      relationship: "continuous_combined_route",
      confidence: "high",
      reason: "Trusted identical route identity establishes a combined route.",
    };
  }
  if (validTrailhead(a) && validTrailhead(b)) {
    const distance = haversineKm(
      { lat: a.trailheadLat, lng: a.trailheadLng },
      { lat: b.trailheadLat, lng: b.trailheadLng },
    );
    if (distance <= 15) return {
      relationship: "continuous_combined_route",
      confidence: "medium",
      reason: `Reliable trailheads are ${distance.toFixed(1)} km apart.`,
    };
  }
  return {
    relationship: "separate_objective",
    confidence: validTrailhead(a) || validTrailhead(b) ? "low" : "estimated",
    reason: validCoordinates(a) && validCoordinates(b)
      ? "Summit coordinates are not trailheads; no trusted route boundary or trailhead compatibility exists."
      : "Route geometry and trailheads are unavailable, so independent objectives remain separate.",
  };
}

function buildScheduleAssignments(current: Hill[], candidate: Hill, profile: TargetMountainProfile): ScheduleAssignment[] {
  const assignments: ScheduleAssignment[] = [];
  current.forEach((hill, index) => {
    assignments.push({
      day: index + 1,
      summitName: hill.summitName ?? hill.name,
      summitIdentityKey: summitIdentity(hill),
      routeIdentityKey: hill.routeIdentityKey ?? null,
      routeName: hill.routeName ?? null,
      gain: hill.elevation * hill.repeats,
      distance: hill.routeDistance ?? null,
      dataSource: hill.dataSource ?? null,
      routeDataStatus: hill.routeDataStatus ?? null,
      relationship: "separate_objective",
      confidence: "high",
      reason: "Current objective receives a stable dedicated day.",
      transitionConsideration: "No transition distance is added to route totals.",
    });
  });
  const related = current.find(hill => scheduleRelationship(hill, candidate).relationship === "continuous_combined_route");
  const relationship = related ? scheduleRelationship(related, candidate) : scheduleRelationship(
    current[0] ?? candidate, candidate,
  );
  const day = related ? assignments[current.indexOf(related)].day : assignments.length + 1;
  assignments.push({
    day,
    summitName: candidate.summitName ?? candidate.name,
    summitIdentityKey: summitIdentity(candidate),
    routeIdentityKey: candidate.routeIdentityKey ?? null,
    routeName: candidate.routeName ?? null,
    gain: candidate.elevation * candidate.repeats,
    distance: candidate.routeDistance ?? null,
    dataSource: candidate.dataSource ?? null,
    routeDataStatus: candidate.routeDataStatus ?? null,
    relationship: relationship.relationship,
    confidence: relationship.confidence,
    reason: relationship.reason,
    transitionConsideration: "Transitions are considered for scheduling only; they are not route distance or ascent.",
  });
  return assignments;
}
function difficultyLevel(value: string | null | undefined): number {
  const text = (value ?? "").toLowerCase();
  if (text.includes("alpine") || text.includes("expert") || text.includes("extreme")) return 4;
  if (text.includes("hard") || text.includes("challenging") || text.includes("difficult")) return 3;
  if (text.includes("moderate") || text.includes("medium")) return 2;
  if (text.includes("easy") || text.includes("beginner")) return 1;
  return 0;
}

function hazardScore(hill: Hill, profile: TargetMountainProfile): { score: number; compatible: boolean } {
  const hazard = hill.hazardLevel ?? "low";
  const technicalDemand = Math.max(profile.routeDna.scrambling, profile.routeDna.technicalMovement);
  const compatible = hazard === "low" || hazard === "moderate"
    || (hazard === "high" && profile.routeDna.exposure >= 4 && technicalDemand >= 5)
    || (hazard === "severe" && profile.routeDna.exposure >= 7 && technicalDemand >= 7);
  if (!compatible) return { score: 0, compatible: false };
  const overallDemand = Math.max(technicalDemand, profile.routeDna.exposure);
  const ideal = overallDemand >= 8 ? 3
    : overallDemand >= 6 ? 2
      : technicalDemand >= 3 ? 1 : 0;
  const actual = { low: 0, moderate: 1, high: 2, severe: 3 }[hazard];
  return {
    score: clampScore(100 - Math.abs(ideal - actual) * 20),
    compatible,
  };
}

function abilityCompatibility(
  hill: Hill,
  profile: TargetMountainProfile,
  difficultyPreference?: string | null,
): { compatible: boolean; reason?: string } {
  const abilityLevel = difficultyLevel(difficultyPreference);
  if (abilityLevel === 0) return { compatible: true };

  // A difficulty preference is a ranking preference, not proof that the user
  // cannot scramble. When the selected target route itself has strong
  // scrambling/exposure DNA (for example Matterhorn), target-DNA hazard
  // compatibility is the authoritative safety gate so relevant routes such as
  // Tryfan or Crib Goch are not incorrectly discarded as merely "Hard".
  const technicalTarget = Math.max(
    profile.routeDna.scrambling,
    profile.routeDna.technicalMovement,
    profile.routeDna.exposure,
  ) >= 7;
  if (technicalTarget && abilityLevel > 1) return { compatible: true };

  const routeLevel = difficultyLevel(hill.grade);
  const hazardLevel = {
    low: 1,
    moderate: 2,
    high: 3,
    severe: 4,
  }[hill.hazardLevel ?? "low"];
  if (routeLevel > abilityLevel || hazardLevel > abilityLevel) {
    return {
      compatible: false,
      reason: `route exceeds the user's ${difficultyPreference} difficulty preference`,
    };
  }
  return { compatible: true };
}

/** Route facts are deliberately stricter than legacy display Hill facts. */
function routeEvidence(hill: Hill): { eligible: boolean; quality: number; reasons: string[] } {
  const reasons: string[] = [];
  const principal = principalSummitEvidence(hill);
  if (!principal.eligible) reasons.push(principal.reason ?? "not a principal summit");
  const duration = parseEstimatedMinutes(hill.estimatedTime);
  const terrain = hill.surface.trim().toLowerCase();
  const distance = hill.routeDistance;
  if (!Number.isFinite(hill.elevation) || hill.elevation <= 0) reasons.push("missing route ascent");
  if (!Number.isFinite(distance) || distance! <= 0) reasons.push("missing route distance");
  if (!duration || !Number.isFinite(duration) || duration <= 0) reasons.push("unparseable duration");
  if (!difficultyLevel(hill.grade)) reasons.push("missing grade");
  if (!hill.routeType || !terrain || /^(unknown|n\/a|none)$/.test(terrain)) reasons.push("missing terrain or route type");
  const density = Number.isFinite(distance) && distance! > 0 ? hill.elevation / distance! : 0;
  const summit = hill.summitElevationASL;
  const substantial = hill.elevation >= 200 || density >= 55;
  const nonHill = hill.routeType !== "hill";
  const mountainTerrain = /\b(mountain|fell|ridge|rock|scrambl|scree|boulder)\b/.test(terrain);
  // Names are display data, not evidence of a summit objective.
  const corroboratedMountainObjective = substantial
    && mountainTerrain
    && (hill.summitIdentityKey != null
      || hill.entityType === "summit" || hill.entityType === "peak" || hill.entityType === "hill");
  // A long low-altitude non-hill route with little climbing density is not made
  // summit-like merely by a large, potentially aggregate ascent figure. For
  // older seeded rows without summit linkage, mountain terrain plus a generic
  // named summit objective may corroborate otherwise complete route facts.
  const legacyStructuredSummit = nonHill && hill.entityType == null
    && hill.summitIdentityKey == null && substantial && mountainTerrain;
  const weakStructured = nonHill
    && (summit == null || summit < 350)
    && density < 55
    && !corroboratedMountainObjective
    && !legacyStructuredSummit;
  if (weakStructured) reasons.push("weak non-summit route evidence");
  // Names are only corroboration: without the structured weak evidence this never rejects a route.
  let quality = (substantial ? 45 : 15) + Math.min(25, Math.round(density / 4));
  if (summit != null && Number.isFinite(summit)) quality += summit >= 900 ? 30 : summit >= 500 ? 20 : summit >= 300 ? 10 : 0;
  if (corroboratedMountainObjective) quality += 15;
  if (!principal.eligible) quality -= 30;
  if (hill.routeType === "hill") quality += 10;
  if (hill.routeDataStatus === "external_route") quality += 5;
  return { eligible: reasons.length === 0, quality: clampScore(quality), reasons };
}
export function isDeterministicCandidateCompatible(hill: Hill, profile: TargetMountainProfile): boolean {
  return routeEvidence(hill).eligible && hazardScore(hill, profile).compatible;
}

function terrainScore(hill: Hill, profile: TargetMountainProfile): number {
  const text = `${hill.surface} ${hill.routeType ?? ""}`.toLowerCase();
  const dna = profile.routeDna;
  let score = 55;
  if (/(rock|scrambl|boulder|ridge)/.test(text)) {
    score += Math.max(dna.scrambling, dna.technicalMovement, dna.ridgeTravel) * 4;
  } else if (/(trail|path|track|grass|gravel)/.test(text)) {
    score += (10 - Math.max(dna.scrambling, dna.technicalMovement)) * 3;
  }
  if (hill.routeType === "circular") score += dna.ridgeTravel * 2;
  if (hill.routeType === "out-and-back") score += dna.sustainedClimbing * 2;
  if (hill.routeType === "hill") score += dna.steepness * 2;
  return clampScore(score);
}

function scoreCandidate(
  hill: Hill,
  profile: TargetMountainProfile,
  difficultyPreference?: string | null,
): RankedCandidateRecord {
  const minutes = parseEstimatedMinutes(hill.estimatedTime) ?? 0;
  const hazard = hazardScore(hill, profile);
  const ability = abilityCompatibility(hill, profile, difficultyPreference);
  const evidence = routeEvidence(hill);
  const components: CandidateScoreComponents = {
    ascentContribution: proximityScore(hill.elevation, profile.totalElevationGain / 4),
    duration: proximityScore(minutes, profile.estimatedDays * 7 * 60 / 4),
    gradeDifficulty: clampScore(100 - Math.abs(difficultyLevel(difficultyPreference || profile.difficulty) - difficultyLevel(hill.grade)) * 28),
    terrainRouteType: terrainScore(hill, profile),
    distance: proximityScore(hill.routeDistance ?? 0, profile.totalDistance / 4),
    hazardCompatibility: hazard.score,
  };
  const score = clampScore(
    components.ascentContribution * 0.27
    + components.duration * 0.17
    + components.gradeDifficulty * 0.20
    + components.terrainRouteType * 0.14
    + components.distance * 0.12
    + components.hazardCompatibility * 0.10,
  );
  return {
    name: hill.name,
    routeIdentityKey: hill.routeIdentityKey,
    score,
    components,
    compatible: hazard.compatible && ability.compatible,
    eligible: evidence.eligible && hazard.compatible && ability.compatible,
    objectiveQuality: evidence.quality,
    rejectionReasons: [
      ...evidence.reasons,
      ...(hazard.compatible ? [] : ["hazard incompatible with target DNA"]),
      ...(ability.reason ? [ability.reason] : []),
    ],
  };
}

function materialiseHill(hill: Hill, repeats: number): Hill {
  return { ...hill, repeats, totalElevation: Math.round(hill.elevation * repeats) };
}

type SelectionState = {
  gain: number;
  choices: Array<{ index: number; repeats: number }>;
  outings: number;
  quality: number;
  distance: number;
  duration: number;
  fit: number;
  score: number;
  identity: string;
};

type SelectionResult = {
  best: SelectionState | undefined;
  runnerUp: SelectionState | undefined;
};

function compareSelectionStates(
  a: SelectionState,
  b: SelectionState,
  target: number,
  targetDistance: number,
  targetMinutes: number,
): number {
  const aBand = a.gain >= target * 0.9 && a.gain <= target * 1.1;
  const bBand = b.gain >= target * 0.9 && b.gain <= target * 1.1;
  if (aBand !== bBand) return aBand ? -1 : 1;
  if (!aBand) {
    return Math.abs(a.gain - target) - Math.abs(b.gain - target)
      || b.quality - a.quality
      || a.outings - b.outings
      || a.identity.localeCompare(b.identity);
  }

  // Once ascent is in band, compactness and mountain objective quality take
  // precedence over marginal arithmetic gains in the lower-priority DNA fit.
  return a.outings - b.outings
    || (a.outings - a.choices.length) - (b.outings - b.choices.length)
    || a.choices.length - b.choices.length
    || b.quality - a.quality
    || Math.abs(a.distance - targetDistance) - Math.abs(b.distance - targetDistance)
    || Math.abs(a.duration - targetMinutes) - Math.abs(b.duration - targetMinutes)
    || b.fit - a.fit
    || b.score - a.score
    || Math.abs(a.gain - target) - Math.abs(b.gain - target)
    || a.identity.localeCompare(b.identity);
}

/** Returns the first material factor that made the winner lexicographically better. */
function selectionReason(
  winner: SelectionState,
  alternative: SelectionState,
  profile: Pick<TargetMountainProfile, "totalElevationGain" | "totalDistance" | "estimatedDays">,
): string {
  const inBand = (state: SelectionState) =>
    state.gain >= profile.totalElevationGain * .9 && state.gain <= profile.totalElevationGain * 1.1;
  if (inBand(winner) !== inBand(alternative)) return "keeps ascent within the 90–110% band";
  if (winner.outings !== alternative.outings) return "uses fewer outings";
  const winnerRepeats = winner.outings - winner.choices.length;
  const alternativeRepeats = alternative.outings - alternative.choices.length;
  if (winnerRepeats !== alternativeRepeats) return "uses fewer repeat outings";
  if (winner.choices.length !== alternative.choices.length) return "uses fewer distinct routes";
  if (winner.quality !== alternative.quality) return "has higher objective quality";
  if (Math.abs(winner.distance - profile.totalDistance) !== Math.abs(alternative.distance - profile.totalDistance)) {
    return "has closer total route distance";
  }
  const targetMinutes = profile.estimatedDays * 7 * 60;
  if (Math.abs(winner.duration - targetMinutes) !== Math.abs(alternative.duration - targetMinutes)) {
    return "has closer total duration";
  }
  if (winner.fit !== alternative.fit) return "has better terrain and hazard DNA fit";
  if (winner.score !== alternative.score) return "has stronger remaining route-fact score";
  return "wins the stable route-identity tie-break";
}
function buildDiverseOptimisationPool<T extends { hill: Hill; record: RankedCandidateRecord }>(
  ranked: T[],
  target: number,
): T[] {
  if (ranked.length <= OPTIMISATION_POOL_SIZE) return ranked;
  const selected = new Set<T>();
  const add = (items: T[], count: number) => {
    items.slice(0, count).forEach(item => selected.add(item));
  };

  add(ranked, 12);
  add([...ranked].sort((a, b) =>
    b.hill.elevation - a.hill.elevation
    || stableHillCompare(a.hill, b.hill)), 8);
  add([...ranked].sort((a, b) =>
    (b.record.objectiveQuality ?? 0) - (a.record.objectiveQuality ?? 0)
    || stableHillCompare(a.hill, b.hill)), 8);
  add([...ranked].sort((a, b) => {
    const relevance = (candidate: T) => Math.min(
      ...[1, 2, 3].map(repeats =>
        Math.abs(candidate.hill.elevation * repeats - target)),
    );
    return relevance(a) - relevance(b)
      || stableHillCompare(a.hill, b.hill);
  }), 8);

  return ranked.filter(item => selected.has(item)).slice(0, OPTIMISATION_POOL_SIZE);
}

function selectBoundedCombination(
  hills: Hill[],
  records: RankedCandidateRecord[],
  profile: Pick<TargetMountainProfile, "totalElevationGain" | "totalDistance" | "estimatedDays">,
): SelectionResult {
  let states: SelectionState[] = [{
    gain: 0,
    choices: [],
    outings: 0,
    quality: 0,
    distance: 0,
    duration: 0,
    fit: 0,
    score: 0,
    identity: "",
  }];

  for (let index = 0; index < hills.length; index++) {
    const expanded = states.flatMap(state => {
      const result = [state];
      if (state.choices.length >= MAX_DISTINCT_ROUTES) return result;

      for (let repeats = 1; repeats <= MAX_REPEATS; repeats++) {
        result.push({
          gain: state.gain + hills[index].elevation * repeats,
          choices: [...state.choices, { index, repeats }],
          outings: state.outings + repeats,
          quality: state.quality
            + (records[index].objectiveQuality ?? 0) * repeats
            - (repeats - 1) * 8,
          distance: state.distance + (hills[index].routeDistance ?? 0) * repeats,
          duration: state.duration
            + (parseEstimatedMinutes(hills[index].estimatedTime) ?? 0) * repeats,
          fit: state.fit
            + (
              records[index].components.terrainRouteType
              + records[index].components.hazardCompatibility
            ) * repeats,
          score: state.score + records[index].score * repeats,
          identity: `${state.identity}|${geographicIdentity(hills[index])}:${repeats}`,
        });
      }
      return result;
    });

    const buckets = new Map<string, SelectionState>();
    for (const state of expanded) {
      const key = `${Math.round(state.gain)}:${state.choices.length}:${state.outings}`;
      const previous = buckets.get(key);
      if (!previous || compareSelectionStates(
        state,
        previous,
        profile.totalElevationGain,
        profile.totalDistance,
        profile.estimatedDays * 7 * 60,
      ) < 0) {
        buckets.set(key, state);
      }
    }
    states = [...buckets.values()]
      .sort((a, b) => compareSelectionStates(
        a,
        b,
        profile.totalElevationGain,
        profile.totalDistance,
        profile.estimatedDays * 7 * 60,
      ))
      .slice(0, 6000);
  }

  const ordered = states
    .filter(state => state.choices.length)
    .sort((a, b) => compareSelectionStates(
      a, b, profile.totalElevationGain, profile.totalDistance, profile.estimatedDays * 7 * 60,
    ));
  return { best: ordered[0], runnerUp: ordered[1] };
}

export function bridgeElevationGap(selectedHills: Hill[], allHills: Hill[], targetGain: number): Hill[] {
  if (targetGain <= 0) return selectedHills;
  const hills = [...selectedHills, ...allHills]
    .filter(hill => normaliseName(hill.name) && hill.elevation > 0)
    .sort(stableHillCompare)
    .filter((hill, index, array) =>
      !array.slice(0, index).some(existing => sameGeographicRoute(existing, hill)))
    .slice(0, OPTIMISATION_POOL_SIZE);
  const records: RankedCandidateRecord[] = hills.map(hill => ({
    name: hill.name,
    score: selectedHills.some(selected => sameGeographicRoute(selected, hill)) ? 100 : 50,
    components: {
      ascentContribution: 0,
      duration: 0,
      gradeDifficulty: 0,
      terrainRouteType: 0,
      distance: 0,
      hazardCompatibility: 0,
    },
    compatible: true,
    objectiveQuality: 50,
  }));
  const result = selectBoundedCombination(
    hills,
    records,
    { totalElevationGain: targetGain, totalDistance: 0, estimatedDays: 1 },
  );
  return (result.best?.choices ?? []).map(choice =>
    materialiseHill(hills[choice.index], choice.repeats));
}

export function matchDeterministicExpedition(
  candidates: Hill[],
  profile: TargetMountainProfile,
  difficultyPreference?: string | null,
): DeterministicExpeditionMatch {
  const scored = candidates
    .filter(hill => Number.isFinite(hill.elevation) && hill.elevation > 0)
    .map(hill => ({
      hill,
      record: scoreCandidate(hill, profile, difficultyPreference),
    }))
    .sort((a, b) =>
      b.record.score - a.record.score || stableHillCompare(a.hill, b.hill));
  const ranked = scored.filter((candidate, index, array) =>
    normaliseName(candidate.hill.name)
    && !array.slice(0, index).some(existing =>
      sameGeographicRoute(existing.hill, candidate.hill)));
  const safe = buildDiverseOptimisationPool(
    ranked.filter(candidate => candidate.record.eligible),
    profile.totalElevationGain,
  );
  const selection = selectBoundedCombination(
    safe.map(candidate => candidate.hill),
    safe.map(candidate => candidate.record),
    profile,
  );
  const selectedHills = (selection.best?.choices ?? []).map(choice =>
    materialiseHill(safe[choice.index].hill, choice.repeats));
  const achievedAscent = selectedHills.reduce(
    (sum, hill) => sum + hill.elevation * hill.repeats,
    0,
  );
  const targetRatio = profile.totalElevationGain > 0
    ? achievedAscent / profile.totalElevationGain
    : 0;
  // The headline match is route-performance only: gain and distance. Route
  // technical fit remains available in ranked candidate components.
  const deterministicScore = clampScore((proximityScore(achievedAscent, profile.totalElevationGain)
    + proximityScore(selection.best?.distance ?? 0, profile.totalDistance)) / 2);
  const warnings: string[] = [];
  if (targetRatio < 0.9) {
    warnings.push(
      `Ascent shortfall: available safe eligible routes reach ${Math.round(targetRatio * 100)}% of target.`,
    );
  } else if (targetRatio > 1.1) {
    warnings.push(
      `Ascent overshoot: closest safe eligible routes reach ${Math.round(targetRatio * 100)}% of target.`,
    );
  }
  if (ranked.some(candidate => !candidate.record.compatible)) {
    warnings.push("Routes with hazards incompatible with the target profile were excluded.");
  }
  if (ranked.some(candidate =>
    candidate.record.compatible && !candidate.record.eligible)) {
    warnings.push(
      "Routes without complete objective route facts or sufficient summit evidence were excluded.",
    );
  }
  const achievedDistance = selection.best?.distance ?? 0;
  const achievedDurationMinutes = selection.best?.duration ?? 0;
  const outingCount = selection.best?.outings ?? 0;
  const distinctRouteCount = selection.best?.choices.length ?? 0;
  const distanceRatio = profile.totalDistance > 0 ? achievedDistance / profile.totalDistance : 0;
  const runnerUp = selection.runnerUp;
  const alternativeRoutes = runnerUp
    ? runnerUp.choices.map(choice => `${safe[choice.index].hill.name}${choice.repeats > 1 ? ` ×${choice.repeats}` : ""}`).join(", ")
    : undefined;
  const alternativeReason = runnerUp && selection.best
    ? selectionReason(selection.best, runnerUp, profile)
    : undefined;

  return {
    rankedCandidates: ranked.map(candidate => candidate.record),
    selectedHills,
    deterministicScore,
    achievedAscent,
    targetRatio,
    warnings,
    matchMethod: DETERMINISTIC_MATCH_METHOD,
    achievedDistance,
    distanceRatio,
    achievedDurationMinutes,
    outingCount,
    distinctRouteCount,
    planSummary:
      `${outingCount} outings, ${Math.round(targetRatio * 100)}% ascent `
      + `and ${Math.round(distanceRatio * 100)}% distance.`,
    strongestAlternative: alternativeRoutes && alternativeReason
      ? `${alternativeRoutes}: ${alternativeReason}`
      : undefined,
    toleranceMode: "normal",
    toleranceLimits: {
      ascent: QUICK_SUMMIT_NORMAL_ASCENT_TOLERANCE,
      distance: QUICK_SUMMIT_NORMAL_DISTANCE_TOLERANCE,
    },
    selectionReason: "Legacy deterministic route optimisation.",
    matchDiagnostics: {
      targetAscent: profile.totalElevationGain,
      plannedAscent: achievedAscent,
      targetDistance: profile.totalDistance,
      plannedDistance: achievedDistance,
      ascentRatio: targetRatio,
      distanceRatio,
      withinNormal: Math.abs(targetRatio - 1) <= QUICK_SUMMIT_NORMAL_ASCENT_TOLERANCE
        && Math.abs(distanceRatio - 1) <= QUICK_SUMMIT_NORMAL_DISTANCE_TOLERANCE,
      withinWidened: Math.abs(targetRatio - 1) <= QUICK_SUMMIT_WIDE_ASCENT_TOLERANCE
        && Math.abs(distanceRatio - 1) <= QUICK_SUMMIT_WIDE_DISTANCE_TOLERANCE,
    },
  };
}

/**
 * Objective-first expedition mode. It searches the fewest distinct, safe
 * genuine summits that match both route ascent and distance; requested days
 * are a maximum rather than a target summit count.
 */
export function matchQuickestHighSummits(
  candidates: Hill[],
  profile: TargetMountainProfile,
  difficultyPreference?: string | null,
): DeterministicExpeditionMatch {
  const scored = candidates
    .filter(hill => Number.isFinite(hill.elevation) && hill.elevation > 0)
    .map(hill => ({ hill, record: scoreCandidate(hill, profile, difficultyPreference) }));
  const ranked = scored.sort((a, b) =>
    (b.hill.summitElevationASL ?? -1) - (a.hill.summitElevationASL ?? -1)
    || (b.hill.summitProminenceM ?? -1) - (a.hill.summitProminenceM ?? -1)
    || b.record.components.terrainRouteType - a.record.components.terrainRouteType
    || a.hill.elevation - b.hill.elevation
    || (a.hill.routeDistance ?? Number.POSITIVE_INFINITY) - (b.hill.routeDistance ?? Number.POSITIVE_INFINITY)
    || stableHillCompare(a.hill, b.hill));
  // Technical targets should not lose a route merely because its catalogue label
  // says Moderate. Explicitly unsafe hazards still fail the safety gate.
  const technicalTarget = Math.max(profile.routeDna.scrambling, profile.routeDna.technicalMovement) >= 7;
  const generallyEligible = ranked.filter(candidate => {
    if (
      candidate.hill.summitProminenceM != null
      && candidate.hill.summitProminenceM < MIN_KNOWN_PRINCIPAL_PROMINENCE_M
    ) {
      candidate.record.eligible = false;
      candidate.record.rejectionReasons = [
        ...(candidate.record.rejectionReasons ?? []),
        `subsidiary top has less than ${MIN_KNOWN_PRINCIPAL_PROMINENCE_M}m known prominence`,
      ];
      return false;
    }
    if (candidate.record.eligible) return true;
    if (!technicalTarget || !candidate.record.compatible) return false;
    const technicalRoute = /(rock|scrambl|boulder|ridge|scree)/i.test(candidate.hill.surface)
      || candidate.hill.routeType === "hill";
    if (technicalRoute && candidate.record.rejectionReasons?.some(reason => reason.includes("difficulty preference"))) {
      candidate.record.eligible = true;
      candidate.record.rejectionReasons = candidate.record.rejectionReasons.filter(reason =>
        !reason.includes("difficulty preference"));
      return true;
    }
    return false;
  });
  const hasTechnicalEvidence = (candidate: typeof ranked[number]) =>
    candidate.hill.hazardLevel === "high"
    || candidate.hill.hazardLevel === "severe"
    || /(scrambl|technical rock|knife-edge)/i.test(candidate.hill.surface);
  const technicalEligible = generallyEligible.filter(hasTechnicalEvidence);
  const eligible = technicalTarget && technicalEligible.length
    ? technicalEligible
    : generallyEligible;
  if (technicalTarget && technicalEligible.length) {
    for (const candidate of generallyEligible) {
      if (hasTechnicalEvidence(candidate)) continue;
      candidate.record.eligible = false;
      candidate.record.rejectionReasons = [
        ...(candidate.record.rejectionReasons ?? []),
        "lacks known technical-route evidence for this strongly technical target",
      ];
    }
  }
  const safeCandidates = eligible.slice(0, OPTIMISATION_POOL_SIZE);
  type QuickCombo = typeof safeCandidates;
  const combos: QuickCombo[] = [];
  const addCombos = (start: number, wanted: number, picked: QuickCombo): void => {
    if (picked.length === wanted) {
      combos.push(picked);
      return;
    }
    for (let i = start; i < safeCandidates.length; i += 1) {
      const candidate = safeCandidates[i];
      if (picked.some(existing => summitIdentity(existing.hill) === summitIdentity(candidate.hill))) continue;
      if (picked.some(existing => validCoordinates(existing.hill) && validCoordinates(candidate.hill)
        && haversineKm(existing.hill, candidate.hill) < PRINCIPAL_SUMMIT_SEPARATION_KM)) continue;
      addCombos(i + 1, wanted, [...picked, candidate]);
    }
  };
  const maxCardinality = Math.min(Math.max(1, profile.estimatedDays), safeCandidates.length);
  for (let cardinality = 1; cardinality <= maxCardinality; cardinality += 1) addCombos(0, cardinality, []);

  const comboFacts = (combo: QuickCombo) => {
    const ascent = combo.reduce((sum, item) => sum + item.hill.elevation, 0);
    const distance = combo.reduce((sum, item) => sum + (item.hill.routeDistance ?? 0), 0);
    const ascentError = profile.totalElevationGain > 0
      ? Math.abs(ascent / profile.totalElevationGain - 1) : Number.POSITIVE_INFINITY;
    const distanceError = profile.totalDistance > 0
      ? Math.abs(distance / profile.totalDistance - 1) : Number.POSITIVE_INFINITY;
    return { ascent, distance, ascentError, distanceError };
  };
  const inTolerance = (combo: QuickCombo, ascentTolerance: number, distanceTolerance: number) => {
    const facts = comboFacts(combo);
    return facts.ascentError <= ascentTolerance && facts.distanceError <= distanceTolerance;
  };
  const sourceRank = (item: QuickCombo[number]) =>
    item.hill.routeDataStatus === "external_route" ? 3
      : item.hill.dataSource === "canonical_verified" ? 2
        : item.hill.routeDataStatus === "terrain_calculated" ? 1 : 0;
  const lexicographicNumbers = (combo: QuickCombo, field: "summitElevationASL" | "summitProminenceM") =>
    combo.map(item => item.hill[field] ?? -1).sort((a, b) => b - a);
  const compareCombos = (a: QuickCombo, b: QuickCombo): number => {
    const af = comboFacts(a); const bf = comboFacts(b);
    const ae = lexicographicNumbers(a, "summitElevationASL");
    const be = lexicographicNumbers(b, "summitElevationASL");
    const combinedElevation = b.reduce((sum, item) => sum + (item.hill.summitElevationASL ?? -1), 0)
      - a.reduce((sum, item) => sum + (item.hill.summitElevationASL ?? -1), 0);
    if (combinedElevation) return combinedElevation;
    for (let i = 0; i < Math.max(ae.length, be.length); i += 1) {
      if ((be[i] ?? -1) !== (ae[i] ?? -1)) return (be[i] ?? -1) - (ae[i] ?? -1);
    }
    const ap = lexicographicNumbers(a, "summitProminenceM");
    const bp = lexicographicNumbers(b, "summitProminenceM");
    const combinedProminence = b.reduce((sum, item) => sum + (item.hill.summitProminenceM ?? -1), 0)
      - a.reduce((sum, item) => sum + (item.hill.summitProminenceM ?? -1), 0);
    if (combinedProminence) return combinedProminence;
    for (let i = 0; i < Math.max(ap.length, bp.length); i += 1) {
      if ((bp[i] ?? -1) !== (ap[i] ?? -1)) return (bp[i] ?? -1) - (ap[i] ?? -1);
    }
    const sourceDifference = b.reduce((sum, item) => sum + sourceRank(item), 0)
      - a.reduce((sum, item) => sum + sourceRank(item), 0);
    return sourceDifference
      || (af.ascentError + af.distanceError) - (bf.ascentError + bf.distanceError)
      || b.reduce((sum, item) => sum + item.record.components.terrainRouteType, 0)
        - a.reduce((sum, item) => sum + item.record.components.terrainRouteType, 0)
      || a.map(item => summitIdentity(item.hill)).sort().join("|")
        .localeCompare(b.map(item => summitIdentity(item.hill)).sort().join("|"));
  };
  // Cardinality is primary only for normal and widened matches. Approximation
  // must genuinely be the closest safe plan, even when that means another day.
  const normal = combos.filter(combo => inTolerance(
    combo, QUICK_SUMMIT_NORMAL_ASCENT_TOLERANCE, QUICK_SUMMIT_NORMAL_DISTANCE_TOLERANCE));
  const wide = combos.filter(combo => inTolerance(
    combo, QUICK_SUMMIT_WIDE_ASCENT_TOLERANCE, QUICK_SUMMIT_WIDE_DISTANCE_TOLERANCE));
  const bestByCardinality = (pool: QuickCombo[]) => pool.length
    ? pool.filter(combo => combo.length === Math.min(...pool.map(item => item.length))).sort(compareCombos)[0]
    : undefined;
  const selected = bestByCardinality(normal) ?? bestByCardinality(wide)
    ?? (combos.length ? combos.sort((a, b) =>
      (comboFacts(a).ascentError + comboFacts(a).distanceError)
      - (comboFacts(b).ascentError + comboFacts(b).distanceError)
      || b.reduce((sum, item) => sum + (item.record.objectiveQuality ?? 0), 0)
        - a.reduce((sum, item) => sum + (item.record.objectiveQuality ?? 0), 0)
      || compareCombos(a, b))[0] : undefined);
  // Keep diagnostics useful: candidates suppressed by the principal/subsidiary
  // rule are explicitly explained even though they passed the initial safety
  // and route-evidence gates.
  if (selected) {
    for (const candidate of eligible) {
      if (selected.some(item => summitIdentity(item.hill) === summitIdentity(candidate.hill))) continue;
      const principal = selected.find(item => validCoordinates(item.hill) && validCoordinates(candidate.hill)
        && haversineKm(item.hill, candidate.hill) < PRINCIPAL_SUMMIT_SEPARATION_KM);
      if (principal) {
        candidate.record.eligible = false;
        candidate.record.rejectionReasons = candidate.record.rejectionReasons ?? [];
        candidate.record.rejectionReasons.push(
          `subsidiary peak is within ${PRINCIPAL_SUMMIT_SEPARATION_KM} km of selected principal summit ${principal.hill.name}`,
        );
      }
    }
  }
  const selectedHills = (selected ?? []).map(candidate => materialiseHill(candidate.hill, 1));
  const achievedAscent = selectedHills.reduce((sum, hill) => sum + hill.elevation, 0);
  const achievedDistance = selectedHills.reduce((sum, hill) => sum + (hill.routeDistance ?? 0), 0);
  const achievedDurationMinutes = selectedHills.reduce(
    (sum, hill) => sum + (parseEstimatedMinutes(hill.estimatedTime) ?? 0), 0);
  const targetRatio = profile.totalElevationGain > 0 ? achievedAscent / profile.totalElevationGain : 0;
  const distanceRatio = profile.totalDistance > 0 ? achievedDistance / profile.totalDistance : 0;
  const withinNormal = Math.abs(targetRatio - 1) <= QUICK_SUMMIT_NORMAL_ASCENT_TOLERANCE
    && Math.abs(distanceRatio - 1) <= QUICK_SUMMIT_NORMAL_DISTANCE_TOLERANCE;
  const withinWidened = Math.abs(targetRatio - 1) <= QUICK_SUMMIT_WIDE_ASCENT_TOLERANCE
    && Math.abs(distanceRatio - 1) <= QUICK_SUMMIT_WIDE_DISTANCE_TOLERANCE;
  const toleranceMode: DeterministicExpeditionMatch["toleranceMode"] = !selected
    ? "none" : normal.includes(selected) ? "normal" : wide.includes(selected) ? "widened" : "approximate";
  const warnings: string[] = [];
  const selectedCount = selected?.length ?? 0;
  if (toleranceMode === "widened") warnings.push("No normal-tolerance match; selected the minimum-cardinality widened-tolerance match.");
  if (toleranceMode === "approximate") warnings.push("No widened-tolerance match; tolerance could not be met, so the closest safe quality approximation was selected.");
  if (selectedCount < profile.estimatedDays) {
    warnings.push(`Selected ${selectedCount} distinct summit${selectedCount === 1 ? "" : "s"} within the ${profile.estimatedDays}-day maximum; no filler summits were added.`);
  }
  if (!selected) warnings.push("No eligible safe summit candidates were available; no route was matched.");
  const selectionReason = toleranceMode === "normal"
    ? "Minimum-cardinality combination within normal ascent and distance tolerances."
    : toleranceMode === "widened"
      ? "Minimum-cardinality combination within widened ascent and distance tolerances."
      : toleranceMode === "approximate"
        ? "Closest safe two-axis approximation; no widened-tolerance combination was available."
        : "No eligible safe summit combination was available.";
  return {
    rankedCandidates: ranked.map(candidate => candidate.record),
    selectedHills,
    // Do not let summit altitude, technical labels, or day count inflate the
    // primary numerical match score.
    deterministicScore: clampScore((proximityScore(achievedAscent, profile.totalElevationGain)
      + proximityScore(achievedDistance, profile.totalDistance)) / 2),
    achievedAscent,
    targetRatio,
    warnings,
    matchMethod: QUICKEST_HIGH_SUMMITS_MATCH_METHOD,
    achievedDistance,
    distanceRatio,
    achievedDurationMinutes,
    outingCount: selectedCount,
    distinctRouteCount: selectedCount,
    planSummary: `${selectedCount} distinct principal summits; ${Math.round(targetRatio * 100)}% of target ascent, `
      + `${Math.round(distanceRatio * 100)}% of target distance (${toleranceMode} tolerance).`,
    toleranceMode,
    toleranceLimits: {
      ascent: toleranceMode === "normal"
        ? QUICK_SUMMIT_NORMAL_ASCENT_TOLERANCE
        : toleranceMode === "none" ? 0 : QUICK_SUMMIT_WIDE_ASCENT_TOLERANCE,
      distance: toleranceMode === "normal"
        ? QUICK_SUMMIT_NORMAL_DISTANCE_TOLERANCE
        : toleranceMode === "none" ? 0 : QUICK_SUMMIT_WIDE_DISTANCE_TOLERANCE,
    },
    selectionReason,
    matchDiagnostics: {
      targetAscent: profile.totalElevationGain,
      plannedAscent: achievedAscent,
      targetDistance: profile.totalDistance,
      plannedDistance: achievedDistance,
      ascentRatio: targetRatio,
      distanceRatio,
      withinNormal,
      withinWidened,
    },
  };
}

export function isDeterministicTargetFeasible(
  candidates: Hill[],
  profile: TargetMountainProfile,
  difficultyPreference?: string | null,
): boolean {
  const match = matchDeterministicExpedition(candidates, profile, difficultyPreference);
  return match.selectedHills.length > 0
    && match.targetRatio >= 0.9
    && match.targetRatio <= 1.1;
}