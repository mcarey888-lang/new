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
  matchMethod: typeof DETERMINISTIC_MATCH_METHOD;
  /** Additive aggregate route facts used by deterministic explanations. */
  achievedDistance: number;
  distanceRatio: number;
  achievedDurationMinutes: number;
  outingCount: number;
  distinctRouteCount: number;
  planSummary?: string;
  strongestAlternative?: string;
}

const OPTIMISATION_POOL_SIZE = 36;
const SAME_ROUTE_DISTANCE_KM = 2;
const MAX_DISTINCT_ROUTES = 8;
const MAX_REPEATS = 3;

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

function haversineKm(a: Hill & { lat: number; lng: number }, b: Hill & { lat: number; lng: number }): number {
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

function stableHillCompare(a: Hill, b: Hill): number {
  return normaliseName(a.name).localeCompare(normaliseName(b.name), "en")
    || a.name.localeCompare(b.name, "en")
    || geographicIdentity(a).localeCompare(geographicIdentity(b), "en")
    || b.elevation - a.elevation;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
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

/** Route facts are deliberately stricter than legacy display Hill facts. */
function routeEvidence(hill: Hill): { eligible: boolean; quality: number; reasons: string[] } {
  const reasons: string[] = [];
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
  const namedSummitObjective =
    /\b(mount|mountain|fell|fells|pike|peak|summit|crag|tor|ben|beinn|carn|ridge)\b/i
      .test(hill.name);
  const genericLowLevelObjective =
    /\b(way|valley|visitor|sightseeing|heritage|ramble|coast path|accessible|stroll|nature reserve|picnic|wood trail)\b/i
      .test(hill.name);
  const corroboratedMountainObjective = substantial
    && mountainTerrain
    && namedSummitObjective
    && !genericLowLevelObjective;
  // A long low-altitude non-hill route with little climbing density is not made
  // summit-like merely by a large, potentially aggregate ascent figure. For
  // older seeded rows without summit linkage, mountain terrain plus a generic
  // named summit objective may corroborate otherwise complete route facts.
  const weakStructured = nonHill
    && (summit == null || summit < 350)
    && density < 55
    && !corroboratedMountainObjective;
  if (weakStructured) reasons.push("weak non-summit route evidence");
  // Names are only corroboration: without the structured weak evidence this never rejects a route.
  if (weakStructured && genericLowLevelObjective) {
    reasons.push("weak objective name corroboration");
  }
  let quality = (substantial ? 45 : 15) + Math.min(25, Math.round(density / 4));
  if (summit != null && Number.isFinite(summit)) quality += summit >= 900 ? 30 : summit >= 500 ? 20 : summit >= 300 ? 10 : 0;
  if (corroboratedMountainObjective) quality += 15;
  if (genericLowLevelObjective) quality -= 20;
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
    compatible: hazard.compatible,
    eligible: evidence.eligible && hazard.compatible, objectiveQuality: evidence.quality,
    rejectionReasons: [
      ...evidence.reasons,
      ...(hazard.compatible ? [] : ["hazard incompatible with target DNA"]),
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
  const totalRepeats = selectedHills.reduce(
    (sum, hill) => sum + hill.repeats,
    0,
  );
  const scoreMap = new Map(ranked.map(candidate => [
    geographicIdentity(candidate.hill),
    candidate.record.score,
  ]));
  const deterministicScore = totalRepeats
    ? clampScore(selectedHills.reduce(
      (sum, hill) =>
        sum + (scoreMap.get(geographicIdentity(hill)) ?? 0) * hill.repeats,
      0,
    ) / totalRepeats)
    : 0;
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