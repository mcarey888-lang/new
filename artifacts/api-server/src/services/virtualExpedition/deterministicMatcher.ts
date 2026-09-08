import type { Hill } from "../../routes/hills-unified.js";
import type { TargetMountainProfile } from "../../routes/virtual-expedition.js";

export const DETERMINISTIC_MATCH_METHOD = "deterministic_route_facts_v1" as const;

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
}

export interface DeterministicExpeditionMatch {
  rankedCandidates: RankedCandidateRecord[];
  selectedHills: Hill[];
  deterministicScore: number;
  achievedAscent: number;
  targetRatio: number;
  warnings: string[];
  matchMethod: typeof DETERMINISTIC_MATCH_METHOD;
}

const COMPONENT_WEIGHTS: Record<keyof CandidateScoreComponents, number> = {
  ascentContribution: 0.27,
  duration: 0.17,
  gradeDifficulty: 0.20,
  terrainRouteType: 0.14,
  distance: 0.12,
  hazardCompatibility: 0.10,
};

const OPTIMISATION_POOL_SIZE = 36;
const SAME_ROUTE_DISTANCE_KM = 2;

function normaliseName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function validCoordinates(hill: Hill): hill is Hill & { lat: number; lng: number } {
  return typeof hill.lat === "number" && Number.isFinite(hill.lat)
    && hill.lat >= -90 && hill.lat <= 90
    && typeof hill.lng === "number" && Number.isFinite(hill.lng)
    && hill.lng >= -180 && hill.lng <= 180;
}

function haversineKm(a: Hill & { lat: number; lng: number }, b: Hill & { lat: number; lng: number }): number {
  const radians = Math.PI / 180;
  const deltaLat = (b.lat - a.lat) * radians;
  const deltaLng = (b.lng - a.lng) * radians;
  const sinLat = Math.sin(deltaLat / 2);
  const sinLng = Math.sin(deltaLng / 2);
  const value = sinLat * sinLat
    + Math.cos(a.lat * radians) * Math.cos(b.lat * radians) * sinLng * sinLng;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function sameGeographicRoute(a: Hill, b: Hill): boolean {
  if (a.routeIdentityKey && b.routeIdentityKey) {
    return a.routeIdentityKey === b.routeIdentityKey;
  }
  if (normaliseName(a.name) !== normaliseName(b.name)) return false;
  if (!validCoordinates(a) || !validCoordinates(b)) return true;
  return haversineKm(a, b) <= SAME_ROUTE_DISTANCE_KM;
}

function geographicIdentity(hill: Hill): string {
  if (hill.routeIdentityKey) return hill.routeIdentityKey;
  const name = normaliseName(hill.name);
  return validCoordinates(hill) ? `${name}@${hill.lat},${hill.lng}` : `${name}@unknown`;
}

function stableHillCompare(a: Hill, b: Hill): number {
  const normalised = normaliseName(a.name).localeCompare(normaliseName(b.name), "en");
  if (normalised) return normalised;
  const name = a.name.localeCompare(b.name, "en");
  if (name) return name;
  const aHasCoordinates = validCoordinates(a);
  const bHasCoordinates = validCoordinates(b);
  if (aHasCoordinates !== bHasCoordinates) return aHasCoordinates ? -1 : 1;
  if (aHasCoordinates && bHasCoordinates) {
    const coordinateOrder = a.lat - b.lat || a.lng - b.lng;
    if (coordinateOrder) return coordinateOrder;
  }
  return b.elevation - a.elevation
    || (a.routeDistance ?? Number.POSITIVE_INFINITY) - (b.routeDistance ?? Number.POSITIVE_INFINITY)
    || a.surface.localeCompare(b.surface, "en");
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function proximityScore(actual: number, desired: number): number {
  if (!Number.isFinite(actual) || actual <= 0 || desired <= 0) return 0;
  return clampScore(100 * Math.min(actual, desired) / Math.max(actual, desired));
}

function parseEstimatedMinutes(value: string | null | undefined): number | null {
  if (!value) return null;
  const range = value.match(/(\d+(?:\.\d+)?)\s*[–-]\s*(\d+(?:\.\d+)?)\s*h/i);
  if (range) return ((Number(range[1]) + Number(range[2])) / 2) * 60;
  const hours = value.match(/(\d+(?:\.\d+)?)\s*h/i);
  if (hours) return Number(hours[1]) * 60;
  const minutes = value.match(/(\d+)\s*min/i);
  return minutes ? Number(minutes[1]) : null;
}

function difficultyLevel(value: string | null | undefined): number {
  const text = (value ?? "").toLowerCase();
  if (text.includes("alpine") || text.includes("expert") || text.includes("extreme")) return 4;
  if (text.includes("hard") || text.includes("challenging") || text.includes("difficult")) return 3;
  if (text.includes("moderate") || text.includes("medium")) return 2;
  if (text.includes("easy") || text.includes("beginner")) return 1;
  return 2;
}

function hazardScore(hill: Hill, profile: TargetMountainProfile): { score: number; compatible: boolean } {
  const hazard = hill.hazardLevel ?? "low";
  const technicalDemand = Math.max(profile.routeDna.scrambling, profile.routeDna.technicalMovement);
  const compatible = hazard === "low"
    || hazard === "moderate"
    || (hazard === "high" && profile.routeDna.exposure >= 4 && technicalDemand >= 5)
    || (hazard === "severe" && profile.routeDna.exposure >= 7 && technicalDemand >= 7);
  if (!compatible) return { score: 0, compatible: false };
  const overallDemand = Math.max(technicalDemand, profile.routeDna.exposure);
  const ideal = overallDemand >= 8 ? 3 : overallDemand >= 6 ? 2 : overallDemand >= 3 ? 1 : 0;
  const actual = { low: 0, moderate: 1, high: 2, severe: 3 }[hazard];
  return { score: clampScore(100 - Math.abs(ideal - actual) * 20), compatible: true };
}

export function isDeterministicCandidateCompatible(
  hill: Hill,
  profile: TargetMountainProfile,
): boolean {
  return Number.isFinite(hill.elevation)
    && hill.elevation > 0
    && hazardScore(hill, profile).compatible;
}

function terrainScore(hill: Hill, profile: TargetMountainProfile): number {
  const description = `${hill.surface} ${hill.routeType ?? ""}`.toLowerCase();
  const dna = profile.routeDna;
  let score = 55;
  if (/(rock|scrambl|boulder|ridge)/.test(description)) {
    score += Math.max(dna.scrambling, dna.technicalMovement, dna.ridgeTravel) * 4;
  } else if (/(trail|path|track|grass|gravel)/.test(description)) {
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
  // A useful expedition normally contains roughly four distinct ascents.
  const desiredAscent = profile.totalElevationGain / 4;
  const desiredDistance = profile.totalDistance / 4;
  const desiredMinutes = profile.estimatedDays * 7 * 60 / 4;
  const estimatedMinutes = parseEstimatedMinutes(hill.estimatedTime)
    ?? Math.max(30, hill.elevation / 300 * 60);
  const desiredDifficulty = difficultyLevel(difficultyPreference || profile.difficulty);
  const actualDifficulty = difficultyLevel(hill.grade);
  const hazard = hazardScore(hill, profile);
  const routeDistance = hill.routeDistance;

  const components: CandidateScoreComponents = {
    ascentContribution: proximityScore(hill.elevation, desiredAscent),
    duration: proximityScore(estimatedMinutes, desiredMinutes),
    gradeDifficulty: clampScore(100 - Math.abs(desiredDifficulty - actualDifficulty) * 28),
    terrainRouteType: terrainScore(hill, profile),
    distance: routeDistance == null ? 0 : proximityScore(routeDistance, desiredDistance),
    hazardCompatibility: hazard.score,
  };
  const score = clampScore(
    Object.entries(COMPONENT_WEIGHTS).reduce(
      (sum, [key, weight]) => sum + components[key as keyof CandidateScoreComponents] * weight,
      0,
    ),
  );
  return {
    name: hill.name,
    routeIdentityKey: hill.routeIdentityKey,
    score,
    components,
    compatible: hazard.compatible,
  };
}

function materialiseHill(hill: Hill, repeats: number): Hill {
  return {
    ...hill,
    repeats,
    totalElevation: Math.round(hill.elevation * repeats),
  };
}

type SelectionState = {
  gain: number;
  choices: Array<{ index: number; repeats: number }>;
  quality: number;
};

function averageQuality(state: SelectionState): number {
  return state.choices.length ? state.quality / state.choices.length : 0;
}

function planSizePenalty(state: SelectionState): number {
  const count = state.choices.length;
  if (count >= 2 && count <= 5) return 0;
  return count < 2 ? 2 - count : count - 5;
}

function compareSelectionStates(a: SelectionState, b: SelectionState, target: number): number {
  const lower = target * 0.9;
  const upper = target * 1.1;
  const aInBand = a.gain >= lower && a.gain <= upper;
  const bInBand = b.gain >= lower && b.gain <= upper;
  if (aInBand !== bInBand) return aInBand ? -1 : 1;
  if (aInBand && bInBand) {
    return planSizePenalty(a) - planSizePenalty(b)
      || averageQuality(b) - averageQuality(a)
      || a.choices.length - b.choices.length
      || Math.abs(a.gain - target) - Math.abs(b.gain - target);
  }
  return Math.abs(a.gain - target) - Math.abs(b.gain - target)
    || averageQuality(b) - averageQuality(a)
    || planSizePenalty(a) - planSizePenalty(b);
}

function buildDiverseOptimisationPool<T extends { hill: Hill }>(
  rankedSafe: T[],
  target: number,
): T[] {
  if (rankedSafe.length <= OPTIMISATION_POOL_SIZE) return rankedSafe;
  const rankedIndex = new Map(rankedSafe.map((candidate, index) => [candidate, index]));
  const selected = new Set<T>();
  const add = (candidates: T[], count: number) => {
    for (const candidate of candidates) {
      if (selected.size >= OPTIMISATION_POOL_SIZE || count <= 0) break;
      if (!selected.has(candidate)) {
        selected.add(candidate);
        count--;
      }
    }
  };

  // Balance quality, ascent extremes, and direct target relevance. The latter
  // protects routes whose one-to-three-repeat ascent nearly solves the target.
  add(rankedSafe, 12);
  add([...rankedSafe].sort((a, b) =>
    b.hill.elevation - a.hill.elevation
    || rankedIndex.get(a)! - rankedIndex.get(b)!), 8);
  add([...rankedSafe].sort((a, b) =>
    a.hill.elevation - b.hill.elevation
    || rankedIndex.get(a)! - rankedIndex.get(b)!), 8);
  add([...rankedSafe].sort((a, b) => {
    const relevance = (candidate: T) => Math.min(
      ...[1, 2, 3].map(repeats => Math.abs(candidate.hill.elevation * repeats - target)),
    );
    return relevance(a) - relevance(b)
      || rankedIndex.get(a)! - rankedIndex.get(b)!;
  }), 8);
  add(rankedSafe, OPTIMISATION_POOL_SIZE - selected.size);

  // Preserve global ranking order for deterministic DP tie resolution.
  return rankedSafe.filter(candidate => selected.has(candidate));
}

function selectBoundedCombination(hills: Hill[], scores: number[], target: number): Hill[] {
  if (!hills.length || target <= 0) return [];
  let states: SelectionState[] = [{ gain: 0, choices: [], quality: 0 }];

  for (let index = 0; index < hills.length; index++) {
    const expanded: SelectionState[] = [];
    for (const state of states) {
      expanded.push(state);
      if (state.choices.length >= 8) continue;
      for (let repeats = 1; repeats <= 3; repeats++) {
        expanded.push({
          gain: state.gain + hills[index].elevation * repeats,
          choices: [...state.choices, { index, repeats }],
          quality: state.quality + scores[index] - (repeats - 1) * 6,
        });
      }
    }

    const bestByBucket = new Map<string, SelectionState>();
    for (const state of expanded) {
      const key = `${Math.round(state.gain)}:${state.choices.length}`;
      const previous = bestByBucket.get(key);
      if (!previous || state.quality > previous.quality) bestByBucket.set(key, state);
    }
    states = [...bestByBucket.values()]
      .sort((a, b) => compareSelectionStates(a, b, target))
      .slice(0, 6000);
  }

  const nonEmpty = states.filter(state => state.choices.length > 0);
  nonEmpty.sort((a, b) => compareSelectionStates(a, b, target));
  return (nonEmpty[0]?.choices ?? []).map(choice =>
    materialiseHill(hills[choice.index], choice.repeats));
}

/**
 * Deterministically closes an ascent gap using only supplied route facts.
 * Geographically duplicate routes are removed and every returned hill is
 * capped at three laps.
 */
export function bridgeElevationGap(
  selectedHills: Hill[],
  allHills: Hill[],
  targetGain: number,
): Hill[] {
  if (targetGain <= 0) return selectedHills;
  const ordered = [...selectedHills, ...allHills]
    .filter(hill => normaliseName(hill.name) && hill.elevation > 0)
    .sort((a, b) => {
      const aSelected = selectedHills.some(selected => sameGeographicRoute(selected, a));
      const bSelected = selectedHills.some(selected => sameGeographicRoute(selected, b));
      return Number(bSelected) - Number(aSelected) || stableHillCompare(a, b);
    });
  const hills: Hill[] = [];
  for (const hill of ordered) {
    if (!hills.some(existing => sameGeographicRoute(existing, hill))) hills.push(hill);
  }
  const preferenceScores = hills.map(hill =>
    selectedHills.some(selected => sameGeographicRoute(selected, hill)) ? 100 : 50);
  return selectBoundedCombination(hills.slice(0, OPTIMISATION_POOL_SIZE), preferenceScores.slice(0, OPTIMISATION_POOL_SIZE), targetGain);
}

export function matchDeterministicExpedition(
  candidates: Hill[],
  profile: TargetMountainProfile,
  difficultyPreference?: string | null,
): DeterministicExpeditionMatch {
  const scored = candidates
    .filter(hill => Number.isFinite(hill.elevation) && hill.elevation > 0)
    .map(hill => ({ hill, record: scoreCandidate(hill, profile, difficultyPreference) }))
    .sort((a, b) => b.record.score - a.record.score || stableHillCompare(a.hill, b.hill));

  const ranked: typeof scored = [];
  for (const candidate of scored) {
    if (normaliseName(candidate.hill.name)
      && !ranked.some(existing => sameGeographicRoute(existing.hill, candidate.hill))) {
      ranked.push(candidate);
    }
  }
  const safe = buildDiverseOptimisationPool(
    ranked.filter(candidate => candidate.record.compatible),
    profile.totalElevationGain,
  );
  const selectedHills = selectBoundedCombination(
    safe.map(candidate => candidate.hill),
    safe.map(candidate => candidate.record.score),
    profile.totalElevationGain,
  );
  const achievedAscent = selectedHills.reduce(
    (sum, hill) => sum + hill.elevation * hill.repeats,
    0,
  );
  const targetRatio = profile.totalElevationGain > 0
    ? achievedAscent / profile.totalElevationGain
    : 0;
  const scoreByIdentity = new Map(ranked.map(candidate => [
    geographicIdentity(candidate.hill),
    candidate.record.score,
  ]));
  const totalRepeats = selectedHills.reduce((sum, hill) => sum + hill.repeats, 0);
  const deterministicScore = totalRepeats
    ? clampScore(selectedHills.reduce(
      (sum, hill) => sum + (scoreByIdentity.get(geographicIdentity(hill)) ?? 0) * hill.repeats,
      0,
    ) / totalRepeats)
    : 0;
  const warnings: string[] = [];
  if (targetRatio < 0.9) {
    warnings.push(`Ascent shortfall: available safe routes reach ${Math.round(targetRatio * 100)}% of target.`);
  } else if (targetRatio > 1.1) {
    warnings.push(`Ascent overshoot: closest safe routes reach ${Math.round(targetRatio * 100)}% of target.`);
  }
  if (ranked.some(candidate => !candidate.record.compatible)) {
    warnings.push("Routes with hazards incompatible with the target profile were excluded.");
  }

  return {
    rankedCandidates: ranked.map(candidate => candidate.record),
    selectedHills,
    deterministicScore,
    achievedAscent,
    targetRatio,
    warnings,
    matchMethod: DETERMINISTIC_MATCH_METHOD,
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
