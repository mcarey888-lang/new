export const READINESS_MODEL_VERSION = "readiness-v2.0.0" as const;

export type ReadinessState = "available" | "degraded" | "unavailable";
export type ReadinessConfidence = "high" | "medium" | "low" | "none";
export type ReadinessSource = "canonical_gps" | "tracked_gps" | "manual" | "indoor";
export type ReadinessDimensionName =
  | "endurance"
  | "elevationCapacity"
  | "consistency"
  | "mountainExperience";

export type ReadinessTarget = {
  mountainId?: string | null;
  routeId?: string | null;
  distanceKm?: number | null;
  ascentM?: number | null;
  expectedDurationMinutes?: number | null;
  terrainTags?: readonly string[];
  summitDate?: string | null;
  /** Field-level provenance supplied by the deterministic target resolver. */
  provenance?: ReadinessTargetProvenance;
};

export type ReadinessTargetFactName =
  | "mountainId"
  | "routeId"
  | "distanceKm"
  | "ascentM"
  | "expectedDurationMinutes"
  | "terrainTags"
  | "summitDate";

export type ReadinessTargetFactProvenance = {
  source: "sde_verified" | "approved_route" | "goal_metadata" | "unknown";
  confidence: "verified" | "approved" | "fallback" | "unknown";
};

export type ReadinessTargetProvenance = Partial<
  Record<ReadinessTargetFactName, ReadinessTargetFactProvenance>
>;

export type ReadinessEvidence = {
  evidenceId: string;
  ownerId: string;
  source: ReadinessSource;
  completedAt: string;
  distanceKm?: number | null;
  ascentM?: number | null;
  durationMinutes?: number | null;
  /** A planned item is never completed evidence. */
  completed?: boolean;
  /** Expedition GPS can count physically; simulated Expedition evidence cannot. */
  simulated?: boolean;
  expedition?: boolean;
  gpsQuality?: "verified" | "trusted" | "untrusted" | null;
  terrainTags?: readonly string[];
  canonicalActivityId?: string | null;
  stableSourceId?: string | null;
  revision?: number | null;
  syncState?: "synced" | "queued" | "local_only" | null;
};

export type ReadinessPlanContext = {
  dueSessions?: number;
  completedDueSessions?: number;
  plannedSessionCount?: number;
};

export type ReadinessInput = {
  ownerId: string;
  asOf: string;
  target: ReadinessTarget;
  evidence: readonly ReadinessEvidence[];
  plan?: ReadinessPlanContext;
};

export type ReadinessDimension = {
  score: number | null;
  available: boolean;
  contribution: number;
  evidenceIds: readonly string[];
  explanation: string;
};

export type ReadinessResult = {
  modelVersion: typeof READINESS_MODEL_VERSION;
  state: ReadinessState;
  overallScore: number | null;
  dimensions: Record<ReadinessDimensionName, ReadinessDimension>;
  confidence: ReadinessConfidence;
  includedEvidenceIds: readonly string[];
  excludedEvidence: ReadonlyArray<{ evidenceId: string; reason: string }>;
  strengths: readonly ReadinessDimensionName[];
  gaps: readonly ReadinessDimensionName[];
  explanations: readonly string[];
  missing: readonly string[];
  limitations: readonly string[];
  asOf: string;
};

const WEIGHTS: Record<ReadinessDimensionName, number> = {
  endurance: 0.3,
  elevationCapacity: 0.3,
  consistency: 0.25,
  mountainExperience: 0.15,
};
const ORDER: ReadinessDimensionName[] = [
  "endurance",
  "elevationCapacity",
  "consistency",
  "mountainExperience",
];
const LABELS: Record<ReadinessDimensionName, string> = {
  endurance: "Endurance",
  elevationCapacity: "Elevation Capacity",
  consistency: "Consistency",
  mountainExperience: "Mountain Experience",
};
const DAY = 86_400_000;

function finitePositive(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}
function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}
function round(value: number): number {
  return Math.round(clamp(value));
}
function ageDays(asOf: number, completedAt: string): number | null {
  const time = Date.parse(completedAt);
  if (!Number.isFinite(time) || time > asOf) return null;
  return Math.max(0, Math.floor((asOf - time) / DAY));
}
function recency(age: number): number {
  return Math.exp((-Math.log(2) * age) / 42);
}
function sourceRank(source: ReadinessSource): number {
  return source === "canonical_gps" ? 4 : source === "tracked_gps" ? 3 : source === "manual" ? 2 : 1;
}
function keyFor(item: ReadinessEvidence): string {
  return item.canonicalActivityId
    ? `canonical:${item.canonicalActivityId}`
    : `${item.source}:${item.stableSourceId ?? item.evidenceId}`;
}
function scoreRatio(value: number | null | undefined, demand: number | null | undefined): number | null {
  return finitePositive(value) && finitePositive(demand) ? clamp(value / demand, 0, 1) : null;
}
function multiplier(item: ReadinessEvidence): number {
  return item.source === "manual" ? 0.7 : item.source === "indoor" ? 0.7 : 1;
}
function validEvidence(
  input: ReadinessInput,
): { included: ReadinessEvidence[]; excluded: Array<{ evidenceId: string; reason: string }> } {
  const excluded: Array<{ evidenceId: string; reason: string }> = [];
  const candidates: Array<ReadinessEvidence & { age: number; rank: number }> = [];
  for (const item of input.evidence) {
    if (!item.evidenceId || item.ownerId !== input.ownerId) {
      excluded.push({ evidenceId: item.evidenceId, reason: "owner_or_identity_mismatch" });
      continue;
    }
    if (item.completed === false) {
      excluded.push({ evidenceId: item.evidenceId, reason: "planned_or_incomplete" });
      continue;
    }
    if (item.simulated) {
      excluded.push({ evidenceId: item.evidenceId, reason: "simulated_expedition_evidence" });
      continue;
    }
    if ((item.source === "canonical_gps" || item.source === "tracked_gps") && item.gpsQuality === "untrusted") {
      excluded.push({ evidenceId: item.evidenceId, reason: "untrusted_gps" });
      continue;
    }
    const age = ageDays(Date.parse(input.asOf), item.completedAt);
    if (age === null) {
      excluded.push({ evidenceId: item.evidenceId, reason: "invalid_or_future_timestamp" });
      continue;
    }
    if (age > 180) {
      excluded.push({ evidenceId: item.evidenceId, reason: "evidence_older_than_180_days" });
      continue;
    }
    const numeric = [item.distanceKm, item.ascentM, item.durationMinutes].filter(
      (value): value is number => value !== null && value !== undefined,
    );
    if (numeric.some((value) => !Number.isFinite(value) || value < 0)) {
      excluded.push({ evidenceId: item.evidenceId, reason: "invalid_metric" });
      continue;
    }
    candidates.push({ ...item, age, rank: sourceRank(item.source) });
  }
  candidates.sort((a, b) =>
    b.rank - a.rank ||
    (b.syncState === "synced" ? 1 : 0) - (a.syncState === "synced" ? 1 : 0) ||
    (b.revision ?? 0) - (a.revision ?? 0) ||
    b.completedAt.localeCompare(a.completedAt) ||
    a.evidenceId.localeCompare(b.evidenceId),
  );
  const seen = new Set<string>();
  const included: ReadinessEvidence[] = [];
  for (const item of candidates) {
    const key = keyFor(item);
    if (seen.has(key)) {
      excluded.push({ evidenceId: item.evidenceId, reason: "duplicate_activity_evidence" });
    } else {
      seen.add(key);
      included.push(item);
    }
  }
  return { included, excluded };
}

function dimension(
  score: number | null,
  ids: string[],
  explanation: string,
): ReadinessDimension {
  return {
    score: score === null ? null : round(score),
    available: score !== null,
    contribution: score === null ? 0 : round(score),
    evidenceIds: ids,
    explanation,
  };
}

export function evaluateReadiness(input: ReadinessInput): ReadinessResult {
  const asOf = Date.parse(input.asOf);
  const target = input.target;
  const { included, excluded } = validEvidence(input);
  const recent = included.map((item) => ({ item, age: ageDays(asOf, item.completedAt) ?? 0, r: recency(ageDays(asOf, item.completedAt) ?? 0) }));
  const missing: string[] = [];
  if (!target.mountainId && !target.routeId) missing.push("stable_target_identity");
  if (!finitePositive(target.distanceKm)) missing.push("target_distance_km");
  if (!finitePositive(target.ascentM)) missing.push("target_ascent_m");
  if (!included.length) {
    const empty = dimension(null, [], "No eligible completed evidence is available.");
    return {
      modelVersion: READINESS_MODEL_VERSION, state: "unavailable", overallScore: null,
      dimensions: { endurance: empty, elevationCapacity: empty, consistency: empty, mountainExperience: empty },
      confidence: "none", includedEvidenceIds: [], excludedEvidence: excluded, strengths: [], gaps: [],
      explanations: ["Readiness is unavailable until a completed eligible activity is recorded."],
      missing, limitations: ["Readiness is a training heuristic, not a safety or summit guarantee."], asOf: input.asOf,
    };
  }
  const gpsOrCanonical = recent.filter(({ item }) => item.source === "canonical_gps" || item.source === "tracked_gps");
  const enduranceValues = recent.filter(({ item }) => finitePositive(item.distanceKm) || finitePositive(item.durationMinutes));
  const enduranceParts: number[] = [];
  if (finitePositive(target.distanceKm)) {
    const bestDistance = Math.max(...enduranceValues.map(({ item, r }) => (item.distanceKm ?? 0) / target.distanceKm! * r * multiplier(item)), 0);
    enduranceParts.push(clamp(bestDistance));
  }
  if (finitePositive(target.expectedDurationMinutes)) {
    const bestDuration = Math.max(...enduranceValues.map(({ item, r }) => (item.durationMinutes ?? 0) / target.expectedDurationMinutes! * r * multiplier(item)), 0);
    enduranceParts.push(clamp(bestDuration));
  }
  if (finitePositive(target.distanceKm)) {
    const cumulative = recent.filter(({ item }) => (ageDays(asOf, item.completedAt) ?? 999) <= 42)
      .reduce((sum, { item, r }) => sum + (item.distanceKm ?? 0) * r * multiplier(item), 0);
    enduranceParts.push(clamp(cumulative / (target.distanceKm * 2.5)));
  }
  const enduranceScore = enduranceParts.length ? enduranceParts.reduce((a, b) => a + b, 0) / enduranceParts.length * 100 : null;
  const enduranceIds = enduranceValues.map(({ item }) => item.evidenceId);

  const elevationParts: number[] = [];
  if (finitePositive(target.ascentM)) {
    const best = Math.max(...recent.map(({ item, r }) => (item.ascentM ?? 0) / target.ascentM! * r * (item.source === "manual" || item.source === "indoor" ? 0.5 : 1)), 0);
    elevationParts.push(clamp(best));
    const rolling = recent.filter(({ item }) => (ageDays(asOf, item.completedAt) ?? 999) <= 42)
      .reduce((sum, { item, r }) => sum + (item.ascentM ?? 0) * r * (item.source === "manual" || item.source === "indoor" ? 0.5 : 1), 0);
    elevationParts.push(clamp(rolling / (target.ascentM * 2.5)));
    const recentAscent = recent.filter(({ item }) => (ageDays(asOf, item.completedAt) ?? 999) <= 21)
      .reduce((sum, { item, r }) => sum + (item.ascentM ?? 0) * r, 0);
    elevationParts.push(clamp(recentAscent / target.ascentM));
  }
  const elevationScore = elevationParts.length ? elevationParts.reduce((a, b) => a + b, 0) / elevationParts.length * 100 : null;

  const activeWeeks = new Set(recent.filter(({ age }) => age <= 42).map(({ item }) => {
    const time = Date.parse(item.completedAt);
    return Math.floor((asOf - time) / (7 * DAY));
  })).size;
  const due = input.plan?.dueSessions ?? Math.max(1, Math.min(12, activeWeeks * 2));
  const completedDue = input.plan ? Math.min(due, Math.max(0, input.plan.completedDueSessions ?? 0)) : recent.filter(({ age }) => age <= 42).length;
  const lastAge = Math.min(...recent.map(({ age }) => age));
  const recencyScore = lastAge <= 3 ? 100 : lastAge <= 7 ? 80 : lastAge <= 14 ? 55 : lastAge <= 28 ? 25 : 0;
  const consistencyScore = ((activeWeeks / 6) * 0.4 + (completedDue / Math.max(1, due)) * 0.4 + recencyScore / 100 * 0.2) * 100;

  const outdoor = recent.filter(({ item }) => item.source === "canonical_gps" || item.source === "tracked_gps");
  const tagged = outdoor.filter(({ item }) => (item.terrainTags?.length ?? 0) > 0);
  const sustained = outdoor.filter(({ item }) =>
    scoreRatio(item.ascentM, target.ascentM)! >= 0.4 || scoreRatio(item.distanceKm, target.distanceKm)! >= 0.4,
  );
  const mountainScore = (
    Math.min(1, outdoor.length / 4) * 0.45 +
    Math.min(1, tagged.length / 3) * 0.35 +
    Math.min(1, sustained.length / 2) * 0.2
  ) * 100;
  const dimensions: Record<ReadinessDimensionName, ReadinessDimension> = {
    endurance: dimension(enduranceScore, enduranceIds, "Based on recent eligible distance and duration evidence."),
    elevationCapacity: dimension(elevationScore, recent.filter(({ item }) => finitePositive(item.ascentM)).map(({ item }) => item.evidenceId), "Based on recent eligible recorded ascent, not lifetime Elevation Bank totals."),
    consistency: dimension(consistencyScore, recent.filter(({ age }) => age <= 42).map(({ item }) => item.evidenceId), "Based on active weeks, completed due sessions, and recency."),
    mountainExperience: dimension(mountainScore, outdoor.map(({ item }) => item.evidenceId), "Based only on real outdoor hill or mountain evidence; it does not infer technical competence."),
  };
  const available = ORDER.filter((name) => dimensions[name].score !== null);
  const weightTotal = available.reduce((sum, name) => sum + WEIGHTS[name], 0);
  const raw = available.reduce((sum, name) => sum + (dimensions[name].score ?? 0) * WEIGHTS[name], 0) / weightTotal;
  const ages = recent.map(({ age }) => age);
  const staleOnly = ages.every((age) => age >= 90);
  const manualOnly = included.every(({ source }) => source === "manual" || source === "indoor");
  const cap = Math.min(
    included.length <= 2 ? 55 : 100,
    new Set(recent.filter(({ age }) => age <= 42).map(({ item }) => Math.floor((asOf - Date.parse(item.completedAt)) / (7 * DAY)))).size < 3 ? 70 : 100,
    staleOnly ? 60 : 100,
    missing.includes("target_distance_km") || missing.includes("target_ascent_m") ? 75 : 100,
    manualOnly ? 65 : 100,
  );
  const overallScore = round(Math.min(cap, raw));
  const state: ReadinessState = missing.length || available.length < 3 ? "degraded" : "available";
  const confidence: ReadinessConfidence =
    included.length >= 7 && new Set(recent.filter(({ age }) => age <= 42).map(({ item }) => Math.floor((asOf - Date.parse(item.completedAt)) / (7 * DAY)))).size >= 3 && gpsOrCanonical.length >= included.length / 2
      ? "high" : included.length >= 3 ? "medium" : "low";
  const sorted = [...available].sort((a, b) => (dimensions[b].score ?? 0) - (dimensions[a].score ?? 0) || ORDER.indexOf(a) - ORDER.indexOf(b));
  const strengths = sorted.filter((name) => (dimensions[name].score ?? 0) >= 70);
  const gaps = [...available].sort((a, b) => (100 - (dimensions[b].score ?? 0)) - (100 - (dimensions[a].score ?? 0)) || ORDER.indexOf(a) - ORDER.indexOf(b));
  const explanations = [
    `Readiness is ${overallScore}/100 from ${included.length} eligible completed activit${included.length === 1 ? "y" : "ies"}.`,
    ...missing.map((item) => `Missing verified ${item.replaceAll("_", " ")}; the result is degraded.`),
  ];
  return {
    modelVersion: READINESS_MODEL_VERSION, state, overallScore, dimensions, confidence,
    includedEvidenceIds: included.map((item) => item.evidenceId), excludedEvidence: excluded,
    strengths, gaps, explanations,
    missing,
    limitations: ["Readiness is a training heuristic, not medical advice or a guarantee of health, safety, weather, technical competence, or summit success."],
    asOf: input.asOf,
  };
}

export function readinessService(input: ReadinessInput): ReadinessResult {
  return evaluateReadiness(input);
}